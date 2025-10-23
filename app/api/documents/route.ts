/**
 * Lightweight proxy API for document operations.
 * All database operations are handled by the Django backend.
 * This route simply forwards requests to the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');
        const exportFormat = searchParams.get('export');

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        // Build backend URL
        let backendUrl = `${BACKEND_API_URL}/documents/`;

        if (exportFormat) {
            // Export endpoint
            backendUrl = `${BACKEND_API_URL}/documents/export/?type=${type}&format=${exportFormat}`;
        } else if (id) {
            // Get single document
            backendUrl = `${BACKEND_API_URL}/documents/${id}/?type=${type}`;
        } else {
            // List all documents
            backendUrl = `${BACKEND_API_URL}/documents/?type=${type}`;
        }

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ error: 'Backend request failed' }));
            return NextResponse.json(error, { status: response.status });
        }

        // Handle different content types for exports
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/csv')) {
            const csv = await response.text();
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition':
                        response.headers.get('content-disposition') ||
                        `attachment; filename="${type.toLowerCase()}_export.csv"`,
                },
            });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error proxying GET /api/documents:', error);
        return NextResponse.json(
            { error: 'Failed to communicate with backend' },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const type = data.metadata?.document_type;

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        const backendUrl = `${BACKEND_API_URL}/documents/`;
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ error: 'Backend request failed' }));
            return NextResponse.json(error, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error('Error proxying POST /api/documents:', error);
        return NextResponse.json(
            { error: 'Failed to communicate with backend' },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, type } = body;

        if (!id || !type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid parameters' },
                { status: 400 },
            );
        }

        const backendUrl = `${BACKEND_API_URL}/documents/${id}/`;
        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ error: 'Backend request failed' }));
            return NextResponse.json(error, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error proxying PUT /api/documents:', error);
        return NextResponse.json(
            { error: 'Failed to communicate with backend' },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type');

        if (!id || !type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid parameters' },
                { status: 400 },
            );
        }

        const backendUrl = `${BACKEND_API_URL}/documents/${id}/?type=${type}`;
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response
                .json()
                .catch(() => ({ error: 'Backend request failed' }));
            return NextResponse.json(error, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error proxying DELETE /api/documents:', error);
        return NextResponse.json(
            { error: 'Failed to communicate with backend' },
            { status: 500 },
        );
    }
}
