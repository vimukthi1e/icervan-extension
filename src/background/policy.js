(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavGuardPolicy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function parseOrigin(url) {
    try {
      return new URL(url).origin;
    } catch (_) {
      return '';
    }
  }

  function hostFromOrigin(origin) {
    try {
      return new URL(origin).hostname;
    } catch (_) {
      return '';
    }
  }

  function inList(url, list) {
    const origin = parseOrigin(url);
    const host = hostFromOrigin(origin);
    return (list || []).some((item) => {
      const v = (item || '').trim().toLowerCase();
      if (!v) return false;
      return origin.toLowerCase() === v || host === v || url.toLowerCase().startsWith(v);
    });
  }

  function evaluateNavigation(ctx, settings) {
    const reasons = [];
    if (!ctx || !ctx.targetUrl) {
      return { score: 0, classification: 'unknown', action: 'allow', reasons: ['missing_context'] };
    }

    if (inList(ctx.targetUrl, settings.blocklist)) {
      return { score: 100, classification: 'blocked_list', action: 'block', reasons: ['blocklist_match'] };
    }

    if (inList(ctx.targetUrl, settings.allowlist)) {
      return { score: -100, classification: 'allow_list', action: 'allow', reasons: ['allowlist_match'] };
    }

    let score = 0;

    if (!ctx.isMainFrame) {
      score -= 20;
      reasons.push('subframe');
    } else {
      score += 20;
      reasons.push('main_frame');
    }

    if (ctx.sameOrigin) {
      score -= 15;
      reasons.push('same_origin');
    } else {
      score += 20;
      reasons.push('cross_origin');
    }

    if (ctx.recentUserGesture) {
      score -= 40;
      reasons.push('recent_user_gesture');
    } else {
      score += 25;
      reasons.push('no_recent_gesture');
    }

    if (ctx.requestType === 'createdNavigationTarget') {
      score += 25;
      reasons.push('popup_target');
    }

    if (ctx.redirectCount >= 2) {
      score += 25;
      reasons.push('redirect_chain');
    }

    if (ctx.hookSignal === 'location.replace' || ctx.hookSignal === 'location.assign' || ctx.hookSignal === 'window.open' || ctx.hookSignal === 'history.replaceState') {
      score += 20;
      reasons.push('script_navigation_hook');
    }


    if (ctx.hookSignal === 'history.pushState') {
      score += 8;
      reasons.push('history_api_hook');
    }

    if (ctx.recentSameDocumentSuspicious) {
      score += 15;
      reasons.push('same_document_signal');
    }

    if ((ctx.historyBurstCount || 0) >= (settings.historyBurstThreshold || 4)) {
      score += 20;
      reasons.push('history_burst');
    }

    if ((ctx.repeatedSuspiciousCount || 0) > 1) {
      score += 10;
      reasons.push('repeated_suspicious_origin');
    }

    if (ctx.mode === 'strict') {
      return { score, classification: 'strict_gate', action: 'prompt', reasons };
    }

    if (ctx.mode === 'monitor') {
      return { score, classification: 'monitor_only', action: 'allow', reasons };
    }

    if (score >= 60) {
      return { score, classification: 'high_risk', action: 'prompt', reasons };
    }

    if (score >= 35 && settings.promptOnMediumRisk) {
      return { score, classification: 'medium_risk', action: 'prompt', reasons };
    }

    return { score, classification: 'low_risk', action: 'allow', reasons };
  }

  return { evaluateNavigation, parseOrigin };
});
