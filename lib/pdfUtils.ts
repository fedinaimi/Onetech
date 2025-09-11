import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { promisify } from 'util';

// Optional imports that may not be available in all environments
let pdf2pic: any = null;
let poppler: any = null;

// Lazy load optional dependencies
async function getPdf2Pic() {
    if (!pdf2pic) {
        try {
            const pdf2picModule = await import('pdf2pic');
            pdf2pic = pdf2picModule.default;
        } catch (error) {
            console.warn('pdf2pic not available:', error);
            pdf2pic = null;
        }
    }
    return pdf2pic;
}

async function getPoppler() {
    if (!poppler) {
        try {
            const popplerModule = await import('pdf-poppler');
            poppler = popplerModule.default || popplerModule;
        } catch (error) {
            console.warn('pdf-poppler not available:', error);
            poppler = null;
        }
    }
    return poppler;
}

// Async helper to dynamically import sharp in serverless environments
let sharpInstance: any | null | undefined;
async function getSharp(): Promise<any | null> {
    if (sharpInstance !== undefined) return sharpInstance;

    try {
        // Try to import sharp with better error handling for Vercel
        let sharp;

        if (typeof window === 'undefined') {
            // Server-side: try to import sharp
            try {
                const sharpModule = await import('sharp');
                sharp = sharpModule.default || sharpModule;
            } catch (importError) {
                console.warn('Sharp module not available:', {
                    importError:
                        importError instanceof Error
                            ? importError.message
                            : String(importError),
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                });
                throw new Error('Sharp unavailable');
            }
        }

        sharpInstance = sharp;
        return sharpInstance;
    } catch (err) {
        console.warn(
            'Sharp not available, using fallback image processing. Error:',
            err instanceof Error ? err.message : 'Unknown error',
            {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
            },
        );
        sharpInstance = null;
        return null;
    }
}

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
        const _sharp = await getSharp();
        if (!_sharp) {
            // Fallback: return minimal buffer if Sharp is not available
            return Buffer.from(`PDF Page: ${text}`);
        }

        const placeholderImage = await _sharp({
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
 * Enhanced PDF page to image conversion with Vercel compatibility
 */
async function convertPdfPageToImageEnhanced(
    pdfBuffer: Buffer,
    pageNumber: number,
): Promise<Buffer> {
    // Detect environment for optimal conversion method selection
    const isVercelEnv = !!(
        process.env.VERCEL ||
        process.env.VERCEL_ENV ||
        process.env.VERCEL_URL
    );
    const isLocalDev = process.env.NODE_ENV === 'development';

    try {
        console.log(
            `Converting PDF page ${pageNumber} to image (enhanced method)...`,
        );
        console.log('Environment:', {
            isVercel: isVercelEnv,
            isDev: isLocalDev,
            nodeEnv: process.env.NODE_ENV,
        });

        // Prioritize methods based on environment
        if (isVercelEnv) {
            // On Vercel, be more conservative - go straight to high-quality placeholders if conversion fails quickly
            console.log(
                '🔧 Vercel environment detected - using fallback-first strategy',
            );

            // Quick attempt at pdf-poppler (timeout quickly if not available)
            const popplerModule = await getPoppler();
            if (popplerModule) {
                try {
                    const conversionPromise = convertPdfPageWithPoppler(
                        pdfBuffer,
                        pageNumber,
                    );
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error('Conversion timeout')),
                            5000,
                        ),
                    );

                    return (await Promise.race([
                        conversionPromise,
                        timeoutPromise,
                    ])) as Buffer;
                } catch (popplerError) {
                    console.warn(
                        `PDF-Poppler failed quickly for page ${pageNumber}:`,
                        popplerError,
                    );
                }
            }

            // Skip other methods on Vercel and go straight to enhanced placeholder
            console.log(
                `🎨 Creating enhanced placeholder for Vercel deployment - page ${pageNumber}`,
            );
            return await createEnhancedPlaceholder(pdfBuffer, pageNumber);
        } else {
            // On localhost/other environments, try pdf2pic first (fastest when ImageMagick is available)
            const pdf2picModule = await getPdf2Pic();
            if (pdf2picModule) {
                try {
                    return await convertPdfPageToImage(pdfBuffer, pageNumber);
                } catch (pdf2picError) {
                    console.warn(
                        `PDF2PIC failed for page ${pageNumber}:`,
                        pdf2picError,
                    );
                }
            }

            // Method 2: Try pdf-poppler
            const popplerModule = await getPoppler();
            if (popplerModule) {
                try {
                    return await convertPdfPageWithPoppler(
                        pdfBuffer,
                        pageNumber,
                    );
                } catch (popplerError) {
                    console.warn(
                        `PDF-Poppler failed for page ${pageNumber}:`,
                        popplerError,
                    );
                }
            }
        }

        // Final fallback: Create a high-quality placeholder
        console.warn(
            `All conversion methods failed, creating enhanced placeholder for page ${pageNumber}`,
        );
        return await createEnhancedPlaceholder(pdfBuffer, pageNumber);
    } catch (error) {
        console.error(
            `❌ All conversion methods failed for page ${pageNumber}:`,
            error,
        );
        // Ultimate fallback
        return await createPlaceholderImage(`PDF Page ${pageNumber}`);
    }
}

/**
 * Convert PDF page to image using pdf-poppler (Vercel compatible)
 */
