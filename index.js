/**
 * Bootstrap temporário: carrega o index.js completo da versão estável no histórico.
 * Árvore: 538e72b099f5b7148222ac905b65f5647e420e43
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

function run(code) {
  const filename = path.join(__dirname, "index.runtime.js");
  const m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(code, filename);
}

(async () => {
  try {
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
    run(code);
  } catch (error) {
    console.error("[Yukina] Falha ao restaurar index:", error?.message || error);
    process.exit(1);
  }
})();
