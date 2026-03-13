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
  assert.equal(risk.shouldSuppressPrompt(withPrompt, now + 500, 1000, 2), false);

  const escalated = { ...withPrompt, count: 2 };
  assert.equal(risk.shouldSuppressPrompt(escalated, now + 500, 1000, 2), true);
  assert.equal(risk.shouldSuppressPrompt(escalated, now + 1200, 1000, 2), false);
});

test('prompt key includes tab, source origin, and destination origin', () => {
  const key = risk.buildPromptKey(4, 'https://dest.example/path?a=1', 'https://source.example/page');
  assert.equal(key, '4|https://source.example->https://dest.example');
});


test('clearStateForAllow resets count and temporary block', () => {
  const state = {
    count: 5,
    windowStartedAt: 100,
    lastPromptAt: 200,
    tempBlockUntil: 99999,
    lastPromptId: 'p1'
  };

  const cleared = risk.clearStateForAllow(state, 500);
  assert.equal(cleared.count, 0);
  assert.equal(cleared.tempBlockUntil, 0);
  assert.equal(cleared.windowStartedAt, 500);
  assert.equal(cleared.lastPromptId, 'p1');
});
