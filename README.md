# Iceraven Navigation Guard (Firefox-first WebExtension)

A privacy-first, local-only browser extension designed for Firefox/Iceraven-style environments to reduce unwanted top-level navigations, redirect takeovers, popup navigations, and history pollution as far as available browser APIs allow.

## Status
MVP + hardening pass implemented.

## Core capabilities
- Three protection modes:
  - **Smart (default)**: allow likely user-driven navigations, gate suspicious ones.
  - **Strict**: prompt before suspicious/uncertain top-level navigations.
  - **Monitor-only**: no blocking, only logging.
- Multi-signal policy engine (not single heuristic).
- Early interception via cancellable `webRequest` main-frame handling.
- Popup/new-tab target monitoring via `webNavigation`.
- Page-world instrumentation for:
  - `window.open`
  - `location.assign`, `location.replace`
  - `history.pushState`, `history.replaceState`
  - `popstate`, `hashchange`
- Approval workflow actions:
  - Continue once
  - Always allow this origin
  - Always block this origin
  - Cancel / stay here
- Local structured logs with ring-buffer cap, viewer, JSON export, and clear.

## Why this architecture (vs userscripts)
Userscripts are too late for many takeover paths. This extension uses privileged request interception in background context to cancel suspicious main-frame requests before full page takeover where possible, then offers user approval to continue intentionally.

## Permissions and rationale
- `webRequest`, `webRequestBlocking`: cancel suspicious top-level requests before load.
- `webNavigation`: detect new navigation targets/popups and lifecycle hints.
- `tabs`: controlled continuation to approved destination.
- `storage`: local settings + logs.
- `http://*/*`, `https://*/*`: explicit host patterns required so content scripts and `webRequest` filters reliably match web pages on Firefox/Iceraven.

No telemetry, no remote services, no analytics SDK, no external CDN.

## Project structure
- `manifest.json`
- `src/background/`
  - `background.js` orchestration and listeners
  - `policy.js` scoring/classification engine
  - `storage.js` local persistence helpers
  - `logger.js` structured log ring-buffer
  - `approval.js` prompt lifecycle management
  - `defaults.js` defaults and storage keys
- `src/content/`
  - `content.js` user gesture and page hook relay
  - `inpage-hook.js` page-world instrumentation
- `src/ui/`
  - `popup.html/js`
  - `options.html/js`
  - `logs.html/js`
  - `prompt.html/js`
- `tests/policy.test.js`
- `docs/ARCHITECTURE.md`

## Install (temporary, Firefox desktop)
1. Open `about:debugging`.
2. Choose “This Firefox”.
3. Load Temporary Add-on.
4. Select `manifest.json` from this repository.

For Iceraven/Firefox Android-style setups, use the browser’s extension sideload/custom collection flow as applicable.

## Usage
1. Open extension options.
2. Choose mode (`smart`, `strict`, `monitor`).
3. Optionally edit allowlist/blocklist (one entry per line).
4. Browse normally.
5. On suspicious navigation, prompt page appears with decision actions.
6. Review logs in `Logs` viewer, export JSON when needed.

## Manual QA checklist
- [ ] Smart mode allows normal same-origin click navigation.
- [ ] Smart mode prompts on script-style cross-origin redirect with no recent gesture.
- [ ] Strict mode prompts consistently for top-level attempts.
- [ ] Monitor mode never blocks, still logs.
- [ ] “Always allow origin” appends to allowlist and allows future matching.
- [ ] “Always block origin” appends to blocklist and blocks future matching.
- [ ] Export logs produces JSON download.
- [ ] Clear logs empties viewer.
- [ ] No remote requests initiated by extension itself.

## Known limitations
- Some navigation behavior on Firefox Android variants cannot always be preempted before visible effects, especially non-HTTP(S) schemes and browser-internal pages that extensions cannot inject into.
- Browser event timing differs by platform/version; prompt timing may vary.
- History preservation is best-effort: cancellation before takeover helps, but browser session-history internals still control some outcomes.
- Gesture attribution is heuristic and can produce false positives/negatives.

## Packaging
1. Ensure all files are present and tests pass.
2. Zip the extension root content (`manifest.json`, `src/`, `docs/`, etc.).
3. Sign/package per Firefox distribution requirements if publishing.

## Security & privacy notes
- All data remains in local extension storage unless user exports logs.
- Export is explicit user action only.
- Debug/log verbosity is configurable to limit retained data.
