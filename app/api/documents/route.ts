'use server';

import type { DocumentType } from '@/lib/documentUtils';
import {
    deleteDocument,
    exportToCSV,
    getDocumentById,
    getDocuments,
    saveDocument,
    updateDocumentField,
} from '@/lib/documentUtils';
import dbConnect from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as DocumentType;
        const id = searchParams.get('id');
        const export_format = searchParams.get('export');

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        if (id) {
            const document = await getDocumentById(id, type);
            if (!document) {
                return NextResponse.json(
                    { error: 'Document not found' },
                    { status: 404 },
                );
            }
            return NextResponse.json(document);
        }

        const documents = await getDocuments(type);

        if (export_format === 'csv') {
            const csv = exportToCSV(documents, type);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${type.toLowerCase()}_export.csv"`,
                },
            });
        }

        if (export_format === 'json') {
            return new NextResponse(JSON.stringify(documents, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${type.toLowerCase()}_export.json"`,
                },
            });
        }

        return NextResponse.json(documents);
    } catch (error) {
        console.error('Error in GET /api/documents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const data = await request.json();
        const type = data.metadata?.document_type as DocumentType;

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        const document = await saveDocument(data, type);
        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/documents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        await dbConnect();

        const { id, type, field, oldValue, newValue } = await request.json();

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        const document = await updateDocumentField(
            id,
            type,
            field,
            oldValue,
            newValue,
        );

        if (!document) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 },
            );
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error('Error in PUT /api/documents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type') as DocumentType;

        if (!id || !type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid parameters' },
                { status: 400 },
            );
        }

        const result = await deleteDocument(id, type);

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 },
            );
        }

        return NextResponse.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /api/documents:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
