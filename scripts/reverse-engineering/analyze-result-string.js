const str = 'pe.d-e% avi-lenw%mi#%%ioettayX-%awea..rnlxsscr%g%%--%panb%onlke%%ciltl%-Caau.l-0tbtmyoaiintug-btuiy%hElsYilhfX%-nPro-O.atb-rt%nn.%hal-sp-%-ates-0gak%-tsis%%utrf%xt-mfcelbk-u5-ie-l00etac-u%gPnpoe-e.pbons%vptwltVekcc-u%P%d%teedcom-co%awil0cQ-etsa%-cdpr-o';

console.log("Original:", str);

const reversed = str.split('').reverse().join('');
console.log("Reversed:", reversed);

try {
    const decoded = decodeURIComponent(str);
    console.log("URI Decoded:", decoded);
} catch (e) {
    console.log("URI Decode failed on original");
}

try {
    const decodedRev = decodeURIComponent(reversed);
    console.log("URI Decoded (Reversed):", decodedRev);
} catch (e) {
    console.log("URI Decode failed on reversed");
}

// Try "skip" patterns (e.g. take every 2nd char)
let skip2 = '';
for (let i = 0; i < str.length; i += 2) skip2 += str[i];
console.log("Skip 2:", skip2);

let skip2_offset = '';
for (let i = 1; i < str.length; i += 2) skip2_offset += str[i];
console.log("Skip 2 Offset:", skip2_offset);

// Try to find "video" or "http"
if (str.includes('video')) console.log("Contains 'video'");
if (reversed.includes('video')) console.log("Reversed contains 'video'");
if (str.includes('http')) console.log("Contains 'http'");
if (reversed.includes('http')) console.log("Reversed contains 'http'");

// Check for % encoding manually
const parts = str.split('%');
console.log("Split by %:", parts);
