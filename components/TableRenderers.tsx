import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Edit2,
    Loader2,
    Plus,
    Shield,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import React from 'react';

interface EditableFieldProps {
    docId: string;
    field: string;
    value: any;
    editingCell: { doc: string; field: string } | null;
    editValue: string;
    setEditValue: (value: string) => void;
    setEditingCell: (cell: { doc: string; field: string } | null) => void;
    startEdit: (docId: string, field: string, currentValue: any) => void;
    saveEdit: () => void;
    type?: string;
    label?: string;
}

interface TableRendererProps {
    doc: any;
    selectedType: 'Rebut' | 'NPT' | 'Kosu';
    editingCell: { doc: string; field: string } | null;
    editValue: string;
    setEditValue: (value: string) => void;
    setEditingCell: (cell: { doc: string; field: string } | null) => void;
    startEdit: (docId: string, field: string, currentValue: any) => void;
    saveEdit: () => void;
    setSelectedDocument: (doc: any) => void;
    editedData?: any; // Optional edited data for getting current values
}

// Helper function to get verification status badge
const getVerificationStatusBadge = (verificationStatus: string) => {
    const statusConfig = {
        original: {
            color: 'bg-gray-100 text-gray-700 border-gray-200',
            icon: AlertCircle,
            label: 'Original',
        },
        draft: {
            color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            icon: Shield,
            label: 'Draft',
        },
        pending_verification: {
            color: 'bg-blue-100 text-blue-700 border-blue-200',
            icon: Shield,
            label: 'Pending Review',
        },
        verified: {
            color: 'bg-green-100 text-green-700 border-green-200',
            icon: ShieldCheck,
            label: 'Verified',
        },
        revision_needed: {
            color: 'bg-red-100 text-red-700 border-red-200',
            icon: AlertCircle,
            label: 'Needs Revision',
        },
    };

    return (
        statusConfig[verificationStatus as keyof typeof statusConfig] ||
        statusConfig.original
    );
};

// Helper component for editable fields
const EditableField: React.FC<EditableFieldProps> = ({
    docId,
    field,
    value,
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
    type = 'text',
}) => {
    const isEditing =
        editingCell?.doc === docId && editingCell?.field === field;

    // Auto-save functionality with debouncing
    const [localValue, setLocalValue] = React.useState(editValue);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showSaved, setShowSaved] = React.useState(false);
    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        setLocalValue(editValue);
    }, [editValue]);

    const handleInputChange = (newValue: string) => {
        setLocalValue(newValue);
        // Also update editValue immediately to keep them in sync
        setEditValue(newValue);

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save (1 second after user stops typing)
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                setIsSaving(true);
                await saveEdit();
                setIsSaving(false);
                setShowSaved(true);
                setTimeout(() => setShowSaved(false), 2000);
            } catch (error) {
                console.error('Error saving field:', error);
                setIsSaving(false);
                // Revert to original value on error
                setLocalValue(editValue);
                setShowSaved(false);
            }
        }, 1000);
    };

    React.useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    if (isEditing) {
        return (
            <div className="relative bg-white border-2 border-blue-400 rounded-lg p-3 shadow-lg">
                <div className="flex flex-col space-y-2">
                    <input
                        type={type}
                        value={localValue}
                        onChange={e => handleInputChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (saveTimeoutRef.current) {
                                    clearTimeout(saveTimeoutRef.current);
                                }
                                // Update edit value and save immediately
                                setEditValue(localValue);
                                setTimeout(async () => {
                                    try {
                                        setIsSaving(true);
                                        await saveEdit();
                                        setIsSaving(false);
                                        setShowSaved(true);
                                        setTimeout(
                                            () => setShowSaved(false),
                                            2000,
                                        );
                                        setEditingCell(null);
                                    } catch (error) {
                                        console.error(
                                            'Error saving field:',
                                            error,
                                        );
                                        setIsSaving(false);
                                        setEditingCell(null);
                                    }
                                }, 50); // Shorter delay
                            } else if (e.key === 'Escape') {
                                if (saveTimeoutRef.current) {
                                    clearTimeout(saveTimeoutRef.current);
                                }
                                setLocalValue(editValue);
                                setEditingCell(null);
                            }
                        }}
                        onBlur={async () => {
                            // Save on blur
                            if (saveTimeoutRef.current) {
                                clearTimeout(saveTimeoutRef.current);
                            }
                            // Update edit value and save immediately
                            setEditValue(localValue);
                            setTimeout(async () => {
                                try {
                                    setIsSaving(true);
                                    await saveEdit();
                                    setIsSaving(false);
                                    setShowSaved(true);
                                    setTimeout(() => setShowSaved(false), 2000);
                                    setTimeout(() => setEditingCell(null), 100);
                                } catch (error) {
                                    console.error(
                                        'Error saving on blur:',
                                        error,
                                    );
                                    setEditingCell(null);
                                }
                            }, 50); // Shorter delay
                        }}
                        placeholder="Enter value..."
                    />
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2 text-xs">
                            {isSaving && (
                                <span className="text-blue-600 flex items-center">
                                    <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                                    Saving...
                                </span>
                            )}
                            {showSaved && (
                                <span className="text-green-600 flex items-center">
                                    <div className="w-3 h-3 bg-green-600 rounded-full mr-1"></div>
                                    Saved
                                </span>
                            )}
                            {!isSaving && !showSaved && (
                                <span className="text-gray-500">
                                    Auto-saves as you type
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-gray-400">
                            Press Enter to confirm, Esc to cancel
                        </span>
                    </div>
                </div>
                {/* Backdrop to make editing area stand out */}
                <div className="absolute inset-0 -m-2 bg-blue-50 rounded-lg -z-10 opacity-30"></div>
            </div>
        );
    }

    return (
        <div
            className="group relative cursor-pointer hover:bg-blue-50 p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
            onClick={() => startEdit(docId, field, value)}
        >
            <div className="flex items-center justify-between">
                <div className="min-h-[24px] flex items-center text-gray-900">
                    {value !== null && value !== undefined && value !== '' ? (
                        String(value)
                    ) : (
                        <span className="text-gray-400 italic">
                            Click to add value
                        </span>
                    )}
                </div>
                <Edit2
                    size={14}
                    className="text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2 flex-shrink-0"
                />
            </div>
            {/* Subtle indicator for editable fields */}
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        </div>
    );
}; // Header Card Component
const HeaderCard: React.FC<
    {
        title: string;
        fields: Array<{
            label: string;
            field: string;
            value: any;
            type?: 'text' | 'number';
        }>;
    } & Omit<TableRendererProps, 'selectedType' | 'setSelectedDocument'>
