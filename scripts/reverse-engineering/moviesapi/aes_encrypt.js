const crypto = require('crypto');

function evpBytesToKey(password, salt, keyLen, ivLen) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const saltBuffer = Buffer.from(salt, 'binary'); // salt is already a buffer or binary string

    let digests = [];
    let genLen = 0;
    let lastDigest = Buffer.alloc(0);

    while (genLen < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(lastDigest);
        hash.update(passwordBuffer);
        hash.update(saltBuffer);
        const digest = hash.digest();
        digests.push(digest);
        lastDigest = digest;
        genLen += digest.length;
    }

    const combined = Buffer.concat(digests);
    const key = combined.slice(0, keyLen);
    const iv = combined.slice(keyLen, keyLen + ivLen);
    return { key, iv };
}

function encrypt(text, password) {
    const salt = crypto.randomBytes(8);
    const { key, iv } = evpBytesToKey(password, salt, 32, 16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const saltedPrefix = Buffer.from('Salted__', 'utf8');
    const finalBuffer = Buffer.concat([saltedPrefix, salt, Buffer.from(encrypted, 'base64')]);
    return finalBuffer.toString('base64');
}

// Test
const payload = JSON.stringify({
    source: "sflix2",
    type: "tv",
    id: "1396",
    season: 1,
    episode: 1,
    srv: "0"
});
const key = "moviesapi-secure-encryption-key-2024-v1";

try {
    const encrypted = encrypt(payload, key);
    console.log("Encrypted Payload:", encrypted);
} catch (e) {
    console.error("Encryption failed:", e);
}

module.exports = { encrypt };
