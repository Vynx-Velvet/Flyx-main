const encoded = "141c170a30620b137b355c5d2f2b210c0917213a16523e09502f485b3a280839211c13740271126f6011292b1e28397a084e";

console.log('Testing hex decode...\n');

const decoded = Buffer.from(encoded, 'hex').toString('utf8');
console.log('Decoded:', decoded);
console.log('\nFirst 200 chars:', decoded.substring(0, 200));
console.log('\nContains http?', decoded.includes('http'));
console.log('Contains .m3u8?', decoded.includes('.m3u8'));
console.log('Contains putgate?', decoded.includes('putgate'));
