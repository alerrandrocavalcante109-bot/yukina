"use strict";

const { createEngine, isGreetingOnly } = require("./engine");

let activeEngine = null;
let installedClient = null;

function getEngine() {
  if (!activeEngine) throw new Error("O núcleo da Yukina IA ainda não foi inicializado.");
  return activeEngine;
}

function install(client, getSettingsCollection) {
  if (installedClient === client) return;
  installedClient = client;
  activeEngine = createEngine(getSettingsCollection);

  client.on("messageCreate", async message => {
    try {
      if (!message.guild || message.author?.bot || !client.user) return;
      const content = String(message.content || "");
      const mentionToken = new RegExp("<@!?" + client.user.id + ">", "g");
      const wasMentioned = mentionToken.test(content);
      let isDirectReply = false;

      if (message.reference?.messageId && message.channel?.messages?.fetch) {
        const referenced = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        isDirectReply = Boolean(referenced && referenced.author?.id === client.user.id);
      }
      if (!wasMentioned && !isDirectReply) return;

      const prompt = content.replace(mentionToken, "").trim();
      if (isGreetingOnly(prompt)) return;

      await message.channel.sendTyping().catch(() => {});
      const result = await activeEngine.answer({
        userId: message.author.id,
        channelId: message.channel.id,
        guildId: message.guild.id,
        prompt,
        displayName: message.member?.displayName || message.author.globalName || message.author.username,
        discordContext: {
          guild: message.guild,
          channel: message.channel,
          actorId: message.author.id,
          actorTag: message.author.tag,
          source: "mention"
        }
      });

      await message.reply({ content: result.text, allowedMentions: { parse: [], users: [message.author.id], repliedUser: true } });
    } catch (error) {
      console.error("[Yukina IA] Erro ao processar mensagem:", error.message || error);
    }
  });

  console.log("[Yukina IA] Núcleo conversacional carregado. OpenRouter: " +
    (process.env.OPENROUTER_API_KEY ? "chave detectada" : "aguardando OPENROUTER_API_KEY") + ".");
}

module.exports = { install, getEngine };
