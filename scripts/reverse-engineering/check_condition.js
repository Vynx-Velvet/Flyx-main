const { decode } = require('./deobfuscate_extra_script_vm');

const val1 = decode(684, 'HLeV');
const val2 = decode(1160, 'VV0q');

console.log(`val1: "${val1}"`);
console.log(`val2: "${val2}"`);
console.log(`Equal? ${val1 === val2}`);
