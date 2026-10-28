"use strict";

const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags
} = require("discord.js");
const api = require("../systems/bot-transfer-api");

function isAdmin(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}
function helpText() {
  return [
    "❄️ **API de Transferência da Yukina**",
    "`Yapi gerar <ID_DO_BOT>` — cria uma chave de integração e envia por DM.",
    "`Yapi moeda <código> <nome> <símbolo>` — cadastra uma moeda na API.",
    "`Yapi revogar <ID_DO_BOT>` — invalida uma chave de integração.",
    "A chave só é mostrada uma vez. Nunca compartilhe em canais públicos."
  ].join("\n");
}
async function run(interactionOrMessage, mode, args = [], isSlash = false) {
  const member = isSlash ? interactionOrMessage.member : interactionOrMessage.member;
  if (!isAdmin(member)) {
    const text = "🛡️ Apenas administradores do servidor podem gerenciar integrações e moedas da API.";
    if (isSlash) return interactionOrMessage.reply({ content: text, flags: MessageFlags.Ephemeral });
    return interactionOrMessage.reply(text);
  }
  try {
    if (mode === "gerar") {
      const botId = isSlash ? interactionOrMessage.options.getString("bot_id", true) : args[0];
      const result = await api.createIntegration(botId, interactionOrMessage.user?.id || interactionOrMessage.author?.id);
      if (isSlash) {
        return interactionOrMessage.reply({
          content: "🔐 **Integração criada!**\nBot integrado: `" + result.botId + "`\n\nGuarde esta chave em uma variável de ambiente secreta no bot integrado:\n```\n" + result.key + "\n```\n**A chave será exibida apenas agora.**",
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] }
        });
      }
      try {
        await interactionOrMessage.author.send("🔐 **Chave da API de Transferência da Yukina**\nBot integrado: `" + result.botId + "`\n\nGuarde em uma variável de ambiente secreta. Esta chave só será exibida uma vez:\n```\n" + result.key + "\n```");
        return interactionOrMessage.reply("❄️ Integração criada! Enviei a chave por mensagem privada. Ela não será mostrada novamente.");
      } catch {
        return interactionOrMessage.reply("⚠️ A integração foi criada, mas não consegui enviar a chave por DM. Por segurança, revogue a integração e gere outra com as DMs abertas.");
      }
    }
    if (mode === "revogar") {
      const botId = isSlash ? interactionOrMessage.options.getString("bot_id", true) : args[0];
      await api.revokeIntegration(botId);
      const text = "🛡️ Integração do bot `" + botId + "` revogada. A chave anterior não pode mais acessar a API.";
      if (isSlash) return interactionOrMessage.reply({ content: text, flags: MessageFlags.Ephemeral });
      return interactionOrMessage.reply(text);
    }
    if (mode === "moeda") {
      const code = isSlash ? interactionOrMessage.options.getString("codigo", true) : args[0];
      const name = isSlash ? interactionOrMessage.options.getString("nome", true) : args[1];
      const symbol = isSlash ? interactionOrMessage.options.getString("simbolo", true) : args[2];
      const currency = await api.registerCurrency(code, name, symbol, interactionOrMessage.user?.id || interactionOrMessage.author?.id);
      const text = "🌸 Moeda cadastrada na API: **" + currency.name + "** (`" + currency.code + "`) — símbolo " + currency.symbol + ".";
      if (isSlash) return interactionOrMessage.reply({ content: text, flags: MessageFlags.Ephemeral });
      return interactionOrMessage.reply(text);
    }
    const text = helpText();
    if (isSlash) return interactionOrMessage.reply({ content: text, flags: MessageFlags.Ephemeral });
    return interactionOrMessage.reply(text);
  } catch (error) {
    const text = "❄️ Não consegui concluir: " + String(error.message || "erro inesperado").slice(0, 500);
    if (isSlash) {
      if (interactionOrMessage.replied || interactionOrMessage.deferred) return interactionOrMessage.followUp({ content: text, flags: MessageFlags.Ephemeral });
      return interactionOrMessage.reply({ content: text, flags: MessageFlags.Ephemeral });
    }
    return interactionOrMessage.reply(text);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("api")
    .setDescription("Gerencia a API segura de transferência entre bots integrados.")
    .addSubcommand(sub => sub.setName("gerar").setDescription("Gera uma chave para integrar um bot à API.")
      .addStringOption(option => option.setName("bot_id").setDescription("ID do bot Discord que será integrado").setRequired(true)))
    .addSubcommand(sub => sub.setName("revogar").setDescription("Revoga a chave e desativa uma integração.")
      .addStringOption(option => option.setName("bot_id").setDescription("ID do bot a desconectar").setRequired(true)))
    .addSubcommand(sub => sub.setName("moeda").setDescription("Cadastra uma moeda aceita pela API.")
      .addStringOption(option => option.setName("codigo").setDescription("Código único, por exemplo KZ ou GEM").setRequired(true))
      .addStringOption(option => option.setName("nome").setDescription("Nome da moeda").setRequired(true))
      .addStringOption(option => option.setName("simbolo").setDescription("Símbolo da moeda").setRequired(true))),
  aliases: ["transferapi"],
  async execute(interaction) {
    return run(interaction, interaction.options.getSubcommand(), [], true);
  },
  async prefixExecute(message, args) {
    return run(message, String(args[0] || "").toLowerCase(), args.slice(1), false);
  },
};
