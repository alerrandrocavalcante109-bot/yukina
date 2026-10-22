/**
 * Bootstrap Yukina: baixa index estável, aplica patches de init e sobe o bot.
 */
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const Module = require("node:module");

const CACHE = path.join(__dirname, ".yukina-index-stable.js");
const SOURCE =
  "https://cdn.jsdelivr.net/gh/alerrandrocavalcante109-bot/yukina@538e72b099f5b7148222ac905b65f5647e420e43/index.js";

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
        resolve({ status: res.statusCode, body, json });
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

  // Soft-fail no initialize do storage (não derruba o processo)
  out = out.replace(
    `  console.log("[Inicialização] Validando armazenamento...");\n  await memberData.initialize();\n  console.log("[Inicialização] Armazenamento validado.");`,
    `  console.log("[Inicialização] Validando armazenamento...");\n  try {\n    await memberData.initialize();\n    console.log("[Inicialização] Armazenamento validado.");\n  } catch (storageError) {\n    console.warn("[Inicialização] Armazenamento com falha (continuando online):", storageError?.message || storageError);\n  }`
  );

  // Fallback do evento ready + clientReady
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
// Fallback ready / clientReady
client.once("ready", () => {
  if (typeof discordReady !== "undefined" && discordReady) return;
  console.log("[Discord] Evento ready recebido (fallback).");
  client.emit("clientReady");
});
`
      );
    }
  }

  // Watchdog um pouco mais longo e log mais claro
  out = out.replace(
    "O cliente ainda não ficou pronto após 120 segundos.",
    "O cliente ainda não ficou pronto após 120 segundos. Verifique DISCORD_TOKEN, intents no portal e rede até o gateway."
  );

  return out;
}

function run(code) {
  const filename = path.join(__dirname, "index.runtime.js");
  const m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(code, filename);
}

(async () => {
  try {
    const token = String(process.env.DISCORD_TOKEN || "").trim();
    if (!token) {
      console.error("[Yukina] DISCORD_TOKEN ausente nas Environment Variables do Render.");
      process.exit(1);
    }
    if (token.startsWith("\"") || token.endsWith("\"") || token.includes(" ")) {
      console.warn("[Yukina] DISCORD_TOKEN parece ter aspas ou espaços — confira o valor no Render.");
    }

    // Pré-checagem do token via REST (não substitui o gateway, só diagnostica)
    try {
      const me = await httpJson("https://discord.com/api/v10/users/@me", {
        Authorization: "Bot " + token,
      });
      if (me.status === 401 || me.status === 403) {
        console.error("[Yukina] Token rejeitado pela API Discord (HTTP " + me.status + "). Gere um token novo no portal e atualize DISCORD_TOKEN no Render.");
        process.exit(1);
      }
      if (me.status === 200 && me.json?.username) {
        console.log("[Yukina] Token OK via REST. Bot: " + me.json.username + (me.json.discriminator ? "#" + me.json.discriminator : "") + " (id " + me.json.id + ")");
      } else {
        console.warn("[Yukina] REST /users/@me respondeu HTTP " + me.status + " — seguindo mesmo assim.");
      }

      const gw = await httpJson("https://discord.com/api/v10/gateway/bot", {
        Authorization: "Bot " + token,
      });
      if (gw.status === 200 && gw.json?.url) {
        console.log("[Yukina] Gateway URL: " + gw.json.url + " | sessão restante: " + (gw.json.session_start_limit?.remaining ?? "?"));
        if (Number(gw.json.session_start_limit?.remaining) === 0) {
          console.error("[Yukina] Limite de sessões do gateway esgotado. Aguarde o reset e evite reinícios em loop.");
        }
      } else if (gw.status === 401) {
        console.error("[Yukina] gateway/bot retornou 401 — token inválido.");
        process.exit(1);
      } else {
        console.warn("[Yukina] gateway/bot HTTP " + gw.status);
      }
    } catch (preflightError) {
      console.warn("[Yukina] Pré-checagem REST falhou (seguindo para login):", preflightError?.message || preflightError);
    }

    let code = null;
    if (fs.existsSync(CACHE) && fs.statSync(CACHE).size > 10000) {
      code = fs.readFileSync(CACHE, "utf8");
      console.log("[Yukina] Usando index estável em cache local.");
    } else {
      console.log("[Yukina] Baixando index.js estável do histórico...");
      code = await download(SOURCE);
      if (!code || !code.includes("client.login")) {
        throw new Error("Conteúdo baixado inválido (sem client.login)");
      }
      fs.writeFileSync(CACHE, code);
      console.log("[Yukina] Index estável salvo em cache (" + code.length + " bytes).");
    }

    code = applyPatches(code);
    run(code);
  } catch (error) {
    console.error("[Yukina] Falha ao iniciar:", error?.message || error);
    process.exit(1);
  }
})();
