"use strict";

/**
 * Yukina — ponto de entrada.
 * Bot Discord + API do painel. A lógica fica em src/.
 */

const { TOKEN } = require("./src/config");
const { createClient } = require("./src/bot/client");
const { registerEvents } = require("./src/bot/events");
const { startApiServer } = require("./src/api/server");
const { initializeDiscord, setupShutdown } = require("./src/bootstrap");

if (!TOKEN) {
  console.error("❌ [Yukina] Token do Discord ausente. Configure DISCORD_TOKEN nas variáveis de ambiente do Render.");
  process.exit(1);
}

const client = createClient();
registerEvents(client);
const server = startApiServer(client);
setupShutdown(client, server);

initializeDiscord(client).catch((error) => {
  console.error("[Inicialização] Falha fatal ao iniciar a Yukina:", error);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1500).unref();
});
