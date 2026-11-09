"use strict";
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getEngine } = require("../systems/yukina-ai");
const voice = require("../systems/yukina-ai/voice");

function isSlash(source) { return Boolean(source.isChatInputCommand?.()); }
function canManage(memberPermissions) {
  return Boolean(memberPermissions?.has(PermissionFlagsBits.ManageGuild) || memberPermissions?.has(PermissionFlagsBits.Administrator));
}
async function send(source, content, ephemeral = true) {
  if (isSlash(source)) {
    if (source.deferred || source.replied) return source.editReply({ content });
    return source.reply({ content, ephemeral });
  }
  return source.reply(content);
}
async function enter(source, member, guild, textChannel) {
  const missing = [
    !process.env.GROQ_API_KEY && "GROQ_API_KEY",
    !process.env.ELEVENLABS_API_KEY && "ELEVENLABS_API_KEY",
    !process.env.ELEVENLABS_VOICE_ID && "ELEVENLABS_VOICE_ID"
  ].filter(Boolean);
  if (missing.length) return send(source, "🌙 Para conversar por voz, configure no Render: " + missing.join(", ") + ".");

  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) return send(source, "🌸 Entre em um canal de voz primeiro. Depois use este comando novamente.");

  const requesterId = isSlash(source) ? source.user.id : source.author.id;
  const existing = voice.getSession(guild.id);
  if (existing && existing.startedBy !== requesterId && !canManage(member.permissions)) {
    return send(source, "🌙 Já estou em uma conversa de voz iniciada por outra pessoa. Peça a ela para encerrar ou solicite à equipe.");
  }

  const permissions = voiceChannel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return send(source, "🌙 Preciso das permissões Conectar e Falar nesse canal.");
  }

  if (isSlash(source)) await source.deferReply({ ephemeral: true });
  try {
    const result = await voice.enter(guild, voiceChannel, textChannel, getEngine, requesterId);
    const message = result.alreadyConnected
      ? "🌸 Já estou em **" + voiceChannel.name + "**! Continuo ouvindo e respondendo por voz. As respostas em texto serão enviadas aqui."
      : "🌸 Entrei em **" + voiceChannel.name + "** e a conexão está pronta! Pode conversar comigo. Vou responder por voz e também por texto aqui. Use /voz sair para encerrar.";
    return send(source, message);
  } catch (error) {
    console.error("[Yukina Voz] Não foi possível entrar:", error);
    return send(source, "🫧 Não consegui estabelecer a conexão de voz. Confira minhas permissões e tente novamente.");
  }
}

async function leave(source, guildId, userId, memberPermissions) {
  const session = voice.getSession(guildId);
  if (!session) return send(source, "🌸 Não estou em um canal de voz neste servidor.");
  if (session.startedBy && session.startedBy !== String(userId) && !canManage(memberPermissions)) {
    return send(source, "🌙 Apenas quem iniciou a conversa ou alguém com Gerenciar Servidor pode encerrar esta sessão.");
  }
  voice.leave(guildId);
  return send(source, "🌙 Até daqui a pouco! Saí do canal de voz.");
}

async function status(source, guildId) {
  const session = voice.getSession(guildId);
  if (!session) return send(source, "🌸 Não estou conectada a nenhum canal de voz neste servidor.");
  const elapsed = Math.max(0, Math.floor((Date.now() - session.joinedAt.getTime()) / 60000));
  return send(source,
    "🎙️ **Status da conversa por voz**\n" +
    "Canal: **" + session.voiceChannel.name + "**\n" +
    "Conexão: **" + session.connection.state.status + "**\n" +
    "Processando fala: **" + (session.busy ? "sim" : "não") + "**\n" +
    "Tempo conectada: **" + elapsed + " minuto(s)**"
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voz")
    .setDescription("Converse com a Yukina por voz.")
    .addSubcommand(sub => sub.setName("entrar").setDescription("Entra no seu canal de voz e começa a escutar."))
    .addSubcommand(sub => sub.setName("sair").setDescription("Encerra a conversa por voz."))
    .addSubcommand(sub => sub.setName("status").setDescription("Verifica a conexão de voz da Yukina."))
    .setDMPermission(false),
  aliases: ["voice", "conversarvoz"],
  async execute(interaction) {
    const action = interaction.options.getSubcommand();
    if (action === "sair") return leave(interaction, interaction.guildId, interaction.user.id, interaction.memberPermissions);
    if (action === "status") return status(interaction, interaction.guildId);
    return enter(interaction, interaction.member, interaction.guild, interaction.channel);
  },
  async prefixExecute(message, args) {
    const action = String(args?.[0] || "").toLowerCase();
    if (["sair", "leave", "parar", "desconectar"].includes(action)) {
      return leave(message, message.guild.id, message.author.id, message.member.permissions);
    }
    if (["status", "estado"].includes(action)) return status(message, message.guild.id);
    if (!["entrar", "join", "conectar"].includes(action)) {
      return message.reply("🌸 Use Yvoz entrar para conversar comigo, Yvoz status para verificar a conexão ou Yvoz sair para encerrar.");
    }
    return enter(message, message.member, message.guild, message.channel);
  }
};
