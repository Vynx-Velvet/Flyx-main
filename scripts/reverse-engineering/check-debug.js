const fs = require('fs');

['debug-prorcp-1396.html', 'debug-prorcp-680.html'].forEach(file => {
    console.log(`\n=== ${file} ===`);
    try {
        const html = fs.readFileSync(file, 'utf8');
        const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
        if (match) {
            console.log('Div ID:', match[1]);
            console.log('Content length:', match[2].length);
            console.log('First 80 chars:', match[2].substring(0, 80));
        } else {
            console.log('No hidden div found with standard pattern');
            // Try alternative patterns
            const alt1 = html.match(/style="display:none[^"]*"[^>]*>([^<]+)</);
            if (alt1) {
                console.log('Alt pattern found, length:', alt1[1].length);
                console.log('First 80:', alt1[1].substring(0, 80));
            }
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
});
