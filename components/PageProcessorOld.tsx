import {
    AlertCircle,
    CheckCircle,
    Clock,
    Eye,
    Loader2,
    Zap,
} from 'lucide-react';
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
    retryCount?: number; // Track how many times this page has been retried
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
    const [processingPages, setProcessingPages] = useState<PageData[]>([]);
    const [selectedPage, setSelectedPage] = useState<PageData | null>(null);
    const [startTime, setStartTime] = useState<number>(0);
    const processingStarted = useRef(false);
    const [concurrentProcessing, setConcurrentProcessing] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);
    const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Backend status polling function
    const startBackendStatusPolling = useCallback((sessionId: string) => {
        console.log('🔄 Starting backend status polling for session:', sessionId);
        setBackendSessionId(sessionId);
        setStartTime(Date.now());
        
        const pollStatus = async () => {
            try {
                const response = await fetch(`/api/batch-status/${sessionId}`);
                
                if (!response.ok) {
                    console.error('Backend status polling error:', response.status);
                    return;
                }
                
                const status = await response.json();
                console.log('📊 Backend status update:', {
                    status: status.status,
                    progress: `${status.completed_pages}/${status.total_pages}`,
                    processing_pages: status.processing_pages || [status.processing_page],
                    parallel_count: status.processing_pages ? status.processing_pages.length : 1
                });
                
                // Update processing pages based on backend status
                setProcessingPages(prev => {
                    return prev.map((page, index) => {
                        const pageInfo = status.pages_info?.[page.pageNumber];
                        
                        if (pageInfo) {
                            return {
                                ...page,
                                status: pageInfo.status === 'completed' ? 'completed' as const :
                                       pageInfo.status === 'failed' ? 'error' as const :
                                       pageInfo.status === 'processing' ? 'processing' as const :
                                       'pending' as const,
                                extractedData: pageInfo.document_id ? { id: pageInfo.document_id } : null,
                                error: pageInfo.error || null,
                                // Use image URL from backend if available
                                imageDataUrl: pageInfo.image_url ? 
                                    (pageInfo.image_url.startsWith('http') ? pageInfo.image_url : `http://localhost:8000${pageInfo.image_url}`) : 
                                    page.imageDataUrl
                            };
                        } else if (status.processing_pages && status.processing_pages.includes(page.pageNumber)) {
                            // New: check if page is in parallel processing list
                            return {
                                ...page,
                                status: 'processing' as const
                            };
                        } else if (status.processing_page === page.pageNumber) {
                            // Fallback: check single processing page for backward compatibility
                            return {
                                ...page,
                                status: 'processing' as const
                            };
                        } else if (page.pageNumber <= (status.completed_pages + status.failed_pages)) {
                            // Assume completed if within processed range and not specifically failed
                            const completedDoc = status.documents.find((d: any) => d.page === page.pageNumber);
                            return {
                                ...page,
                                status: completedDoc ? 'completed' as const : 'error' as const,
                                extractedData: completedDoc ? { id: completedDoc.id } : null
                            };
                        }
                        
                        return page;
                    });
                });
                
                // Call onPageComplete for newly completed pages
                if (status.documents && status.documents.length > 0) {
                    const currentProcessingPages = processingPages;
                    status.documents.forEach((doc: any) => {
                        // Find the current page in our state
                        const currentPage = currentProcessingPages.find(p => p.pageNumber === doc.page);
                        
                        // Only call onPageComplete if this page wasn't already completed
                        if (currentPage && currentPage.status !== 'completed') {
                            console.log(`📄 Page ${doc.page} completed, calling onPageComplete with doc ID: ${doc.id}`);
                            onPageComplete(doc.page, { 
                                id: doc.id,
                                data: doc.data || {},
                                metadata: doc.metadata || {}
                            });
                        }
                    });
                }
                
                // Stop polling if completed or failed
                if (status.status === 'completed' || status.status === 'failed' || 
                    (status.completed_pages + status.failed_pages) >= status.total_pages) {
                    console.log('🏁 Backend processing finished:', {
                        status: status.status,
                        completed: status.completed_pages,
                        failed: status.failed_pages,
                        total: status.total_pages
                    });
                    
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                    
                    // Clear session from storage
                    if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('batch-session');
                    }
                    
                    // Wait a moment for final document callbacks, then complete
                    setTimeout(() => {
                        onAllComplete();
                    }, 1000);
                }
                
            } catch (error) {
                console.error('Backend status polling failed:', error);
                
                // Stop polling after too many errors to prevent infinite loops
                if (error instanceof TypeError && error.message.includes('fetch failed')) {
                    console.log('❌ Backend unavailable, stopping polling and clearing session');
                    
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                    
                    // Clear session and notify completion
                    if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('batch-session');
                    }
                    
                    // Call completion to clean up UI
                    setTimeout(() => {
                        onAllComplete();
                    }, 2000);
                }
            }
        };
        
        // Poll immediately, then every 2 seconds
        pollStatus();
        pollingIntervalRef.current = setInterval(pollStatus, 2000);
    }, [onPageComplete, onAllComplete]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    // Initialize backend processing (backend mode only)
    useEffect(() => {
        console.log('📋 INITIALIZING PageProcessor with', pages.length, 'pages (backend mode only)');
        
        // Check if we have a batch session ID
        const batchSession = typeof window !== 'undefined' ? 
            JSON.parse(sessionStorage.getItem('batch-session') || '{}') : {};
        
        // Validate session age - clear if older than 1 hour
        const sessionAge = Date.now() - (batchSession.timestamp || 0);
        const isSessionValid = batchSession.sessionId && sessionAge < 3600000; // 1 hour
        
        if (isSessionValid) {
            console.log('🔄 Backend session detected:', batchSession.sessionId);
            
            // Verify session still exists on backend before polling
            fetch(`/api/batch-status/${batchSession.sessionId}`)
                .then(response => {
                    if (response.ok) {
                        console.log('✅ Backend session confirmed, starting polling');
                        initializeBackendMode(batchSession.sessionId);
                    } else {
                        console.log('❌ Backend session expired/not found, clearing session');
                        clearInvalidSession();
                        completeProcessing();
                    }
                })
                .catch(error => {
                    console.error('❌ Error verifying backend session:', error);
                    clearInvalidSession();
                    completeProcessing();
                });
        } else {
            if (batchSession.sessionId) {
                console.log('🗑️ Clearing expired session:', batchSession.sessionId);
                clearInvalidSession();
            }
            completeProcessing();
        }
        
        function initializeBackendMode(sessionId: string) {
            const freshPages = pages.map(page => ({
                ...page,
                status: 'pending' as const,
                extractedData: null,
                error: null,
                retryCount: 0
            }));
            
            setProcessingPages(freshPages);
            setBackendSessionId(sessionId);
            processingStarted.current = true;
            setIsInitialized(true);
            
            // Start backend status polling
            startBackendStatusPolling(sessionId);
        }
        
        function clearInvalidSession() {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('batch-session');
                localStorage.removeItem('processing-state');
            }
        }
        
        function completeProcessing() {
            console.log('🏁 No valid backend session - completing processing');
            setIsInitialized(true);
            // Complete immediately if no backend session
            setTimeout(() => {
                onAllComplete();
            }, 500);
        }
    }, [pages, startBackendStatusPolling, onAllComplete]); // Add startBackendStatusPolling to deps

    const processPage = useCallback(
        async (page: PageData) => {
            // Use state updater function to get current state for safety check
            let shouldSkip = false;
            setProcessingPages(prevPages => {
                const currentPageState = prevPages.find(
                    p => p.pageNumber === page.pageNumber,
                );
                if (
                    currentPageState &&
                    (currentPageState.status === 'processing' ||
                        currentPageState.status === 'completed')
                ) {
                    console.log(
                        `Page ${page.pageNumber} is already ${currentPageState.status}, skipping...`,
                    );
                    shouldSkip = true;
                }
                return prevPages; // Don't modify state here
            });

            if (shouldSkip) return;

            // CRITICAL VALIDATION: Ensure page has valid imageDataUrl before processing
            if (!page.imageDataUrl || page.imageDataUrl.length === 0) {
                console.error(`❌ Page ${page.pageNumber} missing imageDataUrl, skipping processing`);
                setProcessingPages(prev =>
                    prev.map(p =>
                        p.pageNumber === page.pageNumber
                            ? { 
                                ...p, 
                                status: 'error' as const,
                                error: 'Missing image URL - race condition detected'
                            }
                            : p,
                    ),
                );
                return;
            }

            console.log(`🔄 Starting to process page ${page.pageNumber} with imageUrl: ${page.imageDataUrl.substring(0, 50)}...`);

            // Track concurrent processing
            setConcurrentProcessing(prev => prev + 1);

            // Update status to processing
            setProcessingPages(prev =>
                prev.map(p =>
                    p.pageNumber === page.pageNumber
                        ? { ...p, status: 'processing' as const }
                        : p,
                ),
            );

            try {
                // Prepare request body with validation
                const requestBody = {
                    imageUrl: page.imageDataUrl, // Backend expects imageUrl
                    fileName: page.fileName,
                    mimeType: page.mimeType,
                    documentType,
                    originalFilename: originalFileName, // Backend expects lowercase 'n'
                    pageNumber: page.pageNumber,
                };

                // Final validation before sending
                if (!requestBody.imageUrl) {
                    throw new Error(`Missing imageUrl for page ${page.pageNumber}`);
                }

                console.log(`📤 Sending request for page ${page.pageNumber}:`, {
                    ...requestBody,
                    imageUrl: requestBody.imageUrl.substring(0, 50) + '...'
                });

                // Use imageDataUrl directly since it comes from backend split
                const response = await fetch('/api/process-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    // Increase timeout to match backend retry logic (up to ~12 minutes total)
                    // 3 attempts: 3min + 4min + 5min = ~12 minutes + safety buffer
                    signal: AbortSignal.timeout(15 * 60 * 1000), // 15 minutes timeout
                });

                const result = await response.json();

                if (result.success) {
                    console.log(
                        `Page ${page.pageNumber} processed successfully`,
                    );
                    // Update status to completed immediately on success
                    setProcessingPages(prev =>
                        prev.map(p =>
                            p.pageNumber === page.pageNumber
                                ? {
                                      ...p,
                                      status: 'completed' as const,
                                      extractedData: result.extractedData,
                                      error: null,
                                  }
                                : p,
                        ),
                    );

                    // Notify parent of completion
                    onPageComplete(page.pageNumber, result.extractedData);
                } else {
                    console.log(
                        `Page ${page.pageNumber} processing failed:`,
                        result.error,
                    );
                    // Update status to error immediately on failure
                    setProcessingPages(prev =>
                        prev.map(p =>
                            p.pageNumber === page.pageNumber
                                ? {
                                      ...p,
                                      status: 'error' as const,
                                      error: result.error,
                                  }
                                : p,
                        ),
                    );
                }
            } catch (error) {
                console.error(
                    `❌ Error processing page ${page.pageNumber}:`,
                    error,
                );
                setProcessingPages(prev =>
                    prev.map(p =>
                        p.pageNumber === page.pageNumber
                            ? {
                                  ...p,
                                  status: 'error' as const,
                                  error:
                                      error instanceof Error
                                          ? error.message
                                          : 'Unknown error',
                              }
                            : p,
                    ),
                );
            } finally {
                // Always decrease concurrent counter
                setConcurrentProcessing(prev => Math.max(0, prev - 1));
            }
        },
