/**
 * Lightweight proxy API for bulk document export.
 * Forwards requests to the Django backend for enhanced Excel export.
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, format = 'xlsx', export_all = true } = body;

        console.log('[EXPORT] Request body:', body);

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid or missing document type' },
                { status: 400 },
            );
        }

        // Use enhanced Excel export endpoint for XLSX format
        if (format === 'xlsx') {
            const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/documents/export-excel/`;
            console.log('[EXPORT] Using enhanced Excel export:', backendUrl);

            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    export_all,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[EXPORT] Backend error:', errorText);
                return NextResponse.json(
                    { error: 'Failed to export documents' },
                    { status: response.status },
                );
            }

            const contentType = response.headers.get('content-type');
            const contentDisposition = response.headers.get(
                'content-disposition',
            );

            // Return the Excel file
            const blob = await response.blob();
            const headers = new Headers();

            if (contentType) {
                headers.set('Content-Type', contentType);
            } else {
                headers.set(
                    'Content-Type',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                );
            }

            if (contentDisposition) {
                headers.set('Content-Disposition', contentDisposition);
            } else {
                headers.set(
                    'Content-Disposition',
                    `attachment; filename="${type.toLowerCase()}_export.xlsx"`,
                );
            }

            return new NextResponse(blob, { headers });
        } else {
            // Use DocumentExportView for CSV/JSON formats
            const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/export-documents/`;
            console.log('[EXPORT] Forwarding to backend:', backendUrl);

            // Build query parameters for the GET request
            const params = new URLSearchParams();
            params.append('type', type);
            params.append('format', format);

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
            const contentDisposition = response.headers.get(
                'content-disposition',
            );

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
        }
    } catch (error) {
        console.error('[EXPORT] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
