import { AlertCircle, CheckCircle, Clock, Loader2, Zap } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type PageStatus = 'pending' | 'processing' | 'completed' | 'error';

interface PageData {
    pageNumber: number;
    fileName: string;
    mimeType: string;
    imageDataUrl: string;
    bufferSize: number;
    status: PageStatus;
    extractedData: any;
    error: string | null;
    retryCount?: number;
}

interface PageProcessorProps {
    pages: PageData[];
    documentType: string;
    originalFileName: string;
    onPageComplete: (pageNumber: number, data: any) => void;
    onAllComplete: () => void;
}

export default function PageProcessor({
    pages,
    documentType,
    originalFileName,
    onPageComplete,
    onAllComplete,
}: PageProcessorProps) {
    // Debug: Log incoming page data
    console.log(
        '[PageProcessor] Component loaded with pages:',
        pages.map(p => ({
            pageNumber: p.pageNumber,
            hasImageUrl: !!p.imageDataUrl,
            imageUrl: p.imageDataUrl?.substring(0, 80) || 'NO URL',
            fileName: p.fileName,
        })),
    );

    // Fix relative URLs by adding backend URL prefix
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
    const fixedImageUrls = pages.map(p => {
        if (p.imageDataUrl && p.imageDataUrl.startsWith('/media/')) {
            // Convert relative URL to absolute URL
            return `${backendUrl}${p.imageDataUrl}`;
        }
        return p.imageDataUrl;
    });

    const [processingPages, setProcessingPages] = useState<PageData[]>([]);
    const [selectedPage, setSelectedPage] = useState<PageData | null>(null);
    const [backendSessionId, setBackendSessionId] = useState<string | null>(
        null,
    );
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const currentPollingSessionRef = useRef<string | null>(null);
    // Remove unused variable to fix ESLint error
    // const [isInitialized, setIsInitialized] = useState(false);

    // Stop all polling activity
    const stopPolling = useCallback(() => {
        console.log('Stopping all polling activity');
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        currentPollingSessionRef.current = null;
    }, []);

    // Backend status polling function
    const startBackendStatusPolling = useCallback(
        (sessionId: string) => {
            console.log(
                'Starting backend status polling for session:',
                sessionId,
            ); // Stop any existing polling first
            stopPolling();

            // Check if we're already polling this session
            if (currentPollingSessionRef.current === sessionId) {
                console.log('Already polling this session, skipping');
                return;
            }

            // Set current session
            setBackendSessionId(sessionId);
            currentPollingSessionRef.current = sessionId;

            // Set maximum polling duration (10 minutes)
            const maxPollingDuration = 600000; // 10 minutes
            const pollingStartTime = Date.now();

            const pollStatus = async () => {
                try {
                    // Check if this session is still the current one
                    if (currentPollingSessionRef.current !== sessionId) {
                        console.log(
                            'Session changed, stopping polling for:',
                            sessionId,
                        );
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                        return;
                    }

                    console.log(
                        'Polling backend status for session:',
                        sessionId,
                    );
                    const response = await fetch(
                        `/api/batch-status/${sessionId}`,
                    );

                    if (!response.ok) {
                        if (response.status === 404) {
                            console.log(
                                'Session not found (404), stopping polling',
                            );
                            stopPolling();
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem('batch-session');
                            }
                            setTimeout(() => {
                                onAllComplete();
                            }, 1000);
                            return;
                        }
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const status = await response.json();
                    console.log('Backend status:', {
                        completed: status.completed_pages,
                        processing: status.processing_pages?.length || 0,
                        failed: status.failed_pages,
                        total: status.total_pages,
                        status: status.status,
                    });

                    // Detect stale sessions (no progress for too long)
                    const currentTime = Date.now();
                    const batchSession = JSON.parse(
                        localStorage.getItem('batch-session') || '{}',
                    );

                    if (
                        status.completed_pages === 0 &&
                        status.failed_pages === 0 &&
                        status.status === 'processing'
                    ) {
                        const sessionAge =
                            currentTime - (batchSession.timestamp || 0);
                        if (sessionAge > 120000) {
                            // 2 minutes instead of 3 to be more aggressive
                            console.log(
                                'Stale session detected (no progress for 2+ minutes), stopping polling',
                            );
                            stopPolling();
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem('batch-session');
                            }
                            setTimeout(() => {
                                onAllComplete();
                            }, 1000);
                            return;
                        }
                    }

                    // Additional check: If session shows processing but no pages are actually being processed
                    if (
                        status.status === 'processing' &&
                        (!status.processing_pages ||
                            status.processing_pages.length === 0) &&
                        status.completed_pages === 0 &&
                        status.failed_pages === 0
                    ) {
                        const sessionAge =
                            currentTime - (batchSession.timestamp || 0);
                        if (sessionAge > 60000) {
                            // 1 minute for completely stuck sessions
                            console.log(
                                'Completely stuck session detected (processing but no active pages), stopping polling',
                            );
                            stopPolling();
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem('batch-session');
                            }
                            setTimeout(() => {
                                onAllComplete();
                            }, 1000);
                            return;
                        }
                    }

                    // Global timeout check (stop polling after max duration)
                    if (currentTime - pollingStartTime > maxPollingDuration) {
                        console.log(
                            'Polling timeout reached (10 minutes), stopping polling',
                        );
                        stopPolling();
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('batch-session');
                        }
                        setTimeout(() => {
                            onAllComplete();
                        }, 1000);
                        return;
                    }

                    // Stop polling if session is completed or has no pages
                    if (
                        status.status === 'completed' ||
                        (status.total_pages === 0 &&
                            status.status !== 'processing')
                    ) {
                        console.log(
                            'Session completed or empty, stopping polling',
                        );
                        stopPolling();
                        setTimeout(() => {
                            onAllComplete();
                        }, 1000);
                        return;
                    }

                    // Update processing pages based on backend status
                    setProcessingPages(prevPages => {
                        return prevPages.map(page => {
                            const pageInfo =
                                status.pages_info?.[page.pageNumber];

                            if (pageInfo) {
                                return {
                                    ...page,
                                    status:
                                        pageInfo.status === 'completed'
                                            ? ('completed' as const)
                                            : pageInfo.status === 'processing'
                                              ? ('processing' as const)
                                              : pageInfo.status === 'failed'
                                                ? ('error' as const)
                                                : ('pending' as const),
                                    error: pageInfo.error || null,
                                    extractedData:
                                        pageInfo.status === 'completed'
                                            ? { id: pageInfo.document_id }
                                            : null,
                                    imageDataUrl:
                                        pageInfo.image_url?.startsWith(
                                            '/media/',
                                        )
                                            ? `${backendUrl}${pageInfo.image_url}`
                                            : pageInfo.image_url ||
                                              page.imageDataUrl, // Update image URL from backend
                                };
                            } else if (
                                page.pageNumber <=
                                status.completed_pages + status.failed_pages
                            ) {
                                // Page is processed but not in pages_info - find in documents
                                const completedDoc = status.documents?.find(
                                    (doc: any) => doc.page === page.pageNumber,
                                );

                                console.log(
                                    `📄 Updating page ${page.pageNumber} with imageUrl from doc: ${completedDoc?.imageUrl}`,
                                );
                                return {
                                    ...page,
                                    status: completedDoc
                                        ? ('completed' as const)
                                        : ('error' as const),
                                    error: completedDoc
                                        ? null
                                        : 'Processing failed',
                                    extractedData: completedDoc
                                        ? { id: completedDoc.id }
                                        : null,
                                    imageDataUrl:
                                        completedDoc?.imageUrl?.startsWith(
                                            '/media/',
                                        )
                                            ? `${backendUrl}${completedDoc.imageUrl}`
                                            : completedDoc?.imageUrl ||
                                              page.imageDataUrl, // Update image URL from document
                                };
                            }

                            return page;
                        });
                    });

                    // Call onPageComplete for newly completed pages
                    if (status.documents && status.documents.length > 0) {
                        const currentProcessingPages = processingPages;
                        status.documents.forEach((doc: any) => {
                            const currentPage = currentProcessingPages.find(
                                p => p.pageNumber === doc.page,
                            );

                            if (
                                currentPage &&
                                currentPage.status !== 'completed'
                            ) {
                                console.log(
                                    `📄 Page ${doc.page} completed, adding to document list`,
                                );
                                onPageComplete(doc.page, {
                                    id: doc.id,
                                    data: doc.data || doc.extraction_data || {},
                                    metadata: doc.metadata || {},
                                    filename:
                                        doc.filename ||
                                        `${originalFileName}_page_${doc.page}`,
                                    document_type: documentType,
                                    created_at:
                                        doc.metadata?.processed_at ||
                                        new Date().toISOString(),
                                    remark:
                                        doc.remark ||
                                        `${documentType} extraction complete - Page ${doc.page}`,
                                    imageUrl: doc.imageUrl || '',
                                    json_url:
                                        doc.json_url ||
                                        `/api/documents/${doc.id}/export?format=json`,
                                    excel_url:
                                        doc.excel_url ||
                                        `/api/documents/${doc.id}/export?format=excel`,
                                });
                            }
                        });
                    }

                    // Stop polling if completed or failed
                    if (
                        status.status === 'completed' ||
                        status.status === 'failed' ||
                        status.completed_pages + status.failed_pages >=
                            status.total_pages
                    ) {
                        console.log('Backend processing finished:', {
                            completed: status.completed_pages,
                            failed: status.failed_pages,
                            total: status.total_pages,
                            status: status.status,
                        });

                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }

                        // Clear session from storage
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('batch-session');
                        }

                        // Wait a moment for final document callbacks, then complete
                        setTimeout(() => {
                            onAllComplete();
                        }, 1000);
                    }
                } catch (error) {
                    console.error('Backend status polling failed:', error);

                    if (
                        error instanceof TypeError &&
                        error.message.includes('fetch failed')
                    ) {
                        console.log(
                            'Backend unavailable, stopping polling and clearing session',
                        );
                        stopPolling();
                        if (typeof window !== 'undefined') {
                            localStorage.removeItem('batch-session');
                        }

                        setTimeout(() => {
                            onAllComplete();
                        }, 2000);
                    }
                }
            };

            // Poll immediately, then every 5 seconds (further reduced frequency to prevent loops)
            pollStatus();
            pollingIntervalRef.current = setInterval(pollStatus, 5000);
        },
        [stopPolling],
    );

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // Initialize backend processing (backend mode only)
    useEffect(() => {
        console.log(
            'INITIALIZING PageProcessor with',
            pages.length,
            'pages (backend mode only)',
        );

        // Check if we have a batch session ID
        const batchSession =
            typeof window !== 'undefined'
                ? JSON.parse(localStorage.getItem('batch-session') || '{}')
                : {};

        // Validate session age - clear if older than 1 hour
        const sessionAge = Date.now() - (batchSession.timestamp || 0);
        const isSessionValid = batchSession.sessionId && sessionAge < 3600000; // 1 hour

        if (isSessionValid) {
            console.log('Backend session detected:', batchSession.sessionId);

            // Verify session still exists on backend before polling
            fetch(`/api/batch-status/${batchSession.sessionId}`)
                .then(response => {
                    if (response.ok) {
                        console.log(
                            'Backend session confirmed, starting polling',
                        );
                        initializeBackendMode(batchSession.sessionId);
                    } else {
                        console.log(
                            'Backend session expired/not found, clearing session',
                        );
                        clearInvalidSession();
                        completeProcessing();
                    }
                })
                .catch(error => {
                    console.error('Error verifying backend session:', error);
                    clearInvalidSession();
                    completeProcessing();
                });
        } else {
            if (batchSession.sessionId) {
                console.log(
                    'Clearing expired session:',
                    batchSession.sessionId,
                );
                clearInvalidSession();
            }
            completeProcessing();
        }

        // Fallback: If no session at all, initialize pages immediately to show images
        if (!batchSession.sessionId && pages.length > 0) {
            console.log('No session found, showing pages immediately');
            const initialPages = pages.map(page => ({
                ...page,
                status: 'pending' as const,
                extractedData: null,
                error: null,
                retryCount: 0,
            }));
            setProcessingPages(initialPages);
        }

        function initializeBackendMode(sessionId: string) {
            console.log(
                'Initializing backend mode with pages:',
                pages.map(p => ({
                    pageNumber: p.pageNumber,
                    hasImageUrl: !!p.imageDataUrl,
                    imageDataUrl: p.imageDataUrl
                        ? p.imageDataUrl.substring(0, 50) + '...'
                        : 'No image URL',
                })),
            );

            const freshPages = pages.map(page => ({
                ...page,
                status: 'pending' as const,
                extractedData: null,
                error: null,
                retryCount: 0,
            }));

            setProcessingPages(freshPages);
            setBackendSessionId(sessionId);
            // setIsInitialized(true); // Commented out since variable is unused

            // Start backend status polling
            startBackendStatusPolling(sessionId);
        }

        function clearInvalidSession() {
            stopPolling();
            if (typeof window !== 'undefined') {
                localStorage.removeItem('batch-session');
                localStorage.removeItem('processing-state');
            }
        }

        function completeProcessing() {
            console.log(
                'No valid backend session - initializing pages from props',
            );

            // Initialize pages from props to show the images
            const initialPages = pages.map((page, index) => ({
                ...page,
                status: 'pending' as const,
                extractedData: null,
                error: null,
                retryCount: 0,
                imageDataUrl: fixedImageUrls[index] || page.imageDataUrl, // Use fixed URLs
            }));

            setProcessingPages(initialPages);
            // setIsInitialized(true); // Commented out since variable is unused

            // Complete immediately if no backend session
            setTimeout(() => {
                onAllComplete();
            }, 500);
        }
    }, [pages, startBackendStatusPolling, onAllComplete]);

    // Reset function for emergency situations
    const forceReset = useCallback(() => {
        console.log('Force reset triggered - stopping all polling');

        stopPolling();

        if (typeof window !== 'undefined') {
            localStorage.removeItem('batch-session');
            localStorage.removeItem('processing-state');
        }

        setProcessingPages([]);
        setBackendSessionId(null);
        // setIsInitialized(true); // Commented out since variable is unused

        setTimeout(() => {
            onAllComplete();
        }, 500);
    }, [stopPolling, onAllComplete]);

    const getStatusIcon = (status: PageStatus) => {
        switch (status) {
            case 'pending':
                return <Clock className="w-4 h-4 text-gray-400" />;
            case 'processing':
                return (
                    <div className="animate-in zoom-in duration-300">
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    </div>
                );
            case 'completed':
                return (
                    <div className="animate-in zoom-in duration-300">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                );
            case 'error':
                return (
                    <div className="animate-in shake duration-300">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                );
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const completedCount = processingPages.filter(
        p => p.status === 'completed',
    ).length;
    const processingCount = processingPages.filter(
        p => p.status === 'processing',
    ).length;
    const errorCount = processingPages.filter(p => p.status === 'error').length;
    const totalCount = processingPages.length;
    const progressPercentage =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div
            id="processing-section"
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                        <div className="relative">
                            <Zap className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
                            {backendSessionId && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                            Processing {originalFileName}
                        </h2>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Real-time backend processing
                            </span>
                            {backendSessionId && (
                                <span className="text-xs text-gray-500">
                                    Session: {backendSessionId.substring(0, 8)}
                                    ...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={forceReset}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Progress Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {totalCount}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Total Pages
                    </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">
                        {completedCount}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Completed
                    </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                        {processingCount}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Processing
                    </div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-red-600">
                        {errorCount}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                        Errors
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4 sm:mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>
                        {completedCount} of {totalCount} pages processed
                    </span>
                    <span>{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden">
                    <div
                        className="bg-green-500 h-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="flex justify-center mt-2">
                    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
                        Auto-saved & Persistent
                    </span>
                </div>
            </div>

            {/* Pages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {processingPages.map(page => (
                    <div
                        key={page.pageNumber}
                        className={`
                            relative border-2 rounded-lg p-3 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md
                            ${
                                page.status === 'completed'
                                    ? 'border-green-200 bg-green-50 hover:border-green-300'
                                    : page.status === 'processing'
                                      ? 'border-blue-200 bg-blue-50 hover:border-blue-300 animate-pulse'
                                      : page.status === 'error'
                                        ? 'border-red-200 bg-red-50 hover:border-red-300'
                                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }
                        `}
                        onClick={() => setSelectedPage(page)}
                    >
                        {/* Page Preview */}
                        <div className="aspect-[3/4] bg-white rounded border mb-3 flex items-center justify-center overflow-hidden">
                            {page.imageDataUrl ? (
                                <div className="w-full h-64">
                                    <img
                                        src={page.imageDataUrl}
                                        alt={`Page ${page.pageNumber}`}
                                        className="w-full h-full object-contain border border-gray-200"
                                        onError={e => {
                                            console.error(
                                                `[ERROR] Failed to load image: ${page.imageDataUrl}`,
                                                e,
                                            );
                                        }}
                                        onLoad={() => {
                                            console.log(
                                                `[SUCCESS] Image loaded: ${page.imageDataUrl}`,
                                            );
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-64 flex items-center justify-center text-gray-500">
                                    Loading... (No image URL: {page.pageNumber})
                                </div>
                            )}
                        </div>

                        {/* Page Info */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">
                                    Page {page.pageNumber}
                                </span>
                                {getStatusIcon(page.status)}
                            </div>

                            <div className="text-xs text-gray-600">
                                {page.status === 'pending' && 'Waiting'}
                                {page.status === 'processing' &&
                                    'Processing...'}
                                {page.status === 'completed' && 'Complete'}
                                {page.status === 'error' && 'Error'}
                            </div>

                            {page.bufferSize && (
                                <div className="text-xs text-gray-500">
                                    {(page.bufferSize / 1024).toFixed(0)} KB
                                </div>
                            )}
                        </div>

                        {/* Status Indicators */}
                        <div className="absolute top-2 right-2 flex space-x-1">
                            {page.status === 'processing' && (
                                <div className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded animate-pulse">
                                    Processing
                                </div>
                            )}
                            {page.retryCount && page.retryCount > 0 && (
                                <div className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded">
                                    R{page.retryCount}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Page Details Modal */}
            {selectedPage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold">
                                Page {selectedPage.pageNumber} Details
                            </h3>
                            <button
                                onClick={() => setSelectedPage(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Image Preview */}
                            <div>
                                <h4 className="font-medium mb-2">
                                    Page Preview
                                </h4>
                                {selectedPage.imageDataUrl && (
                                    <Image
                                        src={selectedPage.imageDataUrl}
                                        alt={`Page ${selectedPage.pageNumber}`}
                                        width={400}
                                        height={533}
                                        className="w-full border rounded"
                                    />
                                )}
                            </div>

                            {/* Details */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2">Status</h4>
                                    <div className="flex items-center space-x-2">
                                        {getStatusIcon(selectedPage.status)}
                                        <span className="capitalize">
                                            {selectedPage.status === 'completed'
                                                ? 'Complete'
                                                : selectedPage.status}
                                        </span>
                                    </div>
                                </div>

                                {selectedPage.error && (
                                    <div>
                                        <h4 className="font-medium mb-2 text-red-600">
                                            Error
                                        </h4>
                                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                            {selectedPage.error}
                                        </p>
                                    </div>
                                )}

                                {selectedPage.status === 'completed' &&
                                    selectedPage.extractedData && (
                                        <div>
                                            <h4 className="font-medium mb-2 text-green-600">
                                                Extracted Data
                                            </h4>
                                            <pre className="text-xs bg-green-50 p-2 rounded overflow-x-auto">
                                                {JSON.stringify(
                                                    selectedPage.extractedData,
                                                    null,
                                                    2,
                                                )}
                                            </pre>
                                        </div>
                                    )}

                                <div>
                                    <h4 className="font-medium mb-2">
                                        File Info
                                    </h4>
                                    <div className="text-sm space-y-1">
                                        <p>
                                            <strong>Filename:</strong>{' '}
                                            {selectedPage.fileName}
                                        </p>
                                        <p>
                                            <strong>Type:</strong>{' '}
                                            {selectedPage.mimeType}
                                        </p>
                                        <p>
                                            <strong>Size:</strong>{' '}
                                            {(
                                                selectedPage.bufferSize / 1024
                                            ).toFixed(0)}{' '}
                                            KB
                                        </p>
                                        {selectedPage.retryCount &&
                                            selectedPage.retryCount > 0 && (
                                                <p>
                                                    <strong>Retries:</strong>{' '}
                                                    {selectedPage.retryCount}
                                                </p>
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
