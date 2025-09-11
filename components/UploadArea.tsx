import {
    FileImage,
    Loader2,
    Plus,
    Sparkles,
    Upload,
    X,
    Zap,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

type DocumentType = 'Rebut' | 'NPT' | 'Kosu';

interface UploadAreaProps {
    selectedType: DocumentType;
    isExtracting: boolean;
    onFileUpload: (file: File) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
}

export default function UploadArea({
    selectedType,
    isExtracting,
    onFileUpload,
    onDrop,
    onDragOver,
}: UploadAreaProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(e);
    };

    const getDocumentTypeColor = (type: DocumentType) => {
        const colors = {
            Rebut: 'blue',
            NPT: 'orange',
            Kosu: 'green',
        };
        return colors[type];
    };

    const getDocumentTypeInfo = (type: DocumentType) => {
        const info = {
            Rebut: {
                title: 'Upload Rebut Document',
                description: 'Drop your Rebut document here',
                examples: 'Supports PDF, PNG, JPG formats',
            },
            NPT: {
                title: 'Upload NPT Document',
                description: 'Drop your NPT document here',
                examples: 'Supports PDF, PNG, JPG formats',
            },
            Kosu: {
                title: 'Upload Kosu Document',
                description: 'Drop your Kosu document here',
                examples: 'Supports PDF, PNG, JPG formats',
            },
        };
        return info[type];
    };

    const color = getDocumentTypeColor(selectedType);
    const info = getDocumentTypeInfo(selectedType);

    return (
        <div className="mb-4 sm:mb-6 md:mb-8">
            {/* Compact Upload Button */}
            {!isExpanded && !isExtracting && (
                <div className="flex justify-center px-3 sm:px-0">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className={`
                            group relative flex items-center space-x-3 px-4 sm:px-6 py-3 sm:py-4 
                            bg-gradient-to-r from-${color}-600 via-${color}-700 to-${color}-800
                            text-white rounded-lg sm:rounded-xl shadow-lg hover:shadow-2xl 
                            transition-all duration-500 hover:scale-[1.05] active:scale-95 
                            w-full sm:w-auto min-h-[60px] justify-center sm:justify-start
                            overflow-hidden
                        `}
                    >
                        {/* Animated Background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000" />

                        <div
                            className={`relative p-2 bg-${color}-500 bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-all flex-shrink-0 group-hover:rotate-12 duration-300`}
                        >
                            <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="relative text-center sm:text-left min-w-0 flex-1">
                            <div className="font-semibold text-sm sm:text-base flex items-center justify-center sm:justify-start">
                                Upload {selectedType} Document
                                <Sparkles className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                            </div>
                            <div className="text-xs sm:text-sm opacity-90 hidden sm:block">
                                Click to add new document
                            </div>
                        </div>
                        <Upload className="h-5 w-5 opacity-80 flex-shrink-0 group-hover:translate-y-[-2px] transition-transform" />
                    </button>
                </div>
            )}

            {/* Expanded Upload Area or Processing State */}
            {(isExpanded || isExtracting) && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-in slide-in-from-top duration-500">
                    {/* Header */}
                    <div
                        className={`bg-gradient-to-r from-${color}-600 via-${color}-700 to-${color}-800 px-4 sm:px-6 py-3 relative overflow-hidden`}
                    >
                        {/* Animated Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                        </div>

                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div
                                    className={`p-2 bg-${color}-500 bg-opacity-20 rounded-lg animate-pulse`}
                                >
                                    <Upload className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white flex items-center">
                                        {info.title}
                                        {isExtracting && (
                                            <Zap className="h-4 w-4 ml-2 animate-bounce text-yellow-300" />
                                        )}
                                    </h3>
                                    <p className="text-sm text-white text-opacity-90">
                                        {info.examples}
                                    </p>
                                </div>
                            </div>
                            {!isExtracting && (
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1.5 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-300 hover:rotate-90"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Upload Content */}
                    <div
                        className={`
                            relative p-6 sm:p-8 text-center transition-all duration-500
                            ${
                                isExtracting
                                    ? `bg-gradient-to-br from-${color}-50 to-${color}-100/50`
                                    : `border-2 border-dashed transition-all duration-300 ${
                                          isDragOver
                                              ? `border-${color}-500 bg-${color}-100 scale-105`
                                              : `border-gray-300 hover:border-${color}-400 hover:bg-${color}-50/30`
                                      } cursor-pointer`
                            }
                        `}
                        onDrop={handleDrop}
                        onDragOver={onDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onClick={() =>
                            !isExtracting && fileInputRef.current?.click()
                        }
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) onFileUpload(file);
                            }}
                            className="hidden"
                        />

                        {/* Drag Over Overlay */}
                        {isDragOver && (
                            <div
                                className={`absolute inset-0 bg-${color}-500/20 border-2 border-${color}-500 rounded-lg flex items-center justify-center animate-in fade-in duration-200`}
                            >
                                <div
                                    className={`bg-white/90 px-6 py-4 rounded-lg shadow-lg border-2 border-${color}-500 animate-bounce`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <Upload
                                            className={`h-6 w-6 text-${color}-600`}
                                        />
                                        <span
                                            className={`font-semibold text-${color}-900`}
                                        >
                                            Drop your file here!
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isExtracting ? (
                            <div className="flex flex-col items-center py-4">
                                <div className={`relative mb-4`}>
                                    <div
                                        className={`w-16 h-16 rounded-full bg-${color}-100 flex items-center justify-center`}
                                    >
                                        <Loader2
                                            className={`h-8 w-8 text-${color}-600 animate-spin`}
                                        />
                                    </div>
                                    <div
                                        className={`absolute inset-0 rounded-full border-4 border-${color}-200 animate-pulse`}
                                    ></div>
                                </div>

                                <div className="space-y-2">
                                    <h3
                                        className={`text-lg font-bold text-${color}-900`}
                                    >
                                        Processing Your Document
                                    </h3>
                                    <p className={`text-sm text-${color}-700`}>
                                        AI is extracting data from your{' '}
                                        {selectedType} document
                                    </p>
                                    <div
                                        className={`flex items-center justify-center space-x-2 text-xs text-${color}-600`}
                                    >
                                        <div
                                            className={`w-2 h-2 rounded-full bg-${color}-600 animate-bounce`}
                                        ></div>
                                        <div
                                            className={`w-2 h-2 rounded-full bg-${color}-600 animate-bounce`}
                                            style={{ animationDelay: '0.1s' }}
                                        ></div>
                                        <div
                                            className={`w-2 h-2 rounded-full bg-${color}-600 animate-bounce`}
                                            style={{ animationDelay: '0.2s' }}
                                        ></div>
                                        <span className="ml-2">
                                            This may take a few moments
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 relative">
                                {/* Upload Icon */}
                                <div
                                    className={`
                                    w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-${color}-100 to-${color}-200 
                                    flex items-center justify-center transition-all duration-300
                                    shadow-md hover:shadow-lg hover:scale-110
                                    ${isDragOver ? 'scale-110 shadow-lg' : ''}
                                `}
                                >
                                    <FileImage
                                        className={`h-8 w-8 text-${color}-600 transition-transform ${isDragOver ? 'animate-bounce' : ''}`}
                                    />
                                </div>

                                {/* Text Content */}
                                <div className="space-y-2 mb-6">
                                    <h3
                                        className={`text-lg font-semibold transition-colors ${isDragOver ? `text-${color}-900` : 'text-gray-900'}`}
                                    >
                                        {isDragOver
                                            ? `Drop your ${selectedType} document`
                                            : info.description}
                                    </h3>
                                    <p
                                        className={`text-sm transition-colors ${isDragOver ? `text-${color}-700` : 'text-gray-600'}`}
                                    >
                                        {isDragOver
                                            ? 'Release to upload'
                                            : 'Drag and drop your file here, or click to browse'}
                                    </p>
                                </div>

                                {/* Upload Button */}
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    className={`
                                        inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium shadow-md
                                        transition-all duration-300 hover:scale-105 active:scale-95
                                        ${
                                            isDragOver
                                                ? `bg-${color}-700 text-white hover:bg-${color}-800 animate-pulse`
                                                : `bg-${color}-600 text-white hover:bg-${color}-700`
                                        }
                                    `}
                                >
                                    <Upload
                                        className={`h-4 w-4 ${isDragOver ? 'animate-bounce' : ''}`}
                                    />
                                    <span>
                                        {isDragOver
                                            ? 'Drop Here!'
                                            : 'Choose File'}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