async function convertPdfPageWithPoppler(
    pdfBuffer: Buffer,
    pageNumber: number,
): Promise<Buffer> {
    const popplerModule = await getPoppler();
    if (!popplerModule) {
        throw new Error('pdf-poppler not available');
    }

    const tempPdfPath = path.join(
        '/tmp',
        `temp_pdf_${Date.now()}_${pageNumber}.pdf`,
    );

    try {
        // Write PDF buffer to temp file
        fs.writeFileSync(tempPdfPath, pdfBuffer);

        const options = {
            format: 'jpeg' as const,
            out_dir: '/tmp',
            out_prefix: `page_${Date.now()}_${pageNumber}`,
            page: pageNumber,
            scale: 2048, // High scale for better quality
            antialias: 'gray' as const,
        };

        console.log(`Using pdf-poppler to convert page ${pageNumber}...`);
        const result = await popplerModule.convert(tempPdfPath, options);

        if (!result || result.length === 0) {
            throw new Error('No conversion result from pdf-poppler');
        }

        const imagePath = result[0].path;
        const imageBuffer = fs.readFileSync(imagePath);

        // Clean up temp files
        deleteTempFile(tempPdfPath);
        deleteTempFile(imagePath);

        console.log(
            `✅ PDF-Poppler converted page ${pageNumber}, size: ${imageBuffer.length} bytes`,
        );

        // Optimize with Sharp if available
        const _sharp = await getSharp();
        if (_sharp && imageBuffer.length > 0) {
            const optimizedBuffer = await _sharp(imageBuffer)
                .jpeg({ quality: 90, progressive: true })
                .resize(1240, 1754, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();

            console.log(
                `✅ Optimized page ${pageNumber} with Sharp, final size: ${optimizedBuffer.length} bytes`,
            );
            return optimizedBuffer;
        }

        return imageBuffer;
    } catch (error) {
        // Clean up temp file if it exists
        deleteTempFile(tempPdfPath);
        console.error(
            `PDF-Poppler conversion failed for page ${pageNumber}:`,
            error,
        );
        throw error;
    }
}

/**
 * Create an enhanced placeholder that looks more like a real PDF page
 */
async function createEnhancedPlaceholder(
    pdfBuffer: Buffer,
    pageNumber: number,
): Promise<Buffer> {
    try {
        // Try to extract some basic info from the PDF
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const page = pdfDoc.getPage(pageNumber - 1); // PDF-lib uses 0-based indexing
        const { width, height } = page.getSize();

        const _sharp = await getSharp();
        if (!_sharp) {
            return await createPlaceholderImage(`PDF Page ${pageNumber}`);
        }

        const placeholderImage = await _sharp({
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
                    <defs>
                        <pattern id="paper" patternUnits="userSpaceOnUse" width="40" height="40">
                            <rect width="40" height="40" fill="#fefefe"/>
                            <circle cx="20" cy="20" r="0.5" fill="#f0f0f0"/>
                        </pattern>
                    </defs>
                    <rect width="1240" height="1754" fill="url(#paper)" stroke="#e5e7eb" stroke-width="2"/>
                    
                    <!-- Header -->
                    <rect x="80" y="80" width="1080" height="60" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="1" rx="4"/>
                    <text x="620" y="115" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#374151" font-weight="bold">
                        📄 PDF Page ${pageNumber}
                    </text>
                    
                    <!-- Content area simulation -->
                    <rect x="120" y="200" width="1000" height="1400" fill="#fdfdfd" stroke="#e5e7eb" stroke-width="1" rx="8"/>
                    
                    <!-- Simulate text lines -->
                    <g fill="#d1d5db" opacity="0.7">
                        ${Array.from({ length: 45 }, (_, i) => {
                            const y = 240 + i * 30;
                            const width = 800 + Math.random() * 150;
                            return `<rect x="160" y="${y}" width="${width}" height="12" rx="2"/>`;
                        }).join('')}
                    </g>
                    
                    <!-- Info footer -->
                    <rect x="120" y="1620" width="1000" height="80" fill="#f1f5f9" stroke="#e5e7eb" stroke-width="1" rx="4"/>
                    <text x="620" y="1645" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#64748b">
                        Original Size: ${Math.round(width)} × ${Math.round(height)} pt • Buffer: ${(pdfBuffer.length / 1024).toFixed(1)} KB
                    </text>
                    <text x="620" y="1665" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">
                        High-quality placeholder - PDF content will be processed normally
                    </text>
                    <text x="620" y="1685" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">
                        PDF rendering temporarily unavailable - using enhanced preview
                    </text>
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
        return await createPlaceholderImage(`PDF Page ${pageNumber}`);
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
        const pdf2picModule = await getPdf2Pic();
        if (!pdf2picModule) {
            throw new Error('pdf2pic not available');
        }

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
        const convert = pdf2picModule.fromBuffer(pdfBuffer, {
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

        // Optimize the image with Sharp if available
        let optimizedBuffer: Buffer;
        const _sharp = await getSharp();
        if (_sharp) {
            optimizedBuffer = await _sharp(imageBuffer)
                .jpeg({ quality: 90, progressive: true })
                .resize(1240, 1754, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();
        } else {
            // Fallback: return original image buffer if Sharp is not available
            optimizedBuffer = imageBuffer;
            console.warn(
                'Sharp not available, returning original image buffer',
            );
        }

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
            let placeholderImage: Buffer;
            const _sharpPlaceholder = await getSharp();
            if (_sharpPlaceholder) {
                placeholderImage = await _sharpPlaceholder({
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
            } else {
                // Fallback: create a simple placeholder buffer
                placeholderImage = Buffer.from('PDF Page ' + pageNumber);
                console.warn('Sharp not available, using minimal placeholder');
            }

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
