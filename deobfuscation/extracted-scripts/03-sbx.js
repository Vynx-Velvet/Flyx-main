function dtc_sbx(){
    function r(){window.location.href='/sbx.html#'+encodeURIComponent(window.location.href)}
    try{if(window.frameElement.hasAttribute("sandbox"))r();return}catch(t){}
    try{document.domain=document.domain}catch(t){try{if(-1!=t.toString().toLowerCase().indexOf("sandbox"))r();return}catch(t){}}
    try{if(!window.navigator.plugins["namedItem"]("Chrome PDF Viewer")) return false}catch(e){return false}
    var e = document.createElement('object');
    e.data = "data:application/pdf;base64,aG1t";
    e.style = "position:absolute;top:-500px;left:-500px;visibility:hidden;";
    e.onerror = function(){r()};
    e.onload = function(){e.parentNode.removeChild(e)};
    document.body.appendChild(e);
    //setTimeout(function(e){e.parentNode.removeChild(e)},150);
}
dtc_sbx();