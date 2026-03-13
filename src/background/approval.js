(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const storage = self.NavGuardStorage;

  async function createPrompt(context, settings) {
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const promptUrl = api.runtime.getURL(`src/ui/prompt.html?id=${encodeURIComponent(id)}`);
    const promptTab = await api.tabs.create({ url: promptUrl, active: true });

    const pending = await storage.getPendingPrompts();
    pending[id] = {
      id,
      createdAt: Date.now(),
      expiresAt: Date.now() + settings.pendingPromptTtlMs,
      promptTabId: typeof promptTab.id === 'number' ? promptTab.id : null,
      context
    };
    await storage.savePendingPrompts(pending);

    return { id, promptTabId: promptTab.id };
  }

  async function getPrompt(id) {
    const pending = await storage.getPendingPrompts();
    const item = pending[id];
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      if (typeof item.promptTabId === 'number') {
        try {
          await api.tabs.remove(item.promptTabId);
        } catch (_) {}
      }
      delete pending[id];
      await storage.savePendingPrompts(pending);
      return null;
    }
    return item;
  }

  async function resolvePrompt(id) {
    const pending = await storage.getPendingPrompts();
    const item = pending[id] || null;
    if (item) {
      delete pending[id];
      await storage.savePendingPrompts(pending);
    }
    return item;
  }

  async function cleanupExpiredPrompts() {
    const pending = await storage.getPendingPrompts();
    const now = Date.now();
    let changed = false;

    for (const [id, item] of Object.entries(pending)) {
      if (!item || item.expiresAt >= now) continue;
      if (typeof item.promptTabId === 'number') {
        try {
          await api.tabs.remove(item.promptTabId);
        } catch (_) {}
      }
      delete pending[id];
      changed = true;
    }

    if (changed) await storage.savePendingPrompts(pending);
  }

  self.NavGuardApproval = { createPrompt, getPrompt, resolvePrompt, cleanupExpiredPrompts };
})();
