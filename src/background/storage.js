(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const { DEFAULT_SETTINGS, STORAGE_KEYS } = self.NavGuardDefaults;

  async function getSettings() {
    const data = await api.storage.local.get(STORAGE_KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.settings] || {}) };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = { ...current, ...partial };
    await api.storage.local.set({ [STORAGE_KEYS.settings]: next });
    return next;
  }

  async function getLogs() {
    const data = await api.storage.local.get(STORAGE_KEYS.logs);
    return data[STORAGE_KEYS.logs] || [];
  }

  async function saveLogs(logs) {
    await api.storage.local.set({ [STORAGE_KEYS.logs]: logs });
  }

  async function getPendingPrompts() {
    const data = await api.storage.local.get(STORAGE_KEYS.pendingPrompts);
    return data[STORAGE_KEYS.pendingPrompts] || {};
  }

  async function savePendingPrompts(pending) {
    await api.storage.local.set({ [STORAGE_KEYS.pendingPrompts]: pending });
  }

  self.NavGuardStorage = {
    getSettings,
    saveSettings,
    getLogs,
    saveLogs,
    getPendingPrompts,
    savePendingPrompts
  };
})();
