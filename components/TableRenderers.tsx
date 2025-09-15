import { Edit2, Save, X } from 'lucide-react';
import React from 'react';

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

// Helper component for editable fields
const EditableField: React.FC<{
    docId: string;
    field: string;
    value: any;
    editingCell: { doc: string; field: string } | null;
    editValue: string;
    setEditValue: (value: string) => void;
    setEditingCell: (cell: { doc: string; field: string } | null) => void;
    startEdit: (docId: string, field: string, currentValue: any) => void;
    saveEdit: () => void;
    type?: 'text' | 'number';
    label?: string;
}> = ({
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
    label,
}) => {
    const isEditing =
        editingCell?.doc === docId && editingCell?.field === field;

    return (
        <div className="flex items-center space-x-2">
            {isEditing ? (
                <>
                    <input
                        type={type}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={label}
                    />
                    <button
                        onClick={saveEdit}
                        className="text-green-600 hover:text-green-800 p-1"
                        title="Save"
                    >
                        <Save size={16} />
                    </button>
                    <button
                        onClick={() => setEditingCell(null)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Cancel"
                    >
                        <X size={16} />
                    </button>
                </>
            ) : (
                <>
                    <span className="flex-1 text-gray-900">{value || '-'}</span>
                    <button
                        onClick={() => startEdit(docId, field, value)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                </>
            )}
        </div>
    );
};

// Header Card Component
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
    return (
        <div className="bg-white shadow-lg rounded-lg mb-6 border border-gray-200">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
            <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-800">
                    {fields.map(({ label, field, value, type = 'text' }) => (
                        <div key={field} className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-800  mb-1">
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
                            className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden"
                        >
                            <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700">
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
