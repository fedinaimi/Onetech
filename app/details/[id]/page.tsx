'use client';

import DocumentDetailsModal from '@/components/DocumentDetailsModal';
import { GenericDocument } from '@/models/Document';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DetailPageProps {
    params: {
        id: string;
    };
}

export default function DetailPage({ params }: DetailPageProps) {
    const router = useRouter();
    const [document, setDocument] = useState<GenericDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/documents/${params.id}`);

                if (!response.ok) {
                    throw new Error('Document not found');
                }

                const doc = await response.json();
                setDocument(doc);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Failed to load document',
                );
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchDocument();
        }
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document details...</p>
                </div>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Document Not Found
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {error || 'The requested document could not be found.'}
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Documents
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Documents
                        </button>
                        <div className="text-center">
                            <h1 className="text-xl font-semibold text-gray-900">
                                Document Details
                            </h1>
                            <p className="text-sm text-gray-500">
                                {document.metadata.filename} |{' '}
                                {document.metadata.document_type}
                            </p>
                        </div>
                        <div className="w-24"></div>{' '}
                        {/* Spacer for centering */}
                    </div>
                </div>
            </div>

            {/* Full-screen Document Details */}
            <div className="h-[calc(100vh-80px)]">
                <DocumentDetailsModal
                    document={document}
                    isOpen={true}
                    onClose={() => router.push('/')}
                />
            </div>
        </div>
    );
}
