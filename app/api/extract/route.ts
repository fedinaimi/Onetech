import type { DocumentType } from '@/lib/documentUtils';
import { saveDocument } from '@/lib/documentUtils';
import dbConnect from '@/lib/mongodb';
import {
    createFileFromBuffer,
    performFullCleanup,
    splitFileIntoPages,
} from '@/lib/pdfUtils';
import { NextRequest, NextResponse } from 'next/server';

// Allow this API route to run longer to accommodate slow backend
export const maxDuration = 600;

const ONETECH_API_URL =
    process.env.NEXT_PUBLIC_EXTRACT_API ||
    'http://onetech-backend-gdl7h722ruzvs.francecentral.azurecontainer.io:8000/extract/';

// Undici agent for better timeout handling (dynamic import, no require)
let undiciAgent: any = null;
async function getUndiciAgent(): Promise<any | undefined> {
    if (undiciAgent) return undiciAgent;
    try {
        const undici = await import('undici');
        const Agent = (undici as any).Agent;
        undiciAgent = new Agent({
            headersTimeout: 0,
            bodyTimeout: 0,
            keepAliveTimeout: 1000,
            keepAliveMaxTimeout: 2000,
            connectTimeout: 15000,
        });
        return undiciAgent;
    } catch (error) {
        console.warn('Failed to create undici agent:', error);
        return undefined;
    }
}

interface ProcessResult {
    success: boolean;
    document?: any;
    error?: string;
}

async function processPageWithExternalAPI(
    pageFile: File,
    documentType: string,
    originalFileName: string,
    pageNumber: number,
): Promise<ProcessResult> {
    try {
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

        console.log(`Page ${pageNumber} - Making single API call`);

        const pageFetchOptions: RequestInit & { dispatcher?: any } = {
            method: 'POST',
            body: apiFormData,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Onetech-Document-Extractor/1.0',
            },
            signal: AbortSignal.timeout(300000), // 5 minutes per page
            keepalive: false,
        };
        const pageAgent = await getUndiciAgent();
        if (pageAgent) pageFetchOptions.dispatcher = pageAgent;

        const response = await fetch(ONETECH_API_URL, pageFetchOptions);

        console.log(`Page ${pageNumber} - Response:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
        });

        const responseText = await response.text();
        console.log(
            `Page ${pageNumber} - Raw response length:`,
            responseText.length,
        );

        // Try to parse JSON
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (parseError) {
            console.error(
                `Page ${pageNumber} - Failed to parse JSON:`,
                parseError,
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
            console.log(`Page ${pageNumber} - Valid extraction data found`);
        } else if (!response.ok) {
            return {
                success: false,
                error: `External API error: ${response.status} ${response.statusText}`,
            };
        }

        // Process the response data
        const extractedData = responseData.data || responseData;
        const extractionRemark =
            responseData.remark ||
            `${documentType} extraction complete - Page ${pageNumber}`;

        // Create document ID with page number
        const baseFileName = originalFileName.replace(/\.[^/.]+$/, '');
        const documentId = `${baseFileName}_page_${pageNumber}_${Date.now()}`;

        const formattedDocument = {
            id: documentId,
            json_url: `/api/documents/${documentId}/export?format=json`,
            excel_url: `/api/documents/${documentId}/export?format=excel`,
            data: extractedData,
            remark: extractionRemark,
            retry_used: 'no',
            metadata: {
                filename: pageFile.name,
                document_type: documentType,
                processed_at: new Date().toISOString(),
                file_size: pageFile.size,
                original_filename: originalFileName,
                page_number: pageNumber,
                is_multi_page: true,
            },
        };

        console.log(`Page ${pageNumber} - Formatted document ready for saving`);

        // Save to database
        try {
            await dbConnect();
            const savedDocument = await saveDocument(
                formattedDocument,
                documentType as DocumentType,
            );
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

async function processImageDirectly(
    file: File,
    documentType: string,
): Promise<ProcessResult> {
    try {
        console.log(`Processing image directly: ${file.name}`);

        // Create FormData for the external API
        const apiFormData = new FormData();
        apiFormData.append('document_type', documentType.toLowerCase());
        apiFormData.append('file', file, file.name);

        console.log(`Calling external API for image:`, {
            url: ONETECH_API_URL,
            method: 'POST',
            documentType: documentType,
            fileName: file.name,
        });

        // Use the same timeout and undici configuration as process-page
        const fetchOptions: RequestInit & { dispatcher?: any } = {
            method: 'POST',
            body: apiFormData,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Onetech-Document-Extractor/1.0',
            },
            // No AbortSignal here: allow long-running image processing beyond 5 minutes
        };

        // Use undici dispatcher if available
        const agent = await getUndiciAgent();
        if (agent) {
            fetchOptions.dispatcher = agent;
        }

        const response = await fetch(ONETECH_API_URL, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`External API error:`, {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText,
            });
            return {
                success: false,
                error: `API error: ${response.status} ${response.statusText}`,
            };
        }

        const responseText = await response.text();
        console.log('Raw response length:', responseText.length);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse API response as JSON:', parseError);
            return {
                success: false,
                error: 'Invalid JSON response from external API',
            };
        }

        // Connect to database
        await dbConnect();

        // Format the document in the same way as processPageWithExternalAPI
        const documentId = `${file.name}_${Date.now()}`;
        const formattedDocument = {
            id: documentId,
            json_url: `/api/documents/${documentId}/export?format=json`,
            excel_url: `/api/documents/${documentId}/export?format=excel`,
            data: responseData,
            remark: 'no-remark',
            retry_used: 'no',
            metadata: {
                filename: file.name,
                document_type: documentType,
                processed_at: new Date().toISOString(),
                file_size: file.size,
                original_filename: file.name,
                page_number: 1,
                total_pages: 1,
            },
        };

        // Save the document
        try {
            const savedDocument = await saveDocument(
                formattedDocument,
                documentType as DocumentType,
            );

            console.log(
                `✅ Image processed and saved successfully: ${savedDocument._id}`,
            );

            return {
                success: true,
                document: formattedDocument,
            };
        } catch (saveError) {
            console.error('Failed to save document:', saveError);
            return {
                success: false,
                error: `Failed to save document: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
            };
        }
    } catch (error) {
        console.error('Image processing error:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown processing error',
        };
    }
}

