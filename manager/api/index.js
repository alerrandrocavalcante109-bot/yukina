const http = require("node:http");
const { URL } = require("node:url");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { create, validate, checkRateLimit } = require("../requests");
const { authorize, getToken, isConfigured } = require("../auth");
const github = require("../github");
const { load } = require("../config");

const ROOT = path.resolve(__dirname, "../..");
const EXECUTION = path.join(ROOT, "manager", "execution", "index.js");
const config = load();

const HOST = process.env.API_HOST || config.api.host;
const PORT = Number(process.env.API_PORT || config.api.port);
const REQUIRE_TOKEN = config.security.requireToken;

function execute(action) {
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

function protectedRequest(req, res) {
  if (!REQUIRE_TOKEN) return true;

  if (!isConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: "Autenticação não configurada. Defina YUKINA_MANAGER_TOKEN."
    });
    return false;
  }

  const clientId = req.socket.remoteAddress || "local";
  const rate = checkRateLimit(clientId);

  if (!rate.ok) {
    sendJson(res, 429, rate);
    return false;
  }

  if (!authorize(getToken(req))) {
    sendJson(res, 401, {
      ok: false,
      error: "Token inválido ou ausente."
    });
    return false;
  }

  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      name: "Yukina Manager API",
      version: "1.0.0",
      status: "online",
      authenticated: REQUIRE_TOKEN
    });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "yukina-manager-api"
    });
  }

  if (!protectedRequest(req, res)) return;

  if (req.method === "GET" && url.pathname === "/api/status") {
    const request = create("status");
    const validation = validate(request);
    if (!validation.ok) return sendJson(res, 400, validation);

    return sendJson(res, 200, {
      requestId: request.id,
      result: execute(request.action)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/github/repositories") {
    try {
      const page = url.searchParams.get("page") || "1";
      const perPage = url.searchParams.get("perPage") || "100";
      const result = await github.repositories({ page, perPage });

      return sendJson(res, 200, {
        ok: true,
        source: "github",
        ...result
      });
    } catch (error) {
      return sendJson(res, 502, {
        ok: false,
        source: "github",
        error: error.message
      });
    }
  }

  const match = url.pathname.match(/^\/api\/(start|stop|restart|logs)$/);

  if (req.method === "POST" && match) {
    const request = create(match[1]);
    const validation = validate(request);

    if (!validation.ok) return sendJson(res, 400, validation);

    const result = execute(request.action);
    return sendJson(res, result.ok ? 200 : 500, {
      requestId: request.id,
      result
    });
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Endpoint não encontrado."
  });
});

server.listen(PORT, HOST, () => {
  console.log("Yukina Manager API em http://" + HOST + ":" + PORT);
});
