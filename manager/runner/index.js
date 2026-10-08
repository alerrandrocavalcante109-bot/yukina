const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const LAVALINK_DIR = path.join(ROOT, "lavalink");
const LOG_DIR = path.join(ROOT, "manager", "logs");
const LOG_FILE = path.join(LOG_DIR, "lavalink.log");

const HOST = process.env.LAVALINK_HOST || "127.0.0.1";
const PORT = Number(process.env.LAVALINK_PORT || 2333);
const REMOTE_URL = String(process.env.YUKINA_LAVALINK_URL || process.env.LAVALINK_URL || "").replace(/\/$/, "");
const LAVALINK_PASSWORD = process.env.LAVALINK_SERVER_PASSWORD || "";
const CHECK_INTERVAL_MS = Number(process.env.RUNNER_INTERVAL_MS || 10000);
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const RENDER_SERVICE_ID = process.env.RENDER_LAVALINK_SERVICE_ID || "";

fs.mkdirSync(LOG_DIR, { recursive: true });

function isRemote() { return Boolean(REMOTE_URL); }

function localRun(args) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: LAVALINK_DIR, encoding: "utf8", stdio: "pipe"
  });
}

function appendLog(value) { if (value) fs.appendFileSync(LOG_FILE, value); }

function dockerAvailable() {
  return spawnSync("docker", ["--version"], { encoding: "utf8" }).status === 0;
}

function containerState() {
  const result = spawnSync("docker", ["inspect", "--format", "{{.State.Status}}", "yukina-lavalink"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "not_found";
}

function remoteConfigured() {
  return Boolean(RENDER_API_KEY && RENDER_SERVICE_ID);
}

async function remoteRequest(method, endpoint) {
  if (!remoteConfigured()) throw new Error("Controle remoto do Render não configurado. Defina RENDER_API_KEY e RENDER_LAVALINK_SERVICE_ID.");

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
    try { message = JSON.parse(body)?.message || body; } catch {}
    throw new Error("Render API HTTP " + response.status + ": " + message);
  }

  try { return body ? JSON.parse(body) : { ok: true }; }
  catch { return { ok: true, body }; }
}

function lavalinkHeaders() {
  const headers = { Accept: "application/json" };
  if (LAVALINK_PASSWORD) headers.Authorization = LAVALINK_PASSWORD;
  return headers;
}

async function serviceOnline() {
  if (isRemote()) {
    try {
      const response = await fetch(REMOTE_URL + "/v4/info", { headers: lavalinkHeaders(), signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch { return false; }
  }

  if (containerState() !== "running") return false;
  try {
    const response = await fetch("http://" + HOST + ":" + PORT + "/v4/info", { headers: lavalinkHeaders(), signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch { return false; }
}

async function start() {
  if (isRemote()) {
    const result = await remoteRequest("POST", "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/resume");
    console.log(JSON.stringify({ mode: "render", action: "start", ok: true, result }, null, 2));
    return;
  }

  if (!dockerAvailable()) {
    console.error("Docker não está instalado ou não está disponível no PATH.");
    process.exitCode = 1;
    return;
  }

  const result = localRun(["up", "-d"]);
  appendLog(result.stdout); appendLog(result.stderr);
  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível iniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }
  console.log("Lavalink iniciado.");
}

async function stop() {
  if (isRemote()) {
    const result = await remoteRequest("POST", "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/suspend");
    console.log(JSON.stringify({ mode: "render", action: "stop", ok: true, result }, null, 2));
    return;
  }

  const result = localRun(["stop", "lavalink"]);
  appendLog(result.stdout); appendLog(result.stderr);
  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível parar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }
  console.log("Lavalink parado.");
}

async function restart() {
  if (isRemote()) {
    const result = await remoteRequest("POST", "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID) + "/restart");
    console.log(JSON.stringify({ mode: "render", action: "restart", ok: true, result }, null, 2));
    return;
  }

  const result = localRun(["restart", "lavalink"]);
  appendLog(result.stdout); appendLog(result.stderr);
  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível reiniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }
  console.log("Lavalink reiniciado.");
}

async function status() {
  const online = await serviceOnline();

  if (isRemote()) {
    let render = null;
    if (remoteConfigured()) {
      try { render = await remoteRequest("GET", "/v1/services/" + encodeURIComponent(RENDER_SERVICE_ID)); }
      catch (error) { render = { error: error.message }; }
    }

    console.log(JSON.stringify({
      service: "lavalink",
      mode: "remote-render",
      status: online ? "online" : "offline",
      url: REMOTE_URL,
      renderServiceId: RENDER_SERVICE_ID || null,
      render,
      checkedAt: new Date().toISOString()
    }, null, 2));
    return;
  }

  const state = containerState();
  console.log(JSON.stringify({
    service: "lavalink",
    mode: "local-docker",
    status: online ? "online" : state === "running" ? "starting_or_unhealthy" : "offline",
    container: "yukina-lavalink",
    containerState: state,
    host: HOST,
    port: PORT,
    checkedAt: new Date().toISOString()
  }, null, 2));
}

async function logs() {
  if (isRemote()) {
    console.log(JSON.stringify({
      ok: true,
      mode: "remote-render",
      message: "Os logs do Aeternus-Lavalink permanecem no Render; o Runner não executa docker logs localmente.",
      serviceId: RENDER_SERVICE_ID || null
    }, null, 2));
    return;
  }

  const result = localRun(["logs", "--tail", "100", "lavalink"]);
  appendLog(result.stdout); appendLog(result.stderr);
  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível obter os logs.");
    process.exitCode = result.status || 1;
    return;
  }
  process.stdout.write(result.stdout);
}

async function watch() {
  if (!isRemote() && !dockerAvailable()) {
    console.error("Docker não está disponível.");
    process.exitCode = 1;
    return;
  }

  console.log("Yukina Runner monitorando Lavalink em modo " + (isRemote() ? "Render remoto" : "Docker local") + ".");
  let wasOnline = false;

  const check = async () => {
    const online = await serviceOnline();

    console.log(JSON.stringify({
      event: "status",
      status: online ? "online" : "offline",
      mode: isRemote() ? "remote-render" : "local-docker",
      checkedAt: new Date().toISOString()
    }));

    if (online) {
      wasOnline = true;
      return;
    }

    if (!wasOnline) return;

    console.log("Lavalink ficou indisponível. Solicitando recuperação...");

    try {
      if (isRemote()) {
        if (!remoteConfigured()) {
          console.log("RENDER_API_KEY/RENDER_LAVALINK_SERVICE_ID ausentes; recuperação remota indisponível.");
          return;
        }
        await restart();
      } else {
        const result = localRun(["up", "-d"]);
        appendLog(result.stdout); appendLog(result.stderr);
      }
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

Modo remoto:
  YUKINA_LAVALINK_URL=https://seu-lavalink.onrender.com
  LAVALINK_SERVER_PASSWORD=mesma_senha_do_Aeternus-Lavalink
  RENDER_API_KEY=...
  RENDER_LAVALINK_SERVICE_ID=...

Uso:
  node manager/runner/index.js start
  node manager/runner/index.js stop
  node manager/runner/index.js restart
  node manager/runner/index.js status
  node manager/runner/index.js logs
  node manager/runner/index.js watch

Com YUKINA_LAVALINK_URL, o Runner monitora o Lavalink do Aeternus-Lavalink.
Com RENDER_API_KEY + RENDER_LAVALINK_SERVICE_ID, também pode controlar o serviço no Render.
Sem LAVALINK_URL, mantém o modo Docker local.
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
