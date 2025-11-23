a = x.substr(2);for(var i=4;i>-1;i--){if(exist(v["bk"+i])){if(v["bk"+i]!=""){a = a.replace(v.file3_separator+b1(v["bk"+i]),"");}}}try{a = b2(a);}catch(e){a="";}
                function b1(str) {
                    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
                        function toSolidBytes(match, p1) {
                            return String.fromCharCode("0x" + p1);
                    }));
                }
                function b2(str) {
                    return decodeURIComponent(atob(str).split("").map(function(c) {
                        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(""));
                }