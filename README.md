# web-security-hardening

A [Claude](https://claude.com/claude-code) **skill** that hardens the security of
web projects — full-stack web apps, Chrome (MV3) extensions, and Cloudflare
Workers — and fixes the issues it finds directly in the code.

It focuses on the things that cause real, expensive damage:

- 🔑 **Leaked API keys & secrets** — keys committed to git, shipped in frontend
  bundles, or hardcoded in extension code.
- 💸 **Runaway cloud/API bills** — unauthenticated, unmetered endpoints that proxy
  a paid API (the "$500k bill" scenario). Adds auth, rate limiting, input bounds,
  and points you to provider spend caps.
- 🛡️ **User-data exposure** — auth flaws, SQL/NoSQL injection, weak password
  hashing, insecure session cookies.
- 🌐 **Frontend attacks** — XSS, CSRF, permissive CORS, missing security headers.

When it finds a secret stuck in client code, it doesn't just tell you to "set up a
backend" — for Cloudflare-based projects it **scaffolds a secure Worker proxy**
(holding the key as a secret binding, with auth + rate limiting) and rewrites the
client to call it.

## What you get back

The skill edits your code to fix issues, then gives a plain-language report:

- **Fixed** — what it changed and why it's now safe (with severity labels)
- **Needs your action** — things only you can do (rotate a leaked key, set a
  provider billing cap, scrub git history)
- **Already solid** — what your project got right
- An overall risk grade

## Installation

Copy this folder into your Claude skills directory:

```
~/.claude/skills/web-security-hardening/
```

(On Windows: `C:\Users\<you>\.claude\skills\web-security-hardening\`)

Then just ask Claude naturally when you're wrapping up a project:

> "is this secure before I ship it?"
> "lock down my chrome extension"
> "make sure my OpenAI key can't leak and run up a huge bill"

## Structure

```
web-security-hardening/
├── SKILL.md                       # main workflow + the client→Worker proxy pattern
├── references/
│   ├── secrets-and-billing.md     # read every time: secret leaks + bill protection
│   ├── chrome-extension.md        # MV3 permissions, CSP, content scripts, messaging
│   ├── cloudflare-worker.md       # secret bindings, rate limiting, CORS, spend caps
│   └── web-app.md                 # headers, CORS, auth/sessions, injection, XSS, deps
├── assets/
│   └── secure-worker-proxy.js     # drop-in secure Cloudflare Worker proxy template
└── evals/
    └── evals.json                 # test scenarios + assertions
```

## License

MIT — see [LICENSE](LICENSE).
