/**
 * Motor central de comandos Yukina: módulos em commands/ podem exportar
 * execute(interaction) para Slash e prefixExecute(message, args, client) para Y/y.
 */
const fs = require("node:fs");
const path = require("node:path");
const PREFIXES = ["Y", "y"];
function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(file);
    return entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_") ? [file] : [];
  });
}
function loadCommands(client) {
  client.commands = client.commands || new Map();
  for (const file of findFiles(path.join(__dirname, "commands"))) {
    try {
      delete require.cache[require.resolve(file)];
      const command = require(file);
      const name = command?.data?.name || command?.name;
      if (!name || typeof command.execute !== "function") {
        console.warn(`⚠️ [Motor] Módulo ignorado: ${path.relative(__dirname, file)}`);
        continue;
      }
      if (client.commands.has(name)) {
        console.warn(`⚠️ [Motor] Comando duplicado ignorado: ${name}`);
        continue;
      }
      client.commands.set(name, command);
      console.log(`🌙 [SLASH] /${name} — carregado pelo motor`);
    } catch (error) {
      console.error(`❌ [Motor] Falha ao carregar ${path.relative(__dirname, file)}:`, error);
    }
  }
}
function startInteractionEngine(client) {
  if (client.__yukinaInteractionEngine) return;
  client.__yukinaInteractionEngine = true;
  client.on("interactionCreate", async interaction => {
    try {
      // Slash commands and registered components belong to interaction.js.
      // Handling them here too would execute slash commands twice and expire the interaction.
      if (interaction.isChatInputCommand()) return;
      const componentType = interaction.isButton() ? "button"
        : interaction.isAnySelectMenu() ? "select"
        : interaction.isModalSubmit() ? "modal" : null;
      if (componentType) {
        const handlers = client.components?.[componentType] || [];
        const matched = handlers.some(handler => {
          if (typeof handler.customId === "string") return handler.customId === interaction.customId;
          if (handler.customId instanceof RegExp) {
            handler.customId.lastIndex = 0;
            return handler.customId.test(interaction.customId);
          }
          return false;
        });
        if (matched) return;
      }
      for (const command of client.commands?.values() || []) {
        if (typeof command.handleInteraction === "function") {
          await command.handleInteraction(interaction);
          if (interaction.replied || interaction.deferred) return;
        }
      }
    } catch (error) {
      console.error("[Motor] Falha ao processar interação:", error);
      const payload = { content: "❄️ Não consegui concluir essa ação. Tente novamente.", ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else if (interaction.isRepliable()) await interaction.reply(payload).catch(() => {});
    }
  });
}
function startPrefixEngine(client) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    const prefix = PREFIXES.find((value) => message.content.startsWith(value));
    if (!prefix) return;
    const body = message.content.slice(prefix.length).trim();
    if (!body) return;
    const [rawName, ...args] = body.split(/\s+/);
    const name = rawName.toLowerCase();
    const entry = [...client.commands.entries()].find(([key, cmd]) =>
      key.toLowerCase() === name || (cmd.aliases || []).some((alias) => String(alias).toLowerCase() === name)
    );
    if (!entry) return;
    const [commandName, command] = entry;
    const executePrefix = command.prefixExecute || command.executePrefix;
    if (typeof executePrefix !== "function") {
      await message.reply("🌙 Este comando ainda não possui execução por prefixo.");
      return;
    }
    // Indicador nativo de digitação para todos os comandos de prefixo.
    await message.channel.sendTyping().catch(() => {});
    const typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => {});
    }, 8000);
    // Vincula envios feitos com texto/opções simples à mensagem do comando.
    // Não converte objetos internos MessagePayload do discord.js, pois isso os esvazia.
    const originalChannelSend = message.channel.send.bind(message.channel);
    message.channel.send = (options) => {
      let payload = options;
      if (typeof options === "string") {
        payload = { content: options };
      } else if (options && typeof options === "object" && !Array.isArray(options)) {
        // MessagePayload possui a configuração real em .options; preserva embeds/anexos.
        const source = options.options && typeof options.options === "object"
          ? options.options
          : options;
        payload = { ...source };
      }
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        payload.reply = { messageReference: message.id, failIfNotExists: false };
        payload.allowedMentions = {
          ...(payload.allowedMentions || {}),
          repliedUser: true
        };
      }
      return originalChannelSend(payload);
    };
    try {
      await executePrefix(message, args, client);
    } catch (error) {
      console.error(`❄️ [Motor] Erro em ${prefix}${commandName}:`, error);
      await message.reply("🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.").catch(() => {});
    } finally {
      message.channel.send = originalChannelSend;
      clearInterval(typingInterval);
    }
  });
}
module.exports = function startCommandEngine(client) {
  loadCommands(client);
  startInteractionEngine(client);
  startPrefixEngine(client);
  const all = [...client.commands.entries()];
  const slash = all.filter(([, c]) => c?.data?.name).map(([, c]) => `/${c.data.name}`);
  const prefix = all.filter(([, c]) => typeof c.prefixExecute === "function" || typeof c.executePrefix === "function")
    .map(([name, c]) => `${c.prefix || "Y"}${name}`);
  console.log("");
  console.log("╭──────────── ❄️ MOTOR DE COMANDOS ❄️ ────────────╮");
  console.log(slash.length ? `🌙 Slash (${slash.length}): ${slash.join(", ")}` : "🌙 Slash: nenhum comando carregado.");
  console.log(prefix.length ? `⌨️ Prefixo Y/y (${prefix.length}): ${prefix.join(", ")}` : "⌨️ Prefixo Y/y: nenhum handler prefixado nos módulos.");
  console.log("╰─────────────────────────────────────────────────╯");
  console.log("");
};
