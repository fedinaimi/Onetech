import { NextRequest, NextResponse } from 'next/server';

// Backend batch status endpoint
const BACKEND_STATUS_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/batch/status/';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const resolvedParams = await params;
    console.log(`=== BATCH STATUS API CALLED === Session: ${resolvedParams.sessionId}`);
    
    try {
        const sessionId = resolvedParams.sessionId;
        
        if (!sessionId) {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }
        
        console.log(`Fetching status for session: ${sessionId}`);
        
        // Call backend status endpoint
        const response = await fetch(`${BACKEND_STATUS_URL}${sessionId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        console.log(`Backend status response: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`[ERROR] Backend status error: ${errorText}`);
            
            if (response.status === 404) {
                return NextResponse.json(
                    { error: 'Session not found' },
                    { status: 404 }
                );
            }
            
            return NextResponse.json(
                { error: `Backend error: ${errorText}` },
                { status: response.status }
            );
        }
        
        const status = await response.json();
        console.log(`Session ${sessionId} status:`, {
            status: status.status,
            progress: `${status.completed_pages}/${status.total_pages}`,
            processing_page: status.processing_page,
            progress_percentage: status.progress_percentage
        });
        
        return NextResponse.json(status);
        
    } catch (error) {
        console.error('[ERROR] Status fetch failed:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}