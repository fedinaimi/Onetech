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
    const [processingPages, setProcessingPages] = useState<PageData[]>(pages);
    const [selectedPage, setSelectedPage] = useState<PageData | null>(null);
    useState<string>('');
    const [startTime, setStartTime] = useState<number>(Date.now());
    const processingStarted = useRef(false); // Track if processing has started

    const processPage = useCallback(
        async (page: PageData) => {
            // Check if this page is already being processed or completed
            const currentPageState = processingPages.find(
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
                return;
            }

            console.log(`Starting to process page ${page.pageNumber}`);

            // Update status to processing
            setProcessingPages(prev =>
                prev.map(p =>
                    p.pageNumber === page.pageNumber
                        ? { ...p, status: 'processing' as const }
                        : p,
                ),
            );

            try {
                // Extract buffer from imageDataUrl
                const base64Data = page.imageDataUrl.split(',')[1];

                const response = await fetch('/api/process-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pageBuffer: base64Data,
                        fileName: page.fileName,
                        mimeType: page.mimeType,
                        documentType,
                        originalFileName,
                        pageNumber: page.pageNumber,
                    }),
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
                    `Error processing page ${page.pageNumber}:`,
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
            }
        },
        [processingPages, documentType, originalFileName, onPageComplete],
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
                console.log(`~${Math.round(estimatedSeconds)}s remaining`);
            } else {
                const minutes = Math.round(estimatedSeconds / 60);
                console.log(`~${minutes}m remaining`);
            }
        } else if (completedCount === totalCount) {
            console.log('Processing complete!');
        }
    }, [processingPages, startTime]);

    // Start processing all pages in parallel - only once
    useEffect(() => {
        if (processingStarted.current || pages.length === 0) {
            return; // Prevent duplicate processing
        }

        processingStarted.current = true;
        setStartTime(Date.now());

        const startProcessing = async () => {
            console.log(`Starting to process ${pages.length} pages...`);

            // Process all pages in parallel
            const processingPromises = pages.map(page => processPage(page));

            try {
                await Promise.allSettled(processingPromises);
                console.log(`Finished processing all ${pages.length} pages`);
                onAllComplete();
            } catch (error) {
                console.error('Error in parallel processing:', error);
            }
        };

        startProcessing();
    }, [pages.length, onAllComplete, processPage, pages]); // Fixed dependencies

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
                        Processing {originalFileName} - Fast Mode
                    </h3>
                    <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                        Progress persists on reload
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
                            <Image
                                src={page.imageDataUrl}
                                alt={`Page ${page.pageNumber}`}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>

                        {/* Page Info */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-sm flex items-center space-x-1">
                                    <span>Page {page.pageNumber}</span>
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold">
                                Page {selectedPage.pageNumber} Details
                            </h3>
                            <button
                                onClick={() => setSelectedPage(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-120px)]">
                            {/* Image Preview */}
                            <div className="lg:w-1/2 p-4 bg-gray-50 relative">
                                <div className="relative w-full h-96">
                                    <Image
                                        src={selectedPage.imageDataUrl}
                                        alt={`Page ${selectedPage.pageNumber}`}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
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
