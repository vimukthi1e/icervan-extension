(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const storage = self.NavGuardStorage;
  const logger = self.NavGuardLogger;
  const policy = self.NavGuardPolicy;
  const approval = self.NavGuardApproval;
  const requestPatterns = self.NavGuardDefaults.REQUEST_MATCH_PATTERNS;

  const frameSignals = new Map();
  const oneTimeAllows = new Map();
  const redirectCounts = new Map();
  const activePromptKeys = new Map();
  const promptIdToKey = new Map();

  function getAllowKey(tabId, targetUrl) {
    return `${tabId}|${targetUrl}`;
  }

  function getFrameSignalKey(tabId, frameId) {
    return `${tabId}:${frameId}`;
  }

  function getPromptKey(tabId, targetUrl) {
    const origin = policy.parseOrigin(targetUrl) || String(targetUrl || '');
    return `${tabId}|${origin}`;
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

  function getRecentGesture(tabId, frameId, windowMs) {
    const frameSignal = frameSignals.get(getFrameSignalKey(tabId, frameId));
    if (!frameSignal) return false;
    return Date.now() - frameSignal.lastGestureTs <= windowMs;
  }

  function getHookSignal(tabId, frameId) {
    const frameSignal = frameSignals.get(getFrameSignalKey(tabId, frameId));
    return frameSignal?.lastHook || '';
  }

  function getSignalUrl(tabId, frameId) {
    const frameSignal = frameSignals.get(getFrameSignalKey(tabId, frameId));
    return frameSignal?.url || '';
  }

  function getRedirectCount(tabId, requestId, url) {
    const key = `${tabId}:${requestId || url}`;
    return redirectCounts.get(key)?.count || 0;
  }

  function setRedirectCount(tabId, requestId, url, count) {
    const key = `${tabId}:${requestId || url}`;
    redirectCounts.set(key, { count, updatedAt: Date.now() });
  }

  function clearPromptKey(promptId) {
    const promptKey = promptIdToKey.get(promptId);
    if (!promptKey) return;
    promptIdToKey.delete(promptId);
    const active = activePromptKeys.get(promptKey);
    if (active && active.promptId === promptId) {
      activePromptKeys.delete(promptKey);
    }
  }

  async function classifyRequest(details, requestType) {
    const settings = await storage.getSettings();
    const sourceFrameId = requestType === 'createdNavigationTarget'
      ? (typeof details.frameId === 'number' ? details.frameId : 0)
      : 0;

    const sourceUrl = details.originUrl
      || details.documentUrl
      || getSignalUrl(details.tabId, sourceFrameId)
      || getSignalUrl(details.tabId, 0)
      || '';

    const sameOrigin = policy.parseOrigin(sourceUrl) && policy.parseOrigin(sourceUrl) === policy.parseOrigin(details.url);

    const ctx = {
      mode: settings.mode,
      targetUrl: details.url,
      sourceUrl,
      isMainFrame: details.type === 'main_frame' || requestType === 'createdNavigationTarget',
      sameOrigin,
      recentUserGesture: getRecentGesture(details.tabId, sourceFrameId, settings.gestureWindowMs),
      requestType,
      redirectCount: getRedirectCount(details.tabId, details.requestId, details.url),
      hookSignal: getHookSignal(details.tabId, sourceFrameId)
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

    if (decision.action === 'block') {
      await logger.appendLog({
        event: 'navigation_blocked',
        phase: 'request',
        tabId: details.tabId,
        frameId: details.frameId,
        targetUrl: details.url,
        decision
      });
      return { cancel: true };
    }

    if (decision.action !== 'prompt') {
      return {};
    }

    const promptKey = getPromptKey(details.tabId, details.url);
    const existingPrompt = activePromptKeys.get(promptKey);
    if (existingPrompt && existingPrompt.expiresAt > Date.now()) {
      if (typeof existingPrompt.promptTabId === 'number') {
        try {
          api.tabs.update(existingPrompt.promptTabId, { active: true });
        } catch (_) {}
      }
      await logger.appendLog({ event: 'navigation_prompt_deduped', tabId: details.tabId, targetUrl: details.url, promptId: existingPrompt.promptId });
      return { cancel: true };
    }

    const created = await approval.createPrompt({ ...ctx, decision, tabId: details.tabId, frameId: details.frameId }, settings);
    activePromptKeys.set(promptKey, {
      promptId: created.id,
      promptTabId: created.promptTabId,
      expiresAt: Date.now() + settings.pendingPromptTtlMs
    });
    promptIdToKey.set(created.id, promptKey);

    await logger.appendLog({ event: 'navigation_prompted', tabId: details.tabId, promptId: created.id, targetUrl: details.url, decision });
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
    const nextCount = getRedirectCount(details.tabId, details.requestId, details.url) + 1;
    setRedirectCount(details.tabId, details.requestId, details.url, nextCount);
    await logger.appendLog({ event: 'redirect_observed', phase: 'redirect', tabId: details.tabId, fromUrl: details.url, toUrl: details.redirectUrl, redirectCount: nextCount });
  }, { urls: requestPatterns, types: ['main_frame'] });

  api.webRequest.onCompleted.addListener((details) => {
    const key = `${details.tabId}:${details.requestId || details.url}`;
    redirectCounts.delete(key);
  }, { urls: requestPatterns, types: ['main_frame'] });

  api.webRequest.onErrorOccurred.addListener((details) => {
    const key = `${details.tabId}:${details.requestId || details.url}`;
    redirectCounts.delete(key);
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
      if (!sender || !sender.tab) return;
      const frameId = typeof sender.frameId === 'number' ? sender.frameId : 0;
      const signalKey = getFrameSignalKey(sender.tab.id, frameId);
      frameSignals.set(signalKey, {
        ...(frameSignals.get(signalKey) || {}),
        lastGestureTs: Date.now(),
        url: message.url || sender.tab.url || ''
      });
      return;
    }

    if (message.type === 'NAVGUARD_PAGE_HOOK') {
      if (!sender || !sender.tab) return;
      const frameId = typeof sender.frameId === 'number' ? sender.frameId : 0;
      const signalKey = getFrameSignalKey(sender.tab.id, frameId);
      const current = frameSignals.get(signalKey) || {};
      frameSignals.set(signalKey, {
        ...current,
        lastHook: message.eventType,
        lastHookTs: Date.now(),
        url: message.url || sender.tab.url || ''
      });
      storage.getSettings().then((settings) => {
        if (settings.logContentEvents) {
          logger.appendLog({
            event: 'page_hook',
            tabId: sender.tab.id,
            frameId,
            url: message.url,
            hookType: message.eventType,
            detail: message.detail
          });
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
      return logger.getLogs();
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
      const promptTabId = sender && sender.tab ? sender.tab.id : null;
      return approval.resolvePrompt(message.id).then(async (item) => {
        clearPromptKey(message.id);
        if (!item) return { ok: false, reason: 'missing_prompt' };

        const settings = await storage.getSettings();
        const { action } = message;
        const context = item.context;

        if (action === 'continue_once') {
          oneTimeAllows.set(getAllowKey(context.tabId, context.targetUrl), Date.now() + settings.oneTimeAllowTtlMs);
          await api.tabs.update(context.tabId, { url: context.targetUrl, active: true });
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, tabId: context.tabId, targetUrl: context.targetUrl });
          if (typeof promptTabId === 'number') {
            try {
              await api.tabs.remove(promptTabId);
            } catch (_) {}
          }
          return { ok: true };
        }

        if (action === 'always_allow_origin') {
          const origin = policy.parseOrigin(context.targetUrl);
          const next = await storage.saveSettings({ allowlist: [...new Set([...(settings.allowlist || []), origin])] });
          oneTimeAllows.set(getAllowKey(context.tabId, context.targetUrl), Date.now() + settings.oneTimeAllowTtlMs);
          await api.tabs.update(context.tabId, { url: context.targetUrl, active: true });
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, origin, tabId: context.tabId, targetUrl: context.targetUrl });
          if (typeof promptTabId === 'number') {
            try {
              await api.tabs.remove(promptTabId);
            } catch (_) {}
          }
          return { ok: true, settings: next };
        }

        if (action === 'always_block_origin') {
          const origin = policy.parseOrigin(context.targetUrl);
          const next = await storage.saveSettings({ blocklist: [...new Set([...(settings.blocklist || []), origin])] });
          try {
            await api.tabs.update(context.tabId, { active: true });
          } catch (_) {}
          await logger.appendLog({ event: 'prompt_resolved', resolution: action, origin, tabId: context.tabId, targetUrl: context.targetUrl });
          if (typeof promptTabId === 'number') {
            try {
              await api.tabs.remove(promptTabId);
            } catch (_) {}
          }
          return { ok: true, settings: next };
        }

        try {
          await api.tabs.update(context.tabId, { active: true });
        } catch (_) {}
        await logger.appendLog({ event: 'prompt_resolved', resolution: 'cancel_stay', tabId: context.tabId, targetUrl: context.targetUrl });
        if (typeof promptTabId === 'number') {
          try {
            await api.tabs.remove(promptTabId);
          } catch (_) {}
        }
        return { ok: true };
      });
    }
  });

  api.tabs.onRemoved.addListener((tabId) => {
    for (const key of frameSignals.keys()) {
      if (key.startsWith(`${tabId}:`)) frameSignals.delete(key);
    }

    for (const key of oneTimeAllows.keys()) {
      if (key.startsWith(`${tabId}|`)) oneTimeAllows.delete(key);
    }

    for (const [promptKey, value] of activePromptKeys.entries()) {
      if (promptKey.startsWith(`${tabId}|`) || value.promptTabId === tabId) {
        activePromptKeys.delete(promptKey);
        promptIdToKey.delete(value.promptId);
      }
    }
  });

  setInterval(() => {
    approval.cleanupExpiredPrompts();

    for (const [key, expiresAt] of oneTimeAllows.entries()) {
      if (expiresAt <= Date.now()) oneTimeAllows.delete(key);
    }

    for (const [promptKey, active] of activePromptKeys.entries()) {
      if (!active || active.expiresAt <= Date.now()) {
        activePromptKeys.delete(promptKey);
        if (active?.promptId) promptIdToKey.delete(active.promptId);
      }
    }

    const redirectMaxAgeMs = 5 * 60 * 1000;
    for (const [key, value] of redirectCounts.entries()) {
      if (!value || Date.now() - value.updatedAt > redirectMaxAgeMs) {
        redirectCounts.delete(key);
      }
    }
  }, 15000);
})();
