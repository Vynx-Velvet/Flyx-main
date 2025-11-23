/**
 * Superembed Token Generator
 * Reverses the logic found in _0x14b603 to generate the form submission token.
 */

function generateToken(which, pageX, pageY) {
    // Default values if not provided (simulating a click)
    // which: 1 (left click)
    // pageX, pageY: coordinates

    const now = Date.now();
    let payload;

    if (which !== undefined && pageX !== undefined && pageY !== undefined) {
        // "true--" + which + "--" + pageX + "--" + pageY + "--" + now
        payload = `true--${which}--${pageX}--${pageY}--${now}`;
    } else {
        // "false--0--0--0--" + now
        payload = `false--0--0--0--${now}`;
    }

    // First Base64 encoding
    let encoded = btoa(payload);

    // Replacements
    encoded = encoded.replace(/M/g, "-P");
    encoded = encoded.replace(/0/g, "-Q");
    encoded = encoded.replace(/=/g, "-5");
    encoded = encoded.replace(/W/g, "-X");
    encoded = encoded.replace(/T/g, "-0");
    encoded = encoded.replace(/E/g, "-V");

    // Second Base64 encoding
    const finalToken = btoa(encoded);

    return finalToken;
}

// Example usage
const token = generateToken(1, 100, 200);
console.log("Generated Token:", token);

// Export for use in other scripts
module.exports = generateToken;
