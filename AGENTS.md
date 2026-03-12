# AGENTS.md

## Project goal
Build a Firefox-first browser extension, primarily targeting Iceraven / Firefox Android compatibility, to stop unwanted page loads, redirects, popup-style navigations, history pollution, and hidden navigation tricks as much as browser APIs allow.

## Working style
- Plan first, then implement.
- Prefer robust architecture over quick hacks.
- Keep permissions as minimal as possible.
- Privacy-first: all logs must stay local unless explicitly exported by the user.
- Do not add remote telemetry.
- Explain limitations clearly.

## Deliverables
- Working extension source
- Clear README
- Options page / settings UI
- Exportable logs
- Test plan
- Known limitations list
- Packaging instructions

## Engineering rules
- Favor maintainable code, low-bug design, and defensive handling.
- Avoid fragile prompt-dependent behavior.
- If a better architecture than the requested one exists, document it and use it.
- Add comments only where they improve maintainability.
- Keep modules small and well named.
- Use a rules engine / policy layer instead of hardcoding everything in one file.

## Validation
Before calling the task done:
- run lint if available
- run tests if available
- manually verify main flows
- confirm no unnecessary permissions were added
- confirm logs export correctly
- confirm blocked navigations do not silently corrupt the previous-page experience more than necessary
