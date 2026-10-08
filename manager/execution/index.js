const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const RUNNER = path.join(ROOT, "manager", "runner", "index.js");

const ACTIONS = new Set(["start", "stop", "restart", "status", "logs"]);

function execute(action) {
  if (!ACTIONS.has(action)) {
    return {
      ok: false,
      action,
      error: "Ação de execução inválida."
    };
  }

  const result = spawnSync(process.execPath, [RUNNER, action], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    ok: result.status === 0,
    action,
    exitCode: result.status ?? 1,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || ""
  };
}

function printResult(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

const action = process.argv[2];

if (!action) {
  printResult({
    ok: false,
    error: "Informe uma ação.",
    allowedActions: [...ACTIONS]
  });
  process.exitCode = 1;
} else {
  printResult(execute(action));
}
