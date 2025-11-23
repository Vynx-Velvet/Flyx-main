const fs = require('fs');
const path = require('path');
const { decode } = require('./deobfuscate_extra_script_vm');

const scriptPath = path.join(__dirname, 'extra_script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const funcName = 'LXVUMCoAHJ';
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
    const regex = new RegExp(`${funcName}\\(([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\\)`, 'g');
    return code.replace(regex, (match, p1, p2, p3, p4, p5) => {
        const args = [p1, p2, p3, p4, p5].map(a => a.trim());
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

// Aliases logic
// _0xc37455: return _0x586c(_0x19f6d4- -0x29a,_0x1827b8); -> args[4] + 666, args[0]
funcCode = replaceCalls(funcCode, '_0xc37455', (args) => ({ index: args[4] + 666, key: args[0] }));

// _0xa86ae9: return _0x586c(_0x40db8e- -0x1f7,_0x4845fc); -> args[0] + 503, args[1]
funcCode = replaceCalls(funcCode, '_0xa86ae9', (args) => ({ index: args[0] + 503, key: args[1] }));

// _0x140989: return _0x586c(_0xe6f955- -0x1ad,_0x14d5ef); -> args[3] + 429, args[2]
funcCode = replaceCalls(funcCode, '_0x140989', (args) => ({ index: args[3] + 429, key: args[2] }));

// _0xc51c05: return _0x586c(_0x10663a-0x28c,_0x21fdbd); -> args[3] - 652, args[1]
funcCode = replaceCalls(funcCode, '_0xc51c05', (args) => ({ index: args[3] - 652, key: args[1] }));

// _0xa96de1: return _0x586c(_0x14e57b-0x116,_0x351d26); -> args[4] - 278, args[1]
funcCode = replaceCalls(funcCode, '_0xa96de1', (args) => ({ index: args[4] - 278, key: args[1] }));

console.log("---------------------------------------------------");
console.log("Deobfuscated function code:");
console.log(funcCode);
