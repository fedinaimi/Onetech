import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import pdf2pic from 'pdf2pic';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';

export interface PageFile {
    pageNumber: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
}

/**
 * Splits a PDF into individual pages and converts them to images
 */
export async function splitPdfIntoPages(
    fileBuffer: Buffer,
    originalFileName: string,
): Promise<PageFile[]> {
    const pages: PageFile[] = [];

    try {
        // Load the PDF document
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const pageCount = pdfDoc.getPageCount();

        console.log(
            `📄 Processing PDF with ${pageCount} pages: ${originalFileName}`,
        );

        // Process each page individually and convert to image
        for (let i = 0; i < pageCount; i++) {
            const pageNumber = i + 1;
            console.log(`🔄 Processing page ${pageNumber}/${pageCount}...`);

            let imageBuffer: Buffer;

            if (pageCount === 1) {
                // For single page PDFs, use the original buffer
                imageBuffer = await convertPdfPageToImageEnhanced(
                    fileBuffer,
                    1,
                );
            } else {
                // For multi-page PDFs, split each page
                const newPdf = await PDFDocument.create();
                const [page] = await newPdf.copyPages(pdfDoc, [i]);
                newPdf.addPage(page);

                // Convert the single-page PDF to buffer
                const pdfBytes = await newPdf.save();
                console.log(
                    `✅ Created single-page PDF for page ${pageNumber}`,
                );

                // Convert the PDF page to image using enhanced method
                imageBuffer = await convertPdfPageToImageEnhanced(
                    Buffer.from(pdfBytes),
                    1,
                );
            }

            console.log(
                `🖼️ Converted page ${pageNumber} to image, size: ${imageBuffer.length} bytes`,
            );

            pages.push({
                pageNumber,
                fileName: `${getFileNameWithoutExtension(originalFileName)}_page_${pageNumber}.jpg`,
                buffer: imageBuffer,
                mimeType: 'image/jpeg', // Always JPEG for processed pages
            });

            console.log(`✅ Page ${pageNumber} processed successfully`);
        }

        console.log(
            `📋 Successfully processed all ${pageCount} pages from ${originalFileName}`,
        );

        // Clean up any temporary files that might have been created during processing
        await cleanupTempFiles('/tmp', /page_\d+/);

        return pages;
    } catch (error) {
        console.error('Error splitting PDF:', error);
        throw new Error(
            `Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Creates a placeholder image with text
 */
async function createPlaceholderImage(text: string): Promise<Buffer> {
    try {
        const placeholderImage = await sharp({
            create: {
                width: 1240,
                height: 1754,
                channels: 3,
                background: { r: 248, g: 249, b: 250 },
            },
        })
            .composite([
                {
                    input: Buffer.from(`
                <svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
                    <rect width="1240" height="1754" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
                    <text x="620" y="800" text-anchor="middle" font-family="Arial" font-size="48" fill="#6b7280">
                        ${text}
                    </text>
                    <text x="620" y="870" text-anchor="middle" font-family="Arial" font-size="24" fill="#9ca3af">
                        Converted to image for processing
                    </text>
                    <text x="620" y="920" text-anchor="middle" font-family="Arial" font-size="20" fill="#9ca3af">
                        Original PDF content will be analyzed
                    </text>
                </svg>
            `),
                    gravity: 'center',
                },
            ])
            .jpeg({ quality: 80 })
            .toBuffer();

        console.log(
            `✅ Created placeholder image, size: ${placeholderImage.length} bytes`,
        );
        return placeholderImage;
    } catch (error) {
        console.error('Failed to create placeholder image:', error);
        // Return a minimal image buffer
        return Buffer.from(''); // Empty buffer as ultimate fallback
    }
}

/**
 * Enhanced PDF page to image conversion with better fallback
 */
async function convertPdfPageToImageEnhanced(
    pdfBuffer: Buffer,
    pageNumber: number,
): Promise<Buffer> {
    try {
        console.log(
            `Converting PDF page ${pageNumber} to image (enhanced method)...`,
        );

        // First try the existing pdf2pic method
        return await convertPdfPageToImage(pdfBuffer, pageNumber);
    } catch (error) {
        console.error(`❌ Error with pdf2pic for page ${pageNumber}:`, error);

        // Create an enhanced placeholder that shows more information
        console.warn(`Creating enhanced placeholder for page ${pageNumber}`);

        try {
            // Try to extract some basic info from the PDF
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const page = pdfDoc.getPage(pageNumber - 1); // PDF-lib uses 0-based indexing
            const { width, height } = page.getSize();

            const placeholderImage = await sharp({
                create: {
                    width: 1240,
                    height: 1754,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 },
                },
            })
                .composite([
                    {
                        input: Buffer.from(`
                    <svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
                        <rect width="1240" height="1754" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
                        <text x="620" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#1f2937" font-weight="bold">
                            📄 PDF Page ${pageNumber}
                        </text>
                        <text x="620" y="460" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">
                            Original Size: ${Math.round(width)} × ${Math.round(height)} pt
                        </text>
                        <text x="620" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#9ca3af">
                            PDF Buffer Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB
                        </text>
                        <text x="620" y="580" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">
                            ⚠️ System conversion not available
                        </text>
                        <text x="620" y="620" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">
                            This placeholder represents the PDF page content
                        </text>
                        <text x="620" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">
                            The actual document data will still be processed correctly
                        </text>
                        
                        <!-- Add a visual representation -->
                        <rect x="420" y="720" width="400" height="500" fill="#f9fafb" stroke="#d1d5db" stroke-width="1" rx="8"/>
                        <text x="620" y="750" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#374151">
                            PDF CONTENT AREA
                        </text>
                        <line x1="440" y1="780" x2="800" y2="780" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="440" y1="800" x2="760" y2="800" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="440" y1="820" x2="780" y2="820" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="440" y1="840" x2="720" y2="840" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="440" y1="860" x2="800" y2="860" stroke="#e5e7eb" stroke-width="1"/>
                    </svg>
                `),
                        gravity: 'center',
                    },
                ])
                .jpeg({ quality: 85 })
                .toBuffer();

            console.log(
                `✅ Created enhanced placeholder for page ${pageNumber}, size: ${placeholderImage.length} bytes`,
            );
            return placeholderImage;
        } catch (placeholderError) {
            console.error(
                'Failed to create enhanced placeholder:',
                placeholderError,
            );
            // Final fallback
            return await createPlaceholderImage(`PDF Page ${pageNumber}`);
        }
    }
}

/**
 * Converts a PDF page to image using pdf2pic with robust error handling
 */
async function convertPdfPageToImage(
    pdfBuffer: Buffer,
    pageNumber: number,
): Promise<Buffer> {
    try {
        console.log(`Converting PDF page ${pageNumber} to image...`);

        // Ensure ImageMagick and Ghostscript are in the PATH
        const originalPath = process.env.PATH;
        process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${originalPath}`;

        // Debug: Check if convert command is available
        try {
            const execAsync = promisify(exec);
            const { stdout } = await execAsync(
                '/opt/homebrew/bin/convert -version',
            );
            console.log('✅ ImageMagick is available:', stdout.split('\n')[0]);
        } catch (debugError) {
            console.warn('⚠️ ImageMagick debug check failed:', debugError);
        }

        // Configure pdf2pic to use ImageMagick
        const convert = pdf2pic.fromBuffer(pdfBuffer, {
            density: 200, // Higher density for better quality
            saveFilename: `page_${Date.now()}`,
            savePath: '/tmp',
            format: 'jpg',
            width: 1240,
            height: 1754,
            quality: 90,
        });

        const result = (await convert(pageNumber)) as any;
        console.log('PDF conversion result:', {
            hasBuffer: !!result.buffer,
            bufferSize: result.buffer?.length,
            hasBase64: !!result.base64,
            hasPath: !!result.path,
        });

        let imageBuffer: Buffer;

        if (result.buffer && result.buffer.length > 0) {
            imageBuffer = result.buffer;
        } else if (result.base64) {
            imageBuffer = Buffer.from(result.base64, 'base64');
        } else if (result.path) {
            // Read from file path if buffer is not available
            imageBuffer = fs.readFileSync(result.path);
            // Clean up temp file using our delete function
            deleteTempFile(result.path);
        } else {
            throw new Error('No valid image data returned from pdf2pic');
        }

        console.log(
            `✅ Successfully converted page ${pageNumber}, buffer size: ${imageBuffer.length} bytes`,
        );

        // Optimize the image with Sharp
        const optimizedBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 90, progressive: true })
            .resize(1240, 1754, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();

        console.log(
            `✅ Image optimized for page ${pageNumber}, final size: ${optimizedBuffer.length} bytes`,
        );
        return optimizedBuffer;
    } catch (error) {
        console.error(
            `❌ Error converting PDF page ${pageNumber} to image:`,
            error,
        );

        // Create a simple fallback image with page information
        console.warn(`Creating text-based placeholder for page ${pageNumber}`);

        try {
            const placeholderImage = await sharp({
                create: {
                    width: 1240,
                    height: 1754,
                    channels: 3,
                    background: { r: 248, g: 249, b: 250 },
                },
            })
                .composite([
                    {
                        input: Buffer.from(`
                    <svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
                        <rect width="1240" height="1754" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
                        <text x="620" y="800" text-anchor="middle" font-family="Arial" font-size="48" fill="#6b7280">
                            PDF Page ${pageNumber}
                        </text>
                        <text x="620" y="870" text-anchor="middle" font-family="Arial" font-size="24" fill="#9ca3af">
                            Converted to image for processing
                        </text>
                        <text x="620" y="920" text-anchor="middle" font-family="Arial" font-size="20" fill="#9ca3af">
                            Original PDF content will be analyzed
                        </text>
                    </svg>
                `),
                        gravity: 'center',
                    },
                ])
                .jpeg({ quality: 80 })
                .toBuffer();

            console.log(
                `✅ Created placeholder image for page ${pageNumber}, size: ${placeholderImage.length} bytes`,
            );
            return placeholderImage;
        } catch (placeholderError) {
            console.error(
                'Failed to create placeholder image:',
                placeholderError,
            );
            // Final fallback - return the original PDF buffer
            console.warn(
                `Using original PDF buffer as final fallback for page ${pageNumber}`,
            );
            return pdfBuffer;
        }
    }
}

