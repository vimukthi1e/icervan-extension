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
