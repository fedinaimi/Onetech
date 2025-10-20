'use server';

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_EXTRACT_API?.replace('/extract/', '') ||
    'http://127.0.0.1:8000';

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

        // Check file size and warn for large files
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 25) {
            console.warn(`⚠️ Large file detected: ${fileSizeMB.toFixed(2)}MB - expect longer processing time`);
        }

        console.log('Backend URL:', BACKEND_URL);

        // Create FormData to send to backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);

        console.log('Calling backend split-pdf endpoint...');

        // Call the backend PDF split endpoint with extended timeout for large files
        const timeoutMs = fileSizeMB > 25 ? 180000 : 120000; // 3min for large files, 2min for normal
        
        const backendResponse = await fetch(`${BACKEND_URL}/split-pdf/`, {
            method: 'POST',
            body: backendFormData,
            signal: AbortSignal.timeout(timeoutMs),
        });

        console.log('Backend response status:', backendResponse.status);

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            console.error('Backend error response:', errorText);

            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || 'Unknown backend error' };
            }

            return NextResponse.json(
                { error: errorData.error || 'Failed to process PDF' },
                { status: backendResponse.status },
            );
        }

        const result = await backendResponse.json();
        console.log(`PDF split successfully: ${result.totalPages} pages`);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error splitting PDF:', error);

        let errorMessage = 'Failed to split PDF';
        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                errorMessage = 'Failed to connect to backend service';
            } else if (error.message.includes('PDF')) {
                errorMessage = 'Failed to process PDF file';
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
