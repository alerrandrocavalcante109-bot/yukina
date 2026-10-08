const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const LOG_DIR = path.join(ROOT, "manager", "logs");
const LOG_FILE = path.join(LOG_DIR, "lavalink.log");

const REMOTE_URL = String(
  process.env.YUKINA_LAVALINK_URL || process.env.LAVALINK_URL || ""
).replace(/\/$/, "");

const LAVALINK_PASSWORD = process.env.LAVALINK_SERVER_PASSWORD || "";
const CHECK_INTERVAL_MS = Number(process.env.RUNNER_INTERVAL_MS || 10000);
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const RENDER_SERVICE_ID = process.env.RENDER_LAVALINK_SERVICE_ID || "";

fs.mkdirSync(LOG_DIR, { recursive: true });

function requireRemote() {
  if (!REMOTE_URL) {
    throw new Error(
      "Yukina não possui YUKINA_LAVALINK_URL. Configure a URL pública do Aeternus-Lavalink."
    );
  }
}

function renderConfigured() {
  return Boolean(RENDER_API_KEY && RENDER_SERVICE_ID);
}

async function renderRequest(method, endpoint) {
  if (!renderConfigured()) {
    throw new Error(
      "Controle do Render não configurado. Defina RENDER_API_KEY e RENDER_LAVALINK_SERVICE_ID."
    );
  }

  const response = await fetch("https://api.render.com" + endpoint, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + RENDER_API_KEY,
      "User-Agent": "Yukina-Manager"
    }
  });

  const body = await response.text();

  if (!response.ok) {
    let message = body;
    try {
      message = JSON.parse(body)?.message || body;
    } catch {}
    throw new Error("Render API HTTP " + response.status + ": " + message);
  }

  try {
    return body ? JSON.parse(body) : { ok: true };
  } catch {
    return { ok: true, body };
  }
}

function lavalinkHeaders() {
  const headers = { Accept: "application/json" };
  if (LAVALINK_PASSWORD) headers.Authorization = LAVALINK_PASSWORD;
  return headers;
}

async function serviceOnline() {
  requireRemote();

  try {
    const response = await fetch(REMOTE_URL + "/v4/info", {
      headers: lavalinkHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function start() {
  requireRemote();

  if (!renderConfigured()) {
    console.log(JSON.stringify({
      mode: "remote",
      action: "start",
      ok: false,
      message: "A URL do Lavalink está configurada, mas o controle do Render não está configurado."
    }, null, 2));
    return;
  }

  const result = await renderRequest(
    "POST",
    "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/resume"
  );

  console.log(JSON.stringify({
    mode: "remote-render",
    action: "start",
    ok: true,
    result
  }, null, 2));
}

async function stop() {
  requireRemote();

  if (!renderConfigured()) {
    throw new Error(
      "Para parar o host da Yukina pelo Runner, configure RENDER_API_KEY e RENDER_LAVALINK_SERVICE_ID."
    );
  }

  const result = await renderRequest(
    "POST",
    "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/suspend"
  );

  console.log(JSON.stringify({
    mode: "remote-render",
    action: "stop",
    ok: true,
    result
  }, null, 2));
}

async function restart() {
  requireRemote();

  if (!renderConfigured()) {
    throw new Error(
      "Para reiniciar o host da Yukina pelo Runner, configure RENDER_API_KEY e RENDER_LAVALINK_SERVICE_ID."
    );
  }

  const result = await renderRequest(
    "POST",
    "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/restart"
  );

  console.log(JSON.stringify({
    mode: "remote-render",
    action: "restart",
    ok: true,
    result
  }, null, 2));
}

async function status() {
  requireRemote();

  const online = await serviceOnline();
  let render = null;

  if (renderConfigured()) {
    try {
      render = await renderRequest(
        "GET",
        "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID)
      );
    } catch (error) {
      render = { error: error.message };
    }
  }

  console.log(JSON.stringify({
    service: "lavalink",
    owner: "Yukina",
    runtime: "Aeternus-Lavalink",
    infrastructure: "Render",
    mode: "remote-render",
    status: online ? "online" : "offline",
    url: REMOTE_URL,
    renderServiceId: RENDER_SERVICE_ID || null,
    render,
    checkedAt: new Date().toISOString()
  }, null, 2));
}

async function logs() {
  requireRemote();

  console.log(JSON.stringify({
    ok: true,
    mode: "remote-render",
    message: "Os logs do Aeternus-Lavalink são mantidos pelo serviço de infraestrutura. A Yukina não executa docker logs localmente.",
    serviceId: RENDER_SERVICE_ID || null
  }, null, 2));
}

async function watch() {
  requireRemote();

  console.log("Yukina Runner monitorando o Lavalink hospedado pela Yukina através do Aeternus-Lavalink/Render.");

  let wasOnline = false;

  const check = async () => {
    const online = await serviceOnline();

    console.log(JSON.stringify({
      event: "status",
      owner: "Yukina",
      runtime: "Aeternus-Lavalink",
      infrastructure: "Render",
      status: online ? "online" : "offline",
      checkedAt: new Date().toISOString()
    }));

    if (online) {
      wasOnline = true;
      return;
    }

    if (!wasOnline) return;

    if (!renderConfigured()) {
      console.log(
        "Lavalink indisponível, mas o controle do Render não está configurado; recuperação automática não pode ser executada."
      );
      return;
    }

    console.log("Lavalink ficou indisponível. Solicitando reinicialização do serviço...");

    try {
      await restart();
    } catch (error) {
      console.error("Falha na recuperação: " + error.message);
    }

    wasOnline = false;
  };

  await check();
  setInterval(check, CHECK_INTERVAL_MS);
}

function help() {
  console.log(`
Yukina Manager — Runner

Arquitetura:
  Yukina → Aeternus-Lavalink → Docker/Render → Lavalink

Variáveis:
  YUKINA_LAVALINK_URL=https://seu-servico-aeternus-lavalink.onrender.com
  LAVALINK_SERVER_PASSWORD=mesma_senha_do_Aeternus-Lavalink
  RENDER_API_KEY=credencial_do_ambiente
  RENDER_LAVALINK_SERVICE_ID=id_do_servico

Uso:
  node manager/runner/index.js start
  node manager/runner/index.js stop
  node manager/runner/index.js restart
  node manager/runner/index.js status
  node manager/runner/index.js logs
  node manager/runner/index.js watch

A Yukina não executa Docker localmente. Ela controla e monitora o Lavalink
que é executado pelo Docker do Aeternus-Lavalink no Render.
`);
}

const command = process.argv[2] || "help";

(async () => {
  try {
    switch (command) {
      case "start": await start(); break;
      case "stop": await stop(); break;
      case "restart": await restart(); break;
      case "status": await status(); break;
      case "logs": await logs(); break;
      case "watch": await watch(); break;
      default: help();
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();
