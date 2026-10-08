const http = require("node:http");
const { URL } = require("node:url");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const EXECUTION = path.join(ROOT, "manager", "execution", "index.js");

const HOST = process.env.API_HOST || "127.0.0.1";
const PORT = Number(process.env.API_PORT || 8080);

const ACTIONS = new Set(["start", "stop", "restart", "status", "logs"]);

function execute(action) {
  if (!ACTIONS.has(action)) {
    return { ok: false, error: "Ação inválida." };
  }

  const result = spawnSync(process.execPath, [EXECUTION, action], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return {
      ok: false,
      action,
      exitCode: result.status ?? 1,
      stdout: result.stdout?.trim() || "",
      stderr: result.stderr?.trim() || ""
    };
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      name: "Yukina Manager API",
      version: "1.0.0",
      part: 3,
      status: "online"
    });
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    return sendJson(res, 200, execute("status"));
  }

  const match = url.pathname.match(/^\/api\/(start|stop|restart|logs)$/);

  if (req.method === "POST" && match) {
    const result = execute(match[1]);
    return sendJson(res, result.ok ? 200 : 500, result);
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "yukina-manager-api"
    });
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Endpoint não encontrado."
  });
});

server.on("clientError", (error, socket) => {
  if (error.code === "ECONNRESET" || !socket.writable) return;
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(PORT, HOST, () => {
  console.log(`Yukina Manager API em http://${HOST}:${PORT}`);
});
