/**
 * Bootstrap Yukina
 * 1) Valida token (com retry em 429)
 * 2) Baixa index estável, aplica patches, grava index.app.js
 * 3) require('./index.app.js') — evita Module._compile no gateway
 */
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const CACHE = path.join(__dirname, ".yukina-index-stable.js");
const APP = path.join(__dirname, "index.app.js");
const SOURCE =
  "https://cdn.jsdelivr.net/gh/alerrandrocavalcante109-bot/yukina@538e72b099f5b7148222ac905b65f5647e420e43/index.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Yukina-Bot" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " ao baixar index estável"));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Timeout ao baixar index estável"));
    });
  });
}

function httpJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Yukina-Bot", ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = body ? JSON.parse(body) : null;
        } catch (_) {}
        resolve({ status: res.statusCode, body, json, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("Timeout HTTP"));
    });
  });
}

function applyPatches(code) {
  let out = code;

  out = out.replace(
    `  console.log("[Inicialização] Validando armazenamento...");\n  await memberData.initialize();\n  console.log("[Inicialização] Armazenamento validado.");`,
    `  console.log("[Inicialização] Validando armazenamento...");\n  try {\n    await memberData.initialize();\n    console.log("[Inicialização] Armazenamento validado.");\n  } catch (storageError) {\n    console.warn("[Inicialização] Armazenamento com falha (continuando online):", storageError?.message || storageError);\n  }`
  );

  if (!out.includes("Evento ready recebido (fallback)")) {
    const anchor = `function loadYukinaSystems() {
  if (systemsLoaded) return;
  systemsLoaded = true;
  console.log("[Yukina] Conexão estabelecida; iniciando os sistemas em seguida...");
  require("./command-engine")(client);
  require("./rank-system")(client);
  require("./xp-level-system")(client);
  require("./time-role-system")(client);
  require("./staff-promotion-announcements")(client);
  require("./interaction")(client);
}
`;
    if (out.includes(anchor)) {
      out = out.replace(
        anchor,
        anchor +
          `
client.once("ready", () => {
  if (typeof discordReady !== "undefined" && discordReady) return;
  console.log("[Discord] Evento ready recebido (fallback).");
  client.emit("clientReady");
});
`
      );
    }
  }

  out = out.replace(
    "O cliente ainda não ficou pronto após 120 segundos.",
    "O cliente ainda não ficou pronto após 120 segundos. Verifique DISCORD_TOKEN, intents e se o processo não está recebendo SIGTERM cedo demais."
  );

  return out;
}

(async () => {
  try {
    console.log("[Yukina] Bootstrap PID=" + process.pid + " | node " + process.version);

    const token = String(process.env.DISCORD_TOKEN || "").trim();
    if (!token) {
      console.error("[Yukina] DISCORD_TOKEN ausente nas Environment Variables do Render.");
      process.exit(1);
    }

    // Pré-checagem com retry em 429
    let tokenOk = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const me = await httpJson("https://discord.com/api/v10/users/@me", {
          Authorization: "Bot " + token,
        });
        if (me.status === 429) {
          const retry = Number(me.json?.retry_after || me.headers?.["retry-after"] || 5);
          console.warn("[Yukina] REST rate limit (429). Tentativa " + attempt + "/3 — aguardando " + retry + "s...");
          await sleep(Math.min(30, Math.max(2, retry)) * 1000);
          continue;
        }
        if (me.status === 401 || me.status === 403) {
          console.error("[Yukina] Token rejeitado (HTTP " + me.status + "). Regenere o token no portal Discord e atualize no Render.");
          process.exit(1);
        }
        if (me.status === 200 && me.json?.username) {
          console.log(
            "[Yukina] Token OK. Bot: " +
              me.json.username +
              (me.json.discriminator && me.json.discriminator !== "0" ? "#" + me.json.discriminator : "") +
              " (id " +
              me.json.id +
              ")"
          );
          tokenOk = true;
        } else {
          console.warn("[Yukina] REST /users/@me HTTP " + me.status);
        }
        break;
      } catch (e) {
        console.warn("[Yukina] Pré-checagem falhou (tentativa " + attempt + "):", e?.message || e);
        await sleep(2000 * attempt);
      }
    }

    try {
      const gw = await httpJson("https://discord.com/api/v10/gateway/bot", {
        Authorization: "Bot " + token,
      });
      if (gw.status === 200 && gw.json?.url) {
        const rem = gw.json.session_start_limit?.remaining;
        console.log("[Yukina] Gateway: " + gw.json.url + " | sessões restantes: " + (rem ?? "?"));
        if (Number(rem) === 0) {
          console.error("[Yukina] Sessões do gateway esgotadas. Pare os deploys e aguarde o reset.");
        }
      } else if (gw.status === 401) {
        console.error("[Yukina] gateway/bot 401 — token inválido.");
        process.exit(1);
      } else if (gw.status === 429) {
        console.warn("[Yukina] gateway/bot em rate limit (429). Aguardando 10s...");
        await sleep(10000);
      }
    } catch (e) {
      console.warn("[Yukina] gateway/bot falhou:", e?.message || e);
    }

    let code;
    if (fs.existsSync(CACHE) && fs.statSync(CACHE).size > 10000) {
      code = fs.readFileSync(CACHE, "utf8");
      console.log("[Yukina] Cache local do index estável.");
    } else {
      console.log("[Yukina] Baixando index.js estável...");
      code = await download(SOURCE);
      if (!code || !code.includes("client.login")) throw new Error("Index baixado inválido");
      fs.writeFileSync(CACHE, code);
      console.log("[Yukina] Cache salvo (" + code.length + " bytes).");
    }

    code = applyPatches(code);
    fs.writeFileSync(APP, code);
    console.log("[Yukina] App escrito em index.app.js — carregando via require...");

    // Carrega como módulo real (WebSocket/discord.js mais estável que Module._compile)
    require(APP);
  } catch (error) {
    console.error("[Yukina] Falha ao iniciar:", error?.stack || error?.message || error);
    process.exit(1);
  }
})();
