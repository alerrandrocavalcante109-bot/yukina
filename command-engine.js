/**
 * Motor central de comandos Yukina: módulos em commands/ podem exportar
 * execute(interaction) para Slash e prefixExecute(message, args, client) para Y/y.
 */
const fs = require("node:fs");
const path = require("node:path");
const prefixCache = new Map();
const { AsyncLocalStorage } = require("node:async_hooks");
const prefixReplyContext = new AsyncLocalStorage();
const patchedChannels = new WeakSet();

// Instala um wrapper único por canal; o contexto assíncrono identifica a mensagem
// correta sem trocar channel.send globalmente a cada comando concorrente.
function installReplyAwareChannel(channel) {
  if (patchedChannels.has(channel)) return;
  const originalSend = channel.send.bind(channel);
  channel.send = (options) => {
    const context = prefixReplyContext.getStore();
    if (!context || !context.active) return originalSend(options);

    let payload = options;
    if (typeof options === "string") {
      payload = { content: options };
    } else if (options && typeof options === "object" && !Array.isArray(options)) {
      const source = options.options && typeof options.options === "object"
        ? options.options
        : options;
      payload = { ...source };
    }

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      payload.reply = { messageReference: context.message.id, failIfNotExists: false };
      payload.allowedMentions = {
        ...(payload.allowedMentions || {}),
        repliedUser: true
      };
    }
    return originalSend(payload);
  };
  patchedChannels.add(channel);
}
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
      const prefixHandler = command?.prefixExecute || command?.executePrefix;
      const isSlash = Boolean(command?.data?.name && typeof command.execute === "function");
      const isPrefix = typeof prefixHandler === "function";
      const name = command?.data?.name || command?.name || command?.aliases?.[0];
      if (!name || (!isSlash && !isPrefix)) {
        console.warn(`⚠️ [Motor] Módulo ignorado: ${path.relative(__dirname, file)}`);
        continue;
      }
      if (client.commands.has(name)) {
        console.warn(`⚠️ [Motor] Comando duplicado ignorado: ${name}`);
        continue;
      }
      client.commands.set(name, command);
      console.log(isSlash
        ? `🌙 [SLASH] /${name} — carregado pelo motor`
        : `⌨️ [PREFIXO] Y${name} — carregado pelo motor`);
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
      // Todas as interações de componentes são processadas exclusivamente por interaction.js.
      // Não processe o mesmo botão/select/modal em dois listeners, pois ambos podem tentar responder.
      if (componentType) return;
    } catch (error) {
      console.error("[Motor] Falha ao processar interação:", error);
      const { MessageFlags } = require("discord.js");
      const payload = { content: "❄️ Não consegui concluir essa ação. Tente novamente.", flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else if (interaction.isRepliable()) await interaction.reply(payload).catch(() => {});
    }
  });
}
function startPrefixEngine(client, getSettingsCollection) {
  client.on("yukinaPrefixUpdated", (guildId, prefix) => {
    prefixCache.set(String(guildId), { prefix: String(prefix || "Y"), expiresAt: Date.now() + 30000 });
    console.log(`[Prefixo] Motor principal atualizado para ${prefix} no servidor ${guildId}`);
  });
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    for (const command of client.commands.values()) {
      if (typeof command?.handleMessage === "function") {
        try { await command.handleMessage(message); }
        catch (error) { console.error("[Motor] Falha em handler de jogo:", error); }
      }
    }
    let configuredPrefix = "Y";
    const cachedPrefix = prefixCache.get(message.guild.id);
    if (cachedPrefix && cachedPrefix.expiresAt > Date.now()) {
      configuredPrefix = cachedPrefix.prefix;
    } else {
      try {
        if (typeof getSettingsCollection === "function") {
          const collection = await getSettingsCollection();
          const doc = await collection.findOne(
            { guildId: message.guild.id },
            { projection: { "settings.prefix": 1 } }
          );
          const candidate = String(doc?.settings?.prefix || "").trim();
          if (candidate && candidate.length <= 5 && !/\s/.test(candidate)) configuredPrefix = candidate;
        }
        prefixCache.set(message.guild.id, { prefix: configuredPrefix, expiresAt: Date.now() + 30000 });
      } catch (error) {
        console.error("[Prefixo] Não foi possível carregar o prefixo do servidor:", error?.message || error);
      }
    }
    // Mantém Y/y como compatibilidade quando o servidor usa o prefixo padrão.
    const prefixes = configuredPrefix === "Y" ? ["Y", "y"] : [configuredPrefix];
    const prefix = prefixes.find((value) => message.content.startsWith(value));
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
    // O contexto por mensagem evita que dois comandos simultâneos no mesmo canal
    // sobrescrevam/restaurem channel.send um do outro.
    installReplyAwareChannel(message.channel);
    const context = { message, active: true };
    try {
      await prefixReplyContext.run(context, () => executePrefix(message, args, client));
    } catch (error) {
      console.error(`❄️ [Motor] Erro em ${prefix}${commandName}:`, error);
      await message.reply("🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.").catch(() => {});
    } finally {
      context.active = false;
      clearInterval(typingInterval);
    }
  });
}
module.exports = function startCommandEngine(client, getSettingsCollection) {
  loadCommands(client);
  startInteractionEngine(client);
  startPrefixEngine(client, getSettingsCollection);
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
