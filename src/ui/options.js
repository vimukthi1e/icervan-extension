(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function linesToList(v) {
    return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function listToLines(v) {
    return (v || []).join('\n');
  }

  async function load() {
    const settings = await api.runtime.sendMessage({ type: 'NAVGUARD_GET_SETTINGS' });
    document.getElementById('mode').value = settings.mode;
    document.getElementById('allowlist').value = listToLines(settings.allowlist);
    document.getElementById('blocklist').value = listToLines(settings.blocklist);
    document.getElementById('logContentEvents').checked = !!settings.logContentEvents;
    document.getElementById('promptOnMediumRisk').checked = !!settings.promptOnMediumRisk;
    document.getElementById('debugMode').checked = !!settings.debugMode;
    document.getElementById('logCap').value = settings.logCap;
    document.getElementById('promptCooldownMs').value = settings.promptCooldownMs;
    document.getElementById('minPromptAttemptsBeforeSuppression').value = settings.minPromptAttemptsBeforeSuppression;
    document.getElementById('maxSuspiciousPromptsPerOriginWindow').value = settings.maxSuspiciousPromptsPerOriginWindow;
    document.getElementById('suspiciousWindowMs').value = settings.suspiciousWindowMs;
    document.getElementById('temporaryBlockMs').value = settings.temporaryBlockMs;
  }

  function numberInput(id, min, max, fallback) {
    const raw = Number(document.getElementById(id).value);
    const finite = Number.isFinite(raw) ? raw : fallback;
    const bounded = Math.min(max, Math.max(min, Math.floor(finite)));
    return bounded;
  }

  async function save() {
    const payload = {
      mode: document.getElementById('mode').value,
      allowlist: linesToList(document.getElementById('allowlist').value),
      blocklist: linesToList(document.getElementById('blocklist').value),
      logContentEvents: document.getElementById('logContentEvents').checked,
      promptOnMediumRisk: document.getElementById('promptOnMediumRisk').checked,
      debugMode: document.getElementById('debugMode').checked,
      logCap: numberInput('logCap', 100, 5000, 800),
      promptCooldownMs: numberInput('promptCooldownMs', 1000, 120000, 15000),
      minPromptAttemptsBeforeSuppression: numberInput('minPromptAttemptsBeforeSuppression', 1, 20, 2),
      maxSuspiciousPromptsPerOriginWindow: numberInput('maxSuspiciousPromptsPerOriginWindow', 1, 20, 2),
      suspiciousWindowMs: numberInput('suspiciousWindowMs', 5000, 300000, 45000),
      temporaryBlockMs: numberInput('temporaryBlockMs', 5000, 300000, 60000)
    };
    await api.runtime.sendMessage({ type: 'NAVGUARD_SAVE_SETTINGS', payload });
    document.getElementById('status').textContent = 'Saved.';
  }

  document.getElementById('save').addEventListener('click', save);
  document.getElementById('openLogs').addEventListener('click', () => {
    api.tabs.create({ url: api.runtime.getURL('src/ui/logs.html') });
  });
  load();
})();
