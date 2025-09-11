'use server';

import { splitFileIntoPages } from '@/lib/pdfUtils';
import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for native modules
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    console.log('=== PDF SPLIT API CALLED ===');

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 },
            );
        }

        console.log('Processing file:', {
            name: file.name,
            size: file.size,
            type: file.type,
        });

        // Split file into pages
        const pages = await splitFileIntoPages(file);
        console.log(`File split into ${pages.length} pages`);

        // Convert page buffers to base64 for frontend display
        const pageData = pages.map(page => ({
            pageNumber: page.pageNumber,
            fileName: page.fileName,
            mimeType: page.mimeType,
            // Convert buffer to base64 for display in frontend
            imageDataUrl: `data:${page.mimeType};base64,${page.buffer.toString('base64')}`,
            // Store original buffer data temporarily (we'll need this for processing)
            bufferSize: page.buffer.length,
            // Add processing status tracking
            status: 'pending' as const,
            extractedData: null,
            error: null,
        }));

        return NextResponse.json({
            success: true,
            originalFileName: file.name,
            totalPages: pages.length,
            pages: pageData,
        });
    } catch (error) {
        console.error('Error splitting PDF:', error);

        let errorMessage = 'Failed to split PDF';
        if (error instanceof Error) {
            if (error.message.includes('Unsupported file type')) {
                errorMessage =
                    'Unsupported file type. Please upload a PDF, image, or supported document.';
            } else if (error.message.includes('PDF conversion')) {
                errorMessage = 'Failed to convert PDF pages to images.';
            }
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details:
                    error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
