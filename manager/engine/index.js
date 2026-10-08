const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(ROOT, "manager", "runner", "index.js");
const LOG_DIR = path.join(ROOT, "manager", "logs");
const LOG_FILE = path.join(LOG_DIR, "engine.log");

const RESTART_DELAY_MS = Number(process.env.ENGINE_RESTART_DELAY_MS || 3000);
const RUNNER_CHECK_MS = Number(process.env.ENGINE_CHECK_MS || 5000);

fs.mkdirSync(LOG_DIR, { recursive: true });

let runnerProcess = null;
let stopping = false;
let restartTimer = null;

function log(message) {
  const line = "[" + new Date().toISOString() + "] " + message + "\n";
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

function startRunner() {
  if (stopping || runnerProcess) return;

  log("Iniciando Runner em modo watch...");

  runnerProcess = spawn(process.execPath, [RUNNER, "watch"], {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  runnerProcess.stdout.on("data", data => {
    const text = data.toString();
    process.stdout.write(text);
    fs.appendFileSync(LOG_FILE, text);
  });

  runnerProcess.stderr.on("data", data => {
    const text = data.toString();
    process.stderr.write(text);
    fs.appendFileSync(LOG_FILE, text);
  });

  runnerProcess.on("error", error => {
    log("Erro ao executar o Runner: " + error.message);
  });

  runnerProcess.on("exit", (code, signal) => {
    runnerProcess = null;

    if (stopping) {
      log("Runner encerrado pelo Engine.");
      return;
    }

    log("Runner encerrou inesperadamente. Código: " + code + ", sinal: " + (signal || "none"));
    scheduleRestart();
  });
}

function scheduleRestart() {
  if (stopping || restartTimer) return;

  log("Novo Runner será iniciado em " + RESTART_DELAY_MS + "ms.");

  restartTimer = setTimeout(() => {
    restartTimer = null;
    startRunner();
  }, RESTART_DELAY_MS);
}

function stop() {
  stopping = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (runnerProcess) {
    log("Encerrando Runner...");
    runnerProcess.kill("SIGTERM");
  }

  setTimeout(() => {
    if (runnerProcess) runnerProcess.kill("SIGKILL");
    log("Engine encerrado.");
    process.exit(0);
  }, 3000);
}

function status() {
  return {
    engine: "online",
    runner: runnerProcess ? "online" : "offline",
    restartScheduled: Boolean(restartTimer),
    checkedAt: new Date().toISOString()
  };
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

log("Yukina Engine iniciado.");
startRunner();

setInterval(() => {
  if (!stopping && !runnerProcess && !restartTimer) {
    log("Runner não está ativo. Recuperando...");
    startRunner();
  }
}, RUNNER_CHECK_MS);

if (require.main === module) {
  process.on("message", message => {
    if (message === "status") process.send?.(status());
    if (message === "stop") stop();
  });
}

module.exports = { startRunner, stop, status };
