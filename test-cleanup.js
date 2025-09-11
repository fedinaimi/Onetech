#!/usr/bin/env node

// Test script for the delete/cleanup functions
const fs = require('fs');
const path = require('path');

// Create some test files to simulate cleanup
const testDir = '/tmp/onetech-test-cleanup';

async function createTestFiles() {
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Create some test files that look like pdf2pic temp files
    const testFiles = [
        'page_1234567890.jpg',
        'page_0987654321.png',
        '1703123456789.jpg',
        'temp_process_123.png',
        'not_a_temp_file.txt',
        'regular_file.json'
    ];

    for (const fileName of testFiles) {
        const filePath = path.join(testDir, fileName);
        fs.writeFileSync(filePath, `Test content for ${fileName}`);
        console.log(`Created test file: ${fileName}`);
    }
}

async function testCleanup() {
    try {
        console.log('Creating test files...');
        await createTestFiles();

        // Import the cleanup functions
        const { cleanupTempFiles, deleteTempFile, cleanupOldTempFiles } = require('./lib/pdfUtils.ts');

        console.log('\n1. Testing cleanupTempFiles with pattern...');
        await cleanupTempFiles(testDir, /page_\d+/);

        console.log('\n2. Testing deleteTempFile...');
        const specificFile = path.join(testDir, 'temp_process_123.png');
        if (fs.existsSync(specificFile)) {
            const result = deleteTempFile(specificFile);
            console.log(`Delete result: ${result}`);
        }

        console.log('\n3. Testing cleanupOldTempFiles (should not delete anything as files are new)...');
        await cleanupOldTempFiles(testDir, 0.1); // 0.1 hours = 6 minutes

        console.log('\n4. Final cleanup - remove test directory...');
        fs.rmSync(testDir, { recursive: true, force: true });
        console.log('Test directory removed');

        console.log('\n✅ All cleanup tests completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testCleanup();
