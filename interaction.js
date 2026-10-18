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
    ephemeral: true,
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

  console.log("");
  console.log("╭────────────── ❄️ COMANDOS YUKINA ❄️ ──────────────╮");
  loadCommands(client);
  const prefixCommands = [...client.commands.entries()].filter(([, command]) =>
    typeof command.prefixExecute === "function" || typeof command.executePrefix === "function"
  );
  if (prefixCommands.length) {
    console.log(`⌨️ Prefixo: ${prefixCommands.length} comando(s) com suporte a prefixo.`);
  } else {
    console.log("⌨️ Prefixo: nenhum handler de prefixo encontrado nos módulos atuais.");
  }
  console.log(`🌙 Slash: ${client.commands.size} comando(s) carregado(s) para interações.`);
  loadComponents(client);
  console.log("╰───────────────────────────────────────────────────╯");
  console.log("");

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "Esse comando ainda não está disponível na Yukina.",
              ephemeral: true,
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
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Esta opção ainda não está conectada à Yukina. Tente novamente mais tarde.",
            ephemeral: true,
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
