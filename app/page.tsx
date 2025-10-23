'use client';

import DocumentList from '@/components/DocumentList';
import DocumentVerificationModal from '@/components/DocumentVerificationModal';
import HeaderBar from '@/components/HeaderBar';

import PageProcessor from '@/components/PageProcessor';
import { KosuTable, NPTTable, RebutTable } from '@/components/TableRenderers';
import axios from 'axios';
import { Clock, FileText, Loader2, Plus, Upload, Users } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

type DocumentType = 'Rebut' | 'NPT' | 'Kosu';

// Custom hook to check if we're on the client side
const useIsClient = () => {
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    return isClient;
};

interface PageData {
    pageNumber: number;
    fileName: string;
    mimeType: string;
    imageDataUrl: string;
    bufferSize: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    extractedData: any;
    error: string | null;
}

interface ImageData {
    fileName: string;
    mimeType: string;
    imageDataUrl: string;
    fileSize: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    extractedData: any;
    error: string | null;
    retryCount?: number;
}

interface UploadingFile {
    id: string;
    name: string;
    progress: number;
    status: 'uploading' | 'completed' | 'error';
    message: string;
    totalPages?: number;
    currentPage?: number;
    pageResults?: Array<{
        pageNumber: number;
        status: 'pending' | 'processing' | 'completed' | 'error';
        message: string;
    }>;
}

interface Document {
    id: string;
    data: any;
    metadata: {
        filename: string;
        document_type: string;
        processed_at: string;
        file_size: number;
    };
    remark: string;
    imageUrl?: string;
    created_at?: string;
    updated_at?: string;
    updated_by_user?: boolean;
    verification_status?:
        | 'original'
        | 'draft'
        | 'pending_verification'
        | 'verified'
        | 'revision_needed';
    history?: Array<{
        field: string;
        old_value: any;
        new_value: any;
        updated_at: string;
        updated_by: string;
    }>;
}

