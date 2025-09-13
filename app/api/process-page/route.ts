import { getDocuments, saveDocument } from '@/lib/documentUtils';
import dbConnect from '@/lib/mongodb';
import { createFileFromBuffer } from '@/lib/pdfUtils';
import { NextRequest, NextResponse } from 'next/server';
// Use undici Agent to tune fetch behavior (timeouts/keep-alive)
// Using `any` typing to avoid a hard type dependency on undici in TS build
let undiciAgent: any | undefined;

// Allow this API route to run for up to 5 minutes
export const maxDuration = 300;

const ONETECH_API_URL =
    process.env.NEXT_PUBLIC_EXTRACT_API ||
    'http://onetech-backend-gdl7h722ruzvs.francecentral.azurecontainer.io:8000/extract/';

// Lazily create a single undici Agent instance to avoid per-request overhead
function getUndiciAgent(): any | undefined {
    if (undiciAgent) return undiciAgent;
    try {
        // Dynamically import to avoid hard dependency issues during build
        // Next.js (Node runtime) ships with undici; this should succeed.

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Agent } = require('undici');
        undiciAgent = new Agent({
            // Give plenty of time for slow backend to send headers/body.
            // We'll rely on our AbortController for overall time limits.
            headersTimeout: 0,
            bodyTimeout: 0,
            // Keep connections short-lived to reduce sticky keep-alive issues
            keepAliveTimeout: 1000,
            keepAliveMaxTimeout: 2000,
            // Reasonable connect timeout
            connectTimeout: 15000,
        });
        return undiciAgent;
    } catch {
        // If undici import fails for any reason, just return undefined.
        // fetch will use its default dispatcher; our code will still work.
        return undefined;
    }
}

