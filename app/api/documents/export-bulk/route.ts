'use server';

import { KosuModel, NPTModel, RebutModel } from '@/models/Document';
import * as ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

const MONGODB_URI = process.env.MONGODB_URI || '';

async function connectToDatabase() {
    if (mongoose.connections[0].readyState) {
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI);
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

// Get the appropriate model based on document type
function getModel(type: string) {
    switch (type) {
        case 'Rebut':
            return RebutModel;
        case 'NPT':
            return NPTModel;
        case 'Kosu':
            return KosuModel;
        default:
            throw new Error(`Unknown document type: ${type}`);
    }
}

// Helper function to flatten document data for Excel export
function flattenDocumentData(documents: any[], type: string) {
    const flattenedData: any[] = [];

    documents.forEach((doc, docIndex) => {
        const baseData: any = {
            document_index: docIndex + 1,
            filename: doc.metadata.filename,
            document_type: doc.metadata.document_type,
            processed_at: new Date(
                doc.metadata.processed_at,
            ).toLocaleDateString(),
            file_size_kb: Math.round(doc.metadata.file_size / 1024),
            remark: doc.remark || '',
            created_at: doc.created_at
                ? new Date(doc.created_at).toLocaleDateString()
                : '',
            updated_at: doc.updated_at
                ? new Date(doc.updated_at).toLocaleDateString()
                : '',
            modified: doc.updated_by_user ? 'Yes' : 'No',
        };

        // Add header information
        if (doc.data.header) {
            Object.keys(doc.data.header).forEach(key => {
                baseData[`header_${key}`] = doc.data.header[key];
            });
        }

        if (type === 'Rebut' && doc.data.items) {
            // For Rebut documents, create one row per item
            doc.data.items.forEach((item: any, itemIndex: number) => {
                flattenedData.push({
                    ...baseData,
                    item_index: itemIndex + 1,
                    reference: item.reference || '',
                    designation: item.designation || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || '',
                    type: item.type || '',
                    total_scrapped: item.total_scrapped || 0,
                });
            });
        } else if (type === 'NPT' && doc.data.downtime_events) {
            // For NPT documents, create one row per downtime event
            doc.data.downtime_events.forEach(
                (event: any, eventIndex: number) => {
                    flattenedData.push({
                        ...baseData,
                        event_index: eventIndex + 1,
                        start_time: event.start_time || '',
                        end_time: event.end_time || '',
                        duration: event.duration || 0,
                        reason: event.reason || '',
                        description: event.description || '',
                    });
                },
            );
        } else if (type === 'Kosu' && doc.data.team_summary) {
            // For Kosu documents, create one row with team summary data
            flattenedData.push({
                ...baseData,
                heures_deposees: doc.data.team_summary.heures_deposees || 0,
                objectif_qte_eq: doc.data.team_summary.objectif_qte_eq || 0,
                qte_realisee: doc.data.team_summary.qte_realisee || 0,
            });
        } else {
            // Fallback: just add base document data
            flattenedData.push(baseData);
        }
    });

    return flattenedData;
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();

        const body = await request.json();
        const { type, dateFrom, dateTo, searchQuery } = body;

        console.log('Export request:', { type, dateFrom, dateTo, searchQuery });

        if (!type || !['Rebut', 'NPT', 'Kosu'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid document type' },
                { status: 400 },
            );
        }

        const Model = getModel(type);

        // Build query based on filters
        const query: any = {};

        // Date filter - handle both Date objects and string dates
        if (dateFrom || dateTo) {
            query['metadata.processed_at'] = {};
            if (dateFrom) {
                // Try both string comparison and date parsing
                const fromDate = new Date(dateFrom);
                query.$or = [
                    { 'metadata.processed_at': { $gte: fromDate } },
                    { 'metadata.processed_at': { $gte: dateFrom } },
                    {
                        'metadata.processed_at': {
                            $gte: fromDate.toISOString(),
                        },
                    },
                ];
            }
            if (dateTo) {
                const toDate = new Date(dateTo + 'T23:59:59.999Z');
                if (!query.$or) query.$or = [];
                query.$or = query.$or.concat([
                    { 'metadata.processed_at': { $lte: toDate } },
                    { 'metadata.processed_at': { $lte: dateTo } },
                    { 'metadata.processed_at': { $lte: toDate.toISOString() } },
                ]);
            }
        }

        // Search filter (basic implementation)
        if (searchQuery) {
            const searchOr = [
                { 'metadata.filename': { $regex: searchQuery, $options: 'i' } },
                {
                    'metadata.document_type': {
                        $regex: searchQuery,
                        $options: 'i',
                    },
                },
                { remark: { $regex: searchQuery, $options: 'i' } },
            ];

            if (query.$or) {
                // Combine with date filters using $and
                query.$and = [{ $or: query.$or }, { $or: searchOr }];
                delete query.$or;
            } else {
                query.$or = searchOr;
            }
        }

        console.log('MongoDB query:', JSON.stringify(query, null, 2));

        // First, let's try to get all documents without filters to debug
        const allDocuments = await Model.find({}).sort({
            'metadata.processed_at': -1,
        });
        console.log(
            `Total documents in ${type} collection: ${allDocuments.length}`,
        );

        if (allDocuments.length > 0) {
            console.log('Sample document structure:', {
                id: allDocuments[0]._id,
                filename: allDocuments[0].metadata?.filename,
                processed_at: allDocuments[0].metadata?.processed_at,
                document_type: allDocuments[0].metadata?.document_type,
            });
        }

        // If no filters are applied, return all documents
        let documents;
        if (!dateFrom && !dateTo && !searchQuery) {
            documents = allDocuments;
        } else {
            // Apply client-side filtering as fallback since server-side might have issues
            documents = allDocuments.filter((doc: any) => {
                // Search filter
                let searchMatch = true;
                if (searchQuery) {
                    const search = searchQuery.toLowerCase();
                    searchMatch =
                        (doc.metadata.filename &&
                            doc.metadata.filename
                                .toLowerCase()
                                .includes(search)) ||
                        (doc.metadata.document_type &&
                            doc.metadata.document_type
                                .toLowerCase()
                                .includes(search)) ||
                        (doc.remark &&
                            doc.remark.toLowerCase().includes(search));
                }

                // Date filter
                let dateMatch = true;
                if (dateFrom || dateTo) {
                    const docDateStr = doc.metadata.processed_at;
                    if (docDateStr) {
                        const docDate = new Date(docDateStr);
                        if (dateFrom) {
                            const fromDate = new Date(dateFrom);
                            if (docDate < fromDate) dateMatch = false;
                        }
                        if (dateTo) {
                            const toDate = new Date(dateTo + 'T23:59:59.999Z');
                            if (docDate > toDate) dateMatch = false;
                        }
                    }
                }

                return searchMatch && dateMatch;
            });
        }

        console.log(`Filtered documents: ${documents.length}`);

        if (documents.length === 0) {
            return NextResponse.json(
                { error: 'No documents found matching the criteria' },
                { status: 404 },
            );
        }

        // Flatten data for Excel
        const flattenedData = flattenDocumentData(documents, type);

        // Create Excel workbook using ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${type}_Documents`);

        if (flattenedData.length > 0) {
            // Get column headers
            const headers = Object.keys(flattenedData[0]);

            // Add header row
            worksheet.addRow(headers);

            // Style the header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' },
            };

            // Add data rows
            flattenedData.forEach(row => {
                const values = headers.map(header => row[header]);
                worksheet.addRow(values);
            });

            // Auto-size columns
            headers.forEach((header, index) => {
                const columnIndex = index + 1;
                const maxLength = Math.max(
                    header.length,
                    ...flattenedData.map(
                        row => String(row[header] || '').length,
                    ),
                );
                worksheet.getColumn(columnIndex).width = Math.min(
                    maxLength + 2,
                    50,
                );
            });
        }

        // Generate Excel buffer
        const excelBuffer = await workbook.xlsx.writeBuffer();
        const buffer = Buffer.from(excelBuffer);

        // Create filename with date range
        let filename = `${type}_Documents`;
        if (dateFrom && dateTo) {
            filename += `_${dateFrom}_to_${dateTo}`;
        } else if (dateFrom) {
            filename += `_from_${dateFrom}`;
        } else if (dateTo) {
            filename += `_until_${dateTo}`;
        }
        filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Bulk export error:', error);
        return NextResponse.json(
            { error: 'Failed to export documents' },
            { status: 500 },
        );
    }
}
