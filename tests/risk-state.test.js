const test = require('node:test');
const assert = require('node:assert/strict');
const risk = require('../src/background/risk-state.js');

const settings = {
  suspiciousWindowMs: 10000,
  maxSuspiciousPromptsPerOriginWindow: 2,
  temporaryBlockMs: 30000
};

test('suspicious attempts escalate to temporary block after threshold', () => {
  const now = 1000;
  let state = risk.normalizeAttemptState(null, now, settings.suspiciousWindowMs);

  state = risk.registerSuspiciousAttempt(state, now + 1, settings).state;
  let update = risk.registerSuspiciousAttempt(state, now + 2, settings);
  assert.equal(update.escalatedToTempBlock, false);

  update = risk.registerSuspiciousAttempt(update.state, now + 3, settings);
  assert.equal(update.escalatedToTempBlock, true);
  assert.equal(risk.isTemporarilyBlocked(update.state, now + 4), true);
});

test('prompt suppression uses cooldown', () => {
  const now = 1000;
  const base = risk.normalizeAttemptState(null, now, settings.suspiciousWindowMs);
  const withPrompt = risk.markPromptShown(base, now, 'p1');
  assert.equal(risk.shouldSuppressPrompt(withPrompt, now + 500, 1000), true);
  assert.equal(risk.shouldSuppressPrompt(withPrompt, now + 1200, 1000), false);
});