[documentType, originalFileName, onPageComplete],
    );

    // Function to retry failed pages
    const retryFailedPages = () => {
        const failedPages = processingPages.filter(p => p.status === 'error');
        console.log(`Retrying ${failedPages.length} failed pages...`);

        failedPages.forEach(page => {
            // Reset the page status to pending and increment retry count
            setProcessingPages(prev =>
                prev.map(p =>
                    p.pageNumber === page.pageNumber
                        ? {
                              ...p,
                              status: 'pending' as const,
                              error: null,
                              retryCount: (p.retryCount || 0) + 1,
                          }
                        : p,
                ),
            );

            // Process the page again
            setTimeout(() => processPage(page), 500); // Small delay to avoid overwhelming the API
        });
    };



    // Calculate overall progress and time estimation
    useEffect(() => {
        const completedCount = processingPages.filter(
            p => p.status === 'completed',
        ).length;
        const totalCount = processingPages.length;

        // Calculate estimated time remaining (for logging/debugging)
        if (completedCount > 0 && completedCount < totalCount) {
            const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
            const avgTimePerPage = elapsedTime / completedCount;
            const remainingPages = totalCount - completedCount;
            const estimatedSeconds = avgTimePerPage * remainingPages;

            if (estimatedSeconds < 60) {
                console.log(`⏱️ ~${Math.round(estimatedSeconds)}s remaining (${completedCount}/${totalCount} completed)`);
            } else {
                const minutes = Math.round(estimatedSeconds / 60);
                console.log(`⏱️ ~${minutes}m remaining (${completedCount}/${totalCount} completed)`);
            }
        } else if (completedCount === totalCount && totalCount > 0) {
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ Processing complete! Total time: ${totalTime}s for ${totalCount} pages`);
        }

        // Detect if too many pages are failing and suggest recovery
        const failedCount = processingPages.filter(p => p.status === 'error').length;
        if (failedCount > totalCount * 0.3 && totalCount > 10) {
            console.warn(`⚠️ High failure rate detected: ${failedCount}/${totalCount} pages failed. Consider reducing batch size or checking backend capacity.`);
        }
    }, [processingPages, startTime]);

    // Start processing when initialization is complete and pages are ready
    useEffect(() => {
        // Skip frontend processing if backend session exists
        if (backendSessionId) {
            console.log('🔄 Backend processing mode active, skipping frontend processing');
            return;
        }

        // Wait for initialization and valid pages
        if (!isInitialized || processingPages.length === 0) {
            console.log('⏳ Waiting for initialization...');
            return;
        }

        // Check if pages have imageDataUrl (indicating split-pdf completed successfully)  
        const hasValidPages = processingPages.length > 0 && processingPages[0].imageDataUrl && processingPages[0].imageDataUrl.length > 0;
        if (!hasValidPages) {
            console.log('⏳ Waiting for PDF split to complete before processing...');
            return;
        }

        // Prevent double-start
        if (processingStarted.current) {
            console.log('🛡️ Processing already started, skipping...');
            return;
        }

        // Count pages that need processing
        const pendingPages = processingPages.filter(p => p.status === 'pending');
        if (pendingPages.length === 0) {
            console.log('ℹ️ No pending pages to process');
            return;
        }

        // START PROCESSING
        processingStarted.current = true;
        setStartTime(Date.now());
        console.log(`🚀 STARTING FRONTEND PROCESSING: ${pendingPages.length} pages ready to process`);

        const startProcessing = async () => {
            // Filter pages that can actually be processed from current state
            const processablePages = processingPages.filter(p => p.status === 'pending' || p.status === 'error');
            
            console.log(`🚀 Starting to process ${processablePages.length} processable pages out of ${processingPages.length} total...`);
            
            if (processablePages.length === 0) {
                console.log('No pages need processing');
                return;
            }

            // Determine batch size based on processable pages - Optimized for client server
            const batchSize = processablePages.length > 30 ? 6 : processablePages.length > 20 ? 8 : processablePages.length > 10 ? 10 : 12;
            console.log(`📦 Using optimized batch size: ${batchSize} for ${processablePages.length} pages (frontend mode)`);

            const processBatch = async (startIndex: number) => {
                const endIndex = Math.min(startIndex + batchSize, processablePages.length);
                const batch = processablePages.slice(startIndex, endIndex);
                
                console.log(`🔄 Processing batch ${Math.floor(startIndex / batchSize) + 1}/${Math.ceil(processablePages.length / batchSize)} (pages ${batch.map(p => p.pageNumber).join(', ')})`);
                
                // Process batch in parallel (smaller groups)
                const batchPromises = batch.map(page => processPage(page));
                
                try {
                    await Promise.allSettled(batchPromises);
                    
                    // Reduced delay between batches for client server performance
                    if (endIndex < processablePages.length) {
                        await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1000ms to 300ms
                        await processBatch(endIndex);
                    }
                } catch (error) {
                    console.error(`Error in batch ${Math.floor(startIndex / batchSize) + 1}:`, error);
                    // Continue with next batch even if current batch has errors
                    if (endIndex < processablePages.length) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay on error
                        await processBatch(endIndex);
                    }
                }
            };

            try {
                await processBatch(0);
                console.log(`✅ Finished processing ${processablePages.length} processable pages`);
                onAllComplete();
            } catch (error) {
                console.error('Error in batch processing:', error);
            }
        };

        startProcessing();
    }, [isInitialized, processingPages.length, processingPages[0]?.imageDataUrl, backendSessionId]); // Trigger when initialized and pages are ready

    const getStatusIcon = (
        status: PageStatus,
        isCurrentlyProcessing = false,
    ) => {
        switch (status) {
            case 'pending':
                return <Clock className="w-4 h-4 text-gray-400" />;
            case 'processing':
                return (
                    <div className="flex items-center">
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        {isCurrentlyProcessing && (
                            <Zap className="w-3 h-3 text-yellow-500 animate-bounce ml-1" />
                        )}
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

    const getStatusColor = (status: PageStatus) => {
        switch (status) {
            case 'pending':
                return 'border-gray-300 bg-gray-50';
            case 'processing':
                return 'border-blue-300 bg-blue-50';
            case 'completed':
                return 'border-green-300 bg-green-50';
            case 'error':
                return 'border-red-300 bg-red-50';
        }
    };

    const completedCount = processingPages.filter(
        p => p.status === 'completed',
    ).length;
    const errorCount = processingPages.filter(p => p.status === 'error').length;
    const processingCount = processingPages.filter(
        p => p.status === 'processing',
    ).length;

    return (
        <div className="space-y-6">
            {/* Progress Summary */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Processing {originalFileName}
                    </h3>
                    <div className="flex items-center space-x-2">
                        <div className={`text-xs px-3 py-1 rounded-full border ${backendSessionId ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {backendSessionId ? 'Real-time backend processing' : 'Progress persists on reload'}
                        </div>
                        {backendSessionId && (
                            <button
                                onClick={() => {
                                    // Clear all sessions and refresh
                                    if (typeof window !== 'undefined') {
                                        sessionStorage.clear();
                                        localStorage.clear();
                                        window.location.reload();
                                    }
                                }}
                                className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                                title="Clear stuck session and refresh"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                            {processingPages.length}
                        </div>
                        <div className="text-sm text-gray-600">Total Pages</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {completedCount}
                        </div>
                        <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                            {processingCount}
                        </div>
                        <div className="text-sm text-gray-600">Processing</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                            {errorCount}
                        </div>
                        <div className="text-sm text-gray-600">Errors</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                        style={{
                            width: `${(completedCount / processingPages.length) * 100}%`,
                        }}
                    />
                </div>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>
                        {completedCount} of {processingPages.length} pages
                        processed
                    </span>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            Auto-saved & Persistent
                        </span>
                        {errorCount > 0 && (
                            <button
                                onClick={retryFailedPages}
                                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-full border border-red-200 transition-colors duration-200"
                            >
                                Retry {errorCount} Failed
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Page Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {processingPages.map(page => (
                    <div
                        key={page.pageNumber}
                        className={`border rounded-lg p-4 transition-all duration-300 hover:shadow-md cursor-pointer ${getStatusColor(page.status)}`}
                        onClick={() => setSelectedPage(page)}
                    >
                        {/* Page Preview */}
                        <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
                            {page.imageDataUrl ? (
                                <Image
                                    src={page.imageDataUrl}
                                    alt={`${originalFileName}-Page ${page.pageNumber}`}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">📄</div>
                                        <div className="text-sm">Page {page.pageNumber}</div>
                                        <div className="text-xs text-gray-400">
                                            {page.status === 'pending' ? 'Waiting...' : 
                                             page.status === 'processing' ? 'Processing...' : 
                                             page.status === 'completed' ? 'Complete' : 'Error'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Page Info */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-sm flex items-center space-x-1">
                                    <span>
                                        {originalFileName}-Page{' '}
                                        {page.pageNumber}
                                    </span>
                                    {page.retryCount && page.retryCount > 0 && (
                                        <span className="text-xs bg-orange-100 text-orange-700 px-1 py-0.5 rounded">
                                            Retry #{page.retryCount}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {Math.round(page.bufferSize / 1024)} KB
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {getStatusIcon(page.status)}
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        setSelectedPage(page);
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded"
                                >
                                    <Eye className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {page.status === 'error' && page.error && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                                {page.error}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Page Detail Modal */}
            {selectedPage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
                    <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold">
                                {originalFileName}-Page{' '}
                                {selectedPage.pageNumber} Details
                            </h3>
                            <button
                                onClick={() => setSelectedPage(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex flex-col lg:flex-row max-h-[calc(95vh-120px)]">
                            {/* Image Preview */}
                            <div className="lg:w-1/2 p-4 bg-gray-50 relative">
                                <div className="relative w-full h-96">
                                    {selectedPage.imageDataUrl ? (
                                        <Image
                                            src={selectedPage.imageDataUrl}
                                            alt={`${originalFileName}-Page ${selectedPage.pageNumber}`}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-gray-200 text-gray-500">
                                            <span>📄 Page {selectedPage.pageNumber}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Extracted Data */}
                            <div className="lg:w-1/2 p-4 overflow-y-auto">
                                <div className="flex items-center space-x-2 mb-4">
                                    {getStatusIcon(selectedPage.status)}
                                    <span className="font-medium capitalize">
                                        {selectedPage.status}
                                    </span>
                                </div>

                                {selectedPage.status === 'completed' &&
                                    selectedPage.extractedData && (
                                        <div>
                                            <h4 className="font-medium mb-2">
                                                Extracted Data:
                                            </h4>
                                            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                                                {JSON.stringify(
                                                    selectedPage.extractedData,
                                                    null,
                                                    2,
                                                )}
                                            </pre>
                                        </div>
                                    )}

                                {selectedPage.status === 'error' &&
                                    selectedPage.error && (
                                        <div>
                                            <h4 className="font-medium mb-2 text-red-600">
                                                Error:
                                            </h4>
                                            <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700">
                                                {selectedPage.error}
                                            </div>
                                        </div>
                                    )}

                                {selectedPage.status === 'processing' && (
                                    <div className="text-center py-8">
                                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                        <p className="text-gray-600">
                                            Processing page...
                                        </p>
                                    </div>
                                )}

                                {selectedPage.status === 'pending' && (
                                    <div className="text-center py-8">
                                        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600">
                                            Waiting to process...
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
