import axios from 'axios';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Eye,
    FileText,
    HardDrive,
    Trash,
} from 'lucide-react';
import React, { useState } from 'react';

interface Props {
    doc: any;
    setSelectedDocument: (d: any) => void;
    loadDocuments: () => Promise<void>;
    selectedType: string;
    renderTableData?: (doc: any) => React.ReactNode;
}

export default function DocumentCardCompact({
    doc,
    setSelectedDocument,
    loadDocuments,
    selectedType,
    renderTableData,
}: Props) {
    const [deleting, setDeleting] = useState(false);
    const [expanded, setExpanded] = useState(false);

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

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            {/* Header */}
            <div
                className={`bg-gradient-to-r from-${color}-600 to-${color}-700 px-4 py-3`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="p-1.5 bg-gray-100 rounded-lg">
                            <FileText className="h-4 w-4 text-gray-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">
                                {doc.metadata.filename}
                            </h3>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div
                        className={`px-2 py-1 rounded-full ${
                            doc.updated_by_user
                                ? 'bg-orange-100 border border-orange-200'
                                : 'bg-green-100 border border-green-200'
                        }`}
                    >
                        {doc.updated_by_user ? (
                            <CheckCircle className="h-3 w-3 text-orange-600" />
                        ) : (
                            <AlertCircle className="h-3 w-3 text-green-600" />
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                            {new Date(
                                doc.metadata.processed_at,
                            ).toLocaleDateString()}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{formatFileSize(doc.metadata.file_size)}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setSelectedDocument(doc)}
                            className={`flex items-center space-x-1 px-3 py-1.5 bg-${color}-100 text-${color}-700 rounded-lg hover:bg-${color}-200 transition-colors text-sm`}
                        >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                        </button>

                        {renderTableData ? (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className={`flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm`}
                            >
                                {expanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                                <span>Fields</span>
                            </button>
                        ) : null}
                    </div>

                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                    >
                        <Trash className="h-3 w-3" />
                        <span className="hidden sm:inline">
                            {deleting ? 'Deleting...' : 'Delete'}
                        </span>
                    </button>
                </div>

                {/* Expandable Table Data */}
                {expanded && renderTableData ? (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        {renderTableData(doc)}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
