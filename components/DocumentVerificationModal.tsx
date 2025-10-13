'use client';

import {
    AlertCircle,
    Check,
    Download,
    Edit2,
    Home,
    RotateCw,
    Save,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { KosuTable, NPTTable, RebutTable } from './TableRenderers';

type VerificationStatus =
    | 'original'
    | 'draft'
    | 'pending_verification'
    | 'verified'
    | 'revision_needed';

interface DocumentVerificationModalProps {
    document: any;
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        documentId: string,
        updates: any,
        newStatus: VerificationStatus,
    ) => Promise<void>;
    selectedType: string;
}

export const DocumentVerificationModal: React.FC<
    DocumentVerificationModalProps
> = ({ document, isOpen, onClose, onSave, selectedType }) => {
    const [editedData, setEditedData] = useState<any>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [imageZoom, setImageZoom] = useState(100);
    const [imageRotation, setImageRotation] = useState(0);
    const [customZoom, setCustomZoom] = useState('100');
    const [isEditingZoom, setIsEditingZoom] = useState(false);
    const [verificationNotes, setVerificationNotes] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);

    // Image panning states
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Table editing states (same as in main page)
    const [editingCell, setEditingCell] = useState<{
        doc: string;
        field: string;
    } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Always allow editing - remove read-only restrictions
    const isViewMode = false;

    useEffect(() => {
        if (document && isOpen) {
            // Extract the actual document data
            // Handle both doc.data and doc.data.data structures
            let documentData = document.data;

            // If the data has nested data property, use that instead
            if (
                documentData &&
                typeof documentData === 'object' &&
                documentData.data
            ) {
                documentData = documentData.data;
            }

            console.log('Verification Modal - Document:', document);
            console.log('Verification Modal - Document Data:', documentData);

            setEditedData(JSON.parse(JSON.stringify(documentData)));
            setHasChanges(false);
            setImageZoom(100);
            setImageRotation(0);
            setCustomZoom('100');
            setIsEditingZoom(false);
            setImagePosition({ x: 0, y: 0 });
            setVerificationNotes('');
            setShowConfirmDialog(false);
            setEditingCell(null);
            setEditValue('');
            setShowVerifiedMessage(false);
            setIsDragging(false);
        }
    }, [document, isOpen]);

    if (!isOpen || !document) return null;

    // Table editing functions (same as in main page)
    const handleCellEdit = async (
        docId: string,
        field: string,
        oldValue: any,
        newValue: any,
    ) => {
        if (!editedData) return;

        // Update the editedData directly for immediate UI feedback
        const newData = { ...editedData };
        const fieldPath = field.replace('data.', '').split('.');
        let current = newData;

        // Navigate to the parent of the field to be updated
        for (let i = 0; i < fieldPath.length - 1; i++) {
            if (current[fieldPath[i]] === undefined) {
                current[fieldPath[i]] = {};
            }
            current = current[fieldPath[i]];
        }

        // Update the final field
        current[fieldPath[fieldPath.length - 1]] = newValue;

        setEditedData(newData);
        setHasChanges(true);
        setEditingCell(null);
    };

    const startEdit = (docId: string, field: string, currentValue: any) => {
        // Always allow editing
        setEditingCell({ doc: docId, field });
        setEditValue(currentValue?.toString() || '');
    };

    const saveEdit = async () => {
        if (!editingCell || !editedData) return;

        const fieldPath = editingCell.field.replace('data.', '').split('.');
        let currentValue: any = editedData;
        for (const path of fieldPath) {
            currentValue = currentValue[path];
        }

        await handleCellEdit(
            editingCell.doc,
            editingCell.field,
            currentValue,
            editValue,
        );
    };

    const handleSaveDraft = async () => {
        if (!hasChanges || !editedData) return;

        setSaving(true);
        try {
            // Generate the new filename format
            const formattedFilename = generateFormattedFilename({
                data: editedData,
                metadata: document.metadata,
            });

            // Prepare the data with updated filename
            const updates = {
                data: editedData,
                metadata: {
                    ...document.metadata,
                    filename: formattedFilename,
                },
            };

            console.log('Saving draft with data:', updates);
            console.log('Original metadata:', document.metadata);
            console.log('New filename:', formattedFilename);

            await onSave(document.id, updates, 'draft');
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitVerification = () => {
        setShowConfirmDialog(true);
    };

    const handleConfirmVerification = async () => {
        setSaving(true);
        try {
            // Generate the new filename format
            const formattedFilename = generateFormattedFilename({
                data: editedData,
                metadata: document.metadata,
            });

            const updates: any = {
                data: editedData,
                verified_by: 'current_user', // Replace with actual user identification
                verified_at: new Date(),
                // Update metadata with new filename format
                metadata: {
                    ...document.metadata,
                    filename: formattedFilename,
                },
            };

            if (verificationNotes.trim()) {
                updates.verification_notes = verificationNotes;
            }

            console.log('Verifying document with updates:', updates);
            console.log('Original metadata:', document.metadata);
            console.log('New filename:', formattedFilename);

            await onSave(document.id, updates, 'verified');
            setShowConfirmDialog(false);
            setShowVerifiedMessage(true);

            // Auto-close after showing success message
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Error verifying document:', error);
            alert('Failed to verify document');
        } finally {
            setSaving(false);
        }
    };

    // Dynamic zoom increment based on current zoom level
    const getZoomIncrement = (currentZoom: number) => {
        if (currentZoom < 100) return 10;
        if (currentZoom < 200) return 25;
        return 50;
    };

    const handleZoomIn = () => {
        setImageZoom(prev => {
            const increment = getZoomIncrement(prev);
            const newZoom = Math.min(prev + increment, 500);
            setCustomZoom(newZoom.toString());
            // Reset position to center when zooming
            if (prev <= 100 && newZoom > 100) {
                setImagePosition({ x: 0, y: 0 });
            }
            return newZoom;
        });
    };

    const handleZoomOut = () => {
        setImageZoom(prev => {
            const increment = getZoomIncrement(prev);
            const newZoom = Math.max(prev - increment, 25);
            setCustomZoom(newZoom.toString());
            // Reset position to center when returning to 100% or below
            if (newZoom <= 100) {
                setImagePosition({ x: 0, y: 0 });
            }
            return newZoom;
        });
    };

    const handleCustomZoomChange = (value: string) => {
        setCustomZoom(value);

        // Only update zoom if it's a valid number
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 25 && numValue <= 500) {
            setImageZoom(numValue);
            // Reset position when changing zoom
            if (numValue <= 100) {
                setImagePosition({ x: 0, y: 0 });
            }
        }
    };

    const handleCustomZoomSubmit = () => {
        const numValue = parseInt(customZoom);
        if (!isNaN(numValue)) {
            const clampedValue = Math.max(25, Math.min(500, numValue));
            setImageZoom(clampedValue);
            setCustomZoom(clampedValue.toString());
            // Reset position when changing zoom
            if (clampedValue <= 100) {
                setImagePosition({ x: 0, y: 0 });
            }
        } else {
            setCustomZoom(imageZoom.toString());
        }
        setIsEditingZoom(false);
    };

    // const handleZoomPreset = (preset: number) => {
    //     setImageZoom(preset);
    //     setCustomZoom(preset.toString());
    //     // Reset position when changing zoom
    //     if (preset <= 100) {
    //         setImagePosition({ x: 0, y: 0 });
    //     }
    // };

    const handleRotate = () => setImageRotation(prev => (prev + 90) % 360);

    const handleImageWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setImageZoom(prev => {
            const newZoom = Math.max(25, Math.min(500, prev * zoomFactor));
            setCustomZoom(Math.round(newZoom).toString());
            // Reset position to center when returning to 100% or below
            if (newZoom <= 100 && prev > 100) {
                setImagePosition({ x: 0, y: 0 });
            }
            // Reset position to center when first zooming in from 100%
            if (prev <= 100 && newZoom > 100) {
                setImagePosition({ x: 0, y: 0 });
            }
            return newZoom;
        });
    };

    // Drag handlers for panning
    const handleMouseDown = (e: React.MouseEvent) => {
        if (imageZoom > 100) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - imagePosition.x,
                y: e.clientY - imagePosition.y,
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && imageZoom > 100) {
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;

            // Optional: Add bounds checking to prevent dragging too far
            // You can uncomment and adjust these limits if needed
            // const maxOffset = 200; // Maximum pixels to drag
            // const boundedX = Math.max(-maxOffset, Math.min(maxOffset, newX));
            // const boundedY = Math.max(-maxOffset, Math.min(maxOffset, newY));

            setImagePosition({
                x: newX,
                y: newY,
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    // Function to reset image to center
    const resetImagePosition = () => {
        setImagePosition({ x: 0, y: 0 });
        setImageZoom(100);
        setImageRotation(0);
    };

    const generateFormattedFilename = (doc: any) => {
        console.log('generateFormattedFilename - Full doc object:', doc);

        if (!doc.data) {
            console.log(
                'generateFormattedFilename - No data found, using fallback:',
                doc.metadata.filename,
            );
            return doc.metadata.filename;
        }

        // Extract data based on document type
        const docType = selectedType;
        let of = '';
        let date = '';
        let ligne = '';
        let equipe = '';

        console.log('generateFormattedFilename - Input:', {
            docType,
            data: doc.data,
        });

        if (docType === 'Rebut') {
            // For Rebut documents, look in header
            const header = doc.data.header || {};
            of = header.of || header.OF || header['Ordre de Fabrication'] || '';
            date = header.date || header.Date || '';
            ligne = header.ligne || header.Ligne || header['Code ligne'] || '';
            equipe = header.equipe || header.Equipe || '';
        } else if (docType === 'NPT') {
            // For NPT documents, look in header
            const header = doc.data.header || {};
            of = header.of || header.OF || header['Numéro OF'] || '';
            date = header.date || header.Date || '';
            ligne = header.ligne || header.Ligne || header['Nom Ligne'] || '';
            equipe = header.equipe || header.Equipe || '';
        } else if (docType === 'Kosu') {
            // For Kosu documents, look in main data
            of = doc.data['Numéro OF'] || '';
            date = doc.data['Date du document'] || doc.data['Jour'] || '';
            ligne = doc.data['Nom Ligne'] || doc.data['Code ligne'] || '';
            equipe = doc.data['Equipe'] || '';
        }

        console.log('generateFormattedFilename - Extracted values:', {
            of,
            date,
            ligne,
            equipe,
        });

        // Clean and format the values
        const cleanValue = (val: any) => {
            if (!val) return '';
            // For dates, remove all non-alphanumeric characters and keep only numbers and letters
            return String(val)
                .replace(/[^\w\d]/g, '')
                .substring(0, 15);
        };

        const formattedOF = cleanValue(of);
        const formattedDate = cleanValue(date);
        const formattedLigne = cleanValue(ligne);
        const formattedEquipe = cleanValue(equipe);

        console.log('generateFormattedFilename - Cleaned values:', {
            formattedOF,
            formattedDate,
            formattedLigne,
            formattedEquipe,
        });

        // Create filename in format: Doctype-OF_DATE_LIGNE_EQUIPE
        // Make it more flexible - only require OF, date, and ligne (equipe is optional)
        if (formattedOF || formattedDate || formattedLigne) {
            const parts = [docType];
            if (formattedOF) parts.push(formattedOF);
            if (formattedDate) parts.push(formattedDate);
            if (formattedLigne) parts.push(formattedLigne);
            if (formattedEquipe) parts.push(formattedEquipe);

            const newFilename = parts.join('_');
            console.log(
                'generateFormattedFilename - Generated filename:',
                newFilename,
            );
            return newFilename;
        }

        // Fallback to original filename if data is missing
        console.log(
            'generateFormattedFilename - Using fallback filename:',
            doc.metadata.filename,
        );
        return doc.metadata.filename;
    };

    const downloadImage = async () => {
        if (!document.imageUrl) return;

        try {
            const imageUrl = document.imageUrl.startsWith('http')
                ? document.imageUrl
                : `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${document.imageUrl}`;

            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;

            // Use formatted filename
            const formattedFilename = generateFormattedFilename({
                data: editedData,
                metadata: document.metadata,
            });
            a.download = `${formattedFilename}_original.jpg`;

            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    };

    const getStatusBadge = (status: VerificationStatus) => {
        const statusConfig = {
            original: { color: 'bg-gray-100 text-gray-800', label: 'Original' },
            draft: { color: 'bg-yellow-100 text-yellow-800', label: 'Draft' },
            pending_verification: {
                color: 'bg-blue-100 text-blue-800',
                label: 'Pending Verification',
            },
            verified: {
                color: 'bg-green-100 text-green-800',
                label: 'Verified',
            },
            revision_needed: {
                color: 'bg-red-100 text-red-800',
                label: 'Revision Needed',
            },
        };

        const config = statusConfig[status] || statusConfig.original;
        return (
            <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}
            >
                {config.label}
            </span>
        );
    };

    const renderDataSection = () => {
        if (!editedData)
            return (
                <div className="p-4 text-gray-500">
                    No data available for verification
                </div>
            );

        // Create a document object with the structure expected by table renderers
        const documentForTable = {
            id: document.id,
            data: editedData,
            metadata: document.metadata,
        };

        const tableProps = {
            doc: documentForTable,
            selectedType: selectedType as 'Rebut' | 'NPT' | 'Kosu',
            editingCell,
            editValue,
            setEditValue,
            setEditingCell,
            startEdit,
            saveEdit,
            setSelectedDocument: () => {}, // Not needed in verification modal
        };

        return (
            <div className="space-y-6">
                {/* Document Info - Always show */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Document Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-600 font-medium mb-1">
                                File Size
                            </div>
                            <div className="font-semibold text-lg text-gray-900">
                                {(document.metadata.file_size / 1024).toFixed(
                                    1,
                                )}{' '}
                                KB
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="text-sm text-gray-600 font-medium mb-1">
                                Document Type
                            </div>
                            <div className="font-semibold text-lg text-gray-900 truncate">
                                {document.metadata.document_type}
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 sm:col-span-2 xl:col-span-1">
                            <div className="text-sm text-gray-600 font-medium mb-1">
                                Processed
                            </div>
                            <div className="font-semibold text-base text-gray-900">
                                {new Date(
                                    document.metadata.processed_at,
                                ).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extracted Data Tables */}
                <div>
                    {/* Debug logging to understand data structure */}
                    {(() => {
                        console.log(
                            'Verification Modal - Document data structure:',
                            {
                                filename: document.metadata?.filename,
                                documentType: editedData.document_type,
                                dataKeys: editedData
                                    ? Object.keys(editedData)
                                    : 'No data object',
                                selectedType,
                            },
                        );
                        return null;
                    })()}

                    {/* Render the appropriate table based on document type */}
                    {selectedType === 'Rebut' && <RebutTable {...tableProps} />}
                    {selectedType === 'NPT' && <NPTTable {...tableProps} />}
                    {selectedType === 'Kosu' && <KosuTable {...tableProps} />}

                    {!['Rebut', 'NPT', 'Kosu'].includes(selectedType) && (
                        <div className="p-4 text-gray-500">
                            Preview not available for this document type
                        </div>
                    )}
                </div>

                {/* Edit History - Show if history exists */}
                {document.history && document.history.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">
                            Edit History
                        </h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                            {document.history.map(
                                (entry: any, index: number) => (
                                    <div
                                        key={index}
                                        className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-1 sm:space-y-0">
                                            <span className="font-medium text-gray-900 text-sm sm:text-base">
                                                {entry.field}
                                            </span>
                                            <span className="text-xs text-gray-600 font-medium">
                                                {new Date(
                                                    entry.updated_at,
                                                ).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                            <div>
                                                <div className="text-gray-600 mb-1 text-xs sm:text-sm font-medium">
                                                    Old Value:
                                                </div>
                                                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs break-all text-gray-800 font-mono">
                                                    {JSON.stringify(
                                                        entry.old_value,
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-600 mb-1 text-xs sm:text-sm font-medium">
                                                    New Value:
                                                </div>
                                                <div className="bg-green-50 border border-green-200 rounded p-2 text-xs break-all text-gray-800 font-mono">
                                                    {JSON.stringify(
                                                        entry.new_value,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] h-full max-h-[98vh] flex flex-col overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                {isViewMode ? (
                                    <div className="w-5 h-5 bg-white rounded"></div>
                                ) : (
                                    <Check className="h-5 w-5 text-white" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">
                                    Document Verification
                                </h2>
                                <p className="text-indigo-100 text-sm">
                                    Review and verify extracted data
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {getStatusBadge(document.verification_status)}
                            {showVerifiedMessage && (
                                <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium shadow-lg animate-pulse">
                                    <Check className="h-4 w-4" />
                                    <span>Document Verified Successfully!</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {hasChanges && (
                            <button
                                onClick={handleSaveDraft}
                                disabled={saving}
                                className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                <Save className="h-4 w-4" />
                                <span>
                                    {saving ? 'Saving...' : 'Save Draft'}
                                </span>
                            </button>
                        )}
                        <button
                            onClick={handleSubmitVerification}
                            disabled={saving}
                            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
                        >
                            <Check className="h-4 w-4" />
                            <span>Verify & Save</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/10 p-2.5 rounded-xl transition-all duration-200"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Content - Split Screen */}
                <div className="flex-1 flex overflow-hidden bg-gray-50">
                    {/* Left Panel - Extracted Data */}
                    <div className="w-1/2 border-r border-gray-300 flex flex-col bg-white">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Edit2 className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        Extracted Data
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Click any field to edit the extracted
                                        information
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            {renderDataSection()}
                        </div>
                    </div>

                    {/* Right Panel - Original Image */}
                    <div className="w-1/2 flex flex-col bg-white">
                        <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <div className="w-4 h-4 bg-emerald-600 rounded"></div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">
                                            Original Document
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            Reference image for verification
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {/* Zoom Controls */}
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={handleZoomOut}
                                            disabled={imageZoom <= 25}
                                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            title={`Zoom Out (-${getZoomIncrement(imageZoom)}%)`}
                                        >
                                            <ZoomOut className="h-4 w-4 text-black" />
                                        </button>

                                        {/* Custom Zoom Input */}
                                        <div className="relative">
                                            {isEditingZoom ? (
                                                <input
                                                    type="number"
                                                    value={customZoom}
                                                    onChange={e =>
                                                        handleCustomZoomChange(
                                                            e.target.value,
                                                        )
                                                    }
                                                    onBlur={
                                                        handleCustomZoomSubmit
                                                    }
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            handleCustomZoomSubmit();
                                                        } else if (
                                                            e.key === 'Escape'
                                                        ) {
                                                            setCustomZoom(
                                                                imageZoom.toString(),
                                                            );
                                                            setIsEditingZoom(
                                                                false,
                                                            );
                                                        }
                                                    }}
                                                    className="w-16 px-2 py-1 text-xs text-center border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    min="25"
                                                    max="500"
                                                    autoFocus
                                                />
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        setIsEditingZoom(true)
                                                    }
                                                    className="text-sm font-medium text-gray-600 min-w-[50px] text-center px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                                    title="Click to edit zoom level"
                                                >
                                                    {Math.round(imageZoom)}%
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleZoomIn}
                                            disabled={imageZoom >= 500}
                                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            title={`Zoom In (+${getZoomIncrement(imageZoom)}%)`}
                                        >
                                            <ZoomIn className="h-4 w-4 text-black" />
                                        </button>
                                    </div>

                                    {/* Other Controls */}
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={handleRotate}
                                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                            title="Rotate"
                                        >
                                            <RotateCw className="h-4 w-4 text-black" />
                                        </button>
                                        <button
                                            onClick={downloadImage}
                                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                            title="Download"
                                        >
                                            <Download className="h-4 w-4 text-black" />
                                        </button>
                                        <button
                                            onClick={resetImagePosition}
                                            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                            title="Reset View"
                                        >
                                            <Home className="h-4 w-4 text-black" />
                                        </button>
                                        {imageZoom > 100 && (
                                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                Drag to pan
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="flex-1 overflow-hidden p-4 bg-gray-100"
                                onWheel={
                                    document.imageUrl
                                        ? handleImageWheel
                                        : undefined
                                }
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseLeave}
                                style={{
                                    cursor:
                                        imageZoom > 100
                                            ? isDragging
                                                ? 'grabbing'
                                                : 'grab'
                                            : 'default',
                                }}
                            >
                                {document.imageUrl ? (
                                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                        <img
                                            src={
                                                document.imageUrl.startsWith(
                                                    'http',
                                                )
                                                    ? document.imageUrl
                                                    : `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${document.imageUrl}`
                                            }
                                            alt="Original document"
                                            className="object-contain rounded-lg shadow-lg transition-transform duration-200 ease-out select-none"
                                            style={{
                                                transform:
                                                    imageZoom <= 100
                                                        ? `rotate(${imageRotation}deg) scale(${imageZoom / 100})`
                                                        : `rotate(${imageRotation}deg) scale(${imageZoom / 100}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                                                maxWidth:
                                                    imageZoom > 100
                                                        ? 'none'
                                                        : '100%',
                                                maxHeight:
                                                    imageZoom > 100
                                                        ? 'none'
                                                        : '100%',
                                                transformOrigin:
                                                    'center center',
                                            }}
                                            onMouseDown={handleMouseDown}
                                            onDragStart={e =>
                                                e.preventDefault()
                                            } // Prevent browser's default drag
                                            onError={e => {
                                                console.error(
                                                    'Error loading image:',
                                                    document.imageUrl,
                                                );
                                                console.error(
                                                    'Full image URL:',
                                                    document.imageUrl.startsWith(
                                                        'http',
                                                    )
                                                        ? document.imageUrl
                                                        : `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${document.imageUrl}`,
                                                );
                                                e.currentTarget.style.display =
                                                    'none';
                                                const errorDiv = e.currentTarget
                                                    .nextElementSibling as HTMLElement;
                                                if (errorDiv)
                                                    errorDiv.classList.remove(
                                                        'hidden',
                                                    );
                                            }}
                                        />
                                        <div className="hidden items-center justify-center h-full text-gray-500">
                                            <div className="text-center">
                                                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                                                <p>Image could not be loaded</p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    URL: {document.imageUrl}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <div className="text-center">
                                            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                                            <p>No image available</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Confirmation Dialog */}
                {showConfirmDialog && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-gray rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold mb-4">
                                Confirm Verification
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to mark this document as
                                verified? This action confirms that all data has
                                been reviewed and is accurate.
                            </p>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Verification Notes (Optional)
                                </label>
                                <textarea
                                    value={verificationNotes}
                                    onChange={e =>
                                        setVerificationNotes(e.target.value)
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Add any notes about the verification..."
                                />
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmVerification}
                                    disabled={saving}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving
                                        ? 'Verifying...'
                                        : 'Confirm Verification'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentVerificationModal;
