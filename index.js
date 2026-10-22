/**
 * Yukina — bot mínimo
 * Apenas: health HTTP + login Discord + comando /painel (e Ypainel)
 */
require("dotenv").config();

const http = require("node:http");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  Partials,
} = require("discord.js");

const TOKEN = String(process.env.DISCORD_TOKEN || "").trim();
const PORT = Number(process.env.PORT || 10000);
const PANEL_URL =
  process.env.PANEL_URL ||
  "https://yukina-6uo.pages.dev/configuracoes-servidor.html";
const GUILD_ID = String(
  process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || ""
).trim();

if (!TOKEN) {
  console.error("[Yukina] DISCORD_TOKEN ausente.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

const painelData = new SlashCommandBuilder()
  .setName("painel")
  .setDescription("Abre as configurações deste servidor no painel web da Yukina.")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function buildPanelUrl(guildId, guildName) {
  const url = new URL(PANEL_URL);
  url.searchParams.set("guild", guildId);
  url.searchParams.set("name", guildName || "Servidor");
  return url.toString();
}

async function replyPainel(interaction) {
  if (!interaction.inGuild() || !interaction.guildId) {
    return interaction.reply({
      content: "❄️ Use este comando dentro de um servidor Discord.",
      flags: MessageFlags.Ephemeral,
    });
  }
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    return interaction.reply({
      content: "🔒 Você precisa da permissão **Gerenciar servidor** para abrir este painel.",
      flags: MessageFlags.Ephemeral,
    });
  }
  const link = buildPanelUrl(interaction.guildId, interaction.guild?.name);
  return interaction.reply({
    content: [
      "❄️ **Painel de Configurações da Yukina**",
      "Abra o painel para gerenciar as configurações deste servidor:",
      "",
      "🔗 " + link,
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

async function prefixPainel(message) {
  if (!message.guild || !message.guildId) {
    return message.reply("❄️ Use este comando dentro de um servidor Discord.");
  }
  const perms = message.member?.permissions;
  if (
    !perms?.has(PermissionFlagsBits.ManageGuild) &&
    !perms?.has(PermissionFlagsBits.Administrator)
  ) {
    return message.reply(
      "🔒 Você precisa da permissão **Gerenciar servidor** para abrir este painel."
    );
  }
  const link = buildPanelUrl(message.guildId, message.guild.name);
  return message.reply({
    content:
      "❄️ **Painel de Configurações da Yukina**\nAbra o painel para gerenciar as configurações deste servidor:\n\n🔗 " +
      link,
    allowedMentions: { parse: [] },
  });
}

// Health HTTP (Render)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      service: "Yukina",
      mode: "painel-only",
      ready: Boolean(client.isReady()),
      user: client.user ? client.user.tag : null,
    })
  );
});
server.listen(PORT, "0.0.0.0", () => {
  console.log("[Yukina] Health na porta " + PORT);
});

client.once("clientReady", async () => {
  console.log("");
  console.log("❄️ Yukina online: " + client.user.tag);
  console.log("🏠 Servidores: " + client.guilds.cache.size);
  console.log("📋 Modo: apenas /painel");
  console.log("");

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    const body = [painelData.toJSON()];
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
        body,
      });
      console.log("[Slash] /painel registrado no servidor " + GUILD_ID);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body });
      console.log("[Slash] /painel registrado globalmente (pode demorar até 1h)");
    }
  } catch (err) {
    console.error("[Slash] Falha ao registrar /painel:", err.message);
  }
});

// Fallback para versões que ainda emitem "ready"
client.once("ready", () => {
  if (!client.isReady()) return;
  client.emit("clientReady");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "painel") return;
  try {
    await replyPainel(interaction);
  } catch (error) {
    console.error("[Painel] Erro:", error);
    const payload = {
      content: "🫧 Não consegui abrir o painel agora. Tente de novo.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  if (!/^[Yy]painel(\s|$)/.test(content)) return;
  try {
    await prefixPainel(message);
  } catch (error) {
    console.error("[Painel] Erro prefixo:", error);
    await message.reply("🫧 Não consegui abrir o painel agora.").catch(() => {});
  }
});

client.on("error", (err) => console.error("[Discord] Client error:", err.message));

process.on("unhandledRejection", (r) =>
  console.error("[Yukina] unhandledRejection:", r)
);

console.log("[Yukina] Iniciando (modo painel)...");
client
  .login(TOKEN)
  .then(() => console.log("[Yukina] Login aceito; aguardando ready..."))
  .catch((err) => {
    console.error("[Yukina] Falha no login:", err.message);
    process.exit(1);
  });

// Encerramento limpo no Render
function shutdown(signal) {
  console.log("[Yukina] " + signal + " — encerrando.");
  try {
    client.destroy();
  } catch (_) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
