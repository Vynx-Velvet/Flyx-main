const https = require('https');

const TEST_URL = 'https://cloudnestra.com/prorcp/NWViMzgzMjQ4ZGZjMGJmODA0NTkyZDQyYzQ5ZTRiNTA6VGtoVFdHaG9iRmMxWlVFdk1TOUtaMlpXVW1sT2NEaHZUbkkxY3pkelNEQnVXVWxxYkM5dldGWlhZakJVU2pKT2EybEtSRFJuYjJGbFRtdEdhRkpQTTNSQ2NqWTVRMmMzUTFOVU1sa3hRVWhEZWpoNE1YUlBNSEprUjFCVk5reENRako2TDJwVk1FSklkWFZYYkhjMlVGSnJObWRqYldveWFqVlBSelpYUm1STU4wRXlWemRLTDBFd2Qyd3hTbFJqWkVKclFuUjRiRzV1ZVhaSVRXWmhRVmxpWW5WTlNGcGlSV1UxYlU5aE1GazRkRU5SYlhodk4zUlBVR0prY2pkRk1EUTVZV05EYm0xa09ITTVSbXBhWVZobU1EQldVVkpaUmxwVEwzVnFZVFpNWmpSa1FUaEdVRWxFVGtGYVozTklTbTF1WlcxWVQzRkdkVFpPTjFCV1NubHNjbnB0T1V3dmQzSm1jUzkwZDFCbVJVeDBabG80ZUM5bE0wZ3libXROVUZwUVQwUm1OQ3MyZVUxS1owVkRhVk5rTTJZNFEwOWlkV2RtVVU0dlEzcHdTMHN5YVd4SE0xbE1UR05FYWxSamVYRjJWMlF4YzBWRU1uRnROa3M1TkZKTWQzcHZXSFp3TW5relZpOHhVWHAyYmtaYVpGbG5TMmhITWxkSGQxUnhkVTVaZWtOaFJtSkZhV0ZQZEZkd2JHNU5WMmhoVlZGS2FTc3ZkazQxVUVwcVptbGtWbTFJY0ZJdmFuUTBTa1JxUlRsalJHNUxkMnQxWlZZNWNuaGFSR3BVWkZWYVZTOHlORkpvUWt0TFpIWlVhV1ZGYVZKREsyczJOMVJaV0daYVdsYzFNWHBKVEVKb2FYQXhha1F5VGxoT1ZGZGxVVzh6UldsMFIyNVhMME5zVXpSVGJFeHRMMHQyZFVsek5ISnBSelJWYTFCTVoyYzJlbXhRYUZWMWNtb3ZSa3ByV0dFM2FGZFFSRmh4TDJaTU9HUTJjMXBTZVRaSE5VSXlXRTB6ZGxaaFJHdHpZVmRXVFd0NlpIcDFRU3RVV0RKeVdtUjVlRFZHVW5VNFVuZHRiVzR4TUZWdFMzTTJlVEZEU3pOMFZHOHJialZZWkdscWVtc3lNamw0VVZscVZXUXZlVlIxU0hoc00xQkhSRGQyV0ZkbmFsUnNZMnBwS3k5NE5HbENhbGhtT0dwcVEzZDVWWFY0TUVST1dUWlBkVlpLTkRGMGVtbEtSSEZzVlRKelRscDNLekZSU0c5Qlp6VlBWMHd2VTFobVRYTkxkMEYyVFVKQlIyMTZObUphYVZGS01GZE1SWGhsY214dGFFTlRjbTB4WTNoVE9YUllXV2hRVlV0V0x5OVhObTByVFhsaVVYSjBlR1V2V1hBeldXUjBObkZRZWtad2RUSnlaSFI1Tkc1NWNXOVpjbE52V1RjNVFXeEtTbkpOV200M2JEZG1aR3QwTnpGd09IQTRlakJsZDJab1QwdHBZbVZ1Y1RoM2JpOWpPV3hYWjBoMVJXSlJTVGRxUVROU1kzZEplbUpNTVZaVVVHeGpMMVk1Tmt0aVFVaHZNbW9yYWxnNVpGVnlUV1J2VVZRck0weEdlRVp2T0VGM2MxQmtZMFI2Y3pBeVdqSldkMEY1WWs0elJGUk5Wa3N4TUdwSVNHSTBOV0k1YmxWU1prZ3ZORFJKWkRBdmMwUnpOMmxqWlVaeFpsaFlUMWRVWkVGT1JVSkxPVWhoSzBaNE5tTldRVXBuUkd0R0szRjBZbEZFY0VabE5VdFJXV00yWkZGbFYzWjVRV3RhV1RNMFFVOVdSSEU0TlV0U1NubG1VRzgxWkRaSFlYbHJNVzU0UkhwYVowVkdXVkIyV20xWE5GaG9kMkV6TkZreWQwOUhabXgxUnpGNlFuQkZNVGhoVkhGQ2VVcGFUV0ZqY1VORFRVeG1aalE1WjJGTFNFeHZNRVJwVVhsYWRHVjFZMlpoU0RVeFlYRmpiMEZtVmpCc1lTdFlaR1JpWkhGWFowOVBhM1ZITlUxdk5rbHZTa3hOTUVaeWJuVmljVE5vT0NzeVZsZ3ljRTlTT1Zsd1J5c3ZjRFpoVFVOdVkwNW5WMUIwU2xWeFJIWlJSRUZPWlhKNFNtVnhiRTF0WlVaYVVFZGxSSGRJYmpGbFUxVkJVMXB0Y2psbWQxWkxTRUZsYWxkb2VuQjZhRVkxWkd3NFVtazFkMDg1WjNWTVVWWTRZVTExT0VkTVVqUkZaMGN3Y3l0RFlsaENjRE55YURrPQ--';

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log('Redirect to:', res.headers.location);
                return fetch(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function main() {
    console.log('Fetching:', TEST_URL.substring(0, 60) + '...');
    const response = await fetch(TEST_URL);
    console.log('Status:', response.status);
    console.log('Response length:', response.data.length);
    console.log('\n=== First 2000 chars ===\n');
    console.log(response.data.substring(0, 2000));
    
    // Check for div patterns
    const divMatch = response.data.match(/<div[^>]*id="([^"]+)"[^>]*>/g);
    console.log('\n=== Div tags found ===');
    if (divMatch) {
        divMatch.forEach(d => console.log(d));
    } else {
        console.log('No div tags found');
    }
    
    // Check for script tags
    const scriptMatch = response.data.match(/<script[^>]*src="([^"]+)"[^>]*>/g);
    console.log('\n=== Script tags found ===');
    if (scriptMatch) {
        scriptMatch.forEach(s => console.log(s));
    } else {
        console.log('No external script tags found');
    }
}

main().catch(console.error);
