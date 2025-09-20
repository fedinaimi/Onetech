import axios from 'axios';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    Expand,
    Eye,
    FileText,
    HardDrive,
    History,
    Trash,
} from 'lucide-react';
import React, { useState } from 'react';

interface Props {
    doc: any;
    setSelectedDocument: (d: any) => void;
    loadDocuments: () => Promise<void>;
    selectedType: string;
    renderTableData: (doc: any) => React.ReactNode;
    onViewDetails?: (doc: any) => void; // New prop for opening the details modal
}

export default function DocumentCard({
    doc,
    setSelectedDocument,
    loadDocuments,
    selectedType,
    renderTableData,
    onViewDetails,
}: Props) {
    const [deleting, setDeleting] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [exporting, setExporting] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!confirm('Delete this document? This action cannot be undone.'))
            return;
        setDeleting(true);
        try {
            const resp = await axios.delete(
                `/api/documents?id=${encodeURIComponent(doc.id)}&type=${encodeURIComponent(selectedType)}`,
            );
            if (resp.status >= 200 && resp.status < 300) {
                await loadDocuments();
            } else {
                const body = resp.data;
                alert(body?.error || 'Failed to delete document');
            }
        } catch (err: any) {
            console.error(err);
            const errorMessage =
                err.response?.data?.error || 'Error deleting document';
            alert(errorMessage);
        } finally {
            setDeleting(false);
        }
    };

    const handleExport = async (format: 'csv' | 'json' | 'xlsx') => {
        setExporting(format);
        try {
            const response = await axios.get(
                `/api/documents/${encodeURIComponent(doc.id)}/export?format=${format}&type=${encodeURIComponent(selectedType)}`,
                { responseType: 'blob' },
            );

            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${doc.metadata.filename.replace(/\.[^/.]+$/, '')}.${format}`;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting document:', error);
            alert('Failed to export document');
        } finally {
            setExporting(null);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getDocumentTypeColor = (type: string) => {
        const colors = {
            Rebut: 'blue',
            NPT: 'orange',
            Kosu: 'green',
        };
        return colors[type as keyof typeof colors] || 'gray';
    };

    const color = getDocumentTypeColor(selectedType);

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
            {/* Header */}
            <div
                className={`bg-gradient-to-r from-${color}-600 to-${color}-700 px-4 sm:px-6 py-3 sm:py-4`}
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 bg-gray-100 rounded-lg`}>
                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                                {doc.metadata.filename}
                            </h3>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-white text-opacity-90 text-xs sm:text-sm space-y-1 sm:space-y-0">
                                <span className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span>
                                        {new Date(
                                            doc.metadata.processed_at,
                                        ).toLocaleDateString()}
                                    </span>
                                </span>
                                <span className="flex items-center space-x-1">
                                    <HardDrive className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span>
                                        {formatFileSize(doc.metadata.file_size)}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    {doc.updated_by_user ? (
                        <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-orange-100 border border-orange-200 rounded-full">
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                            <span className="text-orange-700 text-xs sm:text-sm font-medium">
                                Modified
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-green-100 border border-green-200 rounded-full">
                            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                            <span className="text-green-700 text-xs sm:text-sm font-medium">
                                Original
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="text-center">
                        <div
                            className={`text-xl sm:text-2xl font-bold text-${color}-600`}
                        >
                            {new Date(
                                doc.metadata.processed_at,
                            ).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                            })}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                            Date
                        </div>
                    </div>
                    <div className="text-center">
                        <div
                            className={`text-xl sm:text-2xl font-bold text-${color}-600`}
                        >
                            {doc.metadata.document_type || selectedType}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                            Type
                        </div>
                    </div>
                    <div className="text-center col-span-2 sm:col-span-1">
                        <div
                            className={`text-xl sm:text-2xl font-bold text-${color}-600`}
                        >
                            {new Date(
                                doc.metadata.processed_at,
                            ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                            Time
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 mb-4 sm:mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className={`flex items-center space-x-1 px-3 sm:px-4 py-2 bg-${color}-100 text-${color}-700 rounded-lg hover:bg-${color}-200 transition-colors text-sm`}
                        >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{showDetails ? 'Hide' : 'Show'} Details</span>
                        </button>

                        {onViewDetails && (
                            <button
                                onClick={() => onViewDetails(doc)}
                                className="flex items-center space-x-1 px-3 sm:px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                                title="View full details with image"
                            >
                                <Expand className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>Full View</span>
                            </button>
                        )}

                        <button
                            onClick={() => setSelectedDocument(doc)}
                            className="flex items-center space-x-1 px-3 sm:px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                            title="View history"
                        >
                            <History className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>History</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Export Buttons */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => handleExport('csv')}
                                disabled={exporting === 'csv'}
                                className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50"
                                title="Export as CSV"
                            >
                                {exporting === 'csv' ? '...' : 'CSV'}
                            </button>
                            <button
                                onClick={() => handleExport('json')}
                                disabled={exporting === 'json'}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50"
                                title="Export as JSON"
                            >
                                {exporting === 'json' ? '...' : 'JSON'}
                            </button>
                            <button
                                onClick={() => handleExport('xlsx')}
                                disabled={exporting === 'xlsx'}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50"
                                title="Export as XLSX"
                            >
                                {exporting === 'xlsx' ? '...' : 'XLSX'}
                            </button>
                        </div>

                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                            title="Delete document"
                        >
                            <Trash className="h-4 w-4" />
                            {deleting && <span>Deleting...</span>}
                        </button>
                    </div>
                </div>

                {/* Document Details */}
                {showDetails && (
                    <div className="border-t border-gray-200 pt-4">
                        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                            {renderTableData(doc)}
                        </div>
                    </div>
                )}

                {/* Remark */}
                {doc.remark && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-sm font-medium text-yellow-800">
                            Remark:
                        </div>
                        <div className="text-sm text-yellow-700 mt-1">
                            {doc.remark}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
