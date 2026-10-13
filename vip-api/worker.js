/**
 * Yukina VIP API — preparation scaffold only.
 * Checkout and webhook routes intentionally fail closed until a responsible
 * account owner, provider credentials, database, and verification logic exist.
 */
const PLANS = {
  starter: { name: "Starter", monthly: 790, annual: 7990 },
  plus: { name: "Plus", monthly: 990, annual: 9990 },
  premium: { name: "Premium", monthly: 1490, annual: 14990 },
  ultra: { name: "Ultra", monthly: 1990, annual: 19990 },
  infinity: { name: "Infinity", monthly: 2990, annual: 29990 }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "https://yukina-6uo.pages.dev",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ service: "yukina-vip-api", mode: "preparation", paymentsEnabled: false });
    }
    if (url.pathname === "/api/vip/plans" && request.method === "GET") {
      return json({
        currency: "BRL",
        plans: Object.entries(PLANS).map(([id, p]) => ({
          id, name: p.name, monthlyAmount: p.monthly, annualAmount: p.annual
        }))
      });
    }
    if (url.pathname === "/api/vip/checkout" && request.method === "POST") {
      return json({
        error: "payments_not_configured",
        message: "O checkout ainda não foi habilitado. Nenhuma cobrança foi realizada."
      }, 503);
    }
    if (url.pathname === "/api/vip/webhook" && request.method === "POST") {
      return json({
        error: "webhook_not_configured",
        message: "O processamento de pagamentos ainda não está habilitado."
      }, 503);
    }
    return json({ error: "not_found" }, 404);
  }
};