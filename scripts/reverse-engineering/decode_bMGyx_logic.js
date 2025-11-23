const fs = require('fs');
const path = require('path');
const { decode } = require('./deobfuscate_extra_script_vm');

const scriptPath = path.join(__dirname, 'extra_script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const funcName = 'bMGyx71TzQLfdonN';
const start = scriptContent.indexOf(`function ${funcName}(`);
let braceCount = 0;
let end = -1;
for (let i = start; i < scriptContent.length; i++) {
    if (scriptContent[i] === '{') braceCount++;
    else if (scriptContent[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            end = i + 1;
            break;
        }
    }
}
let funcCode = scriptContent.substring(start, end);

// Helper to replace calls
function replaceCalls(code, funcName, offsetCalc) {
    // Regex to find calls like funcName('str', num, num, num, num)
    // or funcName(num, num, num, 'str', num)
    // The arguments can be in any order, but usually 5 args.
    // The offset calculation is usually the 4th or 5th arg minus/plus something.
    // We need to match the specific pattern for each alias.

    // Let's find the definition of the alias first to know the offset logic.
    // function _0x2717cb(_0x451204,_0x195d28,_0x31d03a,_0x987602,_0x2858a3){return _0x586c(_0x987602- -0x242,_0x2858a3);}
    // It uses arg3 (0-indexed) and arg4.
    // _0x987602 is arg3. _0x2858a3 is arg4.
    // Offset: arg3 - (-0x242) = arg3 + 578.

    // We can regex for the alias call in the code.
    // alias(a, b, c, d, e)
    const regex = new RegExp(`${funcName}\\(([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\\)`, 'g');

    return code.replace(regex, (match, p1, p2, p3, p4, p5) => {
        const args = [p1, p2, p3, p4, p5].map(a => a.trim());
        // Evaluate args if they are numbers or strings
        const evalArg = (a) => {
            try {
                if (a.startsWith("'") || a.startsWith('"') || !isNaN(a) || a.startsWith('-')) {
                    return eval(a);
                }
                return a;
            } catch (e) { return a; }
        };
        const v = args.map(evalArg);

        try {
            const { index, key } = offsetCalc(v);
            const decoded = decode(index, key);
            console.log(`Decoded ${match} -> "${decoded}"`);
            return `'${decoded}'`;
        } catch (e) {
            console.error(`Error decoding ${match}:`, e);
            return match;
        }
    });
}

// Define aliases and their logic
// _0x2717cb: return _0x586c(_0x987602- -0x242,_0x2858a3); -> args[3] + 578, args[4]
funcCode = replaceCalls(funcCode, '_0x2717cb', (args) => ({ index: args[3] + 578, key: args[4] }));

// _0x4d8ae8: return _0x586c(_0x5af453-0x194,_0x3aa782); -> args[2] - 404, args[4]
funcCode = replaceCalls(funcCode, '_0x4d8ae8', (args) => ({ index: args[2] - 404, key: args[4] }));

// _0x12c787: return _0x586c(_0x15bea7- -0x1bb,_0x4ace4b); -> args[4] + 443, args[3]
funcCode = replaceCalls(funcCode, '_0x12c787', (args) => ({ index: args[4] + 443, key: args[3] }));

// _0x303241: return _0x586c(_0x20666d-0x95,_0x46f798); -> args[3] - 149, args[0]
funcCode = replaceCalls(funcCode, '_0x303241', (args) => ({ index: args[3] - 149, key: args[0] }));

console.log("---------------------------------------------------");
console.log("Deobfuscated function code:");
console.log(funcCode);
