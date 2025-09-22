import { AlertCircle, Edit2, Shield, ShieldCheck } from 'lucide-react';
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

    if (isEditing) {
        return (
            <div className="relative bg-white border-2 border-blue-400 rounded-lg p-3 shadow-lg">
                <div className="flex flex-col space-y-3">
                    <input
                        type={type}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                            } else if (e.key === 'Escape') {
                                setEditingCell(null);
                            }
                        }}
                        placeholder="Enter value..."
                    />
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setEditingCell(null)}
                            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
                            title="Cancel (Esc)"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEdit}
                            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors font-medium shadow-sm"
                            title="Save (Enter)"
                        >
                            Save
                        </button>
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
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
}) => {
    // Generate header fields dynamically from the actual header data
    const headerFields = doc.data?.header
        ? Object.keys(doc.data.header).map(key => ({
              label:
                  key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              field: `data.header.${key}`,
              value: doc.data.header[key],
              type:
                  typeof doc.data.header[key] === 'number'
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
            {Object.keys(doc.data || {}).map(key => {
                if (key === 'header' || key === 'document_type') return null;

                const value = doc.data[key];
                if (Array.isArray(value) && value.length > 0) {
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
                                            {Object.keys(value[0] || {}).map(
                                                subKey => (
                                                    <th
                                                        key={subKey}
                                                        className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className="text-sm text-gray-400">
                                                            —
                                                        </span>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
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
    editingCell,
    editValue,
    setEditValue,
    setEditingCell,
    startEdit,
    saveEdit,
}) => {
    // Generate header fields dynamically from the actual header data
    const headerFields = doc.data?.header
        ? Object.keys(doc.data.header).map(key => ({
              label:
                  key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              field: `data.header.${key}`,
              value: doc.data.header[key],
              type:
                  typeof doc.data.header[key] === 'number'
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
            {doc.data?.downtime_events &&
                Array.isArray(doc.data.downtime_events) &&
                doc.data.downtime_events.length > 0 && (
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
                                            doc.data.downtime_events[0] || {},
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
                                    {doc.data.downtime_events.map(
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className="text-sm text-gray-400">
                                                        —
                                                    </span>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            {/* Additional dynamic sections for any other arrays in the data */}
            {Object.keys(doc.data || {}).map(key => {
                if (
                    key === 'header' ||
                    key === 'downtime_events' ||
                    key === 'document_type'
                )
                    return null;

                const value = doc.data[key];
                if (Array.isArray(value) && value.length > 0) {
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
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className="text-sm text-gray-400">
                                                            —
                                                        </span>
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
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
}) => {
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
        .filter(key => doc.data && doc.data[key] !== undefined)
        .map(key => ({
            label: key,
            field: `data.${key}`,
            value: doc.data[key],
            type:
                typeof doc.data[key] === 'number'
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
            {doc.data?.['Suivi horaire'] &&
                Array.isArray(doc.data['Suivi horaire']) &&
                doc.data['Suivi horaire'].length > 0 && (
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
                                        {doc.data['Suivi horaire'].map(
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
