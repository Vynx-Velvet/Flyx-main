const encoded = '#1lfA9IHTuP3iVP3eyKDIpb2mvPVU2lkITNg00b2X#LgE7Nf0tKktpmVUYRGYzQCU2jyJVNyIrNi0pKktpmVU2jyJVNyIrNi0UcfIVKktUID0Tlf5ymkBsljaYKHlumZYsmgaSP2iwlkJUQG9yK2IxKHmOIZJrIVtpkfXsIVIpb319SkeyRktUID0TlWIolfX7SjaUQGaoKGhpR2E9IVI7SdoTICATICATICATICATICATmniul3epO24TlWEoP3eyKfB7CVATICATICATICATICATICATICATPZi0QkJuIGJ0O2Eomj5WO2eYiiJJd29tPG9umj50KHa0PVXuPZiwOGFWmfTvJfUOMC05df1GkksySfXvmywKICATICATICATICATICATICATICATmniul3epO24TQG9gO2xpmEJ5QGizKG1UQGaoLCBwMfXTRwoTICATICATICATICATICATICATICATICATICATPZi0QkJuIFa0PZYumy5ZPZ9td2UUPXavmGhoIWB4IVArIHAxKgsKICATICATICATICATICATICATICB9KfX7CVATICATICATICATICATICB9CVATICATICATICATICATICBZQj5WQGYvOVBVMVUzQHIpIHsKICATICATICATICATICATICATICBymke1PZ4TmGiWO2eYiiJJd29tPG9umj50KGF0O2IoP3eyKf5zPGxpQCTVIVXuOjFwKGm1OZa0Nj9uKGMpIHsKICATICATICATICATICATICATICATICATPZi0QkJuICIYIVArICTVMDAVICsTly5WNGFyd29XmhF0KDApLnevh3eyNj5nKDE2KfXuP2xpl2hoLgIpbwoTICATICATICATICATICATICATIH0pLZpvNj4oIVIpKgsKICATICATICATICATICATIH0=';

var abc = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";

var salt = {
    _keyStr: abc + "0123456789+/=",
    d: function (e) {
        var t = "";
        var n, r, i;
        var s, o, u, a;
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
    _ud: function (e) {
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
    if (x.substr(0, 2) == "#1") {
        let s = x.substr(2);
        // pepper logic: replace # with +
        s = s.replace(/#/g, "+");

        return salt.d(s);
    }
    return x;
}

console.log(decode(encoded));
