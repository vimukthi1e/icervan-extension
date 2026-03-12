(function () {
  const storage = self.NavGuardStorage;

  async function appendLog(entry) {
    const settings = await storage.getSettings();
    const logs = await storage.getLogs();
    const normalized = {
      ts: new Date().toISOString(),
      ...entry
    };
    logs.push(normalized);
    const capped = logs.slice(-Math.max(50, settings.logCap || 800));
    await storage.saveLogs(capped);
    return normalized;
  }

  async function clearLogs() {
    await storage.saveLogs([]);
  }

  async function exportLogs() {
    return storage.getLogs();
  }

  self.NavGuardLogger = { appendLog, clearLogs, exportLogs };
})();
