import Image from 'next/image';

export default function HeaderBar() {
    return (
        <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 shadow-lg border-b-2 border-blue-900/20 sticky top-0 z-40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
                <div className="flex justify-between items-center py-3 sm:py-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className="bg-white/90 p-1.5 rounded-xl shadow-md border-2 border-white/50 flex-shrink-0 hover:bg-white transition-all duration-200">
                            <Image
                                src="/logo-onetech.jpg"
                                alt="OneTech Logo"
                                width={100}
                                height={32}
                                className="h-5 sm:h-6 md:h-8 w-auto"
                            />
                        </div>
                        <div className="hidden sm:block h-6 w-px bg-white/30 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-sm sm:text-base md:text-xl lg:text-2xl font-bold text-white drop-shadow-md truncate">
                                Document Extractor
                            </h1>
                            <p className="hidden sm:block text-xs text-blue-100/80 font-medium">
                                AI-Powered Document Processing
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
