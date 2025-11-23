const fs = require('fs');
const path = require('path');

// Load the encrypted string
const encryptedContent = fs.readFileSync(path.join(__dirname, 'encrypted_CloudStream_Pro.txt'), 'utf8');
const extraScriptContent = fs.readFileSync(path.join(__dirname, 'extra_script_patched.js'), 'utf8');

// Mock environment
const window = {};
const document = {
    getElementById: (id) => {
        console.log(`document.getElementById called with: ${id}`);
        if (id === 'eSfH1IRMyL' || true) { // We suspect the ID is eSfH1IRMyL, but let's return content for any ID to be safe/lazy
            return { innerHTML: encryptedContent };
        }
        return null;
    }
};
const URL = {
    createObjectURL: () => 'blob:url'
};
const Blob = function (content, options) {
    return { content, options };
};
const atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Execute the script
try {
    // We wrap the script in a function to avoid global scope pollution issues if any, 
    // but we need to pass our mocks.
    // Actually, eval is easiest here.

    // The script uses 'this' which might be global.
    // It also uses 'window', 'document', 'URL', 'Blob', 'atob'.

    const runScript = new Function('window', 'document', 'URL', 'Blob', 'atob', extraScriptContent);
    runScript(window, document, URL, Blob, atob);

    console.log("Script executed.");

    // Check window for results
    console.log("Window keys:", Object.keys(window));

    // The script assigns the result to window[ID].
    // Let's print all values in window.
    for (const key in window) {
        const value = window[key];
        if (typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))) {
            console.log(`Found potential source in window['${key}']:`);
            console.log(value.substring(0, 200) + "...");
        }
    }

} catch (e) {
    console.error("Error executing script:", e);
}
