(function () {
  const storage = self.NavGuardStorage;

  let pendingEntries = [];
  let flushTimer = null;
  let flushingPromise = null;

  async function flushPending() {
    if (flushingPromise) {
      return flushingPromise;
    }

    flushingPromise = (async () => {
      if (!pendingEntries.length) return;
      const entries = pendingEntries;
      pendingEntries = [];

      const settings = await storage.getSettings();
      const logs = await storage.getLogs();
      const merged = logs.concat(entries);
      const capped = merged.slice(-Math.max(50, settings.logCap || 800));
      await storage.saveLogs(capped);
    })();

    try {
      await flushingPromise;
    } finally {
      flushingPromise = null;
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flushPending();
    }, 250);
  }

  async function appendLog(entry) {
    const normalized = {
      ts: new Date().toISOString(),
      ...entry
    };
    pendingEntries.push(normalized);
    scheduleFlush();
    return normalized;
  }

  async function clearLogs() {
    pendingEntries = [];
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await storage.saveLogs([]);
  }

  async function exportLogs() {
    await flushPending();
    return storage.getLogs();
  }

  async function getLogs() {
    await flushPending();
    return storage.getLogs();
  }

  self.NavGuardLogger = { appendLog, clearLogs, exportLogs, getLogs, flushPending };
})();
