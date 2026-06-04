// Secure Cloudflare Worker proxy — drop-in destination for a secret that must
// NOT live in a browser extension or web frontend.
//
// The client (extension / web app) calls THIS worker; the worker holds the
// upstream API key as a secret binding and enforces auth + rate limiting +
// input bounds so the endpoint can't be abused into a giant bill.
//
// Setup:
//   wrangler secret put UPSTREAM_API_KEY   # the real key (OpenAI/etc.)
//   wrangler secret put PROXY_TOKEN         # shared token clients must send
//   wrangler kv:namespace create RATE_LIMIT # then put the id in wrangler.toml
// wrangler.toml:
//   [vars] UPSTREAM_URL = "https://api.openai.com/v1/chat/completions"
//          ALLOWED_ORIGIN = "https://yourapp.example.com"   # or chrome-extension://<id>
//   [[kv_namespaces]] binding = "RATE_LIMIT"  id = "..."

const RATE_LIMIT = 30; // requests
const RATE_WINDOW = 60; // seconds
const MAX_BODY_BYTES = 16 * 1024;

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

async function rateLimited(request, env) {
  if (!env.RATE_LIMIT) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `rl:${ip}`;
  const count = parseInt((await env.RATE_LIMIT.get(key)) || "0", 10);
  if (count >= RATE_LIMIT) return true;
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  return false;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, env);

    // 1. Auth — reject anonymous callers.
    if (!env.PROXY_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.PROXY_TOKEN}`) {
      return json({ error: "unauthorized" }, 401, env);
    }

    // 2. Rate limit — cap spend per IP.
    if (await rateLimited(request, env)) return json({ error: "rate limit exceeded" }, 429, env);

    // 3. Bound + validate input. Replace this block with the exact shape your
    //    upstream needs; the point is: whitelist fields, never spread raw client
    //    JSON straight through, and cap anything that scales cost (max_tokens).
    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413, env);
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid JSON" }, 400, env);
    }
    if (!Array.isArray(body.messages)) return json({ error: "messages required" }, 400, env);

    const payload = {
      model: env.MODEL || "gpt-4o-mini",
      messages: body.messages,
      max_tokens: 1024,
    };

    // 4. Call upstream with the secret key (held only here).
    const upstream = await fetch(env.UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.UPSTREAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) return json({ error: "upstream error" }, 502, env); // don't leak detail
    return json(await upstream.json(), 200, env);
  },
};
