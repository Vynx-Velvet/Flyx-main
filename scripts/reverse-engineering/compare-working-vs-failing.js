const fs = require('fs');

// Compare working vs failing files
const files = [
    { name: 'Fight Club (working)', file: 'debug-prorcp-550.html', tmdb: '550' },
    { name: 'Breaking Bad (working)', file: 'debug-prorcp-1396.html', tmdb: '1396' },
    { name: 'Pulp Fiction (failing)', file: 'debug-prorcp-680.html', tmdb: '680' },
];

console.log('Comparing working vs failing files:\n');

for (const { name, file, tmdb } of files) {
    console.log(`=== ${name} (TMDB: ${tmdb}) ===`);
    
    try {
        const html = fs.readFileSync(file, 'utf8');
        const match = html.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
        
        if (!match) {
            console.log('No hidden div found\n');
            continue;
        }
        
        const divId = match[1];
        const encoded = match[2];
        
        console.log('Div ID:', divId);
        console.log('Encoded length:', encoded.length);
        console.log('First char:', encoded[0], '(code:', encoded.charCodeAt(0), ')');
        console.log('First 30:', encoded.substring(0, 30));
        
        // Check for = prefix
        const hasEqPrefix = encoded.startsWith('=');
        console.log('Has = prefix:', hasEqPrefix);
        
        // Try to decode
        let input = hasEqPrefix ? encoded.substring(1) : encoded;
        const reversed = input.split('').reverse().join('');
        const replaced = reversed.replace(/-/g, '+').replace(/_/g, '/');
        
        try {
            const decoded = Buffer.from(replaced, 'base64').toString('binary');
            console.log('Base64 decoded length:', decoded.length);
            
            // Try shifts
            for (const shift of [3, 5, 7]) {
                let result = '';
                for (let i = 0; i < decoded.length; i++) {
                    result += String.fromCharCode(decoded.charCodeAt(i) - shift);
                }
                if (result.includes('https://')) {
                    console.log(`✅ Works with shift ${shift}`);
                    console.log('First URL:', result.substring(0, 80));
                    break;
                }
            }
        } catch (e) {
            console.log('Base64 error:', e.message);
        }
        
        // Extract page metadata
        const dataI = html.match(/data-i="(\d+)"/);
        const cuid = html.match(/cuid:"([^"]+)"/);
        const scriptHash = html.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
        
        console.log('data-i:', dataI ? dataI[1] : 'not found');
        console.log('cuid:', cuid ? cuid[1].substring(0, 20) + '...' : 'not found');
        console.log('script hash:', scriptHash ? scriptHash[1].substring(0, 20) + '...' : 'not found');
        
        console.log();
    } catch (e) {
        console.log('Error:', e.message, '\n');
    }
}
