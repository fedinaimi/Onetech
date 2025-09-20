'use client';

import DocumentList from '@/components/DocumentList';
import HeaderBar from '@/components/HeaderBar';
import ImageProcessor from '@/components/ImageProcessor';
import PageProcessor from '@/components/PageProcessor';
import { KosuTable, NPTTable, RebutTable } from '@/components/TableRenderers';
import axios from 'axios';
import { Clock, FileText, Loader2, Plus, RotateCcw, Upload, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

type DocumentType = 'Rebut' | 'NPT' | 'Kosu';

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
    history?: Array<{
        field: string;
        old_value: any;
        new_value: any;
        updated_at: string;
        updated_by: string;
    }>;
}

export default function HomePage() {
    const [selectedType, setSelectedType] = useState<DocumentType>('Rebut');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentCounts, setDocumentCounts] = useState<
        Record<DocumentType, number>
    >({
        Rebut: 0,
        NPT: 0,
        Kosu: 0,
    });
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(
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
    const [processingImage, setProcessingImage] = useState<ImageData | null>(
        null,
    );
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [imageZoom, setImageZoom] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load persisted processing state on mount
    const loadPersistedProcessingState = useCallback(() => {
        try {
            const savedState = localStorage.getItem('processing-state');
            if (savedState) {
                const {
                    pages,
                    isProcessing,
                    documentType: savedType,
                } = JSON.parse(savedState);

                // Only restore if there are incomplete pages and it matches current document type
                const incompletePages = pages.filter(
                    (p: PageData) => p.status !== 'completed',
                );
                if (incompletePages.length > 0 && savedType === selectedType) {
                    console.log(
                        `Restoring processing state: ${incompletePages.length} incomplete pages`,
                    );
                    setProcessingPages(pages);
                    setIsProcessingPDF(isProcessing);
                } else {
                    // Clear completed or mismatched processing state
                    localStorage.removeItem('processing-state');
                }
            }
        } catch (error) {
            console.error('Error loading persisted processing state:', error);
            localStorage.removeItem('processing-state');
        }
    }, [selectedType]);

    // Save processing state to localStorage
    const saveProcessingState = useCallback(
        (pages: PageData[], isProcessing: boolean, fileName: string) => {
            try {
                const state = {
                    pages,
                    isProcessing,
                    documentType: selectedType,
                    originalFileName: fileName,
                    timestamp: Date.now(),
                };
                localStorage.setItem('processing-state', JSON.stringify(state));
            } catch (error) {
                console.error('Error saving processing state:', error);
            }
        },
        [selectedType],
    );

    // Load persisted image processing state on mount
    const loadPersistedImageProcessingState = useCallback(() => {
        try {
            const savedState = localStorage.getItem('image-processing-state');
            if (savedState) {
                const {
                    imageData,
                    isProcessing,
                    documentType: savedType,
                } = JSON.parse(savedState);

                // Only restore if processing was incomplete and matches current document type
                if (
                    imageData &&
                    imageData.status !== 'completed' &&
                    savedType === selectedType
                ) {
                    console.log(
                        'Restoring image processing state:',
                        imageData.fileName,
                    );
                    setProcessingImage(imageData);
                    setIsProcessingImage(isProcessing);
                } else {
                    // Clear completed or mismatched processing state
                    localStorage.removeItem('image-processing-state');
                }
            }
        } catch (error) {
            console.error(
                'Error loading persisted image processing state:',
                error,
            );
            localStorage.removeItem('image-processing-state');
        }
    }, [selectedType]);

    // Save image processing state to localStorage
    const saveImageProcessingState = useCallback(
        (imageData: ImageData | null, isProcessing: boolean) => {
            try {
                if (imageData) {
                    const state = {
                        imageData,
                        isProcessing,
                        documentType: selectedType,
                        timestamp: Date.now(),
                    };
                    localStorage.setItem(
                        'image-processing-state',
                        JSON.stringify(state),
                    );
                } else {
                    localStorage.removeItem('image-processing-state');
                }
            } catch (error) {
                console.error('Error saving image processing state:', error);
            }
        },
        [selectedType],
    );

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

    const loadDocuments = useCallback(async () => {
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
        loadDocuments();
        loadDocumentCounts(); // Load all counts
        loadPersistedProcessingState(); // Load any persisted processing state
        loadPersistedImageProcessingState(); // Load any persisted image processing state
    }, [
        loadDocuments,
        loadDocumentCounts,
        loadPersistedProcessingState,
        loadPersistedImageProcessingState,
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

            if (processingImage && isProcessingImage) {
                saveImageProcessingState(processingImage, isProcessingImage);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () =>
            window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [
        processingPages,
        isProcessingPDF,
        saveProcessingState,
        processingImage,
        isProcessingImage,
        saveImageProcessingState,
    ]);

    // Save image processing state when it changes
    React.useEffect(() => {
        if (processingImage && isProcessingImage) {
            saveImageProcessingState(processingImage, isProcessingImage);
        }
    }, [processingImage, isProcessingImage, saveImageProcessingState]);

    const handleImageUpload = useCallback(
        async (file: File) => {
            setIsProcessingImage(true);
            setProcessingImage(null);

            try {
                // Create image data URL for visualization
                const reader = new FileReader();
                reader.onload = e => {
                    const imageDataUrl = e.target?.result as string;

                    const imageData: ImageData = {
                        fileName: file.name,
                        mimeType: file.type,
                        imageDataUrl,
                        fileSize: file.size,
                        status: 'pending',
                        extractedData: null,
                        error: null,
                    };

                    setProcessingImage(imageData);
                    // Save initial processing state to localStorage
                    saveImageProcessingState(imageData, true);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error preparing image for processing:', error);
                setIsProcessingImage(false);
            }
        },
        [saveImageProcessingState],
    );

    const handleImageProcessComplete = useCallback(async () => {
        try {
            // The document is already saved by the process-page API
            // Just refresh the document list and update counts
            console.log('Image processing completed, refreshing document list');

            await loadDocuments();
            await loadDocumentCounts();

            // Clear processing state and localStorage after a delay
            setTimeout(() => {
                setIsProcessingImage(false);
                setProcessingImage(null);
                saveImageProcessingState(null, false);
            }, 2000);
        } catch (error) {
            console.error(
                'Error refreshing documents after image processing:',
                error,
            );
            // Handle error by clearing the processing state
            setTimeout(() => {
                setIsProcessingImage(false);
                setProcessingImage(null);
                saveImageProcessingState(null, false);
            }, 5000);
        }
    }, [loadDocuments, loadDocumentCounts, saveImageProcessingState]);

    const handleImageProcessError = useCallback(
        (error: string) => {
            console.error('Image processing error:', error);
            // Keep the error state visible for a few seconds, then clear
            setTimeout(() => {
                setIsProcessingImage(false);
                setProcessingImage(null);
                saveImageProcessingState(null, false);
            }, 5000);
        },
        [saveImageProcessingState],
    );

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
                // Step 1: Split PDF into pages
                const formData = new FormData();
                formData.append('file', file);

                console.log('Splitting PDF:', file.name);
                const splitResponse = await axios.post(
                    '/api/split-pdf',
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        // No timeout - rely on backend response
                    },
                );

                if (splitResponse.data.success) {
                    const pages: PageData[] = splitResponse.data.pages;
                    console.log(`PDF split into ${pages.length} pages`);
                    setProcessingPages(pages);

                    // Save initial processing state to localStorage
                    saveProcessingState(pages, true, file.name);
                } else {
                    throw new Error(
                        splitResponse.data.error || 'Failed to split PDF',
                    );
                }
            } catch (error) {
                console.error('Error splitting PDF:', error);
                setIsProcessingPDF(false);
                // Fall back to old approach for this file
                await handleRegularFileUpload(file);
            }
        },
        [handleRegularFileUpload, saveProcessingState],
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

        // Refresh the documents list to make sure we have the latest data
        loadDocuments();
        loadDocumentCounts();
    }, [loadDocuments, loadDocumentCounts]);

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
                    const updatedDocument = JSON.parse(JSON.stringify(selectedDocument));
                    
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
                        updated_by: 'user'
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

    // Zoom control functions
    const handleZoomIn = () => {
        setImageZoom(prev => Math.min(prev + 0.25, 3)); // Max zoom 3x
    };

    const handleZoomOut = () => {
        setImageZoom(prev => Math.max(prev - 0.25, 0.5)); // Min zoom 0.5x
    };

    const handleZoomReset = () => {
        setImageZoom(1);
        setImagePosition({ x: 0, y: 0 }); // Reset position when resetting zoom
    };

    const handleImageWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY;
        if (delta < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    // Drag handlers for panning
    const handleMouseDown = (e: React.MouseEvent) => {
        if (imageZoom > 1) { // Only allow dragging when zoomed in
            setIsDragging(true);
            setDragStart({
                x: e.clientX - imagePosition.x,
                y: e.clientY - imagePosition.y
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && imageZoom > 1) {
            setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    // Reset zoom and position when document changes
    React.useEffect(() => {
        setImageZoom(1);
        setImagePosition({ x: 0, y: 0 });
        setIsDragging(false);
    }, [selectedDocument]);

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
                                    isProcessingImage ||
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
                                isProcessingImage ||
                                isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 animate-spin" />
                                        <span className="hidden sm:inline">
                                            {isProcessingPDF
                                                ? 'Processing PDF...'
                                                : isProcessingImage
                                                  ? 'Processing Image...'
                                                  : isUploading
                                                    ? 'Preparing files...'
                                                    : 'Uploading...'}
                                        </span>
                                        <span className="sm:hidden">
                                            {isProcessingPDF ||
                                            isProcessingImage
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
                    <PageProcessor
                        pages={processingPages}
                        documentType={selectedType}
                        originalFileName={
                            processingPages[0]?.fileName?.split('-page-')[0] ||
                            'document'
                        }
                        onPageComplete={handlePageComplete}
                        onAllComplete={handleAllComplete}
                    />
                )}

                {/* Image Processing Component */}
                {isProcessingImage && processingImage && (
                    <ImageProcessor
                        imageData={processingImage}
                        documentType={selectedType}
                        originalFileName={processingImage.fileName}
                        onComplete={handleImageProcessComplete}
                        onError={handleImageProcessError}
                    />
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
                    renamingDocument={renamingDocument}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    startRename={startRename}
                    saveRename={saveRename}
                    cancelRename={cancelRename}
                />
            </div>

            {/* Document Details Modal */}
            {selectedDocument && (
                <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start sm:items-center justify-center p-2 sm:p-4">
                    <div className="relative bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl w-full max-w-7xl max-h-[98vh] sm:max-h-[95vh] md:max-h-[90vh] overflow-hidden mt-2 sm:mt-0 modal-content">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 sm:px-4 md:px-6 py-3 sm:py-4 sticky top-0 z-10">
                            <div className="flex justify-between items-start sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate">
                                        Document Details
                                    </h3>
                                    <p className="text-blue-100 text-xs sm:text-sm md:text-base truncate mt-1">
                                        {selectedDocument.metadata.filename}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedDocument(null)}
                                    className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    aria-label="Close modal"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Split Layout */}
                        <div className="flex flex-col lg:flex-row overflow-hidden max-h-[calc(98vh-80px)] sm:max-h-[calc(95vh-100px)] md:max-h-[calc(90vh-120px)]">
                            {/* Left Side - Document Data */}
                            <div className="flex-1 overflow-y-auto border-r border-gray-200">
                                {/* Document Info */}
                                <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                            <div className="text-xs sm:text-sm text-gray-600 font-medium mb-1">
                                                File Size
                                            </div>
                                            <div className="font-semibold text-sm sm:text-base md:text-lg text-gray-900">
                                                {(
                                                    selectedDocument.metadata
                                                        .file_size / 1024
                                                ).toFixed(1)}{' '}
                                                KB
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                            <div className="text-xs sm:text-sm text-gray-600 font-medium mb-1">
                                                Document Type
                                            </div>
                                            <div className="font-semibold text-sm sm:text-base md:text-lg text-gray-900 truncate">
                                                {
                                                    selectedDocument.metadata
                                                        .document_type
                                                }
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 sm:col-span-2 xl:col-span-1">
                                            <div className="text-xs sm:text-sm text-gray-600 font-medium mb-1">
                                                Processed
                                            </div>
                                            <div className="font-semibold text-sm sm:text-base text-gray-900">
                                                {new Date(
                                                    selectedDocument.metadata.processed_at,
                                                ).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Document Data */}
                                <div className="p-4 sm:p-6">
                                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                                        Extracted Data
                                    </h4>
                                    <div className="space-y-4">
                                        {renderTableData(selectedDocument)}
                                    </div>
                                </div>

                                {/* Edit History */}
                                {selectedDocument.history &&
                                    selectedDocument.history.length > 0 && (
                                        <div className="p-4 sm:p-6 border-t border-gray-200">
                                            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                                                Edit History
                                            </h4>
                                            <div className="space-y-3 max-h-40 sm:max-h-48 overflow-y-auto">
                                                {selectedDocument.history.map(
                                                    (entry, index) => (
                                                        <div
                                                            key={index}
                                                            className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4"
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-1 sm:space-y-0">
                                                                <span className="font-medium text-gray-900 text-sm sm:text-base">
                                                                    {entry.field}
                                                                </span>
                                                                <span className="text-xs text-gray-600 font-medium">
                                                                    {new Date(
                                                                        entry.updated_at,
                                                                    ).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                                                <div>
                                                                    <div className="text-gray-600 mb-1 text-xs sm:text-sm font-medium">
                                                                        Old Value:
                                                                    </div>
                                                                    <div className="bg-red-50 border border-red-200 rounded p-2 text-xs break-all text-gray-800 font-mono">
                                                                        {JSON.stringify(
                                                                            entry.old_value,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-gray-600 mb-1 text-xs sm:text-sm font-medium">
                                                                        New Value:
                                                                    </div>
                                                                    <div className="bg-green-50 border border-green-200 rounded p-2 text-xs break-all text-gray-800 font-mono">
                                                                        {JSON.stringify(
                                                                            entry.new_value,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </div>

                            {/* Right Side - Document Image */}
                            <div className="flex-1 lg:max-w-lg xl:max-w-xl overflow-y-auto bg-gray-50">
                                <div className="p-4 sm:p-6 h-full">
                                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                                            Source Document
                                        </h4>
                                        {selectedDocument.imageUrl && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleZoomOut}
                                                    disabled={imageZoom <= 0.5}
                                                    className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    title="Zoom Out"
                                                >
                                                    <ZoomOut size={16} />
                                                </button>
                                                <span className="text-sm font-medium text-gray-600 min-w-[50px] text-center">
                                                    {Math.round(imageZoom * 100)}%
                                                </span>
                                                <button
                                                    onClick={handleZoomIn}
                                                    disabled={imageZoom >= 3}
                                                    className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    title="Zoom In"
                                                >
                                                    <ZoomIn size={16} />
                                                </button>
                                                <button
                                                    onClick={handleZoomReset}
                                                    className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                                    title="Reset Zoom"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                                {imageZoom > 1 && (
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                        Drag to pan
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div 
                                        className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-4 h-full min-h-[300px] flex items-center justify-center overflow-hidden"
                                        onWheel={selectedDocument.imageUrl ? handleImageWheel : undefined}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseLeave}
                                        style={{ 
                                            cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                                        }}
                                    >
                                        {selectedDocument.imageUrl ? (
                                            <div className="w-full h-full flex flex-col">
                                                <div className="flex-1 flex items-center justify-center overflow-hidden">
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${selectedDocument.imageUrl}`}
                                                        alt={`Source: ${selectedDocument.metadata.filename}`}
                                                        className="object-contain rounded-lg shadow-lg transition-transform duration-200 ease-out select-none"
                                                        style={{
                                                            transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px)`,
                                                            maxWidth: imageZoom > 1 ? 'none' : '100%',
                                                            maxHeight: imageZoom > 1 ? 'none' : '100%',
                                                        }}
                                                        onMouseDown={handleMouseDown}
                                                        onDragStart={(e) => e.preventDefault()} // Prevent browser's default drag
                                                        onError={(e) => {
                                                            const img = e.currentTarget;
                                                            const fallback = img.nextElementSibling as HTMLElement;
                                                            img.style.display = 'none';
                                                            if (fallback) {
                                                                fallback.style.display = 'flex';
                                                            }
                                                        }}
                                                    />
                                                    <div className="hidden flex-col items-center justify-center text-gray-500 space-y-2">
                                                        <div className="text-6xl">📄</div>
                                                        <div className="text-sm text-center">
                                                            <div>Image could not be loaded</div>
                                                            <div className="text-xs text-gray-400 mt-1 break-all">
                                                                {selectedDocument.imageUrl}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-gray-600 text-center">
                                                    <div className="font-medium">{selectedDocument.metadata.filename}</div>
                                                    <div className="text-gray-400 mt-1">
                                                        Processed: {new Date(selectedDocument.metadata.processed_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-gray-500 space-y-3">
                                                <div className="text-6xl">📄</div>
                                                <div className="text-sm text-center">
                                                    <div className="font-medium">No source image available</div>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        The original document image was not saved
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
