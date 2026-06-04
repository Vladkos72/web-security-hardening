# Chrome Extension (MV3) Hardening

Extensions ship their entire source to the user — `chrome://extensions` → "Inspect"
exposes everything. Treat all extension code as public. The threats that matter:
secrets baked into the extension, over-broad permissions, weak CSP, and unsafe
handling of page/message content.

## Secrets in extension code
- **No paid API key belongs in an extension.** Background service worker, content
  script, popup — all readable. The fix is the client → Worker proxy pattern in
  SKILL.md: route the call through a Cloudflare Worker that holds the key and
  authenticates the user. If the extension doesn't already talk to such a Worker,
  scaffold one from `assets/secure-worker-proxy.js` and rewrite the background
  worker's `fetch` to call it (sending a `PROXY_TOKEN`, not the upstream key).
  The Worker's `ALLOWED_ORIGIN` should be the extension's `chrome-extension://<id>`.
  (See also `secrets-and-billing.md` and `cloudflare-worker.md`.)
- OAuth: use `chrome.identity.launchWebAuthFlow` / `getAuthToken` so tokens are
  brokered, not embedded. The client secret must never be in the extension.

## Manifest permissions (least privilege)
- `host_permissions` / `matches`: `<all_urls>` or `*://*/*` is rarely justified.
  Narrow to the specific origins the extension actually needs. Broad host access
  is both a security risk and a Web Store review rejection.
- Drop unused permissions (`tabs`, `cookies`, `webRequest`, `scripting`,
  `storage`) — request only what the code uses. Audit by cross-referencing the
  manifest against actual `chrome.*` API calls.
- Prefer `activeTab` over broad host permissions when interaction is user-driven.
- `externally_connectable`: restrict `matches` to known origins; an open value
  lets any site message your extension.

## Content Security Policy
- MV3 forbids remote code by default — keep it that way. Don't add
  `'unsafe-eval'` or remote script sources to
  `content_security_policy.extension_pages`.
- No loading scripts from a CDN/remote URL; bundle everything. Remote code is a
  Web Store violation and a supply-chain hole.

## Content scripts & DOM
- Content scripts share the page's DOM with hostile page scripts. Never trust
  data read from the page. Don't inject secrets or privileged tokens into the
  page context.
- Avoid `innerHTML` / `insertAdjacentHTML` with page-derived or message-derived
  strings → DOM XSS. Use `textContent`, or sanitize (DOMPurify) when HTML is
  genuinely needed.

## Message passing
- Validate the `sender` in `chrome.runtime.onMessage` /
  `onMessageExternal` — check `sender.id` / `sender.origin` before acting on a
  message. Validate the message shape before use.
- Don't expose privileged actions (fetch with the user's cookies, access to
  stored tokens) to messages that any content script or page can send.

## Storage
- `chrome.storage` is not encrypted. Don't store long-lived high-value secrets
  there; store short-lived scoped tokens and refresh server-side.

## Reporting notes
Common real findings: `<all_urls>` where one origin suffices, an API key in the
background worker, `innerHTML` with scraped page content, unvalidated
`onMessage`. Fix in code; for a leaked key also trigger the rotation hand-off.
