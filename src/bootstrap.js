"use strict";

const { TOKEN } = require("./config");
const memberData = require("../member-data");

async function initializeDiscord(client) {
  console.log("[Inicialização] Yukina iniciando...");
  if (!TOKEN) throw new Error("DISCORD_TOKEN não está configurado.");

  console.log("[Inicialização] Validando armazenamento...");
  await memberData.initialize();
  console.log("[Inicialização] Armazenamento validado.");

  console.log("[Inicialização] Listeners preparados.");
  console.log("[Inicialização] Autenticando e conectando ao Discord pelo discord.js...");

  let discordReady = false;
  const loginWatchdog = setTimeout(() => {
    if (discordReady) return;
    console.error("[Discord Gateway] O cliente ainda não ficou pronto após 120 segundos.", {
      wsStatus: client.ws.status,
      destroyed: client.ws.destroyed,
      readyAt: client.readyAt,
      user: client.user?.tag || null,
    });
  }, 120000);
  loginWatchdog.unref();

  client.once("clientReady", () => {
    discordReady = true;
    clearTimeout(loginWatchdog);
  });

  try {
    await client.login(TOKEN);
    console.log("[Inicialização] Login aceito pelo discord.js; aguardando clientReady.");
  } catch (error) {
    clearTimeout(loginWatchdog);
    console.error("[Inicialização] Não foi possível iniciar a sessão Discord:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      wsStatus: client.ws.status,
    });
    throw error;
  }
}

function setupShutdown(client, server) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Yukina] Recebido ${signal}; encerrando conexão e servidor HTTP...`);
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    try {
      client.destroy();
      await new Promise((resolve) => server.close(() => resolve()));
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error("[Yukina] Erro durante o encerramento:", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = { initializeDiscord, setupShutdown };
