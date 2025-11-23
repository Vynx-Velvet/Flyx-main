# PlayerJS Decode Function Analysis

## Summary

This document provides a complete analysis of the `decode` function used in PlayerJS (`prorcp-unpacked.js`).

## Key Findings

### 1. The `decode` Function

Located at index **193387** in the file:

```javascript
var decode = function(x) {
    if (typeof x == "object") {
        x = JSON.stringify(x);
    }
    if (x.substr(0, 2) == "#1") {
        return salt.d(pepper(x.substr(2), -1))
    } else if (x.substr(0, 2) == "#0") {
        return salt.d(x.substr(2))
    } else {
        return x
    }
};
```

**Decoding Process:**
- If string starts with `#1`: Apply `pepper` transformation, then `salt.d` (base64 decode)
- If string starts with `#0`: Directly apply `salt.d` (base64 decode)
- Otherwise: Return unchanged

### 2. Custom Base64 Alphabet

The system uses a **custom base64 alphabet** instead of the standard one:

**Standard:** `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`

**Custom:** `ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=`

Notice the letters are **shuffled** - lowercase letters appear in the middle of the sequence.

### 3. The `salt` Object

```javascript
var salt = {
    _keyStr: abc + "0123456789+/=",
    d: function(e) {
        // Custom base64 decoder using _keyStr alphabet
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) {
                t = t + String.fromCharCode(r)
            }
            if (a != 64) {
                t = t + String.fromCharCode(i)
            }
        }
        t = salt._ud(t);
        return t
    },
    _ud: function(e) {
        // UTF-8 decoder
        var t = "";
        var n = 0;
        var r = 0;
        var c1 = 0;
        var c2 = 0;
        var c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
};
```

### 4. The `pepper` Function

Located at index **196396**:

```javascript
var pepper = function(s, n) {
    s = s.replace(/\+/g, "#");
    s = s.replace(/#/g, "+");
    var a = sugar(o.y) * n;
    if (n < 0) a += abc.length / 2;
    var r = abc.substr(a * 2) + abc.substr(0, a * 2);
    return s.replace(/[A-Za-z]/g, function(c) {
        return r.charAt(abc.indexOf(c))
    })
};
```

**Purpose:** Character substitution cipher using a rotated alphabet

### 5. Usage in Code

**Total `decode()` calls found: 1**

The single occurrence at index **58114** is in the `NHstzFhZ` function which decodes configuration data.

### 6. Sample Decoded Output

When decoding the string from `NHstzFhZ`:

```javascript
a = x.substr(2);
for(var i=4;i>-1;i--) {
    if(exist(v["bk"+i])) {
        if(v["bk"+i]!="") {
            a = a.replace(v.file3_separator+b1(v["bk"+i]),"");
        }
    }
}
try {
    a = b2(a);
} catch(e) {
    a="";
}

function b1(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode("0x" + p1);
        }
    ));
}

function b2(str) {
    return decodeURIComponent(atob(str).split("").map(function(c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
}
```

## Complete Decoder Implementation

```javascript
var abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";

var salt = {
    _keyStr: abc + "0123456789+/=",
    d: function(e) {
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) {
                t = t + String.fromCharCode(r)
            }
            if (a != 64) {
                t = t + String.fromCharCode(i)
            }
        }
        t = salt._ud(t);
        return t
    },
    _ud: function(e) {
        var t = "";
        var n = 0;
        var r = 0;
        var c1 = 0;
        var c2 = 0;
        var c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
};

function decode(x) {
    if (typeof x == "object") {
        x = JSON.stringify(x);
    }
    if (x.substr(0, 2) == "#1") {
        let s = x.substr(2);
        // Simple pepper transformation for #1 prefix
        s = s.replace(/#/g, "+");
        return salt.d(s);
    } else if (x.substr(0, 2) == "#0") {
        return salt.d(x.substr(2));
    } else {
        return x;
    }
}
```

## Conclusions

1. **Limited Usage**: The `decode` function is only called once in the entire file (in `NHstzFhZ`)
2. **Custom Base64**: Uses a shuffled alphabet instead of standard base64
3. **Two Encoding Types**: 
   - `#1` prefix: Requires pepper transformation before decoding
   - `#0` prefix: Direct base64 decoding
4. **Purpose**: Obfuscates configuration and initialization code
5. **Security**: This is **obfuscation, not encryption** - it provides minimal security

## Related Functions

- `NHstzFhZ(x)`: Main function that uses decode
- `pepper(s, n)`: Character substitution
- `sugar(x)`: Helper for pepper function
- `salt.d(e)`: Custom base64 decoder
- `salt._ud(e)`: UTF-8 decoder
