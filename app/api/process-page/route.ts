/**
 * Lightweight proxy for page processing.
 * All processing happens in the backend.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
    console.log('=== PROCESS PAGE API CALLED ===');

    try {
        const body = await request.json();

        // Forward request to backend processing endpoint
        const response = await fetch(
            `${BACKEND_URL}/processing/process-page/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ error: 'Backend processing failed' }));
            return NextResponse.json(error, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json(result);
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
