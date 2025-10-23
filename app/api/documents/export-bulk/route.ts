/**
 * Lightweight proxy API for bulk document export.
 * Forwards requests to the Django backend.
 */

import { NextResponse } from 'next/server';

const BACKEND_API_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, format = 'csv', dateFrom, dateTo, searchQuery } = body;

        console.log('[EXPORT] Request body:', body);

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid or missing document type' },
                { status: 400 },
            );
        }

        // Use DocumentExportView which accepts type and format parameters
        const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/export-documents/`;
        console.log('[EXPORT] Forwarding to backend:', backendUrl);

        // Build query parameters for the GET request
        const params = new URLSearchParams();
        params.append('type', type);
        params.append('format', format);

        // Note: The current DocumentExportView doesn't support date filtering
        // but we can add that functionality later if needed

        const fullUrl = `${backendUrl}?${params.toString()}`;
        console.log('[EXPORT] Full URL:', fullUrl);

        const response = await fetch(fullUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[EXPORT] Backend error:', errorText);
            return NextResponse.json(
                { error: 'Failed to export documents' },
                { status: response.status },
            );
        }

        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            // Handle file download
            const blob = await response.blob();
            const headers = new Headers();

            if (contentType) {
                headers.set('Content-Type', contentType);
            }

            if (contentDisposition) {
                headers.set('Content-Disposition', contentDisposition);
            }

            return new NextResponse(blob, { headers });
        }
    } catch (error) {
        console.error('[EXPORT] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
