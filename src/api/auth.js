"use strict";

const oauthGuildCache = new Map();
const OAUTH_GUILD_CACHE_TTL_MS = 60 * 1000;
const OAUTH_GUILD_CACHE_STALE_MS = 5 * 60 * 1000;

async function authorizePanel(req, guildId, client) {
  const auth = String(req.headers.authorization || "");
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!accessToken) throw Object.assign(new Error("Entre com o Discord novamente."), { status: 401 });

  const now = Date.now();
  let cachedGuilds = oauthGuildCache.get(accessToken);
  if (cachedGuilds && cachedGuilds.staleUntil <= now) {
    oauthGuildCache.delete(accessToken);
    cachedGuilds = null;
  }

  const userPromise = fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  let guildsPromise = null;
  if (!cachedGuilds || cachedGuilds.freshUntil <= now) {
    guildsPromise = fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: "Bearer " + accessToken }
    });
  }

  const userRes = await userPromise;
  if (!userRes.ok) {
    console.warn("[API painel] Discord recusou a validação do usuário OAuth:", JSON.stringify({ userStatus: userRes.status }));
    const status = userRes.status === 401 ? 401 : userRes.status === 403 ? 403 : 502;
    const message = status === 401
      ? "Sua sessão do Discord expirou. Entre novamente."
      : status === 403
        ? "O Discord recusou as permissões OAuth da sessão. Entre novamente."
        : "O Discord está temporariamente indisponível para validar a sessão. Tente novamente.";
    throw Object.assign(new Error(message), { status });
  }
  const user = await userRes.json();

  let guilds;
  if (!guildsPromise) {
    guilds = cachedGuilds.guilds;
  } else {
    const guildsRes = await guildsPromise;
    if (guildsRes.ok) {
      guilds = await guildsRes.json();
      const entry = {
        guilds: Array.isArray(guilds) ? guilds : [],
        freshUntil: Date.now() + OAUTH_GUILD_CACHE_TTL_MS,
        staleUntil: Date.now() + OAUTH_GUILD_CACHE_STALE_MS
      };
      oauthGuildCache.set(accessToken, entry);
      if (oauthGuildCache.size > 500) {
        const oldestKey = oauthGuildCache.keys().next().value;
        if (oldestKey !== undefined) oauthGuildCache.delete(oldestKey);
      }
    } else {
      console.warn("[API painel] Discord recusou a validação OAuth:", JSON.stringify({
        userStatus: userRes.status,
        guildsStatus: guildsRes.status
      }));
      if (guildsRes.status === 429 && cachedGuilds && cachedGuilds.staleUntil > Date.now()) {
        guilds = cachedGuilds.guilds;
        console.warn("[API painel] Usando cache recente de servidores devido ao limite 429 do Discord.");
      } else {
        const status = guildsRes.status === 401 ? 401 : guildsRes.status === 403 ? 403 : 502;
        const message = status === 401
          ? "Sua sessão do Discord expirou. Entre novamente."
          : status === 403
            ? "O Discord recusou as permissões OAuth da sessão. Entre novamente e autorize identify e guilds."
            : "O Discord está temporariamente indisponível para validar a sessão. Tente novamente.";
        throw Object.assign(new Error(message), { status });
      }
    }
  }

  const guild = Array.isArray(guilds) ? guilds.find(g => g.id === guildId) : null;
  if (!guild) throw Object.assign(new Error("Você não tem acesso a este servidor."), { status: 403 });
  const permissions = BigInt(guild.permissions || "0");
  if ((permissions & 8n) === 0n && (permissions & 32n) === 0n && guild.owner !== true) {
    throw Object.assign(new Error("É necessário ter Administrador ou Gerenciar servidor."), { status: 403 });
  }
  const botGuild = client.guilds.cache.get(guildId);
  if (!botGuild) throw Object.assign(new Error("A Yukina ainda não está neste servidor. Adicione o bot e tente novamente."), { status: 409 });
  return { user, guild: botGuild };
}

module.exports = { authorizePanel, oauthGuildCache };
