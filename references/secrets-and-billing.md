# Secrets & Billing Protection

Read this for **every** project. These two risks — leaked secrets and unbounded
spend — cause the largest, most sudden losses, and they apply regardless of
platform.

## Finding leaked secrets

Look in priority order; the highest-impact leaks are the ones a stranger can read
without any access to your machine.

### Secrets shipped to the client (worst)
Anything in code that runs in the user's browser/extension is public — minifying
or "hiding" it changes nothing. A scraper will find it within hours.
- Search the codebase for high-entropy strings and known key shapes:
  - `sk-`, `sk-ant-`, `sk-proj-` (OpenAI/Anthropic), `AIza` (Google),
    `AKIA`/`ASIA` (AWS), `ghp_`/`gho_` (GitHub), `xoxb-`/`xoxp-` (Slack),
    `Bearer ` literals, `-----BEGIN ... PRIVATE KEY-----`.
  - Generic: long base64/hex assigned to names like `apiKey`, `token`, `secret`,
    `password`, `auth`.
- For frontend frameworks, anything inlined at build time leaks. In Vite, only
  `VITE_`-prefixed vars reach the client; in Next.js, only `NEXT_PUBLIC_`. A
  *secret* key with one of those prefixes is a bug — flag and fix it.
- **Fix:** move the key to the server/Worker and have the client call your
  backend instead. There is no acceptable client-side placement for a paid key.

### Secrets in git
- A committed `.env`, `secrets.json`, `*.pem`, `serviceAccount.json`, or
  credentials in config. Check the working tree *and* whether they're tracked.
- **Fix you can do:** add to `.gitignore`, provide a `.env.example` with empty
  placeholders, and `git rm --cached` the tracked file.
- **Hand to the user:** if the secret was ever committed, it lives in history and
  must be treated as compromised. Tell them to (a) **rotate the key immediately**
  at the provider, and (b) optionally scrub history. Give exact commands but let
  them run it — history rewriting is destructive:
  ```
  # rotate first, then optionally:
  git filter-repo --path .env --invert-paths   # or BFG Repo-Cleaner
  ```

### Secrets where they belong
- Backend env vars / platform secret stores (Cloudflare secret bindings, hosting
  provider env). Confirm they're loaded from env, not hardcoded as a fallback
  (`process.env.KEY || "sk-real-key"` defeats the purpose — flag it).

## Stopping runaway bills

A safely-stored key still bankrupts you if anyone can trigger spend without
limit. Every endpoint that costs money (LLM calls, paid APIs, compute, egress)
needs gates.

### The gates, in order of importance
1. **Authentication** — does the caller have to prove who they are? An open proxy
   to a paid API is an open wallet. If the app has users, the endpoint should
   require a valid session/token. If it's truly public, you still need the rest.
2. **Rate limiting** — per-IP and/or per-user caps. Without this one abusive
   client (or a botnet) drives unlimited cost. Platform options:
   - Cloudflare: Rate Limiting rules or a Durable Object / KV counter.
   - Node/web: `express-rate-limit`, or framework middleware, backed by Redis for
     multi-instance.
3. **Hard spend caps / quotas** — the backstop for when the above fail. Set
   billing limits and budget alerts at the *provider* (OpenAI usage limits, AWS
   Budgets, Google Cloud quotas, Cloudflare notifications). You usually can't set
   these in code — tell the user exactly where to click.
4. **Input bounds** — cap request size, max tokens, max items per call. An
   attacker who can request a 100k-token completion per request amplifies cost
   even within rate limits.

### What to report
- For each money-touching endpoint: which gates exist and which are missing.
- Auto-fix what's in code (add auth check, add rate-limit middleware, clamp
  max_tokens / request size).
- Hand to user the provider-side limits and billing alerts they must set — these
  are the true ceiling and live outside the repo.
