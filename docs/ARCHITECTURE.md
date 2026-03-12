# 1. ENGINEERING BRIEF

## Threat model
This extension targets abusive or deceptive top-level navigation patterns that can take over browsing context without clear user intent: auto-redirects, script-triggered cross-origin jumps, popup/new-tab takeovers, and history manipulation that harms back-button recovery.

## Unwanted navigation classes
- Server-side redirects (`30x`) and JavaScript-driven redirects (`location.assign/replace`, `window.open`).
- Cross-origin top-level jumps shortly after load with no trusted user gesture.
- Popup/new-tab creation from scripts or deceptive overlays.
- Session-history manipulation (`pushState`/`replaceState`) that obscures prior page return path.

## What can be intercepted vs observed
- **Interception-capable**: `webRequest.onBeforeRequest` (main-frame), `webNavigation.onCreatedNavigationTarget`, and tab-level update control. These allow pre-load cancellation in many cases.
- **Observation-only or late signals**: page history API calls, hash/popstate behavior, DOM-level deception patterns, and some navigation intents that do not map to a cancellable request in time.

## API requirements
- `webRequest` + `webRequestBlocking` for cancellable top-level request gating.
- `webNavigation` for new navigation target signals and lifecycle context.
- `tabs` for controlled continuation after approval.
- `storage` for settings, lists, and capped local logs.
- content script + page-world bridge for script navigation intent telemetry.

## Platform limitations (Firefox / Android / Iceraven style)
- Some mobile builds expose reduced/variant event timing; not every navigation path offers deterministic preemption.
- User-gesture metadata is not fully authoritative in background request events.
- Cancel-and-prompt flows can still have edge race conditions around tab creation/closure.
- Extension UX surface differs on mobile; prompting is implemented as an extension tab for broad compatibility.

## Why Tampermonkey/userscripts were insufficient
Userscripts operate in page scope after document lifecycle has started and cannot reliably block network-layer top-level requests before takeover. They also lack privileged webRequest interception and robust tab-level gating control.

# 2. ARCHITECTURE OPTIONS

## Option A: Content-script heavy
- Strong page insight (hooks, DOM events).
- Weak preemptive blocking; too late for many server/network redirects.
- High evasion risk.

## Option B: Background interception-centric
- Strong early blocking through `webRequest`.
- Weaker understanding of page intent and user gesture semantics.
- Better at history pollution prevention than userscript approach.

## Option C: Hybrid multi-layer (chosen)
- Background: authoritative gate for cancellable top-level navigation.
- Content/page bridge: high-value intent signals to improve classification.
- Policy layer: separable scoring engine for maintainable evolution.
- Local forensic logging + explicit approval workflow.

Tradeoff: added complexity, but materially better prevention + diagnosis while staying local/private.

# 3. CHOSEN DESIGN

Chosen design is a hybrid policy-driven engine:
- **Interception layer**: `onBeforeRequest` for main-frame gating + popup target handling.
- **Policy layer**: score/classify via signals (same-origin, gesture recency, redirect chain, hook type, mode).
- **Approval layer**: prompt tab with actions (continue once / always allow origin / always block origin / cancel).
- **Observability layer**: capped local logs with export/clear.
- **UX layer**: options page, popup shortcuts, logs viewer.

History-pollution strategy: cancel suspicious requests before load when possible, then re-initiate only after explicit approval.

# 4. IMPLEMENTATION PLAN

## MVP
- MV2 manifest for Firefox-centric compatibility.
- Main-frame request gating + strict/smart/monitor modes.
- Prompt workflow and one-time allow handling.

## Hardening pass
- Redirect chain memory, prompt expiry, allow token expiry.
- Defensive null handling and tab cleanup.

## Observability/logging pass
- Structured local ring buffer logs.
- Log viewer + JSON export + clear action.

## UX/settings pass
- Options for mode, allow/block lists, logging detail, log cap, medium-risk prompting.

## Tests/docs/package pass
- Unit tests for policy scoring/classification.
- README architecture, limitations, permissions, packaging, QA checklist.

# 5. FILE TREE

- `manifest.json`
- `src/background/*` (policy, storage, logger, approval, background wiring)
- `src/content/*` (content collector + page hook bridge)
- `src/ui/*` (popup, options, logs, prompt)
- `tests/policy.test.js`
- `docs/ARCHITECTURE.md`

# 6. CODE IMPLEMENTATION

Implementation resides in the files above with a modular split:
- policy pure function module (testable)
- browser API plumbing in background coordinator
- isolated UI pages for config/logs/prompt actions

# 7. TEST STRATEGY

- Unit test policy scoring and mode behavior.
- Smoke-check extension packaging (`manifest.json` validity, file presence).
- Manual QA checklist (see README).

# 8. LIMITATIONS

- Not all navigation vectors are cancellable in all Firefox Android builds.
- Gesture inference is probabilistic; false positives/negatives can occur.
- Prompt-as-tab UX is less seamless than native modal gating.
- Some history edge-cases remain browser-controlled.

# 9. README / USAGE

See root `README.md` for installation, settings, permissions rationale, and operational workflow.

# 10. NEXT IMPROVEMENTS

- Optional heuristic packs for known abusive redirect domains.
- Per-site policy profiles and temporary session rules.
- Enhanced chain correlation across request lifecycle events.
- Local anonymized “decision explainability” panel.
