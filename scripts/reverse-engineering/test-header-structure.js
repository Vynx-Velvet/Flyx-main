const vm = require('vm');

const code = `
var _0x5bd0=['a','b'];
var _0x32e7=function(_0x37e429,_0x42b790){
    return _0x5bd0[0];
};
(function(_0x237545,_0x514957){
    var _0x42b44f=function(_0x4917f5,_0x2dcc96,_0x415cb0,_0x186ec0){return _0x32e7(_0x415cb0- -0x197,_0x4917f5);};
    while(!![]){
        try{
            var _0x5eb9b8=1;
            if(_0x5eb9b8===_0x514957)break;
            else _0x237545['push'](_0x237545['shift']());
        }catch(_0x4d3970){
            _0x237545['push'](_0x237545['shift']());
        }
    }
}(_0x5bd0,0x106d15*0x1+0x1*0xfb773+-0x16d572));
global.decoder = _0x32e7;
`;

try {
    const sandbox = { global: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    console.log("Success!");
} catch (e) {
    console.error("Error:", e);
}
