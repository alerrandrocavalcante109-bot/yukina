/**
 * Yukina — sem bot Discord.
 * Apenas health HTTP para o Render.
 * Painel web: https://yukina-6uo.pages.dev
 */
const http = require("node:http");

const PORT = Number(process.env.PORT || 10000);

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url === "/" || url === "/health" || url.startsWith("/health?")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        service: "Yukina",
        bot: false,
        message: "Bot Discord desativado. Use o painel web.",
        panel: "https://yukina-6uo.pages.dev/configuracoes-servidor.html",
        site: "https://yukina-6uo.pages.dev",
      })
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("[Yukina] Health HTTP na porta " + PORT);
  console.log("[Yukina] Bot Discord: DESATIVADO");
  console.log("[Yukina] Painel: https://yukina-6uo.pages.dev");
});

process.on("SIGTERM", () => {
  console.log("[Yukina] SIGTERM — encerrando health server.");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
