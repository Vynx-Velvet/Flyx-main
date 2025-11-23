const fs = require('fs');
const path = require('path');

// Load the encrypted string
const encryptedContent = fs.readFileSync(path.join(__dirname, 'encrypted_CloudStream_Pro.txt'), 'utf8');
const extraScriptContent = fs.readFileSync(path.join(__dirname, 'extra_script_new.js'), 'utf8');

// Mock environment
const window = {
    location: {
        href: 'https://cloudnestra.com/prorcp/...'
    },
    navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
};
const document = {
    getElementById: (id) => {
        console.log(`document.getElementById called with: ${id}`);
        // We return the encrypted content. 
        // The script calls .innerHTML on the result.
        return { innerHTML: encryptedContent };
    }
};
const URL = {
    createObjectURL: () => 'blob:url'
};
const Blob = function (content, options) {
    return { content, options };
};
const atob = (str) => Buffer.from(str, 'base64').toString('binary');
const navigator = window.navigator;
const location = window.location;
const screen = { width: 1920, height: 1080 };
const history = {};

// Execute the script
try {
    console.log("Starting execution...");

    // We use a timeout to prevent infinite loops from hanging the process forever
    // But we can't easily timeout a synchronous execution in Node.js main thread.
    // We'll just hope it finishes with better mocks.

    const runScript = new Function('window', 'document', 'URL', 'Blob', 'atob', 'navigator', 'location', 'screen', 'history', extraScriptContent);
    runScript(window, document, URL, Blob, atob, navigator, location, screen, history);

    console.log("Script executed.");

    // Check window for results
    console.log("Window keys:", Object.keys(window));

    for (const key in window) {
        if (key === 'location' || key === 'navigator') continue;

        const value = window[key];
        console.log(`window['${key}'] type: ${typeof value}`);

        if (typeof value === 'string') {
            console.log(`Value start: ${value.substring(0, 100)}`);
            if (value.includes('http') || value.includes('.m3u8')) {
                console.log(`FOUND SOURCE!`);
                fs.writeFileSync(path.join(__dirname, 'decoded_source.txt'), value);
            }
        }
    }

} catch (e) {
    console.error("Error executing script:", e);
}
