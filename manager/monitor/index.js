const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const EXECUTION = path.join(ROOT, "manager", "execution", "index.js");
const intervalMs = Number(process.env.MONITOR_INTERVAL_MS || 15000);
const autoRestart = process.env.MONITOR_AUTO_RESTART !== "false";

function call(action) {
  const result = spawnSync(process.execPath, [EXECUTION, action], {
    cwd: ROOT,
    encoding: "utf8"
  });
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { ok: false, error: result.stderr || "Resposta inválida." };
  }
}

function check() {
  const execution = call("status");
  let service = null;

  try {
    service = JSON.parse(execution.stdout || "{}");
  } catch {}

  const state = String(service?.status || "unknown").toLowerCase();
  const online = state === "running" || state === "up";

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    online,
    state
  }));

  if (!online && autoRestart) {
    console.log("Lavalink offline. Solicitando reinício...");
    const restarted = call("restart");
    console.log(JSON.stringify({
      restartRequested: true,
      ok: restarted.ok
    }));
  }
}

if (require.main === module) {
  console.log("Yukina Monitor iniciado: intervalo " + intervalMs + "ms");
  check();
  setInterval(check, intervalMs);
}

module.exports = { call, check };
