(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function send(message) {
    try {
      api.runtime.sendMessage(message);
    } catch (_) {}
  }

  function injectPageHook() {
    try {
      const script = document.createElement('script');
      script.src = api.runtime.getURL('src/content/inpage-hook.js');
      script.async = false;
      (document.documentElement || document.head || document.body).appendChild(script);
      script.remove();
    } catch (_) {}
  }

  function onUserGesture(event) {
    if (!event.isTrusted) return;
    send({
      type: 'NAVGUARD_USER_GESTURE',
      eventType: event.type,
      url: location.href,
      ts: Date.now()
    });
  }

  ['click', 'pointerdown', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, onUserGesture, { capture: true, passive: true });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'NAVGUARD_INPAGE') return;
    send({
      type: 'NAVGUARD_PAGE_HOOK',
      eventType: data.eventType,
      detail: data.detail,
      url: location.href,
      ts: Date.now()
    });
  });

  injectPageHook();
})();
