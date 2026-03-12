(function () {
  function emit(eventType, detail) {
    window.postMessage({ source: 'NAVGUARD_INPAGE', eventType, detail }, '*');
  }

  const originalOpen = window.open;
  window.open = function patchedOpen() {
    emit('window.open', { args: Array.from(arguments).slice(0, 2) });
    return originalOpen.apply(window, arguments);
  };

  const locationAssign = window.location.assign.bind(window.location);
  window.location.assign = function patchedAssign(url) {
    emit('location.assign', { url: String(url || '') });
    return locationAssign(url);
  };

  const locationReplace = window.location.replace.bind(window.location);
  window.location.replace = function patchedReplace(url) {
    emit('location.replace', { url: String(url || '') });
    return locationReplace(url);
  };

  const originalPushState = history.pushState;
  history.pushState = function patchedPushState() {
    emit('history.pushState', { args: Array.from(arguments).slice(0, 3) });
    return originalPushState.apply(history, arguments);
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function patchedReplaceState() {
    emit('history.replaceState', { args: Array.from(arguments).slice(0, 3) });
    return originalReplaceState.apply(history, arguments);
  };

  window.addEventListener('popstate', () => emit('popstate', {}), true);
  window.addEventListener('hashchange', () => emit('hashchange', { href: location.href }), true);
})();
