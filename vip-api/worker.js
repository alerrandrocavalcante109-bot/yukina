/**
 * Yukina VIP API — Discord authentication foundation.
 * Payments remain disabled until Mercado Pago, webhook verification and
 * transaction persistence are configured and tested.
 */
const PLANS = {
  starter: { name: "Starter", monthly: 790, annual: 7990 },
  plus: { name: "Plus", monthly: 990, annual: 9990 },
  premium: { name: "Premium", monthly: 1490, annual: 14990 },
  ultra: { name: "Ultra", monthly: 1990, annual: 19990 },
  infinity: { name: "Infinity", monthly: 2990, annual: 29990 }
};

const SITE_ORIGIN = "https://yukina-6uo.pages.dev";
const SESSION_COOKIE = "__Host-yukina_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_SECONDS = 60 * 10;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "access-control-allow-origin": SITE_ORIGIN,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      ...extraHeaders
    }
  });
}

function cookieHeader(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

function redirect(url, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", ...headers } });
}

function configured(env) {
  return Boolean(env.DB && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_REDIRECT_URI);
}

async function handleDiscordLogin(env) {
  if (!configured(env)) return json({ error: "discord_login_not_configured", message: "O login Discord ainda não foi configurado." }, 503);
  const state = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)").bind(await sha256(state), now + OAUTH_STATE_SECONDS).run();
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  return redirect(authorize.toString());
}

async function handleDiscordCallback(request, env, url) {
  if (!configured(env)) return json({ error: "discord_login_not_configured" }, 503);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state.length > 256) return redirect(SITE_ORIGIN + "/login.html?error=discord_oauth_invalid");

  const stateHash = await sha256(state);
  const now = Math.floor(Date.now() / 1000);
  const stateRow = await env.DB.prepare("SELECT state_hash FROM oauth_states WHERE state_hash = ? AND expires_at >= ?").bind(stateHash, now).first();
  if (!stateRow) return redirect(SITE_ORIGIN + "/login.html?error=discord_oauth_state");
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(stateHash).run();

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI
    })
  });
  if (!tokenResponse.ok) return redirect(SITE_ORIGIN + "/login.html?error=discord_token_exchange");
  const tokenData = await tokenResponse.json();
  if (typeof tokenData.access_token !== "string") return redirect(SITE_ORIGIN + "/login.html?error=discord_token_invalid");

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!userResponse.ok) return redirect(SITE_ORIGIN + "/login.html?error=discord_profile");
  const user = await userResponse.json();
  if (!/^\d{17,20}$/.test(String(user.id || ""))) return redirect(SITE_ORIGIN + "/login.html?error=discord_profile");

  const sessionToken = randomToken(32);
  const sessionHash = await sha256(sessionToken);
  const expiresAt = now + SESSION_SECONDS;
  await env.DB.prepare(
    "INSERT INTO users (discord_id, username, global_name, avatar, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username, global_name=excluded.global_name, avatar=excluded.avatar, updated_at=excluded.updated_at"
  ).bind(String(user.id), String(user.username || ""), user.global_name ? String(user.global_name) : null, user.avatar ? String(user.avatar) : null, now).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, discord_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(sessionHash, String(user.id), expiresAt, now).run();

  return redirect(SITE_ORIGIN + "/login.html?discord=connected", {
    "Set-Cookie": cookieHeader(sessionToken, SESSION_SECONDS)
  });
}

async function currentUser(request, env) {
  if (!env.DB) return null;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length !== 64) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(
    "SELECT u.discord_id AS id, u.username, u.global_name, u.avatar FROM sessions s JOIN users u ON u.discord_id = s.discord_id WHERE s.token_hash = ? AND s.expires_at > ?"
  ).bind(tokenHash, now).first();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin === SITE_ORIGIN && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": SITE_ORIGIN,
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "vary": "Origin"
      }});
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 403 });
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ service: "yukina-vip-api", mode: "preparation", paymentsEnabled: false, discordLoginConfigured: configured(env) });
    }
    if (url.pathname === "/auth/discord" && request.method === "GET") return handleDiscordLogin(env);
    if (url.pathname === "/auth/discord/callback" && request.method === "GET") return handleDiscordCallback(request, env, url);
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      if (!env.DB) return json({ error: "database_not_configured" }, 503);
      const user = await currentUser(request, env);
      return json({ authenticated: Boolean(user), user: user || null });
    }
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      if (request.headers.get("Origin") !== SITE_ORIGIN) return json({ error: "origin_not_allowed" }, 403);
      const token = cookieValue(request, SESSION_COOKIE);
      if (token && env.DB) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }
    if (url.pathname === "/api/vip/plans" && request.method === "GET") {
      return json({ currency: "BRL", plans: Object.entries(PLANS).map(([id, p]) => ({ id, name: p.name, monthlyAmount: p.monthly, annualAmount: p.annual })) });
    }
    if (url.pathname === "/api/vip/checkout" && request.method === "POST") {
      return json({ error: "payments_not_configured", message: "O checkout ainda não foi habilitado. Nenhuma cobrança foi realizada." }, 503);
    }
    if (url.pathname === "/api/vip/proofs" && request.method === "POST") {
      return json({ error: "proof_review_not_configured", status: "unavailable", message: "O envio e a conferência de comprovantes ainda não estão habilitados. Nenhum arquivo foi recebido e nenhum VIP foi ativado." }, 503);
    }
    if (url.pathname === "/api/vip/webhook" && request.method === "POST") {
      return json({ error: "webhook_not_configured", message: "O processamento de pagamentos ainda não está habilitado." }, 503);
    }
    return json({ error: "not_found" }, 404);
  }
};
