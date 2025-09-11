
import fs from 'fs';
import path from 'path';
import { splitPdfIntoPages } from '../lib/pdfUtils';

async function convertPdf() {
    try {
        console.log('🔍 Starting PDF conversion test...');
        
        const pdfPath = path.join(__dirname, '..', 'app', 'test', 'kosu1 (1).pdf');
        const outputDir = path.join(__dirname, '..', 'app', 'test');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ PDF file not found:', pdfPath);
            return;
        }
        
        console.log('📄 Reading PDF:', pdfPath);
        const pdfBuffer = fs.readFileSync(pdfPath);
        console.log('✅ PDF loaded, size:', pdfBuffer.length, 'bytes');
        
        console.log('🔄 Converting PDF to individual page images...');
        const pages = await splitPdfIntoPages(pdfBuffer, 'kosu1.pdf');
        
        console.log(`✅ Successfully converted ${pages.length} pages`);
        
        for (const page of pages) {
            const imagePath = path.join(outputDir, page.fileName);
            fs.writeFileSync(imagePath, page.buffer);
            console.log(`💾 Saved: ${imagePath} (${page.buffer.length} bytes)`);
        }
        
        console.log('🎉 Conversion completed successfully!');
        console.log(`📁 Images saved in: ${outputDir}`);
        
        console.log('\n📊 Summary:');
        console.log(`- Total pages: ${pages.length}`);
        console.log('- Generated files:');
        pages.forEach((page, index) => {
            console.log(`  ${index + 1}. ${page.fileName} (${page.mimeType}, ${page.buffer.length} bytes)`);
        });
        
    } catch (error) {
        console.error('❌ Error during conversion:', error);
        if (error instanceof Error) {
            console.error(error.stack);
        }
    }
}

convertPdf();
