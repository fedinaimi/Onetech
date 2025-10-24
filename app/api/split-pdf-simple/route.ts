import { splitFileIntoPages } from '@/lib/pdfUtils';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 },
            );
        }

        console.log(`📄 Splitting ${file.name} into pages...`);

        // Split into pages
        const pageFiles = await splitFileIntoPages(file);

        // Convert to JSON-serializable format
        const pages = pageFiles.map(pageFile => ({
            pageNumber: pageFile.pageNumber,
            fileName: pageFile.fileName,
            mimeType: pageFile.mimeType,
            imageBase64: pageFile.buffer.toString('base64'),
            bufferSize: pageFile.buffer.length,
        }));

        console.log(`✅ Split into ${pages.length} pages`);

        return NextResponse.json({
            success: true,
            pages,
            totalPages: pages.length,
        });
    } catch (error) {
        console.error('❌ Error splitting PDF:', error);
        return NextResponse.json(
            {
                error: 'Failed to split PDF',
                message:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
