import { FileText, History, Trash } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';

interface Props {
    doc: any;
    setSelectedDocument: (d: any) => void;
    loadDocuments: () => Promise<void>;
    selectedType: string;
}

export default function DocumentItem({
    doc,
    setSelectedDocument,
    loadDocuments,
    selectedType,
}: Props) {
    const [deleting, setDeleting] = useState(false);

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

    return (
        <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <FileText className="flex-shrink-0 mr-3 h-5 w-5 text-gray-400" />
                    <div>
                        <p className="text-sm font-medium text-gray-900">
                            {doc.metadata.filename}
                        </p>
                        <p className="text-sm text-gray-500">
                            Processed:{' '}
                            {new Date(
                                doc.metadata.processed_at,
                            ).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {doc.updated_by_user && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Modified
                        </span>
                    )}
                    <div className="flex items-center space-x-1">
                        <button
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="Export as CSV"
                        >
                            CSV
                        </button>
                        <button
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title="Export as JSON"
                        >
                            JSON
                        </button>
                        <button
                            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                            title="Export as XLSX"
                        >
                            XLSX
                        </button>
                    </div>
                    <button
                        onClick={() => setSelectedDocument(doc)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View history"
                    >
                        <History size={16} />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                    >
                        <Trash size={16} />
                    </button>
                </div>
            </div>

            {/* Placeholder for table preview (kept in parent) */}
        </div>
    );
}
