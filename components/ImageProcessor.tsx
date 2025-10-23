import {
    AlertCircle,
    CheckCircle,
    Clock,
    Eye,
    Loader2,
    X,
    Zap,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type ImageStatus = 'pending' | 'processing' | 'completed' | 'error';

interface ImageData {
    fileName: string;
    mimeType: string;
    imageDataUrl: string;
    fileSize: number;
    status: ImageStatus;
    extractedData: any;
    error: string | null;
    retryCount?: number;
}

interface ImageProcessorProps {
    imageData: ImageData;
    documentType: string;
    originalFileName: string;
    onComplete: (data: any) => void;
    onError: (error: string) => void;
}

export default function ImageProcessor({
    imageData,
    documentType,
    originalFileName,
    onComplete,
    onError,
}: ImageProcessorProps) {
    const [processingImage, setProcessingImage] =
        useState<ImageData>(imageData);
    const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const processingStarted = useRef(false);

    const processImage = useCallback(
        async (image: ImageData) => {
            if (image.status === 'processing' || image.status === 'completed') {
                console.log(`Image is already ${image.status}, skipping...`);
                return;
            }

            console.log('Starting to process image:', image.fileName);

            // Update status to processing
            setProcessingImage(prev => ({ ...prev, status: 'processing' }));

            try {
                const response = await fetch('/api/process-page', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        imageUrl: image.imageDataUrl, // Backend expects imageUrl
                        fileName: image.fileName,
                        mimeType: image.mimeType,
                        documentType,
                        originalFilename: originalFileName, // Backend expects lowercase 'n'
                        pageNumber: 1, // Images are treated as single page
                    }),
                    signal: AbortSignal.timeout(15 * 60 * 1000), // 15 minutes timeout
                });

                const result = await response.json();

                if (result.success) {
                    console.log('Image processed successfully');
                    setProcessingImage(prev => ({
                        ...prev,
                        status: 'completed',
                        extractedData: result.extractedData,
                        error: null,
                    }));

                    // Pass the complete document data instead of just extractedData
                    onComplete(result.extractedData);
                } else {
                    console.log('Image processing failed:', result.error);
                    setProcessingImage(prev => ({
                        ...prev,
                        status: 'error',
                        error: result.error,
                    }));

                    onError(result.error);
                }
            } catch (error) {
                console.error('Error processing image:', error);
                const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';

                setProcessingImage(prev => ({
                    ...prev,
                    status: 'error',
                    error: errorMessage,
                }));

                onError(errorMessage);
            }
        },
        [documentType, originalFileName, onComplete, onError],
    );

    // Auto-start processing when component mounts
    useEffect(() => {
        if (
            !processingStarted.current &&
            processingImage.status === 'pending'
        ) {
            processingStarted.current = true;
            setStartTime(Date.now());
            processImage(processingImage);
        }
    }, [processingImage, processImage]);

    const getStatusIcon = (status: ImageStatus) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-blue-500" />;
            case 'processing':
                return (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                );
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status: ImageStatus) => {
        switch (status) {
            case 'pending':
                return 'border-blue-200 bg-blue-50';
            case 'processing':
                return 'border-blue-300 bg-blue-100 animate-pulse';
            case 'completed':
                return 'border-green-300 bg-green-50';
            case 'error':
                return 'border-red-300 bg-red-50';
            default:
                return 'border-gray-200 bg-gray-50';
        }
    };

    const getElapsedTime = () => {
        if (processingImage.status === 'pending') return '';
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        return `${elapsed}s`;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500 bg-opacity-20 rounded-lg">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">
                                Processing Image
                            </h3>
                            <p className="text-sm text-blue-100">
                                {documentType} •{' '}
                                {formatFileSize(processingImage.fileSize)}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm opacity-90">
                            {getElapsedTime()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {/* Image Preview */}
                <div className="mb-6">
                    <div
                        className={`
                            border-2 rounded-lg p-4 transition-all duration-300 cursor-pointer
                            ${getStatusColor(processingImage.status)}
                            ${selectedImage ? 'ring-2 ring-blue-500' : ''}
                        `}
                        onClick={() => setSelectedImage(processingImage)}
                    >
                        <div className="flex items-start space-x-4">
                            {/* Image Thumbnail */}
                            <div className="flex-shrink-0">
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                                    <Image
                                        src={processingImage.imageDataUrl}
                                        alt={processingImage.fileName}
                                        fill
                                        className="object-cover"
                                        sizes="96px"
                                    />
                                </div>
                            </div>

                            {/* Image Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-gray-900 truncate">
                                        {processingImage.fileName}
                                    </h4>
                                    <div className="flex items-center space-x-2">
                                        {getStatusIcon(processingImage.status)}
                                        <span className="text-sm text-gray-600 capitalize">
                                            {processingImage.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-sm text-gray-600">
                                        Type: {processingImage.mimeType}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Size:{' '}
                                        {formatFileSize(
                                            processingImage.fileSize,
                                        )}
                                    </div>
                                </div>

                                {/* Status Messages */}
                                {processingImage.status === 'processing' && (
                                    <div className="mt-3 text-sm text-blue-600 flex items-center space-x-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>
                                            Extracting data from image...
                                        </span>
                                    </div>
                                )}

                                {processingImage.status === 'completed' && (
                                    <div className="mt-3 text-sm text-green-600 flex items-center space-x-2">
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Successfully processed!</span>
                                    </div>
                                )}

                                {processingImage.status === 'error' &&
                                    processingImage.error && (
                                        <div className="mt-3 text-sm text-red-600 flex items-center space-x-2">
                                            <AlertCircle className="h-4 w-4" />
                                            <span>{processingImage.error}</span>
                                        </div>
                                    )}
                            </div>

                            {/* Preview Button */}
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    setSelectedImage(processingImage);
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Preview image"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                            Processing Status:
                        </span>
                        <span
                            className={`font-medium ${
                                processingImage.status === 'completed'
                                    ? 'text-green-600'
                                    : processingImage.status === 'error'
                                      ? 'text-red-600'
                                      : processingImage.status === 'processing'
                                        ? 'text-blue-600'
                                        : 'text-gray-600'
                            }`}
                        >
                            {processingImage.status === 'completed' &&
                                'Completed Successfully'}
                            {processingImage.status === 'error' &&
                                'Processing Failed'}
                            {processingImage.status === 'processing' &&
                                'In Progress...'}
                            {processingImage.status === 'pending' &&
                                'Waiting to Start'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-full">
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <div className="relative">
                            <Image
                                src={selectedImage.imageDataUrl}
                                alt={selectedImage.fileName}
                                width={800}
                                height={600}
                                className="object-contain max-h-[80vh] rounded-lg"
                                sizes="800px"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
