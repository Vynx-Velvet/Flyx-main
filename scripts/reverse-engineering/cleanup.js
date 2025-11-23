const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Nicks\\Desktop\\Flyx-main\\scripts\\reverse-engineering';
const filesToDelete = [
    'analyze_shift.js', 'decode_caesar.js', 'decode_joa.js', 'decode_vigenere.js',
    'decode_xor.js', 'decode_xor_pjs.js', 'extract_decoders.js', 'extract_obfuscation.js',
    'inspect_extra.js', 'inspect_extra_end.js', 'inspect_pjs.js', 'inspect_pjs_file_handling.js',
    'save_decoded.js', 'scan_constants.js', 'search_pjsframed.js', 'search_salt_mod.js',
    'search_shift.js', 'verify_decoding_path.js', 'decoded_joa.txt', 'decoded_pjs.txt',
    'analyze_extra_deep.js', 'analyze_extra_scripts.js', 'analyze_pjs.js', 'fetch_scripts.js'
];

filesToDelete.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted ${file}`);
    }
});

if (fs.existsSync(path.join(dir, 'decoded_standard.txt'))) {
    fs.renameSync(path.join(dir, 'decoded_standard.txt'), path.join(dir, 'decoded_url_encrypted.txt'));
    console.log('Renamed decoded_standard.txt to decoded_url_encrypted.txt');
}
