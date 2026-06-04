# Full-Stack Web App Hardening

Covers Node/JS (Next.js, React, Express, Vite) and Python (FastAPI, Flask,
Django) web apps. The threats span the whole stack: secrets split wrong between
server and client, missing security headers, bad CORS, weak auth/sessions,
injection, XSS, and vulnerable dependencies.

## Server vs client secret split
- Only public, non-sensitive config may reach the client. Enforce the framework
  rule: Vite ships only `VITE_*`, Next.js ships only `NEXT_PUBLIC_*`. A real
  secret with a public prefix is a leak — move it server-side. If the client was
  calling a paid API directly with that key, add a server route that proxies the
  call (Next.js API route / server action), or a Cloudflare Worker proxy from
  `assets/secure-worker-proxy.js` when the app is deployed on Cloudflare — see the
  client → Worker proxy pattern in SKILL.md. Rewrite the client to hit your route,
  not the upstream API.
- Server secrets load from env / a secret store, never hardcoded, no literal
  fallback. (See `secrets-and-billing.md`.)
- Server-only code must not be importable into a client bundle. In Next.js, keep
  keys in route handlers / server components / `server-only`-marked modules.

## Authentication & sessions
- Passwords hashed with bcrypt/argon2/scrypt — never plaintext, never fast hashes
  (MD5/SHA-1) or unsalted.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`. JWTs:
  verified signature, sane expiry, and a real secret (not a default/example one).
- Authorization checks on every protected route — confirm the caller is allowed
  to access *this* resource, not merely logged in (guards against IDOR: e.g.
  `/api/orders/123` returning another user's order).
- Don't leak which accounts exist via differing login/reset error messages.

## Injection
- SQL/NoSQL: parameterized queries / prepared statements / ORM bindings — never
  string-concatenate user input into a query. Flag template literals with user
  data inside `db.query(...)`.
- Command/path: never pass user input to `exec`/`spawn`/`os.system` or into file
  paths without strict validation and allow-listing.
- Validate and type-check request input at the boundary (zod, pydantic, schema
  validation). Reject unexpected shapes.

## XSS
- React/JSX escapes by default — the danger is `dangerouslySetInnerHTML` and, in
  plain JS, `innerHTML`/`document.write` with untrusted data. Sanitize with
  DOMPurify or render as text.
- Server-rendered templates: ensure auto-escaping is on (Jinja2 autoescape,
  etc.) and not disabled with `| safe` on user data.

## CORS & security headers
- CORS: explicit origin allow-list, not `*`, on anything authenticated. Don't
  reflect the `Origin` header blindly.
- Set security headers (via `helmet` for Express, framework config, or the host):
  `Content-Security-Policy` (restrict script sources, avoid `unsafe-inline`),
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` / frame-ancestors, `Referrer-Policy`.
- CSRF: state-changing routes that rely on cookie auth need CSRF protection
  (token or `SameSite` cookies). Token-in-header APIs are generally exempt.

## Money-touching endpoints
- Same gates as everywhere: auth + rate limiting + input bounds + provider caps.
  See `secrets-and-billing.md`. Add `express-rate-limit` / framework middleware
  where missing.

## Dependencies
- Run `npm audit` (or `pnpm audit` / `pip-audit`) and report high/critical
  advisories. Auto-fix with `npm audit fix` only when it won't force a breaking
  major bump; otherwise flag for the user.

## Reporting notes
Common real findings: secret with `NEXT_PUBLIC_`/`VITE_` prefix, missing
`HttpOnly`/`Secure` on session cookie, route concatenating input into SQL,
`dangerouslySetInnerHTML` with user content, `cors()` with no origin restriction,
no security headers, unauthenticated paid endpoint. Fix in code; hand off
anything needing key rotation or provider-side billing setup.
