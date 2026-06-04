# Cloudflare Worker Hardening

Workers are often the *correct* place to hold a secret an extension or frontend
can't — but only if the Worker itself is gated. An unauthenticated Worker that
proxies a paid API is the single most common way people get a shock bill. The
threats: secrets stored as plain vars, open proxies with no auth/rate limit,
permissive CORS, and unvalidated input forwarded upstream.

## Secrets: bindings, not vars
- Secrets must be **secret bindings** (`wrangler secret put NAME`), not plaintext
  in `[vars]` of `wrangler.toml`/`wrangler.jsonc`. `[vars]` values are visible in
  the dashboard and often committed. Flag any key-shaped value in `[vars]`.
- Access via `env.NAME` inside the handler — never hardcode a fallback literal.
- Confirm `.dev.vars` (local secrets) is gitignored.

## Gate the endpoint (bill protection)
This is the heart of Worker security. A Worker that calls a paid upstream (LLM,
API) on behalf of clients needs, in order:
1. **Auth** — require a token/session. For an extension or app backend, verify a
   signed token (e.g. a JWT you issue, or the user's session). Reject anonymous
   callers unless the endpoint is genuinely meant to be public.
2. **Rate limiting** — Cloudflare Rate Limiting rules, or a counter in KV /
   Durable Object keyed by IP or user. Without it, one client = unlimited spend.
3. **Input bounds** — clamp `max_tokens`, request body size, and any
   client-supplied parameter that scales cost. Don't forward arbitrary client
   JSON straight to the paid API; whitelist the fields you allow.
4. **Provider-side cap** — tell the user to set usage/billing limits at the
   upstream provider and enable Cloudflare usage notifications. This is the
   backstop and lives outside code.

## CORS
- Don't reflect arbitrary origins or set `Access-Control-Allow-Origin: *` on an
  endpoint that performs privileged/paid actions. Whitelist the specific
  extension ID (`chrome-extension://<id>`) or web origin(s) that should call it.
- If credentials are used, `*` is invalid anyway — be explicit.

## Input handling
- Validate and type-check the request body before use. Treat all client input as
  hostile; never interpolate it into upstream URLs or queries unescaped.
- Don't echo upstream error bodies verbatim to the client if they might contain
  internal detail or the key.

## Headers & responses
- Set sensible response headers; don't leak stack traces or internal config in
  error responses. Fail closed on unexpected errors (return a generic 4xx/5xx).

## Reporting notes
Common real findings: API key in `[vars]` instead of a secret binding, a
`/api/chat` route with no auth and no rate limit proxying an LLM, `ACAO: *` on
that same route, raw client body forwarded to the provider. Fix auth/rate-limit/
CORS/input in code; hand the provider billing caps and key rotation to the user.
