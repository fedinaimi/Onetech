import {
    Calendar,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
    Edit2,
    FileText,
    Folder,
    FolderOpen,
    List,
    Loader2,
    Save,
    Search,
    Shield,
    Square,
    Table,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import React, { Fragment, useMemo, useState } from 'react';

type ViewMode = 'list' | 'table' | 'grouped';
type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc';

interface Props {
    documents: any[];
    isLoading: boolean;
    setSelectedDocument: (d: any) => void;
    loadDocuments: () => Promise<void>;
    selectedType: string;
    renderTableData?: (doc: any) => React.ReactNode;
    onDeleteDocument?: (id: string, type: string) => Promise<void>;
    onVerifyDocument?: (doc: any) => void;
    renamingDocument?: { id: string; currentName: string } | null;
    renameValue?: string;
    setRenameValue?: (value: string) => void;
    startRename?: (id: string, currentFilename: string) => void;
    saveRename?: () => Promise<void>;
    cancelRename?: () => void;
}

export default function DocumentList({
    documents,
    isLoading,
    setSelectedDocument,
    loadDocuments,
    selectedType,
    renderTableData,
    onDeleteDocument,
    onVerifyDocument,
    renamingDocument,
    renameValue,
    setRenameValue,
    startRename,
    saveRename,
    cancelRename,
}: Props) {
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');
    const [sortOption, setSortOption] = useState<SortOption>('date-desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(),
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        id: string;
        filename: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
        new Set(),
    );
    const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Helper function to extract base filename from document
    const getBaseFilename = (doc: any): string => {
        const filename =
            doc.metadata?.original_filename || doc.metadata?.filename || '';

        // Remove file extension
        const withoutExt = filename.replace(
            /\.(pdf|png|jpg|jpeg|gif|bmp|tiff|webp)$/i,
            '',
        );

        // Extract base name (remove _page_X_timestamp pattern)
        const match = withoutExt.match(/^(.+?)(?:_page_\d+(?:_\d+)?)?$/);
        return match ? match[1] : withoutExt;
    };

    // Filter documents based on search and date filters
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            // Search filter
            const searchMatch =
                searchQuery === '' ||
                doc.metadata.filename
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                (doc.metadata.document_type &&
                    doc.metadata.document_type
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())) ||
                (doc.extracted_data &&
                    JSON.stringify(doc.extracted_data)
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()));

            // Date filter
            let dateMatch = true;
            if (dateFrom || dateTo) {
                const docDate = new Date(doc.metadata.processed_at);
                const fromDate = dateFrom ? new Date(dateFrom) : null;
                const toDate = dateTo ? new Date(dateTo) : null;

                if (fromDate && docDate < fromDate) dateMatch = false;
                if (toDate && docDate > toDate) dateMatch = false;
            }

            return searchMatch && dateMatch;
        });
    }, [documents, searchQuery, dateFrom, dateTo]);

    // Sort filtered documents with page number awareness
    const sortedDocuments = useMemo(() => {
        const sorted = [...filteredDocuments];

        switch (sortOption) {
            case 'name-asc':
                sorted.sort((a, b) => {
                    const nameA = getBaseFilename(a);
                    const nameB = getBaseFilename(b);
                    const nameCompare = nameA.localeCompare(nameB);

                    // If same base filename, sort by page number
                    if (nameCompare === 0) {
                        const pageA = a.metadata?.page_number || 0;
                        const pageB = b.metadata?.page_number || 0;
                        return pageA - pageB;
                    }
                    return nameCompare;
                });
                break;
            case 'name-desc':
                sorted.sort((a, b) => {
                    const nameA = getBaseFilename(a);
                    const nameB = getBaseFilename(b);
                    const nameCompare = nameB.localeCompare(nameA);

                    // If same base filename, sort by page number
                    if (nameCompare === 0) {
                        const pageA = a.metadata?.page_number || 0;
                        const pageB = b.metadata?.page_number || 0;
                        return pageA - pageB;
                    }
                    return nameCompare;
                });
                break;
            case 'date-asc':
                sorted.sort((a, b) => {
                    const dateA = new Date(
                        a.metadata?.processed_at || a.created_at,
                    );
                    const dateB = new Date(
                        b.metadata?.processed_at || b.created_at,
                    );
                    const dateCompare = dateA.getTime() - dateB.getTime();

                    // If same date, sort by base filename then page number
                    if (dateCompare === 0) {
                        const nameA = getBaseFilename(a);
                        const nameB = getBaseFilename(b);
                        const nameCompare = nameA.localeCompare(nameB);
                        if (nameCompare === 0) {
                            const pageA = a.metadata?.page_number || 0;
                            const pageB = b.metadata?.page_number || 0;
                            return pageA - pageB;
                        }
                        return nameCompare;
                    }
                    return dateCompare;
                });
                break;
            case 'date-desc':
            default:
                sorted.sort((a, b) => {
                    const dateA = new Date(
                        a.metadata?.processed_at || a.created_at,
                    );
                    const dateB = new Date(
                        b.metadata?.processed_at || b.created_at,
                    );
                    const dateCompare = dateB.getTime() - dateA.getTime();

                    // If same date, sort by base filename then page number
                    if (dateCompare === 0) {
                        const nameA = getBaseFilename(a);
                        const nameB = getBaseFilename(b);
                        const nameCompare = nameA.localeCompare(nameB);
                        if (nameCompare === 0) {
                            const pageA = a.metadata?.page_number || 0;
                            const pageB = b.metadata?.page_number || 0;
                            return pageA - pageB;
                        }
                        return nameCompare;
                    }
                    return dateCompare;
                });
                break;
        }

        return sorted;
    }, [filteredDocuments, sortOption]);

    // Group documents by base filename
    const groupedDocuments = useMemo(() => {
        const groups = new Map<string, any[]>();

        sortedDocuments.forEach(doc => {
            const baseFilename = getBaseFilename(doc);
            if (!groups.has(baseFilename)) {
                groups.set(baseFilename, []);
            }
            groups.get(baseFilename)!.push(doc);
        });

        // Convert to array and add metadata
        return Array.from(groups.entries()).map(([baseName, docs]) => {
            // Sort documents within group by page number
            const sortedDocs = docs.sort((a, b) => {
                const pageA = a.metadata?.page_number || 0;
                const pageB = b.metadata?.page_number || 0;
                return pageA - pageB;
            });

            // Get earliest and latest dates in group
            const dates = sortedDocs.map(
                d => new Date(d.metadata?.processed_at || d.created_at),
            );
            const earliestDate = new Date(
                Math.min(...dates.map(d => d.getTime())),
            );
            const latestDate = new Date(
                Math.max(...dates.map(d => d.getTime())),
            );

            return {
                baseName,
                documents: sortedDocs,
                count: sortedDocs.length,
                earliestDate,
                latestDate,
                totalSize: sortedDocs.reduce(
                    (sum, d) => sum + (d.metadata?.file_size || 0),
                    0,
                ),
            };
        });
    }, [sortedDocuments]);

    // Pagination calculations (works for both grouped and ungrouped)
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        if (viewMode === 'grouped') {
            return groupedDocuments.slice(startIndex, endIndex);
        } else {
            return sortedDocuments.slice(startIndex, endIndex);
        }
    }, [
        viewMode,
        groupedDocuments,
        sortedDocuments,
        currentPage,
        itemsPerPage,
    ]);

    const totalPages = Math.ceil(
        (viewMode === 'grouped'
            ? groupedDocuments.length
            : sortedDocuments.length) / itemsPerPage,
    );
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(
        currentPage * itemsPerPage,
        viewMode === 'grouped'
            ? groupedDocuments.length
            : sortedDocuments.length,
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        setExpandedRows(new Set()); // Clear expanded rows when changing pages
    };

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1); // Reset to first page
        setExpandedRows(new Set());
    };

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1); // Reset to first page when searching
    };

    const handleDateFilterChange = (from: string, to: string) => {
        setDateFrom(from);
        setDateTo(to);
        setCurrentPage(1); // Reset to first page when filtering
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const toggleGroup = (baseName: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(baseName)) {
                newSet.delete(baseName);
            } else {
                newSet.add(baseName);
            }
            return newSet;
        });
    };

    const toggleAllGroups = () => {
        if (expandedGroups.size === groupedDocuments.length) {
            // Collapse all
            setExpandedGroups(new Set());
        } else {
            // Expand all
            setExpandedGroups(new Set(groupedDocuments.map(g => g.baseName)));
        }
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

    const formatFileSize = (bytes: number | null | undefined) => {
        // Handle null, undefined, NaN, or 0
        if (!bytes || isNaN(bytes) || bytes === 0) {
            return '—';
        }

        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const toggleRowExpansion = (docId: string) => {
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(docId)) {
            newExpandedRows.delete(docId);
        } else {
            newExpandedRows.add(docId);
        }
        setExpandedRows(newExpandedRows);
    };

    const handleDeleteClick = (doc: any) => {
        setDeleteConfirmation({
            id: doc.id,
            filename: doc.metadata.filename,
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmation || !onDeleteDocument) return;

        setIsDeleting(deleteConfirmation.id);
        try {
            await onDeleteDocument(deleteConfirmation.id, selectedType);
            await loadDocuments(); // Refresh the documents list
        } catch (error) {
            console.error('Failed to delete document:', error);
            // You might want to show an error toast here
        } finally {
            setIsDeleting(null);
            setDeleteConfirmation(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmation(null);
    };

    // Helper function to get the button text and action based on verification status
    const getDocumentActionButton = (doc: any) => {
        const status = doc.verification_status;
        if (status === 'verified') {
            return {
                text: 'View Details',
                className:
                    'flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm',
                action: () => setSelectedDocument(doc), // View mode
                icon: FileText,
            };
        } else {
            return {
                text: 'Verify',
                className:
                    'flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm',
                action: () => onVerifyDocument?.(doc), // Edit mode
                icon: Shield,
            };
        }
    };

    // Bulk delete functions
    const handleSelectDocument = (docId: string) => {
        const newSelected = new Set(selectedDocuments);
        if (newSelected.has(docId)) {
            newSelected.delete(docId);
        } else {
            newSelected.add(docId);
        }
        setSelectedDocuments(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedDocuments.size === filteredDocuments.length) {
            setSelectedDocuments(new Set());
        } else {
            setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedDocuments.size > 0) {
            setBulkDeleteDialog(true);
        }
    };

    const handleBulkDeleteConfirm = async () => {
        if (!onDeleteDocument || selectedDocuments.size === 0) return;

        setIsBulkDeleting(true);
        try {
            const deletePromises = Array.from(selectedDocuments).map(id =>
                onDeleteDocument(id, selectedType),
            );
            await Promise.all(deletePromises);
            await loadDocuments();
            setSelectedDocuments(new Set());
        } catch (error) {
            console.error('Failed to delete documents:', error);
        } finally {
            setIsBulkDeleting(false);
            setBulkDeleteDialog(false);
        }
    };

    const handleBulkDeleteCancel = () => {
        setBulkDeleteDialog(false);
    };

    const handleDownloadFiltered = async () => {
        if (filteredDocuments.length === 0) {
            alert('No documents to export');
            return;
        }

        setIsDownloading(true);
        try {
            const response = await fetch('/api/documents/export-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: selectedType,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    searchQuery: searchQuery || undefined,
                }),
            });

            if (!response.ok) {
                let errorMessage = `Export failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage =
                        errorData.error || errorData.detail || errorMessage;
                    console.error('[EXPORT] Error response:', errorData);
                } catch (e) {
                    console.error(
                        '[EXPORT] Could not parse error response:',
                        e,
                    );
                }
                throw new Error(errorMessage);
            }

            // Get filename from response headers
            const contentDisposition = response.headers.get(
                'Content-Disposition',
            );
            let filename = `${selectedType}_Documents_Export.xlsx`;
            if (contentDisposition) {
                const filenameMatch =
                    contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            alert(
                `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        } finally {
            setIsDownloading(false);
        }
    };

    const ViewModeButton = ({
        mode,
        icon: Icon,
        label,
    }: {
        mode: ViewMode;
        icon: any;
        label: string;
    }) => (
        <button
            onClick={() => setViewMode(mode)}
            className={`
                flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200
                ${
                    viewMode === mode
                        ? `bg-${color}-100 text-${color}-700 shadow-sm`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
            `}
            title={`${label} view`}
        >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">
                {label}
            </span>
        </button>
    );

    return (
        <div className="mt-4 sm:mt-6 md:mt-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 sm:mb-6 space-y-3 lg:space-y-0">
                <div className="flex items-center space-x-3">
                    <div
                        className={`p-2 bg-${color}-100 rounded-lg flex-shrink-0`}
                    >
                        <FolderOpen
                            className={`h-5 w-5 sm:h-6 sm:w-6 text-${color}-600`}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                            {selectedType} Documents
                        </h2>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 truncate">
                            {filteredDocuments.length} document
                            {filteredDocuments.length !== 1 ? 's' : ''} found
                            {(searchQuery || dateFrom || dateTo) &&
                                ` (${documents.length} total)`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    {/* View Mode Selector */}
                    {documents.length > 0 && (
                        <div className="flex items-center space-x-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 order-2 sm:order-1">
                            <ViewModeButton
                                mode="list"
                                icon={List}
                                label="List"
                            />
                            <ViewModeButton
                                mode="grouped"
                                icon={Folder}
                                label="Grouped"
                            />
                            <ViewModeButton
                                mode="table"
                                icon={Table}
                                label="Table"
                            />
                        </div>
                    )}

                    {/* Sort Options */}
                    {documents.length > 0 && (
                        <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                Sort:
                            </span>
                            <select
                                value={sortOption}
                                onChange={e =>
                                    setSortOption(e.target.value as SortOption)
                                }
                                className="text-sm border-0 bg-transparent focus:ring-0 cursor-pointer text-gray-700 font-medium"
                            >
                                <option value="date-desc">
                                    Date (Newest First)
                                </option>
                                <option value="date-asc">
                                    Date (Oldest First)
                                </option>
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                            </select>
                        </div>
                    )}

                    {/* Expand/Collapse All for Grouped View */}
                    {documents.length > 0 &&
                        viewMode === 'grouped' &&
                        groupedDocuments.length > 0 && (
                            <button
                                onClick={toggleAllGroups}
                                className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                {expandedGroups.size ===
                                groupedDocuments.length ? (
                                    <>
                                        <ChevronUp className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            Collapse All
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            Expand All
                                        </span>
                                    </>
                                )}
                            </button>
                        )}

                    {isLoading && (
                        <div className="flex items-center justify-center sm:justify-start space-x-2 text-gray-600 bg-white px-3 sm:px-4 py-2 rounded-lg shadow order-1 sm:order-2">
                            <Loader2 className="animate-spin" size={16} />
                            <span className="text-sm">
                                Loading documents...
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Search and Filter Bar */}
            {documents.length > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-lg shadow border border-gray-200">
                    <div className="flex flex-col xl:flex-row gap-3 sm:gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 min-w-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search documents..."
                                    value={searchQuery}
                                    onChange={e =>
                                        handleSearchChange(e.target.value)
                                    }
                                    className={`w-full pl-10 pr-10 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm sm:text-base ${
                                        searchQuery
                                            ? 'text-gray-900 font-medium'
                                            : 'text-gray-700'
                                    }`}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearchChange('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                        title="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Date Filter */}
                        <div className="flex flex-col lg:flex-row gap-3 xl:w-auto">
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                    Date Range:
                                </span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                <div className="relative flex-1 sm:flex-none">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e =>
                                            handleDateFilterChange(
                                                e.target.value,
                                                dateTo,
                                            )
                                        }
                                        className={`w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                                            dateFrom
                                                ? 'text-gray-900 font-medium'
                                                : 'text-gray-500'
                                        }`}
                                        style={{
                                            colorScheme: 'light',
                                        }}
                                        title="From date"
                                    />
                                </div>
                                <div className="flex items-center justify-center flex-shrink-0 py-1 sm:py-0">
                                    <span className="text-gray-500 text-sm font-medium">
                                        to
                                    </span>
                                </div>
                                <div className="relative flex-1 sm:flex-none">
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={e =>
                                            handleDateFilterChange(
                                                dateFrom,
                                                e.target.value,
                                            )
                                        }
                                        className={`w-full px-3 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                                            dateTo
                                                ? 'text-gray-900 font-medium'
                                                : 'text-gray-500'
                                        }`}
                                        style={{
                                            colorScheme: 'light',
                                        }}
                                        title="To date"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            {/* Clear Filters Button */}
                            {(searchQuery || dateFrom || dateTo) && (
                                <button
                                    onClick={clearFilters}
                                    className={`px-3 sm:px-4 py-2 sm:py-3 bg-${color}-100 text-${color}-700 rounded-lg hover:bg-${color}-200 transition-colors text-sm font-medium whitespace-nowrap flex items-center justify-center space-x-2 min-h-[44px]`}
                                    title="Clear all filters"
                                >
                                    <X className="h-4 w-4 flex-shrink-0" />
                                    <span className="hidden sm:inline">
                                        Clear Filters
                                    </span>
                                    <span className="sm:hidden">Clear</span>
                                </button>
                            )}

                            {/* Download Filtered Results Button */}
                            {filteredDocuments.length > 0 && (
                                <button
                                    onClick={handleDownloadFiltered}
                                    disabled={isDownloading}
                                    className={`px-3 sm:px-4 py-2 sm:py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium whitespace-nowrap flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]`}
                                    title={`Download ${filteredDocuments.length} filtered document${filteredDocuments.length !== 1 ? 's' : ''} as Excel file`}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                                    ) : (
                                        <Download className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    <span className="hidden sm:inline">
                                        {isDownloading
                                            ? 'Downloading...'
                                            : `Download XLSX (${filteredDocuments.length})`}
                                    </span>
                                    <span className="sm:hidden">
                                        {isDownloading ? 'DL...' : 'Excel'}
                                    </span>
                                </button>
                            )}

                            {/* Bulk Delete Button */}
                            {selectedDocuments.size > 0 && (
                                <button
                                    onClick={handleBulkDeleteClick}
                                    className="px-3 sm:px-4 py-2 sm:py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium whitespace-nowrap flex items-center justify-center space-x-2 min-h-[44px]"
                                    title={`Delete ${selectedDocuments.size} selected document${selectedDocuments.size !== 1 ? 's' : ''}`}
                                >
                                    <Trash2 className="h-4 w-4 flex-shrink-0" />
                                    <span className="hidden sm:inline">
                                        Delete Selected (
                                        {selectedDocuments.size})
                                    </span>
                                    <span className="sm:hidden">
                                        Delete ({selectedDocuments.size})
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bulk Selection Controls */}
                    {filteredDocuments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={handleSelectAll}
                                        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        {selectedDocuments.size ===
                                            filteredDocuments.length &&
                                        filteredDocuments.length > 0 ? (
                                            <CheckSquare className="h-4 w-4 text-blue-600" />
                                        ) : (
                                            <Square className="h-4 w-4" />
                                        )}
                                        <span>
                                            {selectedDocuments.size ===
                                                filteredDocuments.length &&
                                            filteredDocuments.length > 0
                                                ? 'Deselect All'
                                                : 'Select All'}
                                        </span>
                                    </button>
                                    {selectedDocuments.size > 0 && (
                                        <span className="text-sm text-gray-500">
                                            {selectedDocuments.size} document
                                            {selectedDocuments.size !== 1
                                                ? 's'
                                                : ''}{' '}
                                            selected
                                        </span>
                                    )}
                                </div>
                                {selectedDocuments.size > 0 && (
                                    <button
                                        onClick={() =>
                                            setSelectedDocuments(new Set())
                                        }
                                        className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                        <span>Clear Selection</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filter Summary */}
                    {(searchQuery || dateFrom || dateTo) && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-gray-500">
                                    Active filters:
                                </span>
                                {searchQuery && (
                                    <span
                                        className={`px-2 py-1 bg-${color}-100 text-${color}-700 rounded-md`}
                                    >
                                        Search: &quot;{searchQuery}&quot;
                                    </span>
                                )}
                                {dateFrom && (
                                    <span
                                        className={`px-2 py-1 bg-${color}-100 text-${color}-700 rounded-md`}
                                    >
                                        From:{' '}
                                        {new Date(
                                            dateFrom,
                                        ).toLocaleDateString()}
                                    </span>
                                )}
                                {dateTo && (
                                    <span
                                        className={`px-2 py-1 bg-${color}-100 text-${color}-700 rounded-md`}
                                    >
                                        To:{' '}
                                        {new Date(dateTo).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {filteredDocuments.length > 0 ? (
                <div>
                    {/* List View */}
                    {viewMode === 'list' && (
                        <div className="space-y-3 sm:space-y-4">
                            {paginatedData.map(doc => {
                                const isExpanded = expandedRows.has(doc.id);
                                return (
                                    <div
                                        key={doc.id}
                                        className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                                    >
                                        <div className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                                <div className="flex items-center space-x-3">
                                                    {/* Selection Checkbox */}
                                                    <button
                                                        onClick={() =>
                                                            handleSelectDocument(
                                                                doc.id,
                                                            )
                                                        }
                                                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                                                        title={
                                                            selectedDocuments.has(
                                                                doc.id,
                                                            )
                                                                ? 'Deselect document'
                                                                : 'Select document'
                                                        }
                                                    >
                                                        {selectedDocuments.has(
                                                            doc.id,
                                                        ) ? (
                                                            <CheckSquare className="h-5 w-5 text-blue-600" />
                                                        ) : (
                                                            <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                                        )}
                                                    </button>

                                                    <div
                                                        className={`p-2 bg-${color}-100 rounded-lg`}
                                                    >
                                                        <FileText
                                                            className={`h-5 w-5 text-${color}-600`}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {renamingDocument?.id ===
                                                        doc.id ? (
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <input
                                                                    type="text"
                                                                    value={
                                                                        renameValue
                                                                    }
                                                                    onChange={e =>
                                                                        setRenameValue?.(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    className="font-semibold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                                                                    autoFocus
                                                                    onKeyDown={e => {
                                                                        if (
                                                                            e.key ===
                                                                            'Enter'
                                                                        ) {
                                                                            saveRename?.();
                                                                        } else if (
                                                                            e.key ===
                                                                            'Escape'
                                                                        ) {
                                                                            cancelRename?.();
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() =>
                                                                        saveRename?.()
                                                                    }
                                                                    className="text-green-600 hover:text-green-800 p-1"
                                                                    title="Save"
                                                                >
                                                                    <Save className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        cancelRename?.()
                                                                    }
                                                                    className="text-gray-500 hover:text-gray-700 p-1"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between group mb-2">
                                                                <h3 className="font-semibold text-gray-900 truncate">
                                                                    {
                                                                        doc
                                                                            .metadata
                                                                            .filename
                                                                    }
                                                                </h3>
                                                                {startRename && (
                                                                    <button
                                                                        onClick={() =>
                                                                            startRename(
                                                                                doc.id,
                                                                                doc
                                                                                    .metadata
                                                                                    .filename,
                                                                            )
                                                                        }
                                                                        className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-600"
                                                                        title="Rename file"
                                                                    >
                                                                        <Edit2 className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500 space-y-1 sm:space-y-0">
                                                            <span>
                                                                {new Date(
                                                                    doc.metadata.processed_at,
                                                                ).toLocaleDateString()}
                                                            </span>
                                                            <span>
                                                                {formatFileSize(
                                                                    doc.metadata
                                                                        .file_size,
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                                    doc.updated_by_user
                                                                        ? 'bg-orange-100 text-orange-700'
                                                                        : 'bg-green-100 text-green-700'
                                                                }`}
                                                            >
                                                                {doc.updated_by_user
                                                                    ? 'Modified'
                                                                    : 'Original'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {renderTableData ? (
                                                        <button
                                                            onClick={() =>
                                                                toggleRowExpansion(
                                                                    doc.id,
                                                                )
                                                            }
                                                            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                            <span>Fields</span>
                                                        </button>
                                                    ) : null}

                                                    {/* Document Action Button (Verify or View Details) */}
                                                    {(() => {
                                                        const buttonConfig =
                                                            getDocumentActionButton(
                                                                doc,
                                                            );
                                                        const Icon =
                                                            buttonConfig.icon;
                                                        return (
                                                            <button
                                                                onClick={
                                                                    buttonConfig.action
                                                                }
                                                                className={
                                                                    buttonConfig.className
                                                                }
                                                                title={
                                                                    buttonConfig.text
                                                                }
                                                            >
                                                                <Icon className="h-4 w-4" />
                                                                <span>
                                                                    {
                                                                        buttonConfig.text
                                                                    }
                                                                </span>
                                                            </button>
                                                        );
                                                    })()}

                                                    {onDeleteDocument && (
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteClick(
                                                                    doc,
                                                                )
                                                            }
                                                            disabled={
                                                                isDeleting ===
                                                                doc.id
                                                            }
                                                            className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Delete document"
                                                        >
                                                            {isDeleting ===
                                                            doc.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                            <span>Delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable Fields Section */}
                                        {isExpanded && renderTableData ? (
                                            <div className="border-t border-gray-200 p-4">
                                                {renderTableData(doc)}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Grouped View - with full list design for each document */}
                    {viewMode === 'grouped' && (
                        <div className="space-y-4">
                            {paginatedData.map((group: any) => {
                                const isGroupExpanded = expandedGroups.has(
                                    group.baseName,
                                );
                                const FolderIcon = isGroupExpanded
                                    ? FolderOpen
                                    : Folder;

                                return (
                                    <div
                                        key={group.baseName}
                                        className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                                    >
                                        {/* Group Header */}
                                        <div
                                            onClick={() =>
                                                toggleGroup(group.baseName)
                                            }
                                            className={`px-4 py-3 sm:px-6 sm:py-4 cursor-pointer hover:bg-${color}-50 transition-colors border-l-4 ${
                                                isGroupExpanded
                                                    ? `border-${color}-500 bg-${color}-50`
                                                    : 'border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <FolderIcon
                                                        className={`h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 ${
                                                            isGroupExpanded
                                                                ? `text-${color}-600`
                                                                : 'text-gray-500'
                                                        }`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                                                            📁 {group.baseName}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-gray-600">
                                                            <span
                                                                className={`flex items-center space-x-1 font-semibold text-${color}-700`}
                                                            >
                                                                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                <span>
                                                                    {
                                                                        group.count
                                                                    }{' '}
                                                                    page
                                                                    {group.count >
                                                                    1
                                                                        ? 's'
                                                                        : ''}
                                                                </span>
                                                            </span>
                                                            <span>•</span>
                                                            <span className="flex items-center space-x-1">
                                                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                <span>
                                                                    {group.earliestDate.toLocaleDateString()}
                                                                </span>
                                                            </span>
                                                            {group.totalSize >
                                                                0 && (
                                                                <>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {formatFileSize(
                                                                            group.totalSize,
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronDown
                                                    className={`h-5 w-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                                                        isGroupExpanded
                                                            ? 'transform rotate-180'
                                                            : ''
                                                    }`}
                                                />
                                            </div>
                                        </div>

                                        {/* Group Documents - Using same design as List View */}
                                        {isGroupExpanded && (
                                            <div className="bg-gray-50 p-2 space-y-2">
                                                {group.documents.map(
                                                    (doc: any) => {
                                                        const isDocExpanded =
                                                            expandedRows.has(
                                                                doc.id,
                                                            );
                                                        return (
                                                            <div
                                                                key={doc.id}
                                                                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                                                            >
                                                                <div className="p-4">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                                                        <div className="flex items-center space-x-3">
                                                                            {/* Selection Checkbox */}
                                                                            <button
                                                                                onClick={() =>
                                                                                    handleSelectDocument(
                                                                                        doc.id,
                                                                                    )
                                                                                }
                                                                                className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                                                                                title={
                                                                                    selectedDocuments.has(
                                                                                        doc.id,
                                                                                    )
                                                                                        ? 'Deselect document'
                                                                                        : 'Select document'
                                                                                }
                                                                            >
                                                                                {selectedDocuments.has(
                                                                                    doc.id,
                                                                                ) ? (
                                                                                    <CheckSquare className="h-5 w-5 text-blue-600" />
                                                                                ) : (
                                                                                    <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                                                                )}
                                                                            </button>

                                                                            <div
                                                                                className={`p-2 bg-${color}-100 rounded-lg`}
                                                                            >
                                                                                <FileText
                                                                                    className={`h-5 w-5 text-${color}-600`}
                                                                                />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center space-x-2 mb-1">
                                                                                    <span className="flex-shrink-0 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 px-2 py-1 rounded shadow-sm">
                                                                                        Page{' '}
                                                                                        {doc
                                                                                            .metadata
                                                                                            ?.page_number ||
                                                                                            1}
                                                                                    </span>
                                                                                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                                                                                        {
                                                                                            doc
                                                                                                .metadata
                                                                                                .filename
                                                                                        }
                                                                                    </h3>
                                                                                </div>
                                                                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500 space-y-1 sm:space-y-0">
                                                                                    <span>
                                                                                        {new Date(
                                                                                            doc.metadata.processed_at,
                                                                                        ).toLocaleDateString()}
                                                                                    </span>
                                                                                    <span>
                                                                                        {formatFileSize(
                                                                                            doc
                                                                                                .metadata
                                                                                                .file_size,
                                                                                        )}
                                                                                    </span>
                                                                                    <span
                                                                                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                                                            doc.updated_by_user
                                                                                                ? 'bg-orange-100 text-orange-700'
                                                                                                : 'bg-green-100 text-green-700'
                                                                                        }`}
                                                                                    >
                                                                                        {doc.updated_by_user
                                                                                            ? 'Modified'
                                                                                            : 'Original'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2">
                                                                            {renderTableData && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        toggleRowExpansion(
                                                                                            doc.id,
                                                                                        )
                                                                                    }
                                                                                    className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                                                                >
                                                                                    {isDocExpanded ? (
                                                                                        <ChevronDown className="h-4 w-4" />
                                                                                    ) : (
                                                                                        <ChevronRight className="h-4 w-4" />
                                                                                    )}
                                                                                    <span>
                                                                                        Fields
                                                                                    </span>
                                                                                </button>
                                                                            )}

                                                                            {/* Document Action Button */}
                                                                            {(() => {
                                                                                const buttonConfig =
                                                                                    getDocumentActionButton(
                                                                                        doc,
                                                                                    );
                                                                                const Icon =
                                                                                    buttonConfig.icon;
                                                                                return (
                                                                                    <button
                                                                                        onClick={
                                                                                            buttonConfig.action
                                                                                        }
                                                                                        className={
                                                                                            buttonConfig.className
                                                                                        }
                                                                                        title={
                                                                                            buttonConfig.text
                                                                                        }
                                                                                    >
                                                                                        <Icon className="h-4 w-4" />
                                                                                        <span>
                                                                                            {
                                                                                                buttonConfig.text
                                                                                            }
                                                                                        </span>
                                                                                    </button>
                                                                                );
                                                                            })()}

                                                                            {onDeleteDocument && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        handleDeleteClick(
                                                                                            doc,
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        isDeleting ===
                                                                                        doc.id
                                                                                    }
                                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                                    title="Delete document"
                                                                                >
                                                                                    {isDeleting ===
                                                                                    doc.id ? (
                                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    ) : (
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    )}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Expanded Data Table */}
                                                                {isDocExpanded &&
                                                                    renderTableData && (
                                                                        <div className="border-t border-gray-200 bg-gray-50 p-4">
                                                                            <div className="text-sm text-gray-700">
                                                                                {renderTableData(
                                                                                    doc,
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Table View */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className={`bg-${color}-50`}>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                                                <button
                                                    onClick={handleSelectAll}
                                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                    title={
                                                        selectedDocuments.size ===
                                                            filteredDocuments.length &&
                                                        filteredDocuments.length >
                                                            0
                                                            ? 'Deselect All'
                                                            : 'Select All'
                                                    }
                                                >
                                                    {selectedDocuments.size ===
                                                        filteredDocuments.length &&
                                                    filteredDocuments.length >
                                                        0 ? (
                                                        <CheckSquare className="h-4 w-4 text-blue-600" />
                                                    ) : (
                                                        <Square className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Document
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Size
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedData.map(doc => {
                                            const isExpanded = expandedRows.has(
                                                doc.id,
                                            );
                                            return (
                                                <Fragment key={doc.id}>
                                                    <tr className="hover:bg-gray-50">
                                                        <td className="px-4 py-4 whitespace-nowrap w-12">
                                                            <button
                                                                onClick={() =>
                                                                    handleSelectDocument(
                                                                        doc.id,
                                                                    )
                                                                }
                                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                                title={
                                                                    selectedDocuments.has(
                                                                        doc.id,
                                                                    )
                                                                        ? 'Deselect document'
                                                                        : 'Select document'
                                                                }
                                                            >
                                                                {selectedDocuments.has(
                                                                    doc.id,
                                                                ) ? (
                                                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                                                ) : (
                                                                    <Square className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <button
                                                                    onClick={() =>
                                                                        toggleRowExpansion(
                                                                            doc.id,
                                                                        )
                                                                    }
                                                                    className="mr-2 p-1 hover:bg-gray-200 rounded"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                                                    )}
                                                                </button>
                                                                <div
                                                                    className={`p-2 bg-${color}-100 rounded-lg mr-3`}
                                                                >
                                                                    <FileText
                                                                        className={`h-4 w-4 text-${color}-600`}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    {renamingDocument?.id ===
                                                                    doc.id ? (
                                                                        <div className="flex items-center space-x-2">
                                                                            <input
                                                                                type="text"
                                                                                value={
                                                                                    renameValue
                                                                                }
                                                                                onChange={e =>
                                                                                    setRenameValue?.(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    )
                                                                                }
                                                                                className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                                style={{
                                                                                    minWidth:
                                                                                        '200px',
                                                                                }}
                                                                                autoFocus
                                                                                onKeyDown={e => {
                                                                                    if (
                                                                                        e.key ===
                                                                                        'Enter'
                                                                                    ) {
                                                                                        saveRename?.();
                                                                                    } else if (
                                                                                        e.key ===
                                                                                        'Escape'
                                                                                    ) {
                                                                                        cancelRename?.();
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <button
                                                                                onClick={() =>
                                                                                    saveRename?.()
                                                                                }
                                                                                className="text-green-600 hover:text-green-800 p-1"
                                                                                title="Save"
                                                                            >
                                                                                <Save className="h-4 w-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() =>
                                                                                    cancelRename?.()
                                                                                }
                                                                                className="text-gray-500 hover:text-gray-700 p-1"
                                                                                title="Cancel"
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-between group">
                                                                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                                                                {
                                                                                    doc
                                                                                        .metadata
                                                                                        .filename
                                                                                }
                                                                            </div>
                                                                            {startRename && (
                                                                                <button
                                                                                    onClick={() =>
                                                                                        startRename(
                                                                                            doc.id,
                                                                                            doc
                                                                                                .metadata
                                                                                                .filename,
                                                                                        )
                                                                                    }
                                                                                    className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-600"
                                                                                    title="Rename file"
                                                                                >
                                                                                    <Edit2 className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {
                                                                doc.metadata
                                                                    .document_type
                                                            }
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatFileSize(
                                                                doc.metadata
                                                                    .file_size,
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {new Date(
                                                                doc.metadata.processed_at,
                                                            ).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                    doc.updated_by_user
                                                                        ? 'bg-orange-100 text-orange-800'
                                                                        : 'bg-green-100 text-green-800'
                                                                }`}
                                                            >
                                                                {doc.updated_by_user
                                                                    ? 'Modified'
                                                                    : 'Original'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <div className="flex items-center space-x-2">
                                                                {(() => {
                                                                    const buttonConfig =
                                                                        getDocumentActionButton(
                                                                            doc,
                                                                        );
                                                                    const Icon =
                                                                        buttonConfig.icon;
                                                                    return (
                                                                        <button
                                                                            onClick={
                                                                                buttonConfig.action
                                                                            }
                                                                            className={
                                                                                buttonConfig.className
                                                                            }
                                                                            title={
                                                                                buttonConfig.text
                                                                            }
                                                                        >
                                                                            <Icon className="h-4 w-4" />
                                                                            <span>
                                                                                {
                                                                                    buttonConfig.text
                                                                                }
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })()}
                                                                {onDeleteDocument && (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleDeleteClick(
                                                                                doc,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isDeleting ===
                                                                            doc.id
                                                                        }
                                                                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                                                        title="Delete document"
                                                                    >
                                                                        {isDeleting ===
                                                                        doc.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-4 w-4" />
                                                                        )}
                                                                        <span>
                                                                            Delete
                                                                        </span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {/* Expanded Table Data Row */}
                                                    {isExpanded &&
                                                    renderTableData ? (
                                                        <tr className="bg-gray-50">
                                                            <td
                                                                colSpan={6}
                                                                className="px-6 py-4"
                                                            >
                                                                {renderTableData(
                                                                    doc,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden relative">
                    {/* Decorative elements */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-orange-500 to-green-500"></div>

                    <div
                        className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 bg-gradient-to-br from-${color}-100 to-${color}-200 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300`}
                    >
                        <FileText
                            className={`h-10 w-10 sm:h-12 sm:w-12 text-${color}-600`}
                        />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-3">
                        No {selectedType} Documents Found
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-lg mx-auto px-4 leading-relaxed">
                        {isLoading ? (
                            <span className="inline-flex items-center">
                                <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-600" />
                                Loading documents...
                            </span>
                        ) : (
                            <>
                                Upload your first {selectedType.toLowerCase()}{' '}
                                document to get started with AI-powered data
                                extraction.
                            </>
                        )}
                    </p>
                    {!isLoading && (
                        <div
                            className={`inline-flex items-center space-x-2 text-${color}-700 bg-${color}-50 border border-${color}-200 px-4 sm:px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-medium`}
                        >
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">
                                Drag and drop files above to upload
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Pagination */}
            {documents.length > itemsPerPage && (
                <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* Pagination Header */}
                    <div
                        className={`bg-gradient-to-r from-${color}-50 to-${color}-100 px-6 py-4 border-b border-gray-200`}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                            <div className="flex items-center space-x-4">
                                <div className="text-sm font-medium text-gray-900">
                                    Showing{' '}
                                    <span
                                        className={`font-bold text-${color}-600`}
                                    >
                                        {startItem}
                                    </span>{' '}
                                    to{' '}
                                    <span
                                        className={`font-bold text-${color}-600`}
                                    >
                                        {endItem}
                                    </span>{' '}
                                    of{' '}
                                    <span
                                        className={`font-bold text-${color}-600`}
                                    >
                                        {documents.length}
                                    </span>{' '}
                                    documents
                                </div>

                                <div className="flex items-center space-x-2">
                                    <label
                                        htmlFor="itemsPerPage"
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        Show:
                                    </label>
                                    <select
                                        id="itemsPerPage"
                                        value={itemsPerPage}
                                        onChange={e =>
                                            handleItemsPerPageChange(
                                                Number(e.target.value),
                                            )
                                        }
                                        className={`border-2 border-${color}-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-${color}-500 focus:border-${color}-500 bg-white`}
                                    >
                                        <option value={5}>5 per page</option>
                                        <option value={10}>10 per page</option>
                                        <option value={20}>20 per page</option>
                                        <option value={50}>50 per page</option>
                                    </select>
                                </div>
                            </div>

                            <div
                                className={`text-xs font-medium text-${color}-600 bg-${color}-50 px-3 py-1.5 rounded-full border border-${color}-200`}
                            >
                                Page {currentPage} of {totalPages}
                            </div>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-center">
                            <nav className="flex items-center space-x-2">
                                {/* Previous Button */}
                                <button
                                    onClick={() =>
                                        handlePageChange(currentPage - 1)
                                    }
                                    disabled={currentPage === 1}
                                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                                        currentPage === 1
                                            ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                            : `text-${color}-600 bg-white border-${color}-200 hover:bg-${color}-50 hover:border-${color}-300`
                                    }`}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="ml-1">Previous</span>
                                </button>

                                {/* Page Numbers */}
                                <div className="flex items-center space-x-1">
                                    {Array.from(
                                        { length: Math.min(totalPages, 7) },
                                        (_, i) => {
                                            let pageNumber;
                                            if (totalPages <= 7) {
                                                pageNumber = i + 1;
                                            } else if (currentPage <= 4) {
                                                pageNumber = i + 1;
                                            } else if (
                                                currentPage >=
                                                totalPages - 3
                                            ) {
                                                pageNumber = totalPages - 6 + i;
                                            } else {
                                                pageNumber =
                                                    currentPage - 3 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNumber}
                                                    onClick={() =>
                                                        handlePageChange(
                                                            pageNumber,
                                                        )
                                                    }
                                                    className={`min-w-[40px] h-10 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                                                        currentPage ===
                                                        pageNumber
                                                            ? `bg-${color}-600 border-${color}-600 text-white shadow-lg transform scale-105`
                                                            : `bg-white border-gray-200 text-gray-700 hover:bg-${color}-50 hover:border-${color}-300 hover:text-${color}-600`
                                                    }`}
                                                >
                                                    {pageNumber}
                                                </button>
                                            );
                                        },
                                    )}
                                </div>

                                {/* Next Button */}
                                <button
                                    onClick={() =>
                                        handlePageChange(currentPage + 1)
                                    }
                                    disabled={currentPage === totalPages}
                                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                                        currentPage === totalPages
                                            ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                            : `text-${color}-600 bg-white border-${color}-200 hover:bg-${color}-50 hover:border-${color}-300`
                                    }`}
                                >
                                    <span className="mr-1">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="p-2 bg-red-100 rounded-full mr-3">
                                    <Trash2 className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Delete Document
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        This action cannot be undone
                                    </p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-700">
                                    Are you sure you want to delete{' '}
                                    <span className="font-medium text-gray-900">
                                        &quot;{deleteConfirmation.filename}
                                        &quot;
                                    </span>
                                    ?
                                </p>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={handleDeleteCancel}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    disabled={
                                        isDeleting === deleteConfirmation.id
                                    }
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={
                                        isDeleting === deleteConfirmation.id
                                    }
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {isDeleting === deleteConfirmation.id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            <span>Delete</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Dialog */}
            {bulkDeleteDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="p-2 bg-red-100 rounded-full mr-3">
                                    <Trash2 className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Delete Multiple Documents
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        This action cannot be undone
                                    </p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-700 mb-3">
                                    Are you sure you want to delete{' '}
                                    <span className="font-medium text-red-600">
                                        {selectedDocuments.size} document
                                        {selectedDocuments.size !== 1
                                            ? 's'
                                            : ''}
                                    </span>
                                    ?
                                </p>

                                {/* Show selected documents list */}
                                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3 border">
                                    <div className="space-y-1">
                                        {Array.from(selectedDocuments).map(
                                            docId => {
                                                const doc = documents.find(
                                                    d => d.id === docId,
                                                );
                                                return doc ? (
                                                    <div
                                                        key={docId}
                                                        className="text-sm text-gray-700 flex items-center space-x-2"
                                                    >
                                                        <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                                                        <span className="truncate">
                                                            {
                                                                doc.metadata
                                                                    .filename
                                                            }
                                                        </span>
                                                    </div>
                                                ) : null;
                                            },
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={handleBulkDeleteCancel}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    disabled={isBulkDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkDeleteConfirm}
                                    disabled={isBulkDeleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {isBulkDeleting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>
                                                Deleting{' '}
                                                {selectedDocuments.size}{' '}
                                                documents...
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            <span>
                                                Delete {selectedDocuments.size}{' '}
                                                Documents
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
