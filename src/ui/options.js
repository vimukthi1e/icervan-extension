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
  }

  async function save() {
    const payload = {
      mode: document.getElementById('mode').value,
      allowlist: linesToList(document.getElementById('allowlist').value),
      blocklist: linesToList(document.getElementById('blocklist').value),
      logContentEvents: document.getElementById('logContentEvents').checked,
      promptOnMediumRisk: document.getElementById('promptOnMediumRisk').checked,
      debugMode: document.getElementById('debugMode').checked,
      logCap: Math.max(100, Number(document.getElementById('logCap').value || 800))
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
