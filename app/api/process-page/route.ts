/**
 * Lightweight proxy for page processing.
 * All processing happens in the backend.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
    console.log('=== PROCESS PAGE API CALLED ===');
    
    try {
        const body = await request.json();
        console.log('[DEBUG] Frontend received request body:', body);
        console.log('[DEBUG] Request body keys:', Object.keys(body));
        
        // Extract the image from imageDataUrl and prepare FormData for backend
        const { imageUrl, documentType, fileName, pageNumber, originalFilename } = body;
        
        if (!imageUrl) {
            throw new Error('Missing imageUrl in request');
        }
        
        // Make sure imageUrl is absolute
        const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `${BACKEND_URL}${imageUrl}`;
        
        // Fetch the image from the backend URL
        console.log(`[DEBUG] Fetching image from: ${absoluteImageUrl}`);
        const imageResponse = await fetch(absoluteImageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }
        
        const imageBlob = await imageResponse.blob();
        
        // Create FormData for backend extraction endpoint
        const formData = new FormData();
        formData.append('document_type', documentType.toLowerCase());
        formData.append('file', imageBlob, fileName || `page_${pageNumber}.jpg`);
        
        console.log(`[DEBUG] Forwarding to backend extraction endpoint: ${BACKEND_URL}/extract/`);
        
        // Forward request to backend extraction endpoint
        const response = await fetch(`${BACKEND_URL}/extract/`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Backend extraction failed' }));
            console.error('[ERROR] Backend extraction failed:', error);
            return NextResponse.json({
                success: false,
                error: error.message || error.error || 'Backend extraction failed'
            }, { status: response.status });
        }

        const result = await response.json();
        console.log('[DEBUG] Backend extraction result:', result);
        
        // Transform backend response to frontend expected format
        if (result.status === 'success') {
            return NextResponse.json({
                success: true,
                extractedData: result.data,
                imageUrl: result.imageUrl,
                remark: result.remark
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.message || 'Extraction failed'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Process page proxy error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
