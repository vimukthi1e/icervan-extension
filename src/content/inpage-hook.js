(function () {
  if (window.__NAVGUARD_INPAGE_INSTALLED__) {
    return;
  }

  Object.defineProperty(window, '__NAVGUARD_INPAGE_INSTALLED__', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  function emit(eventType, detail) {
    window.postMessage({ source: 'NAVGUARD_INPAGE', eventType, detail }, '*');
  }

  function safePatch(name, patcher) {
    try {
      patcher();
    } catch (error) {
      try {
        emit('hook_install_error', {
          hook: name,
          message: String(error && error.message ? error.message : error)
        });
      } catch (_) {}
    }
  }

  safePatch('window.open', () => {
    const originalOpen = window.open;
    if (typeof originalOpen !== 'function') return;
    window.open = function patchedOpen() {
      emit('window.open', { args: Array.from(arguments).slice(0, 2) });
      return originalOpen.apply(window, arguments);
    };
  });

  safePatch('location.assign', () => {
    const originalAssign = window.location.assign;
    if (typeof originalAssign !== 'function') return;
    window.location.assign = function patchedAssign(url) {
      emit('location.assign', { url: String(url || '') });
      return originalAssign.call(window.location, url);
    };
  });

  safePatch('location.replace', () => {
    const originalReplace = window.location.replace;
    if (typeof originalReplace !== 'function') return;
    window.location.replace = function patchedReplace(url) {
      emit('location.replace', { url: String(url || '') });
      return originalReplace.call(window.location, url);
    };
  });

  safePatch('history.pushState', () => {
    const originalPushState = history.pushState;
    if (typeof originalPushState !== 'function') return;
    history.pushState = function patchedPushState() {
      emit('history.pushState', { args: Array.from(arguments).slice(0, 3) });
      return originalPushState.apply(history, arguments);
    };
  });

  safePatch('history.replaceState', () => {
    const originalReplaceState = history.replaceState;
    if (typeof originalReplaceState !== 'function') return;
    history.replaceState = function patchedReplaceState() {
      emit('history.replaceState', { args: Array.from(arguments).slice(0, 3) });
      return originalReplaceState.apply(history, arguments);
    };
  });

  window.addEventListener('popstate', () => emit('popstate', {}), true);
  window.addEventListener('hashchange', () => emit('hashchange', { href: location.href }), true);
})();