export default function HomePage() {
    const isClient = useIsClient();
    const [selectedType, setSelectedType] = useState<DocumentType>('Rebut');
    const [documents, setDocuments] = useState<any[]>([]);
    const [documentCounts, setDocumentCounts] = useState({
        Rebut: 0,
        NPT: 0,
        Kosu: 0,
    });
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(
        null,
    );
    const [verifyingDocument, setVerifyingDocument] = useState<Document | null>(
        null,
    );
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingCell, setEditingCell] = useState<{
        doc: string;
        field: string;
    } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [renamingDocument, setRenamingDocument] = useState<{
        id: string;
        currentName: string;
    } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [processingPages, setProcessingPages] = useState<PageData[]>([]);
    const [isProcessingPDF, setIsProcessingPDF] = useState(false);
    // Removed separate image processing states - now using unified backend processing
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Utility function to check localStorage usage
    const checkStorageUsage = useCallback(() => {
        try {
            let totalSize = 0;
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }
            const usageKB = Math.round(totalSize / 1024);
            const usageMB = (usageKB / 1024).toFixed(2);

            if (usageKB > 3000) {
                // Warn if over 3MB
                console.warn(
                    `⚠️ localStorage usage: ${usageKB}KB (${usageMB}MB) - approaching quota limit`,
                );
            } else {
                console.log(
                    `💾 localStorage usage: ${usageKB}KB (${usageMB}MB)`,
                );
            }

            return { totalKB: usageKB, totalMB: parseFloat(usageMB) };
        } catch (error) {
            console.error('Error checking storage usage:', error);
            return { totalKB: 0, totalMB: 0 };
        }
    }, []);

    // Enhanced cleanup function to prevent stuck states
    const cleanupStuckSessions = useCallback(() => {
        try {
            if (typeof window === 'undefined') return;

            // Check for old batch sessions
            const batchSession = JSON.parse(
                localStorage.getItem('batch-session') || '{}',
            );
            if (batchSession.sessionId) {
                const sessionAge = Date.now() - (batchSession.timestamp || 0);
                if (sessionAge > 3600000) {
                    // 1 hour - keep sessions longer for reload persistence
                    console.log(
                        '🗑️ Clearing expired batch session:',
                        batchSession.sessionId,
                    );
                    localStorage.removeItem('batch-session');
                }
            }

            // Clean up processing state if too old
            const processingState = localStorage.getItem('processing-state');
            if (processingState) {
                const parsed = JSON.parse(processingState);
                const stateAge = Date.now() - (parsed.timestamp || 0);
                if (stateAge > 3600000) {
                    // 1 hour - keep processing state longer for reload persistence
                    console.log('🗑️ Clearing expired processing state');
                    localStorage.removeItem('processing-state');
                }
            }
        } catch (error) {
            console.error('Error cleaning up stuck sessions:', error);
            // If there's any error, clear everything to be safe
            if (typeof window !== 'undefined') {
                localStorage.removeItem('batch-session');
                localStorage.removeItem('processing-state');
                localStorage.removeItem('processing-state-minimal');
            }
        }
    }, []);

    // Force reset all processing states - use when completely stuck
    const forceResetAllStates = useCallback(() => {
        console.log(
            '🚨 FORCE RESET: Clearing all states and stopping all processing',
        );

        // Stop any processing
        setIsProcessingPDF(false);
        setProcessingPages([]);
        setUploadingFiles([]);

        // Clear all storage
        if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
        }

        // Force page reload to ensure clean state
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }, []); // Load persisted processing state on mount
    const loadPersistedProcessingState = useCallback(() => {
        try {
            // First clean up any stuck sessions
            cleanupStuckSessions();

            const savedState = localStorage.getItem('processing-state');
            if (savedState) {
                const {
                    pages,
                    isProcessing,
                    documentType: savedType,
                } = JSON.parse(savedState);

                // Only restore if there are incomplete pages and it matches current document type
                const incompletePages = pages.filter(
                    (p: any) => p.status !== 'completed',
                );
                if (incompletePages.length > 0 && savedType === selectedType) {
                    console.log(
                        `📦 Restoring processing state: ${incompletePages.length} incomplete pages (image data will be regenerated)`,
                    );

                    // Convert lightweight format back to full PageData format
                    const restoredPages: PageData[] = pages.map((p: any) => ({
                        pageNumber: p.pageNumber,
                        fileName: p.fileName,
                        mimeType: p.mimeType,
                        imageDataUrl: '', // Will be empty - needs to be regenerated
                        bufferSize: p.bufferSize,
                        status: p.status,
                        extractedData: p.extractedData,
                        error: p.error,
                    }));

                    setProcessingPages(restoredPages);
                    setIsProcessingPDF(isProcessing);

                    // Auto-resume processing if there are pending/error pages
                    const pendingPages = restoredPages.filter(
                        p => p.status === 'pending' || p.status === 'error',
                    );
                    if (pendingPages.length > 0 && !isProcessing) {
                        console.log(
                            `🔄 Auto-resuming processing for ${pendingPages.length} pending pages`,
                        );
                        setTimeout(() => {
                            setIsProcessingPDF(true);
                            // The PageProcessor component will handle the actual processing
                        }, 1000);
                    }
                } else {
                    // Clear completed or mismatched processing state
                    localStorage.removeItem('processing-state');
                }
            }

            // Also check for minimal fallback state
            const minimalState = localStorage.getItem(
                'processing-state-minimal',
            );
            if (minimalState && !savedState) {
                const {
                    pageCount,
                    isProcessing,
                    documentType: savedType,
                    originalFileName,
                } = JSON.parse(minimalState);
                if (savedType === selectedType && isProcessing) {
                    console.log(
                        `📦 Found minimal processing state for ${pageCount} pages - will need to restart PDF splitting`,
                    );
                    // Note: Don't auto-restore minimal state as it lacks page data
                    localStorage.removeItem('processing-state-minimal');
                }
            }
        } catch (error) {
            console.error('Error loading persisted processing state:', error);
            localStorage.removeItem('processing-state');
            localStorage.removeItem('processing-state-minimal');
        }
    }, [selectedType, cleanupStuckSessions]);

    // Enhanced session storage for PDF data persistence
    const savePDFSession = useCallback(
        (file: File, pages: PageData[], documentType: string) => {
            try {
                // Check if we're in the browser (client-side)
                if (typeof window === 'undefined') {
                    return;
                }

                // Save PDF file info for resume capability
                const sessionData = {
                    originalFileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    documentType,
                    pageCount: pages.length,
                    timestamp: Date.now(),
                    sessionId: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                };

                sessionStorage.setItem(
                    'pdf-session',
                    JSON.stringify(sessionData),
                );
                console.log(
                    `💾 Saved PDF session: ${file.name} (${pages.length} pages)`,
                );
            } catch (error) {
                console.error('Error saving PDF session:', error);
            }
        },
        [],
    );

    // Load PDF session on reload
    const loadPDFSession = useCallback(() => {
        try {
            // Check if we're in the browser (client-side)
            if (typeof window === 'undefined') {
                return null;
            }

            const sessionData = sessionStorage.getItem('pdf-session');
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                console.log(
                    `📦 Found PDF session: ${parsed.originalFileName} (${parsed.pageCount} pages)`,
                );
                return parsed;
            }
        } catch (error) {
            console.error('Error loading PDF session:', error);
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('pdf-session');
            }
        }
        return null;
    }, []);

    // Save processing state to localStorage (without heavy image data)
    const saveProcessingState = useCallback(
        (pages: PageData[], isProcessing: boolean, fileName: string) => {
            try {
                // Create lightweight version without base64 image data
                const lightweightPages = pages.map(page => ({
                    pageNumber: page.pageNumber,
                    fileName: page.fileName,
                    mimeType: page.mimeType,
                    bufferSize: page.bufferSize,
                    status: page.status,
                    extractedData: page.extractedData,
                    error: page.error,
                    // Exclude imageDataUrl to save space
                    hasImageData: !!page.imageDataUrl,
                }));

                const state = {
                    pages: lightweightPages,
                    isProcessing,
                    documentType: selectedType,
                    originalFileName: fileName,
                    timestamp: Date.now(),
                };

                // Calculate approximate size before storing
                const stateString = JSON.stringify(state);
                const sizeKB = Math.round(stateString.length / 1024);

                if (sizeKB > 4000) {
                    // If larger than 4MB, don't store
                    console.warn(
                        `⚠️ Processing state too large (${sizeKB}KB) - skipping localStorage save`,
                    );
                    return;
                }

                localStorage.setItem('processing-state', stateString);
                console.log(
                    `💾 Saved processing state (${sizeKB}KB) for ${lightweightPages.length} pages`,
                );

                // Check total storage usage after saving
                setTimeout(() => checkStorageUsage(), 100);
            } catch (error) {
                console.error('Error saving processing state:', error);
                // Fallback: try to clear old data and save minimal state
                try {
                    localStorage.removeItem('processing-state');
                    const minimalState = {
                        pageCount: pages.length,
                        isProcessing,
                        documentType: selectedType,
                        originalFileName: fileName,
                        timestamp: Date.now(),
                    };
                    localStorage.setItem(
                        'processing-state-minimal',
                        JSON.stringify(minimalState),
                    );
                    console.log(
                        '💾 Saved minimal processing state as fallback',
                    );
                } catch (fallbackError) {
                    console.error(
                        'Failed to save even minimal state:',
                        fallbackError,
                    );
                }
            }
        },
        [selectedType],
    );

    // Removed image processing state persistence - now using unified backend processing

    const loadDocumentCounts = useCallback(async () => {
        try {
            const counts: Record<DocumentType, number> = {
                Rebut: 0,
                NPT: 0,
                Kosu: 0,
            };

            // Load counts for each document type
            for (const type of ['Rebut', 'NPT', 'Kosu'] as DocumentType[]) {
                try {
                    const response = await axios.get(
                        `/api/documents?type=${type}`,
                    );
                    counts[type] = response.data.length;
                } catch (error) {
                    console.error(
                        `Error loading ${type} documents count:`,
                        error,
                    );
                    counts[type] = 0;
                }
            }

            setDocumentCounts(counts);
        } catch (error) {
            console.error('Error loading document counts:', error);
        }
    }, []);

    // Add throttling to prevent excessive API calls
    const lastLoadTime = useRef<number>(0);
    const loadDocuments = useCallback(async () => {
        // Throttle: Don't load more than once every 2 seconds
        const now = Date.now();
        if (now - lastLoadTime.current < 2000) {
            console.log('🔄 Throttling loadDocuments call - too frequent');
            return;
        }
        lastLoadTime.current = now;

        setIsLoading(true);
        try {
            const response = await axios.get(
                `/api/documents?type=${selectedType}`,
            );
            setDocuments(response.data);

            // Also update the count for current type
            setDocumentCounts(prev => ({
                ...prev,
                [selectedType]: response.data.length,
            }));
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedType]);

    // Load documents and counts when component mounts or type changes
    React.useEffect(() => {
        // Clean up only stuck sessions, but preserve valid ones for reload persistence
        cleanupStuckSessions(); // This now uses 1-hour timeout instead of clearing everything

        loadDocuments();
        loadDocumentCounts(); // Load all counts
        loadPersistedProcessingState(); // Re-enabled for reload persistence
        loadPDFSession(); // Re-enabled for PDF session persistence
    }, [
        loadDocuments,
        loadDocumentCounts,
        loadPersistedProcessingState,
        loadPDFSession,
        cleanupStuckSessions,
    ]);

    // Save processing state when user is about to leave/refresh
    React.useEffect(() => {
        const handleBeforeUnload = () => {
            if (processingPages.length > 0 && isProcessingPDF) {
                const originalFileName =
                    processingPages[0]?.fileName?.split('-page-')[0] ||
                    'document';
                saveProcessingState(
                    processingPages,
                    isProcessingPDF,
                    originalFileName,
                );
            }

            // Removed image processing state saving - using unified backend processing
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () =>
            window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [processingPages, isProcessingPDF, saveProcessingState]);

    // Removed image processing state saving - now using unified backend processing

    // Update page title to show processing status
    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isProcessingPDF && processingPages.length > 0) {
            const completed = processingPages.filter(
                p => p.status === 'completed',
            ).length;
            const total = processingPages.length;
            const percentage = Math.round((completed / total) * 100);
            document.title = `Processing... ${percentage}% (${completed}/${total}) - OneTech`;
        } else {
            document.title = 'OneTech - Document Extractor';
        }
    }, [isProcessingPDF, processingPages]);

    // Enhanced session recovery with cross-tab synchronization
    React.useEffect(() => {
        // Only run on client-side after initial mount
        if (typeof window === 'undefined') return;

        const timer = setTimeout(() => {
            try {
                // TEMPORARILY DISABLED - loadPersistedProcessingState();
                const pdfSession = loadPDFSession();

                if (pdfSession) {
                    console.log(
                        `🔍 Checking for recoverable PDF session: ${pdfSession.originalFileName}`,
                    );
                }
            } catch (error) {
                console.error('Error during session recovery:', error);
            }
        }, 100);

        // Listen for storage changes across tabs
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'processing-state' && e.newValue) {
                try {
                    const newState = JSON.parse(e.newValue);
                    console.log(
                        '🔄 Processing state updated in another tab, syncing...',
                    );
                    if (newState.pages) {
                        setProcessingPages(newState.pages);
                        setIsProcessingPDF(newState.isProcessing);
                        setSelectedType(newState.documentType);
                    }
                } catch (error) {
                    console.error('Error syncing cross-tab state:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []); // Empty dependency array - only run once on mount

    const handleImageUpload = useCallback(
        async (file: File) => {
            setIsProcessingPDF(true); // Use PDF processing state for consistency
            setProcessingPages([]);

            try {
                // Use the same backend batch processing API for images
                const formData = new FormData();
                formData.append('file', file);
                formData.append('documentType', selectedType);

                console.log(
                    'Starting backend processing for image:',
                    file.name,
                );
                const batchResponse = await axios.post(
                    '/api/start-batch-processing',
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                );

                if (batchResponse.data.success) {
                    const sessionId = batchResponse.data.sessionId;
                    const status = batchResponse.data.status;

                    console.log(
                        `Backend batch processing started for image with session: ${sessionId}`,
                    );

                    // Create page data structure for single image
                    const pages: PageData[] = [
                        {
                            pageNumber: 1,
                            fileName: file.name,
                            mimeType: file.type,
                            imageDataUrl: '', // Will be filled by backend
                            bufferSize: file.size,
                            status: 'pending',
                            extractedData: null,
                            error: null,
                        },
                    ];

                    setProcessingPages(pages);

                    // Store session info for PageProcessor polling
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(
                            'batch-session',
                            JSON.stringify({
                                sessionId: sessionId,
                                timestamp: Date.now(),
                                originalFileName: file.name,
                                documentType: selectedType,
                                totalPages: 1,
                            }),
                        );
                    }

                    // Save processing state
                    saveProcessingState(pages, true, file.name);
                } else {
                    throw new Error(
                        batchResponse.data.error ||
                            'Failed to start backend processing',
                    );
                }
            } catch (error) {
                console.error('Error starting image processing:', error);
                setIsProcessingPDF(false);
                alert(
                    error instanceof Error
                        ? error.message
                        : 'Failed to start processing',
                );
            }
        },
        [selectedType, saveProcessingState],
    );

    // Removed image processing handlers - now using unified backend processing

    const handleRegularFileUpload = useCallback(
        async (file: File) => {
            const fileId = `${Date.now()}-${Math.random()}`;
            const newFile: UploadingFile = {
                id: fileId,
                name: file.name,
                progress: 0,
                status: 'uploading',
                message: 'Preparing upload...',
            };

            setUploadingFiles(prev => [...prev, newFile]);

            // Use the old extraction logic for non-PDF files
            const progressMessages = [
                { progress: 5, message: 'Analyzing file...' },
                { progress: 30, message: 'Extracting data...' },
                { progress: 60, message: 'Processing content...' },
                { progress: 90, message: 'Saving to database...' },
            ];

            const updateFileProgress = (
                progress: number,
                message: string,
                status: UploadingFile['status'] = 'uploading',
            ) => {
                setUploadingFiles(prev =>
                    prev.map(f =>
                        f.id === fileId
                            ? { ...f, progress, message, status }
                            : f,
                    ),
                );
            };

            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                if (currentProgress < 20) {
                    currentProgress += Math.random() * 5 + 2;
                    const currentMessage = progressMessages
                        .reverse()
                        .find(msg => currentProgress >= msg.progress);
                    if (currentMessage) {
                        updateFileProgress(
                            Math.round(currentProgress),
                            currentMessage.message,
                        );
                    }
                }
            }, 1500);

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('documentType', selectedType);

                const extractResponse = await axios.post(
                    '/api/extract',
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        // No timeout - rely on backend response
                    },
                );

                clearInterval(progressInterval);
                const extractorBody = extractResponse.data;

                if (
                    extractResponse.status >= 200 &&
                    extractResponse.status < 300
                ) {
                    updateFileProgress(
                        100,
                        'Successfully processed!',
                        'completed',
                    );
                    setTimeout(async () => {
                        await loadDocuments();
                        await loadDocumentCounts();
                    }, 1000);
                } else {
                    const errMsg = extractorBody?.error || 'Processing failed';
                    throw new Error(errMsg);
                }
            } catch (error) {
                clearInterval(progressInterval);
                console.error('Error processing file:', error);

                let errorMessage = 'Upload failed';
                if (axios.isAxiosError(error)) {
                    const status = error.response?.status;
                    if (status === 413) errorMessage = 'File too large';
                    else if (status === 400)
                        errorMessage =
                            error.response?.data?.error ||
                            'Invalid file format';
                    else if (status && status >= 500)
                        errorMessage = 'Server processing error';
                    else if (error.code === 'ECONNABORTED')
                        errorMessage = 'Processing failed - connection aborted';
                } else if (error instanceof Error) {
                    errorMessage = error.message;
                }

                updateFileProgress(0, errorMessage, 'error');
            }

            setTimeout(() => {
                setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
            }, 5000);
        },
        [selectedType, loadDocuments, loadDocumentCounts],
    );

    const handlePDFUpload = useCallback(
        async (file: File) => {
            setIsProcessingPDF(true);
            setProcessingPages([]);

            try {
                // Step 1: Start backend batch processing
                const formData = new FormData();
                formData.append('file', file);
                formData.append('documentType', selectedType);

                console.log(
                    'Starting backend batch processing for PDF:',
                    file.name,
                );
                const batchResponse = await axios.post(
                    '/api/start-batch-processing',
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    },
                );

                if (batchResponse.data.success) {
                    const sessionId = batchResponse.data.sessionId;
                    const status = batchResponse.data.status;

                    console.log(
                        `Backend batch processing started with session: ${sessionId}`,
                    );

                    // Create page data structure from the status for the UI
                    const pages: PageData[] = Array.from(
                        { length: status.total_pages },
                        (_, index) => ({
                            pageNumber: index + 1,
                            fileName: `${file.name.split('.')[0]}-page-${index + 1}.jpg`,
                            mimeType: 'image/jpeg',
                            imageDataUrl: '', // Will be populated later if needed
                            bufferSize: 0,
                            status: 'pending' as const,
                            extractedData: null,
                            error: null,
                        }),
                    );

                    setProcessingPages(pages);

                    // Store session ID for polling
                    const pdfSession = {
                        sessionId,
                        originalFileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        documentType: selectedType,
                        pageCount: status.total_pages,
                        timestamp: Date.now(),
                    };

                    if (typeof window !== 'undefined') {
                        localStorage.setItem(
                            'batch-session',
                            JSON.stringify(pdfSession),
                        );
                    }

                    // Save processing state
                    saveProcessingState(pages, true, file.name);
                } else {
                    throw new Error(
                        batchResponse.data.error ||
                            'Failed to start batch processing',
                    );
                }
            } catch (error) {
                console.error('Error starting batch processing:', error);
                setIsProcessingPDF(false);
                // Fall back to old approach for this file
                await handleRegularFileUpload(file);
            }
        },
        [selectedType, handleRegularFileUpload, saveProcessingState],
    );

    const handleSingleFileUpload = useCallback(
        async (file: File) => {
            // Check if it's a PDF file to use the new approach
            const isPDF =
                file.type === 'application/pdf' ||
                file.name.toLowerCase().endsWith('.pdf');

            // Check if it's an image file to use visualization
            const isImage = file.type.startsWith('image/');

            if (isPDF) {
                await handlePDFUpload(file);
            } else if (isImage) {
                await handleImageUpload(file);
            } else {
                await handleRegularFileUpload(file);
            }
        },
        [handlePDFUpload, handleImageUpload, handleRegularFileUpload],
    );

    const handleMultipleFilesUpload = useCallback(
        (files: File[]) => {
            setIsUploading(true);

            // Small delay to show the preparing state before processing begins
            setTimeout(() => {
                files.forEach(file => {
                    handleSingleFileUpload(file);
                });
                setIsUploading(false);
            }, 500);
        },
        [handleSingleFileUpload],
    );

    // Callback functions for PageProcessor
    const handlePageComplete = useCallback(
        async (pageNumber: number, data: any) => {
            console.log(`Page ${pageNumber} completed with data:`, data);

            // Immediately add the completed document to the list
            if (data && data.id) {
                setDocuments(prev => {
                    // Check if document already exists to prevent duplicates
                    const exists = prev.some(doc => doc.id === data.id);
                    if (exists) {
                        return prev;
                    }
                    // Add new document at the top of the list
                    return [data, ...prev];
                });

                // Update document counts as pages complete
                setDocumentCounts(prev => ({
                    ...prev,
                    [selectedType]: prev[selectedType] + 1,
                }));
            }

            // Update processing state and save to localStorage
            setProcessingPages(prev => {
                const updated = prev.map(p =>
                    p.pageNumber === pageNumber
                        ? {
                              ...p,
                              status: 'completed' as const,
                              extractedData: data,
                          }
                        : p,
                );

                // Save updated state to localStorage
                const originalFileName =
                    prev[0]?.fileName?.split('-page-')[0] || 'document';
                saveProcessingState(updated, true, originalFileName);

                return updated;
            });
        },
        [selectedType, saveProcessingState],
    );

    const handleAllComplete = useCallback(() => {
        console.log('All pages processing complete');
        setIsProcessingPDF(false);
        setProcessingPages([]);

        // Clear processing state from localStorage
        localStorage.removeItem('processing-state');

        // No need to refresh documents - they're already updated via onPageComplete
        console.log(
            'Processing complete - documents already updated via page completion callbacks',
        );
    }, []);

    const handleCellEdit = async (
        docId: string,
        field: string,
        oldValue: any,
        newValue: any,
    ) => {
        try {
            const response = await axios.put('/api/documents', {
                id: docId,
                type: selectedType,
                field,
                oldValue,
                newValue,
            });

            if (response.status >= 200 && response.status < 300) {
                // Update the documents list
                await loadDocuments();

                // If the edited document is currently selected in the modal, update it immediately
                if (selectedDocument && selectedDocument.id === docId) {
                    // Create a deep copy of the selected document to avoid mutation
                    const updatedDocument = JSON.parse(
                        JSON.stringify(selectedDocument),
                    );

                    // Update the field in the document copy
                    const fieldPath = field.split('.');
                    let current = updatedDocument;

                    // Navigate to the parent of the field to be updated
                    for (let i = 0; i < fieldPath.length - 1; i++) {
                        if (current[fieldPath[i]] === undefined) {
                            current[fieldPath[i]] = {};
                        }
                        current = current[fieldPath[i]];
                    }

                    // Update the final field
                    current[fieldPath[fieldPath.length - 1]] = newValue;

                    // Update the updated_at timestamp
                    updatedDocument.updated_at = new Date().toISOString();
                    updatedDocument.updated_by_user = true;

                    // Add to history if it doesn't exist
                    if (!updatedDocument.history) {
                        updatedDocument.history = [];
                    }
                    updatedDocument.history.unshift({
                        field,
                        old_value: oldValue,
                        new_value: newValue,
                        updated_at: new Date().toISOString(),
                        updated_by: 'user',
                    });

                    // Update the selected document state
                    setSelectedDocument(updatedDocument);
                }

                setEditingCell(null);
            }
        } catch (error) {
            console.error('Error updating document:', error);
        }
    };

    const startEdit = (docId: string, field: string, currentValue: any) => {
        setEditingCell({ doc: docId, field });
        setEditValue(currentValue?.toString() || '');
    };

    const saveEdit = async () => {
        if (!editingCell) return;

        const doc = documents.find(d => d.id === editingCell.doc);
        if (!doc) return;

        const fieldPath = editingCell.field.split('.');
        // allow dynamic indexing when walking nested fields
        let currentValue: any = doc;
        for (const path of fieldPath) {
            currentValue = currentValue[path];
        }

        await handleCellEdit(
            editingCell.doc,
            editingCell.field,
            currentValue,
            editValue,
        );
    };

    const handleDeleteDocument = async (id: string, type: string) => {
        try {
            const response = await axios.delete(
                `/api/documents?id=${id}&type=${type}`,
            );

            if (response.status >= 200 && response.status < 300) {
                // Refresh both documents list and document counts
                await loadDocuments();
                await loadDocumentCounts();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error; // Re-throw to let the component handle the error
        }
    };

    const handleRenameDocument = async (id: string, newFilename: string) => {
        try {
            const response = await axios.put('/api/documents', {
                id,
                type: selectedType,
                field: 'metadata.filename',
                oldValue: renamingDocument?.currentName,
                newValue: newFilename,
            });

            if (response.status >= 200 && response.status < 300) {
                await loadDocuments();
                setRenamingDocument(null);
                setRenameValue('');
            }
        } catch (error) {
            console.error('Error renaming document:', error);
            throw error;
        }
    };

    const startRename = (id: string, currentFilename: string) => {
        setRenamingDocument({ id, currentName: currentFilename });
        setRenameValue(currentFilename);
    };

    const saveRename = async () => {
        if (!renamingDocument || !renameValue.trim()) return;
        await handleRenameDocument(renamingDocument.id, renameValue.trim());
    };

    const cancelRename = () => {
        setRenamingDocument(null);
        setRenameValue('');
    };

    const handleVerificationSave = async (
        documentId: string,
        updates: any,
        newStatus:
            | 'original'
            | 'draft'
            | 'pending_verification'
            | 'verified'
            | 'revision_needed',
    ) => {
        try {
            console.log('Verification Save - Input:', {
                documentId,
                updates,
                newStatus,
            });

            const response = await axios.put('/api/documents', {
                id: documentId,
                type: selectedType,
                verification_status: newStatus,
                ...updates,
            });

            if (response.status === 200) {
                console.log('Verification Save - Response:', response.data);

                // Reload documents to get the updated data
                await loadDocuments();

                // Re-fetch the updated documents list and update modal states
                const refreshResponse = await axios.get(
                    `/api/documents?type=${selectedType}`,
                );
                const refreshedDocuments = refreshResponse.data;

                console.log(
                    'Verification Save - Refreshed Documents:',
                    refreshedDocuments,
                );

                // Update the verifying document if it's the same one
                if (verifyingDocument && verifyingDocument.id === documentId) {
                    const updatedDoc = refreshedDocuments.find(
                        (doc: any) => doc.id === documentId,
                    );
                    console.log(
                        'Verification Save - Updated Verifying Doc:',
                        updatedDoc,
                    );
                    if (updatedDoc) {
                        setVerifyingDocument(updatedDoc);
                    }
                }

                // Also update selected document if it's the same one
                if (selectedDocument && selectedDocument.id === documentId) {
                    const updatedDoc = refreshedDocuments.find(
                        (doc: any) => doc.id === documentId,
                    );
                    console.log(
                        'Verification Save - Updated Selected Doc:',
                        updatedDoc,
                    );
                    if (updatedDoc) {
                        setSelectedDocument(updatedDoc);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating verification status:', error);
            throw error;
        }
    };

    const handleVerifyDocument = (doc: Document) => {
        setVerifyingDocument(doc);
    };

    // per-request export remains handled by API; removed global export buttons from header

    const renderTableData = (doc: Document) => {
        // Handle nested data structure - actual document data might be in doc.data.data
        const documentData = doc.data?.data || doc.data;

        const tableProps = {
            doc: { ...doc, data: documentData }, // Pass the corrected data structure
            selectedType,
            editingCell,
            editValue,
            setEditValue,
            setEditingCell,
            startEdit,
            saveEdit,
            setSelectedDocument,
        };

        // Debug logging to understand data structure
        console.log('Document data structure:', {
            filename: doc.metadata?.filename,
            originalDataKeys: doc.data
                ? Object.keys(doc.data)
                : 'No data object',
            actualDataKeys: documentData
                ? Object.keys(documentData)
                : 'No document data',
            documentData: documentData,
            selectedType,
        });

        // Check if document has data to display (any data beyond just document_type)
        const hasData =
            documentData &&
            // Check for any meaningful content
            Object.keys(documentData).some(key => {
                if (key === 'document_type') return false;
                const value = documentData[key];

                // More comprehensive check for valid data
                if (value === null || value === undefined || value === '')
                    return false;
                if (Array.isArray(value) && value.length === 0) return false;
                if (
                    typeof value === 'object' &&
                    Object.keys(value).length === 0
                )
                    return false;

                return true;
            });

        console.log('Has data:', hasData);

        if (!hasData) {
            return (
                <div className="p-4 text-gray-500">
                    <div>No data available for preview</div>
                    <div className="text-xs mt-2 text-gray-400">
                        Debug:{' '}
                        {documentData
                            ? `Data keys: ${Object.keys(documentData).join(', ')}`
                            : 'No data object found'}
                    </div>
                </div>
            );
        }

        // Render the appropriate table based on document type
        if (selectedType === 'Rebut') return <RebutTable {...tableProps} />;
        if (selectedType === 'NPT') return <NPTTable {...tableProps} />;
        if (selectedType === 'Kosu') return <KosuTable {...tableProps} />;

        return (
            <div className="p-4 text-gray-500">
                Preview not available for this document type
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <HeaderBar />

            {/* Session Recovery Banner */}
            {isClient &&
                (() => {
                    const pdfSession = loadPDFSession();
                    const hasUnfinishedProcessing = processingPages.some(
                        p => p.status === 'pending' || p.status === 'error',
                    );

                    if (
                        pdfSession &&
                        hasUnfinishedProcessing &&
                        !isProcessingPDF
                    ) {
                        return (
                            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0">
                                                <svg
                                                    className="h-5 w-5 text-amber-600"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-medium text-amber-800">
                                                    Resume Processing Session
                                                </h3>
                                                <p className="text-sm text-amber-700">
                                                    Found unfinished processing
                                                    for "
                                                    {
                                                        pdfSession.originalFileName
                                                    }
                                                    " ({pdfSession.pageCount}{' '}
                                                    pages)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => {
                                                    setIsProcessingPDF(true);
                                                    console.log(
                                                        '🔄 Resuming processing session...',
                                                    );
                                                    // Scroll to processing section after resuming
                                                    setTimeout(() => {
                                                        const processingElement =
                                                            document.getElementById(
                                                                'processing-section',
                                                            );
                                                        if (processingElement) {
                                                            processingElement.scrollIntoView(
                                                                {
                                                                    behavior:
                                                                        'smooth',
                                                                },
                                                            );
                                                        }
                                                    }, 500);
                                                }}
                                                className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-3 py-1 rounded transition-colors"
                                            >
                                                Resume Processing
                                            </button>
                                            <button
                                                onClick={forceResetAllStates}
                                                className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded transition-colors"
                                            >
                                                Force Reset All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
                {/* Title */}

                {/* Horizontal Tabs with Upload Button */}
                <div className="mb-4 sm:mb-6 md:mb-8 bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-gray-200 p-2 sm:p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                        {/* Document Type Tabs */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1">
                            {(['Rebut', 'NPT', 'Kosu'] as DocumentType[]).map(
                                type => {
                                    const isSelected = selectedType === type;
                                    const config = {
                                        Rebut: {
                                            color: 'blue',
                                            icon: FileText,
                                            description:
                                                'Equipment Rebut Documents',
                                        },
                                        NPT: {
                                            color: 'orange',
                                            icon: Clock,
                                            description:
                                                'Non-Productive Time Reports',
                                        },
                                        Kosu: {
                                            color: 'green',
                                            icon: Users,
                                            description: 'Team Summary Reports',
                                        },
                                    }[type];

                                    const Icon = config.icon;

                                    const colorClasses = {
                                        blue: isSelected
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'text-blue-600 hover:bg-blue-50 border-blue-200',
                                        orange: isSelected
                                            ? 'bg-orange-600 text-white shadow-lg'
                                            : 'text-orange-600 hover:bg-orange-50 border-orange-200',
                                        green: isSelected
                                            ? 'bg-green-600 text-white shadow-lg'
                                            : 'text-green-600 hover:bg-green-50 border-green-200',
                                    }[config.color];

                                    return (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setSelectedType(type);
                                                setDocuments([]);
                                            }}
                                            className={`
                                                flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base
                                                transition-all duration-200 border-2 
                                                ${isSelected ? 'border-current' : 'border-gray-200 hover:border-current'}
                                                ${colorClasses}
                                                hover:scale-[1.02] active:scale-95
                                                flex items-center justify-center sm:justify-start gap-2 min-h-[44px]
                                            `}
                                        >
                                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                            <span className="truncate">
                                                {type}
                                            </span>
                                            {documentCounts[type] > 0 && (
                                                <span
                                                    className={`
                                                        px-1.5 py-0.5 text-xs rounded-full font-semibold
                                                        ${isSelected ? 'bg-white text-gray-800' : `bg-${config.color}-100`}
                                                        flex-shrink-0
                                                    `}
                                                >
                                                    {documentCounts[type]}
                                                </span>
                                            )}
                                        </button>
                                    );
                                },
                            )}
                        </div>

                        {/* Upload Button */}
                        <div className="flex sm:ml-auto">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={
                                    uploadingFiles.some(
                                        f => f.status === 'uploading',
                                    ) ||
                                    isProcessingPDF ||
                                    isUploading
                                }
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg 
                                font-medium text-sm sm:text-base transition-all duration-200 hover:scale-[1.02] active:scale-95 
                                flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center shadow-lg hover:shadow-xl"
                            >
                                {uploadingFiles.some(
                                    f => f.status === 'uploading',
                                ) ||
                                isProcessingPDF ||
                                isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 animate-spin" />
                                        <span className="hidden sm:inline">
                                            {isProcessingPDF
                                                ? 'Processing...'
                                                : isUploading
                                                  ? 'Preparing files...'
                                                  : 'Uploading...'}
                                        </span>
                                        <span className="sm:hidden">
                                            {isProcessingPDF
                                                ? 'Processing...'
                                                : isUploading
                                                  ? 'Preparing...'
                                                  : 'Uploading...'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                        <span className="hidden sm:inline">
                                            Upload {selectedType} Documents
                                        </span>
                                        <span className="sm:hidden">
                                            Upload
                                        </span>
                                        <Upload className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                    </>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                className="hidden"
                                onChange={e => {
                                    const files = Array.from(
                                        e.target.files || [],
                                    );
                                    if (files.length > 0) {
                                        handleMultipleFilesUpload(files);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Upload Progress List */}
                {uploadingFiles.length > 0 && (
                    <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                            Processing Files
                        </h3>
                        <div className="space-y-4">
                            {uploadingFiles.map(file => (
                                <div
                                    key={file.id}
                                    className="border border-gray-200 rounded-lg p-4"
                                >
                                    {/* File Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <span
                                            className="font-medium text-gray-800 truncate max-w-xs"
                                            title={file.name}
                                        >
                                            {file.name}
                                            {file.totalPages &&
                                                file.totalPages > 1 && (
                                                    <span className="text-xs text-gray-500 ml-2">
                                                        ({file.totalPages}{' '}
                                                        pages)
                                                    </span>
                                                )}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {file.status === 'uploading' && (
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                            )}
                                            <span
                                                className={`text-sm font-medium ${
                                                    file.status === 'completed'
                                                        ? 'text-green-600'
                                                        : file.status ===
                                                            'error'
                                                          ? 'text-red-600'
                                                          : 'text-blue-600'
                                                }`}
                                            >
                                                {file.progress}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Overall Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ease-out ${
                                                file.status === 'completed'
                                                    ? 'bg-green-500'
                                                    : file.status === 'error'
                                                      ? 'bg-red-500'
                                                      : 'bg-blue-600'
                                            }`}
                                            style={{
                                                width: `${file.progress}%`,
                                            }}
                                        ></div>
                                    </div>

                                    {/* Status Message */}
                                    <div
                                        className={`text-sm mb-2 ${
                                            file.status === 'completed'
                                                ? 'text-green-600'
                                                : file.status === 'error'
                                                  ? 'text-red-600'
                                                  : 'text-gray-600'
                                        }`}
                                    >
                                        {file.message}
                                        {file.currentPage &&
                                            file.totalPages && (
                                                <span className="text-blue-600 font-medium ml-1">
                                                    (Page {file.currentPage}/
                                                    {file.totalPages})
                                                </span>
                                            )}
                                    </div>

                                    {/* Page Progress Details */}
                                    {file.pageResults &&
                                        file.pageResults.length > 1 && (
                                            <div className="mt-3 bg-gray-50 rounded-lg p-3">
                                                <div className="text-xs font-medium text-gray-700 mb-2">
                                                    Page Processing Status:
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {file.pageResults.map(
                                                        (page, index) => (
                                                            <div
                                                                key={index}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                                                    page.status ===
                                                                    'completed'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : page.status ===
                                                                            'error'
                                                                          ? 'bg-red-100 text-red-700'
                                                                          : page.status ===
                                                                              'processing'
                                                                            ? 'bg-blue-100 text-blue-700'
                                                                            : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                            >
                                                                {page.status ===
                                                                    'processing' && (
                                                                    <div className="animate-spin rounded-full h-2 w-2 border border-blue-600 border-t-transparent"></div>
                                                                )}
                                                                <span>
                                                                    Page{' '}
                                                                    {
                                                                        page.pageNumber
                                                                    }
                                                                </span>
                                                                {page.status ===
                                                                    'completed' && (
                                                                    <span>
                                                                        ✓
                                                                    </span>
                                                                )}
                                                                {page.status ===
                                                                    'error' && (
                                                                    <span>
                                                                        ✗
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Page Processing Component */}
                {processingPages.length > 0 && (
                    <div id="processing-section">
                        <PageProcessor
                            pages={processingPages}
                            documentType={selectedType}
                            originalFileName={
                                processingPages[0]?.fileName?.split(
                                    '-page-',
                                )[0] || 'document'
                            }
                            onPageComplete={handlePageComplete}
                            onAllComplete={handleAllComplete}
                        />
                    </div>
                )}

                {/* Documents List */}
                <DocumentList
                    documents={documents}
                    isLoading={isLoading}
                    setSelectedDocument={setSelectedDocument}
                    loadDocuments={loadDocuments}
                    selectedType={selectedType}
                    renderTableData={renderTableData}
                    onDeleteDocument={handleDeleteDocument}
                    onVerifyDocument={handleVerifyDocument}
                    renamingDocument={renamingDocument}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    startRename={startRename}
                    saveRename={saveRename}
                    cancelRename={cancelRename}
                />
            </div>

            {/* Unified Document Modal - Uses DocumentVerificationModal for both view and edit */}
            <DocumentVerificationModal
                document={selectedDocument || verifyingDocument}
                isOpen={!!(selectedDocument || verifyingDocument)}
                onClose={() => {
                    setSelectedDocument(null);
                    setVerifyingDocument(null);
                }}
                onSave={handleVerificationSave}
                selectedType={selectedType}
            />
        </div>
    );
}
