/**
 * Yukina — centralizador de interações do Discord.js v14.
 *
 * Estrutura aceita:
 *   commands/<arquivo>.js                 -> { data: SlashCommandBuilder, execute(interaction) }
 *   components/buttons/<arquivo>.js       -> { customId: "id-exato", execute(interaction) }
 *   components/selects/<arquivo>.js       -> { customId: "id-exato", execute(interaction) }
 *   components/modals/<arquivo>.js        -> { customId: "id-exato", execute(interaction) }
 *
 * Também aceita customId como RegExp. Cada módulo é opcional: diretórios inexistentes
 * são ignorados para que a Yukina possa ser separada aos poucos sem quebrar a inicialização.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MessageFlags } = require("discord.js");

const ROOT = __dirname;

function loadJsFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...loadJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_")) {
      files.push(fullPath);
    }
  }

  return files;
}

function loadCommands(client) {
  const directory = path.join(ROOT, "commands");
  for (const file of loadJsFiles(directory)) {
    try {
      delete require.cache[require.resolve(file)];
      const command = require(file);
      const name = command?.data?.name || command?.name;
      if (!name || typeof command.execute !== "function") {
        console.warn(`[Interactions] Comando ignorado (precisa de data.name/name e execute): ${path.relative(ROOT, file)}`);
        continue;
      }
      if (client.commands.has(name)) {
        console.warn(`[Interactions] Comando duplicado ignorado: ${name}`);
        continue;
      }
      client.commands.set(name, command);
      console.log(`   🌙 [SLASH] /${name} — carregado e pronto para sincronização`);
      if (typeof command.prefixExecute === "function" || typeof command.executePrefix === "function") {
        console.log(`   ⌨️ [PREFIXO] ${command.prefix || "Y"}${name} — handler de prefixo encontrado`);
      }
    } catch (error) {
      console.error(`[Interactions] Falha ao carregar ${path.relative(ROOT, file)}:`, error);
    }
  }
}

function loadComponents(client) {
  const types = [
    ["buttons", "button"],
    ["selects", "select"],
    ["modals", "modal"],
  ];

  for (const [folder, type] of types) {
    const directory = path.join(ROOT, "components", folder);
    for (const file of loadJsFiles(directory)) {
      try {
        delete require.cache[require.resolve(file)];
        const component = require(file);
        if ((typeof component?.customId !== "string" && !(component?.customId instanceof RegExp)) ||
            typeof component.execute !== "function") {
          console.warn(`[Interactions] Componente ignorado (precisa de customId e execute): ${path.relative(ROOT, file)}`);
          continue;
        }
        client.components[type].push(component);
        console.log(`[Interactions] Componente carregado (${type}): ${path.relative(ROOT, file)}`);
      } catch (error) {
        console.error(`[Interactions] Falha ao carregar componente ${path.relative(ROOT, file)}:`, error);
      }
    }
  }
}

function matchesCustomId(handler, customId) {
  if (typeof handler.customId === "string") return handler.customId === customId;
  handler.customId.lastIndex = 0;
  return handler.customId.test(customId);
}

async function safeErrorReply(interaction, error) {
  console.error("[Interactions] Erro ao executar interação:", error);
  const payload = {
    content: "❄️ A Yukina encontrou um erro ao executar esta ação. Tente novamente; se continuar, avise a equipe.",
    flags: MessageFlags.Ephemeral,
  };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (replyError) {
    // A interação pode ter expirado; não deixe um erro de resposta derrubar o bot.
    console.error("[Interactions] Não foi possível responder à interação:", replyError.message);
  }
}

function registerInteractionHandlers(client) {
  client.commands = client.commands || new Map();
  client.components = client.components || { button: [], select: [], modal: [] };

  loadComponents(client);

  // Componentes podem restaurar tarefas persistentes depois que o Discord estiver pronto.
  const initializeComponents = async () => {
    for (const type of ["button", "select", "modal"]) {
      for (const component of client.components[type]) {
        if (typeof component.initialize !== "function") continue;
        try {
          await component.initialize(client);
        } catch (error) {
          console.error("[Interactions] Falha ao inicializar componente:", error);
        }
      }
    }
  };
  if (client.isReady()) initializeComponents();
  else client.once("ready", initializeComponents);

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Esse comando ainda não está disponível na Yukina.",
              flags: MessageFlags.Ephemeral,
            });
          }
          return;
        }

        await command.execute(interaction, client);
        return;
      }

      let type = null;
      if (interaction.isButton()) type = "button";
      else if (interaction.isAnySelectMenu()) type = "select";
      else if (interaction.isModalSubmit()) type = "modal";
      if (!type) return;

      const handler = client.components[type].find((item) =>
        matchesCustomId(item, interaction.customId)
      );

      if (!handler) {
        // Compatibilidade com comandos antigos que exportam handleInteraction().
        // Este é o único listener que os executa, evitando respostas duplicadas.
        for (const command of client.commands.values()) {
          if (typeof command.handleInteraction !== "function") continue;
          await command.handleInteraction(interaction);
          if (interaction.replied || interaction.deferred) return;
        }

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.",
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      await handler.execute(interaction, client);
    } catch (error) {
      await safeErrorReply(interaction, error);
    }
  });

  console.log("[Interactions] Centralizador de interações ativado.");
}

module.exports = registerInteractionHandlers;
