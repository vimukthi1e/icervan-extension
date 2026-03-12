const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const defaultsPath = path.join(__dirname, '..', 'src', 'background', 'defaults.js');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const defaultsSource = fs.readFileSync(defaultsPath, 'utf8');

const EXPECTED_MATCH_PATTERNS = ['http://*/*', 'https://*/*'];

function hasEmptyPatterns(patterns) {
  return (patterns || []).some((p) => typeof p !== 'string' || p.trim() === '');
}

test('manifest declares firefox mv2', () => {
  assert.equal(manifest.manifest_version, 2);
});

test('manifest permissions include explicit host patterns for interception', () => {
  const hostPerms = (manifest.permissions || []).filter((p) => p.includes('://'));
  assert.deepEqual(hostPerms.sort(), EXPECTED_MATCH_PATTERNS.slice().sort());
  assert.equal(hasEmptyPatterns(hostPerms), false);
});

test('content script match patterns are explicit and non-empty', () => {
  assert.ok(Array.isArray(manifest.content_scripts));
  assert.ok(manifest.content_scripts.length > 0);
  const matches = manifest.content_scripts[0].matches;
  assert.deepEqual(matches.sort(), EXPECTED_MATCH_PATTERNS.slice().sort());
  assert.equal(hasEmptyPatterns(matches), false);
});

test('background defaults keep request filter patterns aligned with manifest scope', () => {
  for (const pattern of EXPECTED_MATCH_PATTERNS) {
    assert.ok(defaultsSource.includes(`'${pattern}'`));
  }
});


test('background includes risk-state module before orchestrator', () => {
  const scripts = manifest.background && manifest.background.scripts ? manifest.background.scripts : [];
  const riskIdx = scripts.indexOf('src/background/risk-state.js');
  const bgIdx = scripts.indexOf('src/background/background.js');
  assert.ok(riskIdx >= 0);
  assert.ok(bgIdx >= 0);
  assert.ok(riskIdx < bgIdx);
});