// Helper function to check if document already exists
async function checkExistingDocument(
    filename: string,
    documentType: string,
    pageNumber: number,
) {
    try {
        const documents = await getDocuments(documentType as any);
        return documents.find(
            doc =>
                doc.metadata?.original_filename === filename &&
                doc.metadata?.page_number === pageNumber,
        );
    } catch (error) {
        console.error('Error checking existing document:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    console.log('=== PROCESS PAGE API CALLED ===');

    try {
        const body = await request.json();
        const {
            pageBuffer,
            fileName,
            mimeType,
            documentType,
            originalFileName,
            pageNumber,
            imageDataUrl, // New field for when image comes from backend split
        } = body;

        if (!documentType) {
            return NextResponse.json(
                { error: 'Missing document type' },
                { status: 400 },
            );
        }

        // Handle different input formats
        let buffer: Buffer;
        let actualFileName: string;
        let actualMimeType: string;

        if (imageDataUrl) {
            // Image came from backend PDF split (base64 data URL)
            const base64Data = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
            buffer = Buffer.from(base64Data, 'base64');
            actualFileName = fileName || `page-${pageNumber}.jpg`;
            actualMimeType = mimeType || 'image/jpeg';
            console.log(`Processing backend-split page ${pageNumber} from imageDataUrl`);
        } else if (pageBuffer) {
            // Traditional base64 buffer
            buffer = Buffer.from(pageBuffer, 'base64');
            actualFileName = fileName;
            actualMimeType = mimeType;
            console.log(`Processing traditional page ${pageNumber} from pageBuffer`);
        } else {
            return NextResponse.json(
                { error: 'Missing page image data (pageBuffer or imageDataUrl required)' },
                { status: 400 },
            );
        }

        // Create File object for external API
        const pageFile = createFileFromBuffer(buffer, actualFileName, actualMimeType);

        console.log(`Processing page ${pageNumber} of ${originalFileName}`);

        // Call external API for data extraction
        const result = await processPageWithExternalAPI(
            pageFile,
            documentType,
            originalFileName,
            pageNumber,
        );

        if (result.success && result.document) {
            return NextResponse.json({
                success: true,
                pageNumber,
                extractedData: result.document,
                message: `Page ${pageNumber} processed successfully`,
            });
        } else {
            return NextResponse.json({
                success: false,
                pageNumber,
                error: result.error || 'Failed to process page',
            });
        }
    } catch (error) {
        console.error('Error processing page:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

async function processPageWithExternalAPI(
    pageFile: File,
    documentType: string,
    originalFileName: string,
    pageNumber: number,
): Promise<{ success: boolean; document?: any; error?: string }> {
    // Single attempt processing - faster and more responsive
    // No retries or timeouts, rely on backend response status
    try {
        // Connect to database
        await dbConnect();

        // Create FormData for the external API
        const apiFormData = new FormData();
        apiFormData.append('document_type', documentType.toLowerCase());
        apiFormData.append('file', pageFile, pageFile.name);

        console.log(`Calling external API for page ${pageNumber}:`, {
            url: ONETECH_API_URL,
            method: 'POST',
            documentType: documentType,
            fileName: pageFile.name,
        });

        let response: Response | null = null;

        console.log(`Page ${pageNumber} - Making single API call`);

        // Single attempt with a 5-minute timeout (matches route maxDuration)
        try {
            const fetchOptions: RequestInit & { dispatcher?: any } = {
                method: 'POST',
                body: apiFormData,
                signal: AbortSignal.timeout(300000),
            };

            // Use undici dispatcher if available
            const agent = getUndiciAgent();
            if (agent) {
                fetchOptions.dispatcher = agent;
            }

            response = await fetch(ONETECH_API_URL, fetchOptions);
        } catch (fetchError: any) {
            console.error(`Page ${pageNumber} - API call failed:`, fetchError);
            let errorMessage = 'Failed to connect to external API';
            if (fetchError?.name === 'AbortError') {
                errorMessage = 'Request timeout (5 minutes)';
            } else if (
                fetchError?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
                fetchError?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT'
            ) {
                errorMessage =
                    'Headers timeout - external API may be overloaded';
            }
            return {
                success: false,
                error: `${errorMessage}: ${fetchError?.message || String(fetchError)}`,
            };
        }

        const responseText = await response.text();
        console.log(
            `Page ${pageNumber} - Raw response length:`,
            responseText.length,
        );

        // Try to parse JSON
        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log(
                `Page ${pageNumber} - Parsed response:`,
                JSON.stringify(responseData, null, 2),
            );
        } catch (parseError) {
            console.error(
                `Page ${pageNumber} - JSON parse error:`,
                parseError,
                'Raw response:',
                responseText.substring(0, 500),
            );
            if (!response.ok) {
                return {
                    success: false,
                    error: `External API error: ${response.status} ${response.statusText}`,
                };
            }
            return {
                success: false,
                error: 'Invalid JSON response from external API',
            };
        }

        // Check if we have valid data
        if (
            responseData &&
            (responseData.data || responseData.status === 'success')
        ) {
            console.log(
                `Page ${pageNumber} - Valid data received from external API`,
            );
        } else if (!response.ok) {
            console.error(
                `Page ${pageNumber} - API returned error:`,
                response.status,
                responseData,
            );
            return {
                success: false,
                error: `External API error: ${response.status} ${response.statusText}`,
            };
        }

        // Process the response data
        try {
            const extractedData = responseData.data || responseData;

            // Check if document already exists for this page to prevent duplicates
            const existingDocument = await checkExistingDocument(
                originalFileName,
                documentType,
                pageNumber,
            );
            if (existingDocument) {
                console.log(
                    `Page ${pageNumber} - Document already exists, returning existing document`,
                );
                return {
                    success: true,
                    document: existingDocument,
                };
            }

            // Prepare document for database
            const documentId = `${Date.now()}-${pageNumber}-${Math.random().toString(36).substring(2, 15)}`;
            const documentData = {
                id: documentId,
                data: extractedData,
                metadata: {
                    filename: originalFileName,
                    document_type: documentType,
                    processed_at: new Date().toISOString(),
                    file_size: pageFile.size,
                    page_number: pageNumber,
                    original_filename: originalFileName,
                },
                remark:
                    responseData.remark || 'Document processed successfully',
                retry_used: 'no-retry', // Single attempt approach
                json_url: `/api/documents/${documentId}/export?format=json`,
                excel_url: `/api/documents/${documentId}/export?format=excel`,
                created_at: new Date(),
                updated_at: new Date(),
                updated_by_user: false,
            };

            console.log(`Page ${pageNumber} - Saving document to database...`);

            // Save to database
            const savedDocument = await saveDocument(
                documentData,
                documentType as any,
            );

            // Format the document for frontend
            const formattedDocument = {
                id: savedDocument.id || savedDocument._id,
                data: savedDocument.data,
                metadata: savedDocument.metadata,
                remark: savedDocument.remark,
                created_at: savedDocument.created_at,
                updated_at: savedDocument.updated_at,
                updated_by_user: savedDocument.updated_by_user,
            };

            console.log(
                `Page ${pageNumber} - Document saved to database:`,
                savedDocument._id,
            );

            return {
                success: true,
                document: formattedDocument,
            };
        } catch (saveError) {
            console.error(
                `Page ${pageNumber} - Error saving to database:`,
                saveError,
            );
            return {
                success: false,
                error: `Failed to save document: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
            };
        }
    } catch (error) {
        console.error(`Page ${pageNumber} - Processing error:`, error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown processing error',
        };
    }
}
