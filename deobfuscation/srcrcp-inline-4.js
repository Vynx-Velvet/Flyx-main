(function(){
  var sbxErr = document.getElementById('sbxErr');
  var playEl = document.querySelector('.playbtnx');

  if (!playEl) return;

  function hasDirectSandbox(){
    try {
      if (window.top === window.self) return false;
      var fe = window.frameElement;
      return !!(fe && fe.hasAttribute && fe.hasAttribute('sandbox'));
    } catch(e){ return false; }
  }
  function popupProbe(){
    var ok=false, w=null;
    try { w = window.open('about:blank','_blank'); ok = !!w; } catch(e){ ok=false; }
    if (w){ try{ w.close(); }catch(_){ } }
    return ok;
  }
  function blockAndShow(){
    if (sbxErr) sbxErr.style.display = 'flex';
  }

  playEl.addEventListener('click', function(e){
    if (hasDirectSandbox() || !popupProbe()){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      blockAndShow();
      return false;
    }
  }, true);
})();