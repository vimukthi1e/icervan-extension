const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateNavigation } = require('../src/background/policy.js');

const baseSettings = {
  allowlist: [],
  blocklist: [],
  promptOnMediumRisk: true
};

test('blocklist overrides and blocks', () => {
  const out = evaluateNavigation({ targetUrl: 'https://evil.example/x', mode: 'smart', isMainFrame: true }, {
    ...baseSettings,
    blocklist: ['https://evil.example']
  });
  assert.equal(out.action, 'block');
  assert.equal(out.classification, 'blocked_list');
});

test('allowlist overrides and allows', () => {
  const out = evaluateNavigation({ targetUrl: 'https://ok.example/x', mode: 'smart', isMainFrame: true }, {
    ...baseSettings,
    allowlist: ['https://ok.example']
  });
  assert.equal(out.action, 'allow');
});

test('strict mode prompts regardless of low-risk signals', () => {
  const out = evaluateNavigation({
    targetUrl: 'https://site.example/path',
    sourceUrl: 'https://site.example',
    sameOrigin: true,
    recentUserGesture: true,
    isMainFrame: true,
    mode: 'strict'
  }, baseSettings);
  assert.equal(out.action, 'prompt');
});

test('high-risk smart path prompts', () => {
  const out = evaluateNavigation({
    targetUrl: 'https://cross.example/a',
    sourceUrl: 'https://src.example',
    sameOrigin: false,
    recentUserGesture: false,
    isMainFrame: true,
    redirectCount: 3,
    hookSignal: 'location.replace',
    mode: 'smart'
  }, baseSettings);
  assert.equal(out.action, 'prompt');
  assert.equal(out.classification, 'high_risk');
});

test('medium risk can be configured to allow without prompt', () => {
  const out = evaluateNavigation({
    targetUrl: 'https://cross.example/a',
    sourceUrl: 'https://cross.example/home',
    sameOrigin: true,
    recentUserGesture: false,
    isMainFrame: true,
    requestType: 'createdNavigationTarget',
    redirectCount: 0,
    mode: 'smart'
  }, {
    ...baseSettings,
    promptOnMediumRisk: false
  });

  assert.equal(out.classification, 'low_risk');
  assert.equal(out.action, 'allow');
});

test('monitor mode always allows', () => {
  const out = evaluateNavigation({
    targetUrl: 'https://cross.example/a',
    sourceUrl: 'https://src.example',
    sameOrigin: false,
    recentUserGesture: false,
    isMainFrame: true,
    mode: 'monitor'
  }, baseSettings);
  assert.equal(out.action, 'allow');
});


test('same-document burst increases risk classification', () => {
  const out = evaluateNavigation({
    targetUrl: 'https://cross.example/a',
    sourceUrl: 'https://cross.example/home',
    sameOrigin: true,
    recentUserGesture: false,
    isMainFrame: true,
    mode: 'smart',
    recentSameDocumentSuspicious: true,
    historyBurstCount: 5,
    repeatedSuspiciousCount: 2
  }, {
    ...baseSettings,
    historyBurstThreshold: 4
  });

  assert.equal(out.action, 'prompt');
  assert.ok(out.reasons.includes('same_document_signal'));
  assert.ok(out.reasons.includes('history_burst'));
});
