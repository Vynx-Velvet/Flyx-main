const fs = require('fs');
const path = require('path');

try {
    const extraScriptContent = fs.readFileSync(path.join(__dirname, 'extra_script_new.js'), 'utf8');
    const runScript = new Function('window', 'document', 'URL', 'Blob', 'atob', extraScriptContent);
    console.log("Compilation successful");
} catch (e) {
    console.error("Compilation failed:", e);
}
