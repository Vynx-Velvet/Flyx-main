(function () {
    const gate = document.getElementById('gate');
    const link = document.getElementById('continue');

    // No preventDefault — let the real <a> open a new tab (not popup-blocked)
    link.addEventListener('click', () => {
      // Immediately unlock the current tab
      gate.remove();
      document.body.classList.remove('gated');
    });

    // (Optional) also dismiss if user presses Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('gated')) {
        gate.remove();
        document.body.classList.remove('gated');
      }
    }, { capture: true });
  }());