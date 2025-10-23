'use server';

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

// Type definitions for export data
type CommonExportData = {
    id: any;
    filename: any;
    document_type: any;
    processed_at: any;
    remark: any;
    created_at: any;
    updated_at: any;
};

type RebutExportData = CommonExportData & {
    headers: any;
    items: any[];
};

type NPTExportData = CommonExportData & {
    headers: any;
    downtime_events: any[];
};

type KosuExportData = CommonExportData & {
    headers: any;
    team_summary: any[];
};

type ExportData =
    | CommonExportData
    | RebutExportData
    | NPTExportData
    | KosuExportData;

// Helper function to convert JSON to CSV
function jsonToCsv(data: Record<string, unknown>[], headers: string[]): string {
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

// Helper function to convert document data to export format
function prepareDocumentData(doc: unknown): ExportData {
    const document = doc as any; // Type assertion for dynamic document structure

    const commonData: CommonExportData = {
        id: document._id,
        filename: document.metadata.filename,
        document_type: document.metadata.document_type,
        processed_at: document.metadata.processed_at,
        remark: document.remark,
        created_at: document.created_at,
        updated_at: document.updated_at,
    };

    if (document.metadata.document_type === 'Rebut' && document.data.items) {
        return {
            ...commonData,
            headers: document.data.header || {},
            items: document.data.items.map((item: any, index: number) => ({
                index: index + 1,
                reference: item.reference || '',
                designation: item.designation || '',
                quantity: item.quantity || 0,
                unit: item.unit || '',
                type: item.type || '',
                total_scrapped: item.total_scrapped || 0,
            })),
        } as RebutExportData;
    } else if (
        document.metadata.document_type === 'NPT' &&
        document.data.downtime_events
    ) {
        return {
            ...commonData,
            headers: document.data.header || {},
            downtime_events: document.data.downtime_events.map(
                (event: any, index: number) => ({
                    index: index + 1,
                    start_time: event.start_time || '',
                    end_time: event.end_time || '',
                    duration: event.duration || 0,
                    reason: event.reason || '',
                    description: event.description || '',
                }),
            ),
        } as NPTExportData;
    } else if (
        document.metadata.document_type === 'Kosu' &&
        document.data.team_summary
    ) {
        return {
            ...commonData,
            headers: document.data.header || {},
            team_summary: [
                {
                    index: 1,
                    heures_deposees:
                        document.data.team_summary.heures_deposees || 0,
                    objectif_qte_eq:
                        document.data.team_summary.objectif_qte_eq || 0,
                    qte_realisee: document.data.team_summary.qte_realisee || 0,
                },
            ],
        } as KosuExportData;
    }

    return commonData;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';
        const resolvedParams = await params;
        const documentId = resolvedParams.id;

        // Try to find the document by searching in backend
        let document = null;
        let documentType = '';

        // Try each document type
        const types = ['Rebut', 'NPT', 'Kosu'];
        for (const type of types) {
            try {
                const response = await fetch(
                    `${BACKEND_URL}/documents/${documentId}/?type=${type}`
                );
                if (response.ok) {
                    document = await response.json();
                    documentType = type;
                    break;
                }
            } catch {
                // Continue trying other types
            }
        }

        if (!document) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 },
            );
        }

        const exportData = prepareDocumentData(document);

        if (format === 'csv') {
            let csvContent = '';

            // Add headers section
            if ('headers' in exportData && exportData.headers) {
                csvContent += 'DOCUMENT HEADERS\n';
                const headerEntries = Object.entries(exportData.headers);
                for (const [key, value] of headerEntries) {
                    csvContent += `"${key}","${value}"\n`;
                }
                csvContent += '\n';
            }

            // Add main data section
            if (
                documentType === 'Rebut' &&
                'items' in exportData &&
                exportData.items
            ) {
                csvContent += 'ITEMS DATA\n';
                const headers = [
                    'index',
                    'reference',
                    'designation',
                    'quantity',
                    'unit',
                    'type',
                    'total_scrapped',
                ];
                csvContent += jsonToCsv(exportData.items, headers);
            } else if (
                documentType === 'NPT' &&
                'downtime_events' in exportData &&
                exportData.downtime_events
            ) {
                csvContent += 'DOWNTIME EVENTS\n';
                const headers = [
                    'index',
                    'start_time',
                    'end_time',
                    'duration',
                    'reason',
                    'description',
                ];
                csvContent += jsonToCsv(exportData.downtime_events, headers);
            } else if (
                documentType === 'Kosu' &&
                'team_summary' in exportData &&
                exportData.team_summary
            ) {
                csvContent += 'TEAM SUMMARY\n';
                const headers = [
                    'index',
                    'heures_deposees',
                    'objectif_qte_eq',
                    'qte_realisee',
                ];
                csvContent += jsonToCsv(exportData.team_summary, headers);
            }

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${document.metadata.filename}_${documentType.toLowerCase()}.csv"`,
                },
            });
        } else if (format === 'xlsx') {
            // For XLSX, we'll return JSON for now and let the frontend handle XLSX conversion
            // You can integrate a library like xlsx or exceljs here for proper XLSX generation
            return NextResponse.json(exportData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${document.metadata.filename}_${documentType.toLowerCase()}.json"`,
                },
            });
        } else {
            // JSON format
            return NextResponse.json(exportData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${document.metadata.filename}_${documentType.toLowerCase()}.json"`,
                },
            });
        }
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Failed to export document' },
            { status: 500 },
        );
    }
}
