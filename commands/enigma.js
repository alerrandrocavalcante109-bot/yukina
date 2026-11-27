"use strict";
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getUserLanguage } = require("../systems/idioma");
const { getMessage } = require("../systems/idioma/locales/enigma");
const ROUND_TIME_MS = 30000;
const activeGames = new Map();
const ENIGMAS = [
  { answer: "relógio", hint: "Tenho ponteiros ou números e mostro algo que nunca para." },
  { answer: "eco", hint: "Repito o que você diz, mas não tenho voz própria." },
  { answer: "sombra", hint: "Acompanho seus movimentos, mas desapareço no escuro." },
  { answer: "chave", hint: "Posso abrir portas sem ter mãos." },
  { answer: "mapa", hint: "Mostro caminhos, cidades e lugares sem sair do papel." },
  { answer: "vela", hint: "Posso iluminar um ambiente enquanto diminuo de tamanho." },
  { answer: "livro", hint: "Tenho páginas, histórias e conhecimento, mas não falo." },
  { answer: "escova", hint: "Tenho cerdas e ajudo a deixar algo limpo ou arrumado." },
  { answer: "termômetro", hint: "Mostro se está quente ou frio usando números." },
  { answer: "espelho", hint: "Mostro sua imagem, mas não guardo nenhuma fotografia." }
];
function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function chooseEnigma() {
  return ENIGMAS[Math.floor(Math.random() * ENIGMAS.length)];
}
async function startGame(channel, reply, userId) {
  const language = await getUserLanguage(userId);
  if (activeGames.has(channel.id)) return reply(getMessage(language, "active"));
  const enigma = chooseEnigma();
  const game = { channelId: channel.id, answer: normalize(enigma.answer), displayAnswer: enigma.answer, timeout: null };
  activeGames.set(channel.id, game);
  try {
    await channel.send({
      content: [
        getMessage(language, "title"),
        getMessage(language, "prompt"),
        "",
        getMessage(language, "hint") + " " + enigma.hint,
        "",
        getMessage(language, "time"),
        getMessage(language, "send")
      ].join("\n"),
      allowedMentions: { parse: [] }
    });
    game.timeout = setTimeout(async () => {
      if (activeGames.get(channel.id) !== game) return;
      activeGames.delete(channel.id);
      await channel.send({
        content: getMessage(language, "timeout", { answer: game.displayAnswer }),
        allowedMentions: { parse: [] }
      }).catch(error => console.error("[Yukina /enigma] Falha ao encerrar rodada:", error));
    }, ROUND_TIME_MS);
    game.timeout.unref?.();
    return reply(getMessage(language, "started"));
  } catch (error) {
    activeGames.delete(channel.id);
    if (game.timeout) clearTimeout(game.timeout);
    console.error("[Yukina /enigma] Não foi possível iniciar:", error);
    return reply(getMessage(language, "failed"));
  }
}
async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;
  const game = activeGames.get(message.channel.id);
  if (!game || normalize(message.content) !== game.answer) return;
  activeGames.delete(message.channel.id);
  if (game.timeout) clearTimeout(game.timeout);
  const language = await getUserLanguage(message.author.id);
  await message.reply({
    content: getMessage(language, "winner", { user: message.author.username, answer: game.displayAnswer }),
    allowedMentions: { repliedUser: false }
  }).catch(error => console.error("[Yukina /enigma] Falha ao anunciar vencedor:", error));
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName("enigma")
    .setDescription("Inicia um jogo de adivinhação com 30 segundos de duração."),
  name: "enigma",
  aliases: ["enigma"],
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.channel) {
      const language = await getUserLanguage(interaction.user.id);
      return interaction.reply({ content: getMessage(language, "guild"), flags: MessageFlags.Ephemeral });
    }
    return startGame(interaction.channel, content => interaction.reply({ content, flags: MessageFlags.Ephemeral }), interaction.user.id);
  },
  async prefixExecute(message) {
    if (!message.guild) {
      const language = await getUserLanguage(message.author.id);
      return message.reply(getMessage(language, "guild"));
    }
    return startGame(message.channel, content => message.reply(content), message.author.id);
  },
  handleMessage
};
