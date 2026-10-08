const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const LAVALINK_DIR = path.join(ROOT, "lavalink");
const LOG_DIR = path.join(ROOT, "manager", "logs");
const LOG_FILE = path.join(LOG_DIR, "lavalink.log");

const HOST = process.env.LAVALINK_HOST || "127.0.0.1";
const PORT = Number(process.env.LAVALINK_PORT || 2333);
const CHECK_INTERVAL_MS = Number(process.env.RUNNER_INTERVAL_MS || 10000);

fs.mkdirSync(LOG_DIR, { recursive: true });

function run(args) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: LAVALINK_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
}

function appendLog(text) {
  if (text) fs.appendFileSync(LOG_FILE, text);
}

function dockerAvailable() {
  return spawnSync("docker", ["--version"], { encoding: "utf8" }).status === 0;
}

function containerState() {
  const result = spawnSync(
    "docker",
    ["inspect", "--format", "{{.State.Status}}", "yukina-lavalink"],
    { encoding: "utf8" }
  );

  return result.status === 0 ? result.stdout.trim() : "not_found";
}

async function serviceOnline() {
  if (containerState() !== "running") return false;

  try {
    const response = await fetch(`http://${HOST}:${PORT}/v4/info`, {
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function start() {
  if (!dockerAvailable()) {
    console.error("Docker não está instalado ou não está disponível no PATH.");
    process.exitCode = 1;
    return;
  }

  const result = run(["up", "-d"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível iniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }

  console.log("Lavalink iniciado.");
}

function stop() {
  const result = run(["stop", "lavalink"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível parar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }

  console.log("Lavalink parado.");
}

function restart() {
  const result = run(["restart", "lavalink"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível reiniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }

  console.log("Lavalink reiniciado.");
}

async function status() {
  const state = containerState();
  const online = await serviceOnline();

  console.log(JSON.stringify({
    service: "lavalink",
    status: online ? "online" : state === "running" ? "starting_or_unhealthy" : "offline",
    container: "yukina-lavalink",
    containerState: state,
    host: HOST,
    port: PORT,
    checkedAt: new Date().toISOString()
  }, null, 2));
}

function logs() {
  const result = run(["logs", "--tail", "100", "lavalink"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível obter os logs.");
    process.exitCode = result.status || 1;
    return;
  }

  process.stdout.write(result.stdout);
}

async function watch() {
  if (!dockerAvailable()) {
    console.error("Docker não está disponível.");
    process.exitCode = 1;
    return;
  }

  console.log("Yukina Runner monitorando Lavalink.");
  let wasOnline = false;

  const check = async () => {
    const online = await serviceOnline();

    if (online) {
      wasOnline = true;
      console.log(JSON.stringify({
        event: "status",
        status: "online",
        checkedAt: new Date().toISOString()
      }));
      return;
    }

    if (wasOnline || containerState() === "not_found") {
      console.log("Lavalink indisponível. Solicitando reinício...");
      const result = run(["up", "-d"]);
      appendLog(result.stdout);
      appendLog(result.stderr);
      wasOnline = false;
    }
  };

  await check();
  setInterval(check, CHECK_INTERVAL_MS);
}

function help() {
  console.log(`
Yukina Manager — Runner

Uso:
  node manager/runner/index.js start
  node manager/runner/index.js stop
  node manager/runner/index.js restart
  node manager/runner/index.js status
  node manager/runner/index.js logs
  node manager/runner/index.js watch

Parte 1:
  • iniciar Lavalink
  • detectar disponibilidade real pela API /v4/info
  • parar
  • reiniciar automaticamente quando ficar indisponível
  • capturar logs
  • expor status básico para os próximos módulos
`);
}

const command = process.argv[2] || "help";

(async () => {
  switch (command) {
    case "start": start(); break;
    case "stop": stop(); break;
    case "restart": restart(); break;
    case "status": await status(); break;
    case "logs": logs(); break;
    case "watch": await watch(); break;
    default: help();
  }
})();
