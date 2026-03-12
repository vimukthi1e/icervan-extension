(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavGuardRiskState = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function normalizeAttemptState(state, now, windowMs) {
    if (!state || now - state.windowStartedAt > windowMs) {
      return {
        count: 0,
        windowStartedAt: now,
        lastPromptAt: 0,
        tempBlockUntil: 0,
        lastPromptId: null
      };
    }

    return {
      count: state.count || 0,
      windowStartedAt: state.windowStartedAt || now,
      lastPromptAt: state.lastPromptAt || 0,
      tempBlockUntil: state.tempBlockUntil || 0,
      lastPromptId: state.lastPromptId || null
    };
  }

  function isTemporarilyBlocked(state, now) {
    return !!state && state.tempBlockUntil > now;
  }

  function shouldSuppressPrompt(state, now, cooldownMs) {
    if (!state || !state.lastPromptAt) return false;
    return now - state.lastPromptAt < cooldownMs;
  }

  function registerSuspiciousAttempt(state, now, settings) {
    const next = normalizeAttemptState(state, now, settings.suspiciousWindowMs);
    next.count += 1;

    let escalatedToTempBlock = false;
    if (next.count > settings.maxSuspiciousPromptsPerOriginWindow) {
      next.tempBlockUntil = now + settings.temporaryBlockMs;
      escalatedToTempBlock = true;
    }

    return { state: next, escalatedToTempBlock };
  }

  function markPromptShown(state, now, promptId) {
    const next = { ...state };
    next.lastPromptAt = now;
    next.lastPromptId = promptId;
    return next;
  }

  function clearStateForAllow(state, now) {
    if (!state) return state;
    return {
      count: 0,
      windowStartedAt: now,
      lastPromptAt: state.lastPromptAt || 0,
      tempBlockUntil: 0,
      lastPromptId: state.lastPromptId || null
    };
  }

  return {
    normalizeAttemptState,
    isTemporarilyBlocked,
    shouldSuppressPrompt,
    registerSuspiciousAttempt,
    markPromptShown,
    clearStateForAllow
  };
});
