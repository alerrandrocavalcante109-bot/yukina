const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const EXECUTION = path.join(ROOT, "manager", "execution", "index.js");

const intervalMs = Number(process.env.MONITOR_INTERVAL_MS || 15000);
const autoRestart = process.env.MONITOR_AUTO_RESTART !== "false";

function status() {
  const result = spawnSync(process.execPath, [EXECUTION, "status"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { ok: false, status: "unknown", error: result.stderr || "status inválido" };
  }
}

function restart() {
  return spawnSync(process.execPath, [EXECUTION, "restart"], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

function check() {
  const result = status();
  const state = String(result.stdout?.status || result.status || "").toLowerCase();
  const online = ["running", "up"].some(value => state.includes(value));

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    online,
    state: result.stdout?.status || result.status || "unknown"
  }));

  if (!online && autoRestart) {
    console.log("Lavalink offline. Tentando reiniciar...");
    const restarted = restart();
    console.log(restarted.status === 0 ? "Reinício solicitado." : "Falha ao solicitar reinício.");
  }
}

if (require.main === module) {
  console.log("Yukina Monitor iniciado: intervalo " + intervalMs + "ms");
  check();
  setInterval(check, intervalMs);
}

module.exports = { status, restart, check };
