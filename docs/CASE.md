# Case description

Main problem:
On Android browsers, some sites auto-load another page or another site without clear user permission.
Sometimes after going back, the previous page appears missing or replaced.
Typical ad blockers and Tampermonkey scripts have not been reliable.

Important observations:
- The bad behavior seems mainly on Android/mobile flow.
- Desktop behavior may be different or cleaner.
- Manual clicks on normal links can be caught by userscripts, but automatic redirects often are not caught.
- The goal is NOT simple site blocking that still allows a blocked page to load and pollute history.
- The goal is to stop or gate unwanted navigation BEFORE it fully takes over, as much as browser APIs allow.

Desired behavior:
- If any top-level navigation is not clearly user-approved, the extension should stop it or require explicit approval.
- Preserve the current page whenever possible.
- Avoid “blocked page then back button broken” behavior where possible.
- Log everything useful locally for later analysis.

Target:
- Primary: Iceraven / Firefox Android style environment
- Secondary: Firefox desktop compatibility if practical

Non-goals:
- No remote backend
- No cloud logging
- No DNS filtering
- No OS-level VPN product
