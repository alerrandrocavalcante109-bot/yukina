"use strict";

const { createEngine, isGreetingOnly } = require("./engine");
const { transcribeAudio } = require("./audio");

let activeEngine = null;
let installedClient = null;

function getEngine() {
  if (!activeEngine) throw new Error("O núcleo da Yukina IA ainda não foi inicializado.");
  return activeEngine;
}

function isAudioAttachment(attachment) {
  const type = String(attachment.contentType || "").toLowerCase();
  const name = String(attachment.name || "").toLowerCase();
  return type.startsWith("audio/") || /\.(ogg|opus|mp3|m4a|wav|webm|mp4|mpeg|mpga|flac)$/.test(name);
}

async function handleAudioMessage(message) {
  const attachment = [...message.attachments.values()].find(isAudioAttachment);
  if (!attachment) return false;
  if (attachment.size > 24 * 1024 * 1024) {
    await message.reply("🌸 Esse áudio ultrapassa meu limite de 24 MB. Envie um arquivo menor, por favor.");
    return true;
  }
  await message.channel.sendTyping().catch(() => {});
  try {
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Não consegui baixar o áudio enviado.");
    const buffer = Buffer.from(await response.arrayBuffer());
    const transcript = await transcribeAudio(buffer, attachment.name || "mensagem-audio.ogg", attachment.contentType || "audio/ogg");
    const result = await activeEngine.answer({
      userId: message.author.id,
      channelId: message.channel.id,
      guildId: message.guild.id,
      prompt: transcript,
      displayName: message.member?.displayName || message.author.globalName || message.author.username,
      discordContext: {
        guild: message.guild, channel: message.channel, actorId: message.author.id,
        actorTag: message.author.tag, source: "audio-attachment"
      }
    });
    await message.reply({
      content: "🎙️ **Entendi:** " + transcript.slice(0, 700) + "\n\n" + result.text,
      allowedMentions: { parse: [], users: [message.author.id], repliedUser: true }
    });
  } catch (error) {
    console.warn("[Yukina IA] Não foi possível processar o áudio:", error.message);
    const missingKey = !process.env.GROQ_API_KEY;
    await message.reply(missingKey
      ? "🌙 Para eu entender áudios, falta configurar GROQ_API_KEY nas variáveis do Render."
      : "🌸 Não consegui entender esse áudio. Tente enviar novamente em OGG, MP3, M4A, WAV ou WEBM.").catch(() => {});
  }
  return true;
}

function install(client, getSettingsCollection) {
  if (installedClient === client) return;
  installedClient = client;
  activeEngine = createEngine(getSettingsCollection);

  client.on("messageCreate", async message => {
    try {
      if (!message.guild || message.author?.bot || !client.user) return;
      if (await handleAudioMessage(message)) return;

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
          guild: message.guild, channel: message.channel, actorId: message.author.id,
          actorTag: message.author.tag, source: "mention"
        }
      });

      await message.reply({ content: result.text, allowedMentions: { parse: [], users: [message.author.id], repliedUser: true } });
    } catch (error) {
      console.error("[Yukina IA] Erro ao processar mensagem:", error.message || error);
    }
  });

  console.log("[Yukina IA] Núcleo conversacional carregado. OpenRouter: " +
    (process.env.OPENROUTER_API_KEY ? "chave detectada" : "aguardando OPENROUTER_API_KEY") + ".");
  console.log("[Yukina Voz] Transcrição: " + (process.env.GROQ_API_KEY ? "Groq configurado" : "aguardando GROQ_API_KEY") +
    "; fala: " + (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID ? "ElevenLabs configurado" : "aguardando credenciais ElevenLabs") + ".");
}

module.exports = { install, getEngine };
