const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, '../src/assets/test-recordings');
const manifestPath = path.join(audioDir, 'manifest.json');

// Ensure directory exists
if (!fs.existsSync(audioDir)) {
    console.log('Test recordings directory not found. Creating...');
    fs.mkdirSync(audioDir, { recursive: true });
}

// Read files
const files = fs.readdirSync(audioDir).filter(file => file.endsWith('.webm'));
const recordings = [];

files.forEach(file => {
    // Parsing filename: lang-word-timestamp.webm
    // Example: en-US-hello-2023...webm
    // We need to be careful if "word" contains hyphens.
    // Assumption: lang is always first (e.g. en-US, es-US, en, es)
    // Timestamp is at the end.
    // Let's use regex.

    // Format: <lang>-<word>-<timestamp>.webm
    // lang can be en, en-US, es, es-US
    const match = file.match(/^([a-z]{2}(?:-[A-Z]{2})?)-(.+)-(\d{4}-\d{2}-\d{2}T.+)\.webm$/);

    if (match) {
        recordings.push({
            filename: file,
            language: match[1],
            word: match[2],
            timestamp: match[3]
        });
    } else {
        console.warn(`Skipping file with invalid format: ${file}`);
    }
});

fs.writeFileSync(manifestPath, JSON.stringify(recordings, null, 2));
console.log(`Manifest generated with ${recordings.length} recordings at ${manifestPath}`);
