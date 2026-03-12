# Iceraven Extension

A Firefox-style browser extension project focused on reducing unwanted redirects, auto navigations, popup-style page takeovers, and history pollution as much as browser APIs allow.

## Main goal

This project aims to help prevent or control cases where a website:

- opens another page without clear user approval
- redirects to another site automatically
- causes back-button problems
- makes the previous page seem missing or replaced
- uses scripts or navigation tricks that are difficult to stop with normal userscripts

## Target

Primary target:

- Iceraven
- Firefox-style Android environment

Secondary target:

- Firefox desktop, where practical

## Key idea

This project should not rely mainly on Tampermonkey or simple userscripts.

Instead, it should use a stronger browser-extension architecture with:

- navigation interception where possible
- suspicious navigation detection
- approval / allow / block controls
- local-only logging for later analysis
- minimal permissions
- privacy-first design

## Non-goals

This project does not aim to provide:

- a remote backend
- cloud logging
- analytics or telemetry
- DNS-level blocking
- a VPN product

## Privacy

All logs and data should stay local unless the user explicitly exports them.

## Status

Early planning / architecture stage.
