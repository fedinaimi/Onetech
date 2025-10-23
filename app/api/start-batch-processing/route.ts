import { NextRequest, NextResponse } from 'next/server';

// Backend batch processing endpoint
const BACKEND_BATCH_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/batch/start/';

export async function POST(request: NextRequest) {
    console.log("=== BATCH PROCESSING API CALLED ===");
    
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const documentType = formData.get('documentType') as string;
        
        if (!file) {
            console.log("[ERROR] No file provided");
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }
        
        if (!documentType) {
            console.log("[ERROR] No document type provided");
            return NextResponse.json(
                { success: false, error: 'Document type is required' },
                { status: 400 }
            );
        }
        
        console.log(`Processing file: ${file.name}, type: ${documentType}, size: ${file.size}`);
        
        // Create form data for backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        backendFormData.append('document_type', documentType);
        
        console.log("Calling backend batch processing endpoint...");
        
        // Call backend batch processing
        const response = await fetch(BACKEND_BATCH_URL, {
            method: 'POST',
            body: backendFormData,
        });
        
        console.log(`Backend response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`[ERROR] Backend error: ${errorText}`);
            return NextResponse.json(
                { success: false, error: `Backend error: ${errorText}` },
                { status: response.status }
            );
        }
        
        const result = await response.json();
        console.log("Backend batch processing started:", result);
        
        return NextResponse.json({
            success: true,
            sessionId: result.session_id,
            message: result.message,
            status: result.status
        });
        
    } catch (error) {
        console.error('[ERROR] Batch processing failed:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}