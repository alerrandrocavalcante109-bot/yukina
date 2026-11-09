"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getEngine } = require("../systems/yukina-ai");
const voice = require("../systems/yukina-ai/voice");
async function enter(source, member, guild, textChannel) {
  if (!process.env.GROQ_API_KEY || !process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    const missing = [!process.env.GROQ_API_KEY && "GROQ_API_KEY", !process.env.ELEVENLABS_API_KEY && "ELEVENLABS_API_KEY", !process.env.ELEVENLABS_VOICE_ID && "ELEVENLABS_VOICE_ID"].filter(Boolean).join(", ");
    const message = "🌙 Para conversar por voz, configure estas variáveis no Render: " + missing + ".";
    return source.isChatInputCommand?.() ? source.reply({ content: message, ephemeral: true }) : source.reply(message);
  }
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    const message = "🌸 Entre em um canal de voz primeiro. Depois use este comando novamente.";
    return source.isChatInputCommand?.() ? source.reply({ content: message, ephemeral: true }) : source.reply(message);
  }
  const permissions = voiceChannel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    const message = "🌙 Preciso das permissões Conectar e Falar nesse canal.";
    return source.isChatInputCommand?.() ? source.reply({ content: message, ephemeral: true }) : source.reply(message);
  }
  try {
    voice.enter(guild, voiceChannel, textChannel, getEngine);
    const response = "🌸 Entrei em **" + voiceChannel.name + "**! Estou ouvindo quem falar neste canal e responderei por voz e por texto aqui. Para encerrar, use /voz sair ou Yvoz sair.";
    return source.reply({ content: response });
  } catch (error) {
    console.error("[Yukina Voz] Não foi possível entrar:", error);
    const response = "🫧 Não consegui entrar no canal de voz. Verifique minhas permissões e tente novamente.";
    return source.isChatInputCommand?.() ? source.reply({ content: response, ephemeral: true }) : source.reply(response);
  }
}
module.exports = {
  data: new SlashCommandBuilder().setName("voz").setDescription("Converse com a Yukina por voz.")
    .addSubcommand(sub => sub.setName("entrar").setDescription("Entra no seu canal de voz e começa a escutar."))
    .addSubcommand(sub => sub.setName("sair").setDescription("Encerra a conversa por voz.")).setDMPermission(false),
  aliases: ["voice", "conversarvoz"],
  async execute(interaction) {
    if (interaction.options.getSubcommand() === "sair") {
      const done = voice.leave(interaction.guildId);
      return interaction.reply({ content: done ? "🌙 Até daqui a pouco! Saí do canal de voz." : "🌸 Não estou em um canal de voz neste servidor.", ephemeral: true });
    }
    return enter(interaction, interaction.member, interaction.guild, interaction.channel);
  },
  async prefixExecute(message, args) {
    const action = String(args?.[0] || "").toLowerCase();
    if (["sair", "leave", "parar", "desconectar"].includes(action)) {
      const done = voice.leave(message.guild.id);
      return message.reply(done ? "🌙 Até daqui a pouco! Saí do canal de voz." : "🌸 Não estou em um canal de voz neste servidor.");
    }
    if (!["entrar", "join", "conectar"].includes(action)) return message.reply("🌸 Use Yvoz entrar para conversar comigo por voz ou Yvoz sair para encerrar.");
    return enter(message, message.member, message.guild, message.channel);
  }
};
