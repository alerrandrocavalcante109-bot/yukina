/**
 * Bootstrap Yukina
 * Health imediato + index estável com patches de SIGTERM grace e storage soft-fail.
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const CACHE = path.join(__dirname, ".yukina-index-stable.js");
const APP = path.join(__dirname, "index.app.js");
const SOURCE =
  "https://cdn.jsdelivr.net/gh/alerrandrocavalcante109-bot/yukina@538e72b099f5b7148222ac905b65f5647e420e43/index.js";

const PORT = Number(process.env.PORT || 10000);
const STARTED_AT = Date.now();

const earlyServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "Yukina Bot", bootstrap: true, pid: process.pid }));
});

function listenEarly() {
  return new Promise((resolve) => {
    earlyServer.once("listening", () => {
      console.log("[Yukina] Health bootstrap na porta " + PORT + " (PID " + process.pid + ")");
      resolve();
    });
    earlyServer.on("error", (err) => {
      console.warn("[Yukina] Porta bootstrap:", err.message);
      resolve();
    });
    earlyServer.listen(PORT, "0.0.0.0");
  });
}

function closeEarly() {
  return new Promise((resolve) => {
    try {
      earlyServer.close(() => resolve());
    } catch (_) {
      resolve();
    }
  });
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
        resolve({ status: res.statusCode, body, json });
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Timeout HTTP"));
    });
  });
}

function applyPatches(code) {
  let out = code;

  out = out.replace(
    '  console.log("[Inicialização] Validando armazenamento...");\n  await memberData.initialize();\n  console.log("[Inicialização] Armazenamento validado.");',
    '  console.log("[Inicialização] Validando armazenamento...");\n  try {\n    await memberData.initialize();\n    console.log("[Inicialização] Armazenamento validado.");\n  } catch (storageError) {\n    console.warn("[Inicialização] Armazenamento com falha (continuando online):", storageError?.message || storageError);\n  }'
  );

  if (!out.includes("Evento ready recebido (fallback)")) {
    const needle = 'require("./interaction")(client);\n}';
    if (out.includes(needle)) {
      out = out.replace(
        needle,
        needle +
          '\n\nclient.once("ready", () => {\n  if (typeof discordReady !== "undefined" && discordReady) return;\n  console.log("[Discord] Evento ready recebido (fallback).");\n  client.emit("clientReady");\n});\n'
      );
    }
  }

  // Grace SIGTERM: injeta no início de shutdown()
  if (!out.includes("SIGTERM ignorado (grace")) {
    const needle = "async function shutdown(signal) {\n  if (shuttingDown) return;";
    const inject =
      "async function shutdown(signal) {\n" +
      "  if (shuttingDown) return;\n" +
      "  const bootTs = Number(process.env.YUKINA_BOOT_TS) || 0;\n" +
      "  const uptimeMs = bootTs ? Date.now() - bootTs : 0;\n" +
      "  if (signal === \"SIGTERM\" && bootTs && uptimeMs < 180000) {\n" +
      "    console.warn(\"[Yukina] SIGTERM ignorado (grace 3min). uptime=\" + Math.round(uptimeMs / 1000) + \"s pid=\" + process.pid);\n" +
      "    return;\n" +
      "  }";
    if (out.includes(needle)) {
      out = out.replace(needle, inject);
      console.log("[Bootstrap] Patch SIGTERM aplicado.");
    } else {
      console.warn("[Bootstrap] Não achei shutdown() para aplicar grace SIGTERM.");
    }
  }

  return out;
}

(async () => {
  try {
    process.env.YUKINA_BOOT_TS = String(STARTED_AT);
    await listenEarly();
    console.log("[Yukina] Bootstrap PID=" + process.pid + " | bootTs=" + process.env.YUKINA_BOOT_TS + " | node " + process.version);

    const token = String(process.env.DISCORD_TOKEN || "").trim();
    if (!token) {
      console.error("[Yukina] DISCORD_TOKEN ausente.");
      process.exit(1);
    }

    try {
      const me = await httpJson("https://discord.com/api/v10/users/@me", {
        Authorization: "Bot " + token,
      });
      if (me.status === 401 || me.status === 403) {
        console.error("[Yukina] Token rejeitado (HTTP " + me.status + ").");
        process.exit(1);
      }
      if (me.status === 429) {
        console.warn("[Yukina] REST 429 — seguindo para o gateway.");
      } else if (me.status === 200 && me.json && me.json.username) {
        console.log("[Yukina] Token OK. Bot: " + me.json.username + " (id " + me.json.id + ")");
      }
    } catch (e) {
      console.warn("[Yukina] Pré-checagem REST:", e && e.message ? e.message : e);
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
    console.log(
      "[Yukina] index.app.js escrito (" +
        code.length +
        " bytes). grace SIGTERM? " +
        (code.includes("SIGTERM ignorado (grace") ? "sim" : "NÃO")
    );

    await closeEarly();
    console.log("[Yukina] Carregando index.app.js...");
    require(APP);
  } catch (error) {
    console.error("[Yukina] Falha ao iniciar:", error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
