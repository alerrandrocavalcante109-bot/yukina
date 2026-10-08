const { randomUUID } = require("node:crypto");

const ALLOWED_ACTIONS = new Set([
  "start",
  "stop",
  "restart",
  "status",
  "logs"
]);

const MAX_REQUESTS = 100;
const WINDOW_MS = 60_000;
const requests = new Map();

function cleanup(now) {
  for (const [key, timestamps] of requests) {
    const active = timestamps.filter(time => now - time < WINDOW_MS);
    if (active.length) requests.set(key, active);
    else requests.delete(key);
  }
}

function checkRateLimit(clientId = "local") {
  const now = Date.now();
  cleanup(now);

  const timestamps = requests.get(clientId) || [];

  if (timestamps.length >= MAX_REQUESTS) {
    return {
      ok: false,
      error: "Limite de requisições excedido.",
      retryAfterMs: WINDOW_MS - (now - timestamps[0])
    };
  }

  timestamps.push(now);
  requests.set(clientId, timestamps);

  return { ok: true };
}

function create(action, options = {}) {
  const id = randomUUID();

  if (!ALLOWED_ACTIONS.has(action)) {
    return {
      ok: false,
      id,
      error: "Ação não permitida.",
      allowedActions: [...ALLOWED_ACTIONS]
    };
  }

  return {
    ok: true,
    id,
    action,
    createdAt: new Date().toISOString(),
    options
  };
}

function validate(request) {
  if (!request || typeof request !== "object") {
    return { ok: false, error: "Solicitação inválida." };
  }

  if (!request.id || !request.action || !request.createdAt) {
    return { ok: false, error: "Solicitação incompleta." };
  }

  if (!ALLOWED_ACTIONS.has(request.action)) {
    return { ok: false, error: "Ação não permitida." };
  }

  if (Number.isNaN(Date.parse(request.createdAt))) {
    return { ok: false, error: "Data da solicitação inválida." };
  }

  return { ok: true };
}

module.exports = {
  ALLOWED_ACTIONS,
  checkRateLimit,
  create,
  validate
};

if (require.main === module) {
  const action = process.argv[2];

  if (!action) {
    console.log(JSON.stringify({
      ok: false,
      error: "Informe uma ação.",
      allowedActions: [...ALLOWED_ACTIONS]
    }, null, 2));
    process.exitCode = 1;
  } else {
    const request = create(action);
    console.log(JSON.stringify(request, null, 2));
  }
}
