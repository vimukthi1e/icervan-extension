(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const storage = self.NavGuardStorage;
  const logger = self.NavGuardLogger;
  const policy = self.NavGuardPolicy;
  const approval = self.NavGuardApproval;
  const requestPatterns = self.NavGuardDefaults.REQUEST_MATCH_PATTERNS;

  const tabSignals = new Map();
  const oneTimeAllows = new Map();
  const redirectCounts = new Map();

  function getAllowKey(tabId, targetUrl) {
    return `${tabId}|${targetUrl}`;
  }

  function consumeOneTimeAllow(tabId, targetUrl) {
    const key = getAllowKey(tabId, targetUrl);
    const expiresAt = oneTimeAllows.get(key);
    if (expiresAt && expiresAt > Date.now()) {
      oneTimeAllows.delete(key);
      return true;
    }
    oneTimeAllows.delete(key);
    return false;
  }

  function getRecentGesture(tabId, windowMs) {
    const signal = tabSignals.get(tabId);
    if (!signal) return false;
    return Date.now() - signal.lastGestureTs <= windowMs;
  }

  async function classifyRequest(details, requestType) {
    const settings = await storage.getSettings();
    const sourceUrl = details.originUrl || details.documentUrl || tabSignals.get(details.tabId)?.url || '';
    const sameOrigin = policy.parseOrigin(sourceUrl) && policy.parseOrigin(sourceUrl) === policy.parseOrigin(details.url);

    const key = `${details.tabId}:${details.requestId || details.url}`;
    const redirectCount = redirectCounts.get(key) || 0;

    const ctx = {
      mode: settings.mode,
      targetUrl: details.url,
      sourceUrl,
      isMainFrame: details.type === 'main_frame' || requestType === 'createdNavigationTarget',
      sameOrigin,
      recentUserGesture: getRecentGesture(details.tabId, settings.gestureWindowMs),
      requestType,
      redirectCount,
      hookSignal: tabSignals.get(details.tabId)?.lastHook || ''
    };

    return {
      settings,
      ctx,
      decision: policy.evaluateNavigation(ctx, settings)
    };
  }

  async function maybeGateNavigation(details, requestType) {
    if (details.tabId < 0) return {};
    if (consumeOneTimeAllow(details.tabId, details.url)) {
      await logger.appendLog({ event: 'one_time_allow_consumed', tabId: details.tabId, targetUrl: details.url, phase: 'request' });
      return {};
    }

    const { settings, ctx, decision } = await classifyRequest(details, requestType);

    await logger.appendLog({
      event: 'navigation_attempt',
      phase: 'request',
      tabId: details.tabId,
      frameId: details.frameId,
      sourceUrl: ctx.sourceUrl,
      targetUrl: ctx.targetUrl,
      sameOrigin: ctx.sameOrigin,
      recentUserGesture: ctx.recentUserGesture,
      decision
    });

    if (decision.action === 'allow') return {};

    const promptId = await approval.createPrompt({ ...ctx, decision, tabId: details.tabId, frameId: details.frameId }, settings);
    await logger.appendLog({ event: 'navigation_prompted', tabId: details.tabId, promptId, targetUrl: details.url, decision });
    return { cancel: true };
  }

  api.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.type !== 'main_frame') return {};
      return maybeGateNavigation(details, 'beforeRequest');
    },
    { urls: requestPatterns, types: ['main_frame'] },
    ['blocking']
  );

  api.webRequest.onBeforeRedirect.addListener(async (details) => {
    const key = `${details.tabId}:${details.requestId || details.url}`;
    redirectCounts.set(key, (redirectCounts.get(key) || 0) + 1);
    await logger.appendLog({ event: 'redirect_observed', phase: 'redirect', tabId: details.tabId, fromUrl: details.url, toUrl: details.redirectUrl });
  }, { urls: requestPatterns, types: ['main_frame'] });

  api.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
    const result = await maybeGateNavigation({
      tabId: details.tabId,
      frameId: details.sourceFrameId,
      url: details.url,
      type: 'main_frame',
      originUrl: details.sourceUrl,
      requestId: `createdTarget-${details.timeStamp}`
    }, 'createdNavigationTarget');

    if (result.cancel) {
      try {
        await api.tabs.remove(details.tabId);
      } catch (_) {}
    }
  });

  api.runtime.onMessage.addListener((message, sender) => {
    if (!message || !message.type) return;

    if (message.type === 'NAVGUARD_USER_GESTURE') {
      tabSignals.set(sender.tab.id, {
        ...(tabSignals.get(sender.tab.id) || {}),
        lastGestureTs: Date.now(),
        url: message.url || sender.tab.url || ''
      });
      return;
    }

    if (message.type === 'NAVGUARD_PAGE_HOOK') {
      const current = tabSignals.get(sender.tab.id) || {};
      tabSignals.set(sender.tab.id, {
        ...current,
        lastHook: message.eventType,
        lastHookTs: Date.now(),
        url: message.url || sender.tab.url || ''
      });
      storage.getSettings().then((settings) => {
        if (settings.logContentEvents) {
          logger.appendLog({ event: 'page_hook', tabId: sender.tab.id, url: message.url, hookType: message.eventType, detail: message.detail });
        }
      });
      return;
    }

    if (message.type === 'NAVGUARD_GET_SETTINGS') {
      return storage.getSettings();
    }

    if (message.type === 'NAVGUARD_SAVE_SETTINGS') {
      return storage.saveSettings(message.payload || {});
    }

    if (message.type === 'NAVGUARD_GET_LOGS') {
      return storage.getLogs();
    }

    if (message.type === 'NAVGUARD_CLEAR_LOGS') {
      return logger.clearLogs();
    }

    if (message.type === 'NAVGUARD_EXPORT_LOGS') {
      return logger.exportLogs();
    }

    if (message.type === 'NAVGUARD_GET_PROMPT') {
      return approval.getPrompt(message.id);
    }

    if (message.type === 'NAVGUARD_RESOLVE_PROMPT') {
      return approval.resolvePrompt(message.id).then(async (item) => {
        if (!item) return { ok: false, reason: 'missing_prompt' };
        const settings = await storage.getSettings();
        const { action } = message;
        const context = item.context;

        if (action === 'continue_once') {
          oneTimeAllows.set(getAllowKey(context.tabId, context.targetUrl), Date.now() + settings.oneTimeAllowTtlMs);
          await api.tabs.update(context.tabId, { url: context.targetUrl });
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, tabId: context.tabId, targetUrl: context.targetUrl });
          return { ok: true };
        }

        if (action === 'always_allow_origin') {
          const origin = policy.parseOrigin(context.targetUrl);
          const next = await storage.saveSettings({ allowlist: [...new Set([...(settings.allowlist || []), origin])] });
          oneTimeAllows.set(getAllowKey(context.tabId, context.targetUrl), Date.now() + settings.oneTimeAllowTtlMs);
          await api.tabs.update(context.tabId, { url: context.targetUrl });
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, origin, tabId: context.tabId, targetUrl: context.targetUrl });
          return { ok: true, settings: next };
        }

        if (action === 'always_block_origin') {
          const origin = policy.parseOrigin(context.targetUrl);
          const next = await storage.saveSettings({ blocklist: [...new Set([...(settings.blocklist || []), origin])] });
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, origin, tabId: context.tabId, targetUrl: context.targetUrl });
          return { ok: true, settings: next };
        }

        await logger.appendLog({ event: 'prompt_resolved', resolution: 'cancel_stay', tabId: context.tabId, targetUrl: context.targetUrl });
        return { ok: true };
      });
    }
  });

  api.tabs.onRemoved.addListener((tabId) => {
    tabSignals.delete(tabId);
    for (const key of oneTimeAllows.keys()) {
      if (key.startsWith(`${tabId}|`)) oneTimeAllows.delete(key);
    }
  });

  setInterval(() => {
    approval.cleanupExpiredPrompts();
    for (const [key, expiresAt] of oneTimeAllows.entries()) {
      if (expiresAt <= Date.now()) oneTimeAllows.delete(key);
    }
  }, 15000);
})();