> = ({
    title,
    fields,
    doc,
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
}) => {
    const statusBadge = getVerificationStatusBadge(
        doc.verification_status || 'original',
    );
    const StatusIcon = statusBadge.icon;

    return (
        <div className="bg-white shadow-sm rounded-xl mb-8 border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center">
                        <div className="w-2 h-8 bg-white rounded-full mr-3 opacity-80"></div>
                        {title}
                    </h3>
                    {/* Status Badge */}
                    <div
                        className={`flex items-center space-x-2 px-3 py-1 border rounded-full bg-white/90 backdrop-blur-sm ${statusBadge.color.replace('bg-', 'border-').replace('100', '300')}`}
                    >
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">
                            {statusBadge.label}
                        </span>
                    </div>
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {fields.map(({ label, field, value, type = 'text' }) => (
                        <div key={field} className="group">
                            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                {label}
                            </label>
                            <div className="bg-gray-50 rounded-lg border border-gray-200 transition-all duration-200 group-hover:border-blue-300 group-hover:shadow-sm">
                                <EditableField
                                    docId={doc.id}
                                    field={field}
                                    value={value}
                                    editingCell={editingCell}
                                    editValue={editValue}
                                    setEditValue={setEditValue}
                                    setEditingCell={setEditingCell}
                                    startEdit={startEdit}
                                    saveEdit={saveEdit}
                                    type={type}
                                    label={label}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const RebutTable: React.FC<TableRendererProps> = ({
    doc,
    selectedType,
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
    editedData,
}) => {
    // State for "Add Row" - track which table is adding a row
    const [addingRowForTable, setAddingRowForTable] = React.useState<
        string | null
    >(null);
    const [localData, setLocalData] = React.useState<any>(null);
    const [isAddingRow, setIsAddingRow] = React.useState(false);

    // Initialize local data copy
    React.useEffect(() => {
        if (editedData || doc.data) {
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    }, [editedData, doc.data]);

    // Use localData if available, otherwise use editedData/doc.data
    const displayData = localData || editedData || doc.data;

    // Handle adding a new row - adds directly to the table inline
    const handleAddRow = async (tableKey: string) => {
        setIsAddingRow(true);
        setAddingRowForTable(tableKey);
        try {
            // Get current items array from local data
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];

            // Create new row with empty values for all columns
            // If array is empty, use default column structure for items table
            let newItem: Record<string, any> = {};

            if (currentItems.length > 0) {
                // Use existing item structure
                const sampleItem = currentItems[0];
                Object.keys(sampleItem).forEach(key => {
                    newItem[key] = ''; // Empty string for all fields
                });
            } else {
                // For empty arrays, create default structure based on table key
                if (tableKey === 'items') {
                    newItem = {
                        reference: '',
                        total_scrapped: '',
                        reference_fjk: '',
                        designation: '',
                        quantity: '',
                        unit: '',
                        type: '',
                    };
                } else {
                    // For other tables, we'll need at least one field
                    newItem = { value: '' };
                }
            }

            // Add the new row to local data immediately for UI update
            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = [...currentItems, newItem];
            setLocalData(updatedData);

            // Update the entire array using the field path
            const field = `data.${tableKey}`;
            const updatedItems = [...currentItems, newItem];

            // Call API to update the document
            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add row');
            }
        } catch (error) {
            console.error('Error adding row:', error);
            alert('Failed to add row. Please try again.');
            // Revert local data on error
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        } finally {
            setIsAddingRow(false);
            setAddingRowForTable(null);
        }
    };

    // Handle deleting a row
    const handleDeleteRow = async (tableKey: string, index: number) => {
        if (!confirm('Are you sure you want to delete this row?')) {
            return;
        }

        try {
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];

            // Remove the row at the specified index
            const updatedItems = currentItems.filter(
                (_: any, i: number) => i !== index,
            );

            // Update local data immediately
            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = updatedItems;
            setLocalData(updatedData);

            // Update via API
            const field = `data.${tableKey}`;
            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete row');
            }
        } catch (error) {
            console.error('Error deleting row:', error);
            alert('Failed to delete row. Please try again.');
            // Revert local data on error
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    };

    // Handle reordering rows (move up or down)
    const handleReorderRow = async (
        tableKey: string,
        index: number,
        direction: 'up' | 'down',
    ) => {
        try {
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];

            // Check bounds
            if (direction === 'up' && index === 0) return;
            if (direction === 'down' && index === currentItems.length - 1)
                return;

            // Create new array with swapped items
            const updatedItems = [...currentItems];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            [updatedItems[index], updatedItems[newIndex]] = [
                updatedItems[newIndex],
                updatedItems[index],
            ];

            // Update local data immediately
            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = updatedItems;
            setLocalData(updatedData);

            // Update via API
            const field = `data.${tableKey}`;
            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to reorder row');
            }
        } catch (error) {
            console.error('Error reordering row:', error);
            alert('Failed to reorder row. Please try again.');
            // Revert local data on error
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    };

    // Generate header fields dynamically from the actual header data
    const headerFields = displayData?.header
        ? Object.keys(displayData.header).map(key => ({
              label:
                  key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              field: `data.header.${key}`,
              value: displayData.header[key],
              type:
                  typeof displayData.header[key] === 'number'
                      ? ('number' as const)
                      : ('text' as const),
          }))
        : [];

    return (
        <div className="space-y-6">
            {/* Header Section - Dynamic */}
            {headerFields.length > 0 && (
                <HeaderCard
                    title="Document Header - Rebut"
                    fields={headerFields}
                    doc={doc}
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    setEditingCell={setEditingCell}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                />
            )}

            {/* Dynamic sections for any arrays in the data */}
            {Object.keys(displayData || {}).map(key => {
                if (key === 'header' || key === 'document_type') return null;

                const value = displayData[key];
                if (Array.isArray(value)) {
                    // If array is empty, still show table structure with add button
                    if (value.length === 0) {
                        return (
                            <div
                                key={key}
                                className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden mb-8"
                            >
                                <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600">
                                    <h3 className="text-xl font-bold text-white flex items-center">
                                        <div className="w-2 h-8 bg-white rounded-full mr-3 opacity-80"></div>
                                        {key.charAt(0).toUpperCase() +
                                            key
                                                .slice(1)
                                                .replace(/_/g, ' ')}{' '}
                                        Data
                                    </h3>
                                </div>
                                <div className="px-6 py-8 text-center bg-gray-50">
                                    <p className="text-gray-600 mb-4">
                                        No items found. Add a new row to get
                                        started.
                                    </p>
                                    <button
                                        onClick={() => handleAddRow(key)}
                                        disabled={isAddingRow}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 mx-auto"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>
                                            {isAddingRow
                                                ? 'Adding...'
                                                : 'Add First Row'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    }
                    // Define column order for items table to place "Total scrapped" right after "Reference"
                    const getColumnOrder = () => {
                        const keys = Object.keys(value[0] || {});
                        if (
                            key === 'items' &&
                            keys.includes('reference') &&
                            keys.includes('total_scrapped')
                        ) {
                            // For items table, reorder to place total_scrapped after reference
                            const priorityOrder = [
                                'reference',
                                'total_scrapped',
                                'reference_fjk',
                                'designation',
                                'quantity',
                                'unit',
                                'type',
                            ];
                            const orderedKeys: string[] = [];
                            const remainingKeys = new Set(keys);

                            // First, add priority keys in order
                            for (const priorityKey of priorityOrder) {
                                if (remainingKeys.has(priorityKey)) {
                                    orderedKeys.push(priorityKey);
                                    remainingKeys.delete(priorityKey);
                                }
                            }

                            // Then add any remaining keys
                            orderedKeys.push(...Array.from(remainingKeys));

                            return orderedKeys;
                        }
                        return keys;
                    };

                    const orderedKeys = getColumnOrder();

                    return (
                        <div
                            key={key}
                            className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden mb-8"
                        >
                            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600">
                                <h3 className="text-xl font-bold text-white flex items-center">
                                    <div className="w-2 h-8 bg-white rounded-full mr-3 opacity-80"></div>
                                    {key.charAt(0).toUpperCase() +
                                        key.slice(1).replace(/_/g, ' ')}{' '}
                                    Data
                                </h3>
                            </div>
                            <div className="overflow-x-auto bg-gray-50">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                                        <tr>
                                            {orderedKeys.map(subKey => (
                                                <th
                                                    key={subKey}
                                                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
                                                >
                                                    {subKey
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        subKey
                                                            .slice(1)
                                                            .replace(/_/g, ' ')}
                                                </th>
                                            ))}
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {value.map(
                                            (item: any, index: number) => (
                                                <tr key={index}>
                                                    {orderedKeys.map(subKey => (
                                                        <td
                                                            key={subKey}
                                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                        >
                                                            <EditableField
                                                                docId={doc.id}
                                                                field={`data.${key}.${index}.${subKey}`}
                                                                value={
                                                                    item[subKey]
                                                                }
                                                                editingCell={
                                                                    editingCell
                                                                }
                                                                editValue={
                                                                    editValue
                                                                }
                                                                setEditValue={
                                                                    setEditValue
                                                                }
                                                                setEditingCell={
                                                                    setEditingCell
                                                                }
                                                                startEdit={
                                                                    startEdit
                                                                }
                                                                saveEdit={
                                                                    saveEdit
                                                                }
                                                                type={
                                                                    typeof item[
                                                                        subKey
                                                                    ] ===
                                                                    'number'
                                                                        ? 'number'
                                                                        : 'text'
                                                                }
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center space-x-1">
                                                            {/* Reorder Buttons */}
                                                            <button
                                                                onClick={() =>
                                                                    handleReorderRow(
                                                                        key,
                                                                        index,
                                                                        'up',
                                                                    )
                                                                }
                                                                disabled={
                                                                    index === 0
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move up"
                                                            >
                                                                <ArrowUp className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleReorderRow(
                                                                        key,
                                                                        index,
                                                                        'down',
                                                                    )
                                                                }
                                                                disabled={
                                                                    index ===
                                                                    value.length -
                                                                        1
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move down"
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </button>
                                                            {/* Delete Button */}
                                                            <button
                                                                onClick={() =>
                                                                    handleDeleteRow(
                                                                        key,
                                                                        index,
                                                                    )
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
                                                                title="Delete row"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add Row Button */}
                            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    {value.length === 0
                                        ? 'No rows in table'
                                        : `${value.length} row${value.length !== 1 ? 's' : ''}`}
                                </div>
                                <button
                                    onClick={() => handleAddRow(key)}
                                    disabled={isAddingRow}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02] shadow-md hover:shadow-lg"
                                >
                                    {isAddingRow &&
                                    addingRowForTable === key ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            <span>Add Row</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
};

export const NPTTable: React.FC<TableRendererProps> = ({
    doc,
    selectedType,
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
    editedData,
}) => {
    // State for "Add Row" - track which table is adding a row
    const [addingRowForTable, setAddingRowForTable] = React.useState<
        string | null
    >(null);
    const [localData, setLocalData] = React.useState<any>(null);
    const [isAddingRow, setIsAddingRow] = React.useState(false);

    // Initialize local data copy
    React.useEffect(() => {
        if (editedData || doc.data) {
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    }, [editedData, doc.data]);

    // Use localData if available, otherwise use editedData/doc.data
    const dataSource = localData || editedData || doc.data;

    // Handle adding a new row
    const handleAddRow = async (tableKey: string) => {
        setIsAddingRow(true);
        setAddingRowForTable(tableKey);
        try {
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];

            let newItem: Record<string, any> = {};
            if (currentItems.length > 0) {
                const sampleItem = currentItems[0];
                Object.keys(sampleItem).forEach(key => {
                    newItem[key] = '';
                });
            } else {
                if (tableKey === 'downtime_events') {
                    newItem = {
                        codes_ligne: '',
                        ref_pf: '',
                        designation: '',
                        mod_impacte: '',
                        npt_minutes: '',
                        heure_debut_d_arret: '',
                        heure_fin_d_arret: '',
                        cause_npt: '',
                        numero_di: '',
                        commentaire: '',
                        validation: '',
                    };
                } else {
                    newItem = { value: '' };
                }
            }

            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = [...currentItems, newItem];
            setLocalData(updatedData);

            const field = `data.${tableKey}`;
            const updatedItems = [...currentItems, newItem];

            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add row');
            }
        } catch (error) {
            console.error('Error adding row:', error);
            alert('Failed to add row. Please try again.');
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        } finally {
            setIsAddingRow(false);
            setAddingRowForTable(null);
        }
    };

    // Handle deleting a row
    const handleDeleteRow = async (tableKey: string, index: number) => {
        if (!confirm('Are you sure you want to delete this row?')) {
            return;
        }

        try {
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];
            const updatedItems = currentItems.filter(
                (_: any, i: number) => i !== index,
            );

            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = updatedItems;
            setLocalData(updatedData);

            const field = `data.${tableKey}`;
            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete row');
            }
        } catch (error) {
            console.error('Error deleting row:', error);
            alert('Failed to delete row. Please try again.');
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    };

    // Handle reordering rows
    const handleReorderRow = async (
        tableKey: string,
        index: number,
        direction: 'up' | 'down',
    ) => {
        try {
            const currentData = localData || editedData || doc.data;
            const currentItems = currentData[tableKey] || [];

            if (direction === 'up' && index === 0) return;
            if (direction === 'down' && index === currentItems.length - 1)
                return;

            const updatedItems = [...currentItems];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            [updatedItems[index], updatedItems[newIndex]] = [
                updatedItems[newIndex],
                updatedItems[index],
            ];

            const updatedData = JSON.parse(JSON.stringify(currentData));
            updatedData[tableKey] = updatedItems;
            setLocalData(updatedData);

            const field = `data.${tableKey}`;
            const response = await fetch('/api/documents', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: doc.id,
                    type: selectedType,
                    field,
                    oldValue: currentItems,
                    newValue: updatedItems,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to reorder row');
            }
        } catch (error) {
            console.error('Error reordering row:', error);
            alert('Failed to reorder row. Please try again.');
            setLocalData(JSON.parse(JSON.stringify(editedData || doc.data)));
        }
    };

    // Generate header fields dynamically from the actual header data
    const headerFields = dataSource?.header
        ? Object.keys(dataSource.header).map(key => ({
              label:
                  key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              field: `data.header.${key}`,
              value: dataSource.header[key],
              type:
                  typeof dataSource.header[key] === 'number'
                      ? ('number' as const)
                      : ('text' as const),
          }))
        : [];

    return (
        <div className="space-y-6">
            {/* Header Section - Dynamic based on actual data */}
            {headerFields.length > 0 && (
                <HeaderCard
                    title="Document Header - NPT (Non-Productive Time)"
                    fields={headerFields}
                    doc={doc}
                    editingCell={editingCell}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    setEditingCell={setEditingCell}
                    startEdit={startEdit}
                    saveEdit={saveEdit}
                />
            )}

            {/* Downtime Events Table - Dynamic based on actual data */}
            {dataSource?.downtime_events &&
            Array.isArray(dataSource.downtime_events) ? (
                dataSource.downtime_events.length > 0 ? (
                    <div className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700">
                            <h3 className="text-lg font-semibold text-white">
                                Downtime Events
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {Object.keys(
                                            dataSource.downtime_events[0] || {},
                                        ).map(key => (
                                            <th
                                                key={key}
                                                className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider"
                                            >
                                                {key.charAt(0).toUpperCase() +
                                                    key
                                                        .slice(1)
                                                        .replace(/_/g, ' ')}
                                            </th>
                                        ))}
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dataSource.downtime_events.map(
                                        (event: any, index: number) => (
                                            <tr key={index}>
                                                {Object.keys(event).map(key => (
                                                    <td
                                                        key={key}
                                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                    >
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.downtime_events.${index}.${key}`}
                                                            value={event[key]}
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type={
                                                                typeof event[
                                                                    key
                                                                ] === 'number'
                                                                    ? 'number'
                                                                    : 'text'
                                                            }
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={() =>
                                                                handleReorderRow(
                                                                    'downtime_events',
                                                                    index,
                                                                    'up',
                                                                )
                                                            }
                                                            disabled={
                                                                index === 0
                                                            }
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Move up"
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleReorderRow(
                                                                    'downtime_events',
                                                                    index,
                                                                    'down',
                                                                )
                                                            }
                                                            disabled={
                                                                index ===
                                                                dataSource
                                                                    .downtime_events
                                                                    .length -
                                                                    1
                                                            }
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Move down"
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteRow(
                                                                    'downtime_events',
                                                                    index,
                                                                )
                                                            }
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
                                                            title="Delete row"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                {dataSource.downtime_events.length} row
                                {dataSource.downtime_events.length !== 1
                                    ? 's'
                                    : ''}
                            </div>
                            <button
                                onClick={() => handleAddRow('downtime_events')}
                                disabled={isAddingRow}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02] shadow-md hover:shadow-lg"
                            >
                                {isAddingRow &&
                                addingRowForTable === 'downtime_events' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Adding...</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        <span>Add Row</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700">
                            <h3 className="text-lg font-semibold text-white">
                                Downtime Events
                            </h3>
                        </div>
                        <div className="px-6 py-8 text-center bg-gray-50">
                            <p className="text-gray-600 mb-4">
                                No downtime events found. Add a new row to get
                                started.
                            </p>
                            <button
                                onClick={() => handleAddRow('downtime_events')}
                                disabled={isAddingRow}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 mx-auto"
                            >
                                <Plus className="h-4 w-4" />
                                <span>
                                    {isAddingRow
                                        ? 'Adding...'
                                        : 'Add First Row'}
                                </span>
                            </button>
                        </div>
                    </div>
                )
            ) : null}

            {/* Additional dynamic sections for any other arrays in the data */}
            {Object.keys(dataSource || {}).map(key => {
                if (
                    key === 'header' ||
                    key === 'downtime_events' ||
                    key === 'document_type'
                )
                    return null;

                const value = dataSource[key];
                if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return (
                            <div
                                key={key}
                                className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden"
                            >
                                <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700">
                                    <h3 className="text-lg font-semibold text-white">
                                        {key.charAt(0).toUpperCase() +
                                            key.slice(1).replace(/_/g, ' ')}
                                    </h3>
                                </div>
                                <div className="px-6 py-8 text-center bg-gray-50">
                                    <p className="text-gray-600 mb-4">
                                        No items found. Add a new row to get
                                        started.
                                    </p>
                                    <button
                                        onClick={() => handleAddRow(key)}
                                        disabled={isAddingRow}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 mx-auto"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>
                                            {isAddingRow
                                                ? 'Adding...'
                                                : 'Add First Row'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={key}
                            className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden"
                        >
                            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700">
                                <h3 className="text-lg font-semibold text-white">
                                    {key.charAt(0).toUpperCase() +
                                        key.slice(1).replace(/_/g, ' ')}
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {Object.keys(value[0] || {}).map(
                                                subKey => (
                                                    <th
                                                        key={subKey}
                                                        className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider"
                                                    >
                                                        {subKey
                                                            .charAt(0)
                                                            .toUpperCase() +
                                                            subKey
                                                                .slice(1)
                                                                .replace(
                                                                    /_/g,
                                                                    ' ',
                                                                )}
                                                    </th>
                                                ),
                                            )}
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {value.map(
                                            (item: any, index: number) => (
                                                <tr key={index}>
                                                    {Object.keys(item).map(
                                                        subKey => (
                                                            <td
                                                                key={subKey}
                                                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                            >
                                                                <EditableField
                                                                    docId={
                                                                        doc.id
                                                                    }
                                                                    field={`data.${key}.${index}.${subKey}`}
                                                                    value={
                                                                        item[
                                                                            subKey
                                                                        ]
                                                                    }
                                                                    editingCell={
                                                                        editingCell
                                                                    }
                                                                    editValue={
                                                                        editValue
                                                                    }
                                                                    setEditValue={
                                                                        setEditValue
                                                                    }
                                                                    setEditingCell={
                                                                        setEditingCell
                                                                    }
                                                                    startEdit={
                                                                        startEdit
                                                                    }
                                                                    saveEdit={
                                                                        saveEdit
                                                                    }
                                                                    type={
                                                                        typeof item[
                                                                            subKey
                                                                        ] ===
                                                                        'number'
                                                                            ? 'number'
                                                                            : 'text'
                                                                    }
                                                                />
                                                            </td>
                                                        ),
                                                    )}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center space-x-1">
                                                            <button
                                                                onClick={() =>
                                                                    handleReorderRow(
                                                                        key,
                                                                        index,
                                                                        'up',
                                                                    )
                                                                }
                                                                disabled={
                                                                    index === 0
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move up"
                                                            >
                                                                <ArrowUp className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleReorderRow(
                                                                        key,
                                                                        index,
                                                                        'down',
                                                                    )
                                                                }
                                                                disabled={
                                                                    index ===
                                                                    value.length -
                                                                        1
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move down"
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    handleDeleteRow(
                                                                        key,
                                                                        index,
                                                                    )
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
                                                                title="Delete row"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    {value.length} row
                                    {value.length !== 1 ? 's' : ''}
                                </div>
                                <button
                                    onClick={() => handleAddRow(key)}
                                    disabled={isAddingRow}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02] shadow-md hover:shadow-lg"
                                >
                                    {isAddingRow &&
                                    addingRowForTable === key ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            <span>Add Row</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
};

export const KosuTable: React.FC<TableRendererProps> = ({
    doc,
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
    editedData,
}) => {
    // Use editedData if available, otherwise use doc.data
    const dataSource = editedData || doc.data;
    // Define the header fields that appear first in Kosu documents
    const headerFieldKeys = [
        'Titre du document',
        'Référence du document',
        'Date du document',
        'Equipe',
        'Nom Ligne',
        'Code ligne',
        'Jour',
        'Semaine',
        'Numéro OF',
        'Ref PF',
    ];

    // Extract header fields from the actual data
    const headerFields = headerFieldKeys
        .filter(key => dataSource && dataSource[key] !== undefined)
        .map(key => ({
            label: key,
            field: `data.${key}`,
            value: dataSource[key],
            type:
                typeof dataSource[key] === 'number'
                    ? ('number' as const)
                    : ('text' as const),
        }));

    return (
        <div className="space-y-6">
            {/* Document Header Section */}
            {headerFields.length > 0 && (
                <div className="bg-white shadow-lg rounded-lg border border-gray-200">
                    <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700">
                        <h3 className="text-lg font-semibold text-white">
                            Document Information
                        </h3>
                    </div>
                    <div className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {headerFields.map(
                                ({ label, field, value, type }) => (
                                    <div key={field} className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            {label}
                                        </label>
                                        <EditableField
                                            docId={doc.id}
                                            field={field}
                                            value={value}
                                            editingCell={editingCell}
                                            editValue={editValue}
                                            setEditValue={setEditValue}
                                            setEditingCell={setEditingCell}
                                            startEdit={startEdit}
                                            saveEdit={saveEdit}
                                            type={type}
                                            label={label}
                                        />
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hourly Tracking Section */}
            {dataSource?.['Suivi horaire'] &&
                Array.isArray(dataSource['Suivi horaire']) &&
                dataSource['Suivi horaire'].length > 0 && (
                    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
                            <h3 className="text-lg font-semibold text-white">
                                Suivi horaire (Hourly Tracking)
                            </h3>
                        </div>
                        <div className="px-6 py-4">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Heure
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Nb Opérateurs
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Objectif Qté/H
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Qté pièces bonnes
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Productivité
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {dataSource['Suivi horaire'].map(
                                            (item: any, index: number) => (
                                                <tr
                                                    key={index}
                                                    className="hover:bg-gray-50"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.Heure || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Suivi horaire.${index}.Nombre d'Opérateurs`}
                                                            value={
                                                                item[
                                                                    "Nombre d'Opérateurs"
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="number"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Suivi horaire.${index}.Objectif Qté / H`}
                                                            value={
                                                                item[
                                                                    'Objectif Qté / H'
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="number"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Suivi horaire.${index}.Quantité pièces bonnes`}
                                                            value={
                                                                item[
                                                                    'Quantité pièces bonnes'
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="number"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Suivi horaire.${index}.Productivité`}
                                                            value={
                                                                item[
                                                                    'Productivité'
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="text"
                                                        />
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            {/* Team Summary Section */}
            {doc.data?.['Total / Equipe'] &&
                typeof doc.data['Total / Equipe'] === 'object' && (
                    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
                        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700">
                            <h3 className="text-lg font-semibold text-white">
                                Total / Equipe (Team Summary)
                            </h3>
                        </div>
                        <div className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {Object.entries(doc.data['Total / Equipe']).map(
                                    ([key, value]) => (
                                        <div key={key} className="space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700">
                                                {key}
                                            </label>
                                            <EditableField
                                                docId={doc.id}
                                                field={`data.Total / Equipe.${key}`}
                                                value={value}
                                                editingCell={editingCell}
                                                editValue={editValue}
                                                setEditValue={setEditValue}
                                                setEditingCell={setEditingCell}
                                                startEdit={startEdit}
                                                saveEdit={saveEdit}
                                                type={
                                                    typeof value === 'number'
                                                        ? 'number'
                                                        : 'text'
                                                }
                                                label={key}
                                            />
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>
                )}

            {/* Escalation Rules Section */}
            {doc.data?.["Règles d'escalade"] &&
                Array.isArray(doc.data["Règles d'escalade"]) &&
                doc.data["Règles d'escalade"].length > 0 && (
                    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
                        <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700">
                            <h3 className="text-lg font-semibold text-white">
                                Règles d&apos;escalade (Escalation Rules)
                            </h3>
                        </div>
                        <div className="px-6 py-4">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Productivité
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Personne à informer
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {doc.data["Règles d'escalade"].map(
                                            (rule: any, index: number) => (
                                                <tr
                                                    key={index}
                                                    className="hover:bg-gray-50"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Règles d'escalade.${index}.Productivité`}
                                                            value={
                                                                rule[
                                                                    'Productivité'
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="text"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <EditableField
                                                            docId={doc.id}
                                                            field={`data.Règles d'escalade.${index}.Personne à informer`}
                                                            value={
                                                                rule[
                                                                    'Personne à informer'
                                                                ]
                                                            }
                                                            editingCell={
                                                                editingCell
                                                            }
                                                            editValue={
                                                                editValue
                                                            }
                                                            setEditValue={
                                                                setEditValue
                                                            }
                                                            setEditingCell={
                                                                setEditingCell
                                                            }
                                                            startEdit={
                                                                startEdit
                                                            }
                                                            saveEdit={saveEdit}
                                                            type="text"
                                                        />
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            {/* Additional fields that aren't in the main sections */}
            {Object.keys(doc.data || {}).map(key => {
                // Skip fields we've already handled
                if (
                    headerFieldKeys.includes(key) ||
                    key === 'document_type' ||
                    key === 'Suivi horaire' ||
                    key === 'Total / Equipe' ||
                    key === "Règles d'escalade" ||
                    key === 'remark' ||
                    key === 'extraction_confidence' ||
                    key === 'final_confidence'
                ) {
                    return null;
                }

                const value = doc.data[key];

                // Handle simple values or strings
                if (
                    value !== null &&
                    value !== undefined &&
                    typeof value !== 'object'
                ) {
                    return (
                        <div
                            key={key}
                            className="bg-white shadow-lg rounded-lg border border-gray-200"
                        >
                            <div className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700">
                                <h3 className="text-lg font-semibold text-white">
                                    {key}
                                </h3>
                            </div>
                            <div className="px-6 py-4">
                                <EditableField
                                    docId={doc.id}
                                    field={`data.${key}`}
                                    value={value}
                                    editingCell={editingCell}
                                    editValue={editValue}
                                    setEditValue={setEditValue}
                                    setEditingCell={setEditingCell}
                                    startEdit={startEdit}
                                    saveEdit={saveEdit}
                                    type={
                                        typeof value === 'number'
                                            ? 'number'
                                            : 'text'
                                    }
                                    label={key}
                                />
                            </div>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
};
