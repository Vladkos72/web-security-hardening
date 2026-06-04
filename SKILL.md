---
name: web-security-hardening
description: >-
  Hardens the security of web projects — full-stack web apps, Chrome (MV3)
  extensions, and Cloudflare Workers — and fixes the issues it finds directly in
  the code. Focuses on the things that cause real damage: leaked API keys and
  secrets, runaway cloud/API bills from abuse, exposure of user data, and
  frontend attacks (XSS, CSRF, CORS, missing headers). Use this whenever the user
  is getting ready to publish, deploy, or ship a project; says things like "is
  this secure?", "lock this down", "protect my API keys", "I don't want a huge
  bill", "make sure hackers can't get my users' data", or is setting up a new
  project and wants security done right from the start. Trigger it even when the
  user only gestures at security ("about to go live", "final check before
  launch") rather than naming a specific vulnerability.
---

# Web Security Hardening

This skill makes a web project safe to publish. The user runs it either as a
final pre-launch pass or while building, to set security on the right path. The
goal is concrete and money-shaped: don't let a leaked key turn into a $500k bill,
don't let users' data leak, don't let the frontend get hijacked.

You **fix issues directly in the code** (the user has opted into auto-fix), then
report back in chat: what was wrong, what you fixed, and what was already done
right. Keep it honest — if something is risky and you couldn't safely auto-fix
it, say so plainly.

## The mindset that matters

A security pass is only useful if it reflects how the project *actually* works,
not a checklist applied blind. Before touching anything, understand the project:
what is it (extension / web app / Worker), what secrets does it hold, where does
user data live, what does it talk to, and what's exposed to the public internet.
Real vulnerabilities live at those boundaries. A generic "add a CSP" is worth
little; knowing *this* Worker proxies an OpenAI key with no rate limit is worth
the whole engagement.

The expensive failures are almost always one of four shapes. Keep these front of
mind — they're the priority order when triaging:

1. **Leaked secrets** — an API key, token, or password that a stranger can read.
   In a frontend bundle, in git history, in a committed `.env`, hardcoded in a
   content script. This is the $500k-bill risk: a key in shipped JS *will* be
   scraped and abused.
2. **Runaway bills** — a paid API or compute endpoint anyone can call without
   limit. Even with the key safely server-side, an unauthenticated proxy with no
   rate limit or spend cap is an open tab on your credit card.
3. **User data exposure** — auth that can be bypassed, injection (SQL/NoSQL/
   command), insecure storage of personal data, or endpoints that return more
   than the caller should see.
4. **Frontend attacks** — XSS, CSRF, permissive CORS, missing security headers,
   `dangerouslySetInnerHTML`/`innerHTML` with untrusted input, vulnerable deps.

## Workflow

### 1. Identify the project and its boundaries

Look at the repo. Determine which platform(s) apply — `manifest.json` with
`"manifest_version": 3` means a Chrome extension; `wrangler.toml`/`wrangler.jsonc`
means a Cloudflare Worker; a `package.json` with Next/React/Express or a Python
web framework means a web app. A project can be several at once (e.g. an
extension that talks to a Worker).

Map the boundaries: where are secrets stored, what endpoints are public, where
does user input enter, where does user data rest. Note what you find — you'll
report on it.

### 2. Read the relevant playbook(s)

Each platform has its own attack surface. Read the reference file(s) that match
the project — they contain the specific checks, the common mistakes, and the
preferred fixes:

- `references/secrets-and-billing.md` — **read this every time.** Secret leakage
  and bill-runaway protection apply to every project type and are the top
  priorities.
- `references/chrome-extension.md` — MV3 extensions: manifest permissions, CSP,
  content-script isolation, secrets in extension code, message passing.
- `references/cloudflare-worker.md` — Workers: secret bindings vs vars, rate
  limiting, auth on proxied APIs, CORS, spend protection.
- `references/web-app.md` — full-stack web: headers, CORS, auth/session,
  injection, XSS, dependency audit, server/client secret split.

### 3. Triage, then fix

Go through findings in priority order (secrets → bills → user data → frontend).
For each real issue, apply the fix directly in the code, matching the project's
existing style and conventions. Prefer fixes that close the hole at its root
(move the key server-side) over band-aids (obfuscate the key in the bundle —
useless).

Some things you must **not** silently auto-fix because they need a human:
rotating a key that has already leaked (you can't do it, but you must tell them
to), deleting committed secrets from git *history* (rewriting history is
destructive — flag it and give the exact commands), or changing auth flows in a
way that could lock users out. For these, make the safe code change you can and
clearly hand the rest to the user.

After each fix, sanity-check that you haven't broken the app's normal
functioning — security that breaks the feature gets reverted by the user and
helps no one.

### 4. Report in chat

Give a clear, skimmable summary. Lead with the headline risk if there is one.
Structure:

```
## Security review: <project>

**Headline:** <the one thing that mattered most, or "no critical issues found">

### Fixed
- <issue> → <what you changed and why it's now safe>  (severity)

### Needs your action (couldn't safely auto-fix)
- <issue> → <exact steps for the user, e.g. rotate this key, run these git commands>

### Already solid
- <things the project got right — give credit, it tells the user what not to worry about>

### Risk grade: <Critical / High / Medium / Low> — <one sentence why>
```

Use severity labels (Critical/High/Medium/Low) so the user can prioritize. Be
specific with file paths and line references so they can verify your work.

## The standard fix: client → Cloudflare Worker proxy

These projects are overwhelmingly Chrome extensions and web apps deployed on
Cloudflare, usually calling a paid API (OpenAI etc.). That means the single most
common finding — "a secret key is sitting in client code" — has one canonical
fix, and you should be ready to *implement* it, not just describe it:

> The client (extension or frontend) must not hold the key. It calls a small
> Cloudflare Worker you control; the Worker holds the key as a secret binding and
> enforces auth + rate limiting + input bounds. The browser never sees the key.

When you hit a client-side key and the project has no such proxy yet, **scaffold
one** from `assets/secure-worker-proxy.js` — copy it into the project (e.g.
`worker/src/index.js`), adapt the upstream URL and request shape to what the
client actually calls, and rewrite the client to call the Worker instead of the
upstream API directly. Then point the user at the `wrangler secret put` /
`kv:namespace create` commands and the provider billing cap. Don't leave them
with "you should set up a backend" — give them the backend.

If a proxy already exists (common in these projects — the extension already talks
to a Worker), don't create a second one; harden the existing Worker per
`references/cloudflare-worker.md` and route the client through it.

## Principles for fixes

- **Secrets belong server-side or in a secret store, never in shipped client
  code.** If a frontend needs to call a paid API, it goes through a Cloudflare
  Worker (or other backend) that holds the key and enforces limits — see the
  proxy pattern above, and scaffold it from `assets/secure-worker-proxy.js` when
  one doesn't exist. There is no safe way to put a high-value key in a browser
  extension or web bundle.
- **Every public endpoint that costs money needs a gate** — auth, rate limiting,
  and ideally a hard spend cap. Assume it will be found and hammered.
- **Validate and escape at the boundary.** Untrusted input (user forms, URL
  params, message-passing payloads) is hostile until proven otherwise.
- **Fail closed.** When a security control is uncertain, the safe default is to
  deny, not allow.
- **Explain the why in your report.** The user is learning their own threat
  model; a fix they understand is one they won't undo.