export async function POST(request: NextRequest) {
    console.log('=== EXTRACT API CALLED ===');

    try {
        const requestFormData = await request.formData();
        const file = requestFormData.get('file') as File;
        const documentType = requestFormData.get('documentType') as string;

        console.log('Received request:', {
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
            documentType: documentType,
            formDataKeys: Array.from(requestFormData.keys()),
        });

        if (!file) {
            console.log('❌ No file uploaded');
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 },
            );
        }

        if (!documentType) {
            console.log('❌ No document type provided');
            return NextResponse.json(
                { error: 'Document type is required' },
                { status: 400 },
            );
        }

        console.log('✅ File details:', {
            originalSize: file.size,
            fileName: file.name,
            fileType: file.type,
            documentType: documentType,
        });

        // Check if it's an image file - if so, process directly without splitting
        const isImage =
            file.type.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(file.name);

        if (isImage) {
            console.log('📷 Image file detected - processing directly...');
            const result = await processImageDirectly(file, documentType);

            if (result.success) {
                console.log('✅ Image processed successfully');
                return NextResponse.json({
                    success: true,
                    message: 'Image processed successfully',
                    extractedData: result.document,
                });
            } else {
                console.log('❌ Failed to process image:', result.error);
                return NextResponse.json(
                    { error: result.error || 'Failed to process image' },
                    { status: 500 },
                );
            }
        }

        // Test basic file processing for PDF files
        console.log('🔄 Testing file buffer conversion...');
        const testBuffer = Buffer.from(await file.arrayBuffer());
        console.log(`✅ File buffer created: ${testBuffer.length} bytes`);

        // Split file into individual pages (for PDF files)
        console.log('🔄 Splitting file into pages...');
        const pages = await splitFileIntoPages(file);
        console.log(`✅ File split into ${pages.length} pages`);

        const processedResults = [];
        const errors = [];

        // Process each page individually
        for (const page of pages) {
            try {
                console.log(
                    `🔄 Processing ${page.fileName} (page ${page.pageNumber})...`,
                );

                // Create a File object for this page
                const pageFile = createFileFromBuffer(
                    page.buffer,
                    page.fileName,
                    page.mimeType,
                );
                console.log(
                    `✅ Created page file: ${pageFile.name}, size: ${pageFile.size}`,
                );

                // Process this page through the external API
                const result = await processPageWithExternalAPI(
                    pageFile,
                    documentType,
                    file.name,
                    page.pageNumber,
                );

                if (result.success && result.document) {
                    processedResults.push(result.document);
                    console.log(
                        `✅ Successfully processed page ${page.pageNumber}`,
                    );
                } else {
                    errors.push({
                        pageNumber: page.pageNumber,
                        fileName: page.fileName,
                        error: result.error || 'Unknown error',
                    });
                    console.error(
                        `❌ Failed to process page ${page.pageNumber}:`,
                        result.error,
                    );
                }
            } catch (pageError) {
                console.error(
                    `Error processing page ${page.pageNumber}:`,
                    pageError,
                );
                errors.push({
                    pageNumber: page.pageNumber,
                    fileName: page.fileName,
                    error:
                        pageError instanceof Error
                            ? pageError.message
                            : 'Unknown error',
                });
            }
        }

        // Return results
        const response = {
            totalPages: pages.length,
            processedSuccessfully: processedResults.length,
            errors: errors.length,
            results: processedResults,
            failedPages: errors,
            originalFileName: file.name,
            message: `Processed ${processedResults.length} out of ${pages.length} pages successfully`,
        };

        if (processedResults.length === 0) {
            return NextResponse.json(
                {
                    error: 'Failed to process any pages',
                    details: response,
                },
                { status: 500 },
            );
        }

        console.log(
            `Processing complete: ${processedResults.length}/${pages.length} pages successful`,
        );

        // Clean up memory and temporary files after processing
        try {
            console.log('🧹 Starting post-processing cleanup...');
            await performFullCleanup(pages);
        } catch (cleanupError) {
            console.warn(
                'Warning: Cleanup failed but processing was successful:',
                cleanupError,
            );
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('❌ Error in extract API:', error);

        // Enhanced error handling with more specific messages
        let errorMessage = 'Internal server error';
        let statusCode = 500;
        let errorDetails = '';

        if (error instanceof Error) {
            errorDetails = error.message;

            if (error.message.includes('Unsupported file type')) {
                errorMessage = error.message;
                statusCode = 400;
            } else if (error.message.includes('Failed to split PDF')) {
                errorMessage =
                    'Unable to process PDF file. Please ensure the file is not corrupted.';
                statusCode = 400;
            } else if (error.message.includes('PDF conversion not available')) {
                errorMessage =
                    'PDF processing service temporarily unavailable. Please try again later.';
                statusCode = 503;
            } else if (
                error.message.includes('fetch failed') ||
                error.message.includes('ECONNRESET') ||
                error.message.includes('ECONNREFUSED')
            ) {
                errorMessage =
                    'Failed to connect to document processing service';
                statusCode = 503;
            } else if (error.message.includes('timeout')) {
                errorMessage =
                    'Document processing timed out - file may be too large';
                statusCode = 408;
            } else if (error.message.includes('No file uploaded')) {
                errorMessage = 'No file was provided';
                statusCode = 400;
            }
        }

        const errorResponse = {
            error: errorMessage,
            details: errorDetails,
            timestamp: new Date().toISOString(),
            // Add some debug info for development
            debug:
                process.env.NODE_ENV === 'development'
                    ? {
                          stack:
                              error instanceof Error ? error.stack : undefined,
                          originalError: error,
                      }
                    : undefined,
        };

        console.error('Returning error response:', errorResponse);

        // Attempt cleanup even on error
        try {
            console.log('🧹 Performing cleanup after error...');
            await performFullCleanup();
        } catch (cleanupError) {
            console.warn('Cleanup after error failed:', cleanupError);
        }

        return NextResponse.json(errorResponse, { status: statusCode });
    }
}
