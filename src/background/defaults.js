(function () {
  const DEFAULT_SETTINGS = {
    mode: 'smart',
    allowlist: [],
    blocklist: [],
    logContentEvents: true,
    logCap: 800,
    promptOnMediumRisk: true,
    debugMode: false,
    gestureWindowMs: 2500,
    pendingPromptTtlMs: 120000,
    oneTimeAllowTtlMs: 15000,
    promptCooldownMs: 15000,
    suspiciousWindowMs: 45000,
    maxSuspiciousPromptsPerOriginWindow: 2,
    temporaryBlockMs: 60000,
    historyBurstWindowMs: 4000,
    historyBurstThreshold: 4
  };

  const REQUEST_MATCH_PATTERNS = ['http://*/*', 'https://*/*'];

  const STORAGE_KEYS = {
    settings: 'navGuard.settings',
    logs: 'navGuard.logs',
    pendingPrompts: 'navGuard.pendingPrompts'
  };

  self.NavGuardDefaults = { DEFAULT_SETTINGS, STORAGE_KEYS, REQUEST_MATCH_PATTERNS };
})();
