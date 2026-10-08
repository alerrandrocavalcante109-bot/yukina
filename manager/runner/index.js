const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const LAVALINK_DIR = path.join(ROOT, "lavalink");
const LOG_DIR = path.join(ROOT, "manager", "logs");
const LOG_FILE = path.join(LOG_DIR, "lavalink.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

function run(args, options = {}) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: LAVALINK_DIR,
    encoding: "utf8",
    stdio: options.stdio || "pipe"
  });
}

function appendLog(text) {
  if (!text) return;
  fs.appendFileSync(LOG_FILE, text);
}

function dockerAvailable() {
  const result = spawnSync("docker", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

function start() {
  if (!dockerAvailable()) {
    console.error("Docker não está instalado ou não está disponível no PATH.");
    process.exitCode = 1;
    return;
  }

  console.log("Iniciando Lavalink...");
  const result = run(["up", "-d"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível iniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }

  console.log("Lavalink iniciado. O Docker Compose ficará responsável pelo reinício automático.");
}

function stop() {
  console.log("Parando Lavalink...");
  const result = run(["stop"]);
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
  console.log("Reiniciando Lavalink...");
  const result = run(["restart"]);
  appendLog(result.stdout);
  appendLog(result.stderr);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível reiniciar o Lavalink.");
    process.exitCode = result.status || 1;
    return;
  }

  console.log("Lavalink reiniciado.");
}

function status() {
  const result = run(["ps", "--format", "json"]);

  if (result.status !== 0) {
    console.error(result.stderr || "Não foi possível consultar o status.");
    process.exitCode = result.status || 1;
    return;
  }

  const output = result.stdout.trim();

  if (!output) {
    console.log(JSON.stringify({
      service: "lavalink",
      status: "offline"
    }, null, 2));
    return;
  }

  try {
    const rows = output.split("\n").filter(Boolean).map(JSON.parse);
    const service = rows.find(row => row.Service === "lavalink") || rows[0];

    console.log(JSON.stringify({
      service: "lavalink",
      status: service?.State || "unknown",
      container: service?.Name || "yukina-lavalink",
      ports: service?.Ports || "2333"
    }, null, 2));
  } catch {
    console.log(output);
  }
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

function help() {
  console.log(`
Yukina Manager — Runner

Uso:
  node manager/runner/index.js start
  node manager/runner/index.js stop
  node manager/runner/index.js restart
  node manager/runner/index.js status
  node manager/runner/index.js logs

Funções da Parte 1:
  • iniciar o Lavalink
  • parar o Lavalink
  • reiniciar o Lavalink
  • consultar o status
  • registrar logs
  • aproveitar o restart: unless-stopped do Docker Compose
`);
}

const command = process.argv[2] || "help";

switch (command) {
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    restart();
    break;
  case "status":
    status();
    break;
  case "logs":
    logs();
    break;
  default:
    help();
}
