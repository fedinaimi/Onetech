import { Clock, FileText, Users } from 'lucide-react';

type DocumentType = 'Rebut' | 'NPT' | 'Kosu';

interface DocumentTypeSwitchProps {
    selectedType: DocumentType;
    onTypeChange: (type: DocumentType) => void;
    documentsCount?: Record<DocumentType, number>;
}

const documentTypeConfig = {
    Rebut: {
        icon: FileText,
        color: 'blue',
        description: 'Equipment Rebut Documents',
    },
    NPT: {
        icon: Clock,
        color: 'orange',
        description: 'Non-Productive Time Reports',
    },
    Kosu: {
        icon: Users,
        color: 'green',
        description: 'Team Summary Reports',
    },
} as const;

export default function DocumentTypeSwitch({
    selectedType,
    onTypeChange,
    documentsCount = { Rebut: 0, NPT: 0, Kosu: 0 },
}: DocumentTypeSwitchProps) {
    return (
        <div className="mb-6 sm:mb-8">
            {/* Title */}
            <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                    Document Extractor
                </h2>
                <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
                    Choose a document type to extract and manage data
                </p>
            </div>

            {/* Horizontal Switch */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2 sm:p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {(['Rebut', 'NPT', 'Kosu'] as DocumentType[]).map(type => {
                        const config = documentTypeConfig[type];
                        const Icon = config.icon;
                        const isSelected = selectedType === type;
                        const count = documentsCount[type];

                        const colorClasses = {
                            blue: {
                                selected:
                                    'bg-blue-600 text-white shadow-lg border-blue-600',
                                unselected:
                                    'text-blue-600 hover:bg-blue-50 border-transparent',
                            },
                            orange: {
                                selected:
                                    'bg-orange-600 text-white shadow-lg border-orange-600',
                                unselected:
                                    'text-orange-600 hover:bg-orange-50 border-transparent',
                            },
                            green: {
                                selected:
                                    'bg-green-600 text-white shadow-lg border-green-600',
                                unselected:
                                    'text-green-600 hover:bg-green-50 border-transparent',
                            },
                        }[config.color];

                        return (
                            <button
                                key={type}
                                onClick={() => onTypeChange(type)}
                                className={`
                                    relative p-3 sm:p-4 lg:p-5 rounded-lg border-2 transition-all duration-200 ease-in-out
                                    ${
                                        isSelected
                                            ? colorClasses.selected
                                            : colorClasses.unselected
                                    }
                                    hover:scale-105 active:scale-95
                                `}
                            >
                                <div className="flex flex-col items-center text-center space-y-1 sm:space-y-2">
                                    <div className="relative">
                                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
                                        {count > 0 && (
                                            <span
                                                className={`
                                                absolute -top-1 -right-1 sm:-top-2 sm:-right-2 
                                                h-4 w-4 sm:h-5 sm:w-5 text-xs font-bold rounded-full
                                                flex items-center justify-center
                                                ${
                                                    isSelected
                                                        ? 'bg-white text-gray-800'
                                                        : `bg-${config.color}-600 text-white`
                                                }
                                            `}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm sm:text-base lg:text-lg">
                                            {type}
                                        </div>
                                        <div
                                            className={`text-xs sm:text-sm hidden sm:block ${
                                                isSelected
                                                    ? 'text-white opacity-90'
                                                    : 'text-gray-500'
                                            }`}
                                        >
                                            {config.description}
                                        </div>
                                    </div>
                                </div>

                                {/* Selection indicator */}
                                {isSelected && (
                                    <div className="absolute inset-0 border-2 border-white rounded-lg opacity-30"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
