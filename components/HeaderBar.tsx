import Image from 'next/image';

export default function HeaderBar() {
    return (
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
                <div className="flex justify-between items-center py-3 sm:py-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100 flex-shrink-0">
                            <Image
                                src="/logo-onetech.jpg"
                                alt="OneTech Logo"
                                width={100}
                                height={32}
                                className="h-5 sm:h-6 md:h-8 w-auto"
                            />
                        </div>
                        <div className="hidden sm:block h-5 md:h-6 w-px bg-gray-300 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-sm sm:text-base md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent truncate">
                                Document Extractor
                            </h1>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
