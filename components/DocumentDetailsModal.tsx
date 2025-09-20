'use client';

import { GenericDocument } from '@/models/Document';
import { Download, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useState } from 'react';
import { KosuTable, NPTTable, RebutTable } from './TableRenderers';

interface DocumentDetailsModalProps {
    document: GenericDocument | null;
    isOpen: boolean;
    onClose: () => void;
}

export const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({
    document,
    isOpen,
    onClose,
}) => {
    const [imageZoom, setImageZoom] = useState(100);
    const [imageRotation, setImageRotation] = useState(0);

    if (!isOpen || !document) return null;

    const handleZoomIn = () => {
        setImageZoom(prev => Math.min(prev + 25, 300));
    };

    const handleZoomOut = () => {
        setImageZoom(prev => Math.max(prev - 25, 50));
    };

    const handleRotate = () => {
        setImageRotation(prev => (prev + 90) % 360);
    };

    const downloadImage = async () => {
        if (!document.imageUrl) return;

        try {
            const response = await fetch(document.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const linkElement = window.document.createElement('a');
            linkElement.href = url;
            linkElement.download = `${document.metadata.filename}_original.jpg`;
            window.document.body.appendChild(linkElement);
            linkElement.click();
            window.URL.revokeObjectURL(url);
            window.document.body.removeChild(linkElement);
        } catch (error) {
            console.error('Failed to download image:', error);
        }
    };

    const renderDataTable = () => {
        const documentType = document.metadata.document_type;

        // Common props for read-only tables
        const tableProps = {
            doc: document.data,
            selectedType: documentType as 'Rebut' | 'NPT' | 'Kosu',
            editingCell: null,
            editValue: '',
            setEditValue: () => {},
            setEditingCell: () => {},
            startEdit: () => {},
            saveEdit: () => {},
            setSelectedDocument: () => {},
        };

        switch (documentType) {
            case 'Rebut':
                return <RebutTable {...tableProps} />;
            case 'NPT':
                return <NPTTable {...tableProps} />;
            case 'Kosu':
                return <KosuTable {...tableProps} />;
            default:
                return (
                    <div className="p-4 text-gray-500">
                        <p>
                            Data table view not available for this document
                            type.
                        </p>
                        <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-auto">
                            {JSON.stringify(document.data, null, 2)}
                        </pre>
                    </div>
                );
        }
    };

    return (
        <>
            {/* Main Modal - Split View */}
            <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
                    {/* Modal Header */}
                    <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold">
                                Document Details
                            </h2>
                            <p className="text-blue-100 text-sm">
                                {document.metadata.filename} |{' '}
                                {document.metadata.document_type}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-300 p-1"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Split Content Area */}
                    <div className="flex h-[calc(95vh-80px)]">
                        {/* Left Side - Image Section */}
                        {document.imageUrl && (
                            <div className="w-1/2 border-r border-gray-200 flex flex-col">
                                {/* Image Controls */}
                                <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700">
                                        Original Document
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={handleZoomOut}
                                            className="p-1 hover:bg-gray-200 rounded"
                                            disabled={imageZoom <= 50}
                                            title="Zoom Out"
                                        >
                                            <ZoomOut size={16} />
                                        </button>
                                        <span className="px-2 py-1 text-xs bg-white rounded border">
                                            {imageZoom}%
                                        </span>
                                        <button
                                            onClick={handleZoomIn}
                                            className="p-1 hover:bg-gray-200 rounded"
                                            disabled={imageZoom >= 300}
                                            title="Zoom In"
                                        >
                                            <ZoomIn size={16} />
                                        </button>
                                        <button
                                            onClick={handleRotate}
                                            className="p-1 hover:bg-gray-200 rounded"
                                            title="Rotate"
                                        >
                                            <RotateCw size={16} />
                                        </button>
                                        <button
                                            onClick={downloadImage}
                                            className="p-1 hover:bg-gray-200 rounded"
                                            title="Download Image"
                                        >
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Image Container */}
                                <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
                                    <img
                                        src={document.imageUrl}
                                        alt="Document"
                                        className="max-w-full h-auto object-contain shadow-lg border border-gray-300"
                                        style={{
                                            transform: `scale(${imageZoom / 100}) rotate(${imageRotation}deg)`,
                                            transformOrigin: 'center',
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Right Side - Data Section */}
                        <div
                            className={`${document.imageUrl ? 'w-1/2' : 'w-full'} flex flex-col`}
                        >
                            {/* Data Header */}
                            <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Extracted Data
                                </h3>
                                <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded border">
                                    Extracted:{' '}
                                    {new Date(
                                        document.metadata.processed_at,
                                    ).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Data Content */}
                            <div className="flex-1 overflow-auto p-4">
                                <div className="space-y-6">
                                    {/* Document Metadata */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-800 mb-3">
                                            Document Information
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <span className="text-gray-600">
                                                    Type:
                                                </span>
                                                <span className="ml-2 font-medium">
                                                    {
                                                        document.metadata
                                                            .document_type
                                                    }
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">
                                                    Filename:
                                                </span>
                                                <span className="ml-2 font-medium">
                                                    {document.metadata.filename}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">
                                                    Processed:
                                                </span>
                                                <span className="ml-2 font-medium">
                                                    {new Date(
                                                        document.metadata.processed_at,
                                                    ).toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">
                                                    File Size:
                                                </span>
                                                <span className="ml-2 font-medium">
                                                    {(
                                                        document.metadata
                                                            .file_size / 1024
                                                    ).toFixed(1)}{' '}
                                                    KB
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Extracted Data Table */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-semibold text-gray-800">
                                                Extracted Data
                                            </h4>
                                            <div className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">
                                                Compare with original document
                                                (left side)
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                            {renderDataTable()}
                                        </div>
                                    </div>

                                    {/* Remark */}
                                    {document.remark &&
                                        document.remark !== 'no-remark' && (
                                            <div className="bg-blue-50 rounded-lg p-4">
                                                <h4 className="font-semibold text-blue-800 mb-2">
                                                    Processing Notes
                                                </h4>
                                                <p className="text-blue-700 text-sm">
                                                    {document.remark}
                                                </p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DocumentDetailsModal;