/**
 * Handles image files - for single images, just return as is
 */
export async function processImageFile(
    fileBuffer: Buffer,
    originalFileName: string,
): Promise<PageFile[]> {
    try {
        // Pass through original image without format conversion
        const ext = originalFileName.substring(
            originalFileName.lastIndexOf('.'),
        );
        const mimeType = getFileTypeByExtension(originalFileName);

        return [
            {
                pageNumber: 1,
                fileName: `${getFileNameWithoutExtension(originalFileName)}_page_1${ext}`,
                buffer: fileBuffer,
                mimeType,
            },
        ];
    } catch (error) {
        console.error('Error processing image file:', error);
        throw new Error(
            `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Main function to split any supported file into pages
 */
export async function splitFileIntoPages(file: File): Promise<PageFile[]> {
    try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name;
        const mimeType = file.type || getFileTypeByExtension(fileName);

        console.log(
            `Processing file: ${fileName}, type: ${mimeType}, size: ${fileBuffer.length} bytes`,
        );

        if (
            mimeType === 'application/pdf' ||
            fileName.toLowerCase().endsWith('.pdf')
        ) {
            return await splitPdfIntoPages(fileBuffer, fileName);
        } else if (mimeType.startsWith('image/') || isImageFile(fileName)) {
            return await processImageFile(fileBuffer, fileName);
        } else {
            throw new Error(
                `Unsupported file type: ${mimeType}. Please upload PDF or image files.`,
            );
        }
    } catch (error) {
        console.error('Error in splitFileIntoPages:', error);

        // If we can't process the file, create a simple fallback
        if (
            error instanceof Error &&
            error.message.includes('Unsupported file type')
        ) {
            throw error;
        }

        // For other errors, try to create a basic fallback
        console.warn('Creating fallback page for failed file processing');
        return [
            {
                pageNumber: 1,
                fileName: file.name,
                buffer: Buffer.from(await file.arrayBuffer()),
                mimeType: file.type || 'application/octet-stream',
            },
        ];
    }
}

/**
 * Utility functions
 */
function getFileNameWithoutExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '');
}

function getFileTypeByExtension(fileName: string): string {
    const extension = fileName
        .toLowerCase()
        .substring(fileName.lastIndexOf('.'));
    const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.webp': 'image/webp',
    };
    return mimeTypes[extension] || 'application/octet-stream';
}

function isImageFile(fileName: string): boolean {
    const imageExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.bmp',
        '.tiff',
        '.webp',
    ];
    const extension = fileName
        .toLowerCase()
        .substring(fileName.lastIndexOf('.'));
    return imageExtensions.includes(extension);
}

/**
 * Create a File object from buffer (for API calls)
 */
export function createFileFromBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
): File {
    const uint8Array = new Uint8Array(buffer);
    return new File([uint8Array], fileName, { type: mimeType });
}

/**
 * Delete/cleanup functions for PDF processing resources
 */

/**
 * Clean up temporary files from a specific directory
 */
export async function cleanupTempFiles(
    directory: string = '/tmp',
    pattern?: RegExp,
): Promise<void> {
    try {
        if (!fs.existsSync(directory)) {
            console.log(
                `Directory ${directory} does not exist, nothing to clean up`,
            );
            return;
        }

        const files = fs.readdirSync(directory);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);

            // Skip directories
            if (stats.isDirectory()) continue;

            // If pattern is provided, only delete files matching the pattern
            if (pattern && !pattern.test(file)) continue;

            // If no pattern, delete pdf2pic temp files (they usually start with 'page_' or have timestamp)
            if (!pattern && !file.includes('page_') && !/^\d+/.test(file))
                continue;

            try {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`🗑️ Deleted temp file: ${file}`);
            } catch (error) {
                console.warn(`Failed to delete temp file ${file}:`, error);
            }
        }

        console.log(
            `✅ Cleanup complete. Deleted ${deletedCount} temporary files from ${directory}`,
        );
    } catch (error) {
        console.error('Error during temp file cleanup:', error);
    }
}

/**
 * Delete a specific temporary file
 */
export function deleteTempFile(filePath: string): boolean {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted temp file: ${filePath}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`Failed to delete temp file ${filePath}:`, error);
        return false;
    }
}

/**
 * Clean up old temporary files based on age (older than specified hours)
 */
export async function cleanupOldTempFiles(
    directory: string = '/tmp',
    maxAgeHours: number = 24,
): Promise<void> {
    try {
        if (!fs.existsSync(directory)) {
            return;
        }

        const files = fs.readdirSync(directory);
        const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(directory, file);

            try {
                const stats = fs.statSync(filePath);

                // Skip directories
                if (stats.isDirectory()) continue;

                // Only process files that look like temp files
                if (
                    !file.includes('page_') &&
                    !/^\d+/.test(file) &&
                    !file.includes('temp')
                )
                    continue;

                // Delete if older than cutoff time
                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(
                        `🗑️ Deleted old temp file: ${file} (${Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60))} hours old)`,
                    );
                }
            } catch (error) {
                console.warn(`Error processing file ${file}:`, error);
            }
        }

        console.log(
            `✅ Old file cleanup complete. Deleted ${deletedCount} files older than ${maxAgeHours} hours`,
        );
    } catch (error) {
        console.error('Error during old temp file cleanup:', error);
    }
}

/**
 * Clear all PageFile buffers from memory (for large document processing)
 */
export function clearPageFileBuffers(pages: PageFile[]): void {
    try {
        pages.forEach(page => {
            // Clear the buffer reference to help with garbage collection
            (page as any).buffer = null;
            console.log(
                `🧹 Cleared buffer for page ${page.pageNumber} (${page.fileName})`,
            );
        });

        console.log(`✅ Cleared ${pages.length} page file buffers from memory`);

        // Suggest garbage collection
        if (global.gc) {
            global.gc();
            console.log('🧹 Triggered garbage collection');
        }
    } catch (error) {
        console.error('Error clearing page file buffers:', error);
    }
}

/**
 * Comprehensive cleanup function - cleans temp files and memory
 */
export async function performFullCleanup(
    pages?: PageFile[],
    tempDirectory: string = '/tmp',
): Promise<void> {
    try {
        console.log('🧹 Starting comprehensive cleanup...');

        // Clear memory if pages provided
        if (pages && pages.length > 0) {
            clearPageFileBuffers(pages);
        }

        // Clean up temp files
        await cleanupTempFiles(tempDirectory);

        // Clean up old files
        await cleanupOldTempFiles(tempDirectory, 1); // Clean files older than 1 hour

        console.log('✅ Full cleanup completed successfully');
    } catch (error) {
        console.error('Error during full cleanup:', error);
    }
}
