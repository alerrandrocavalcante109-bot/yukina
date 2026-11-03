"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, weightedPick, randomInt } = require("../systems/plan-commands");

const BANDS = [
  { min: 100000, max: 250000, weight: 35 },
  { min: 250000, max: 500000, weight: 25 },
  { min: 500000, max: 1000000, weight: 18 },
  { min: 1000000, max: 2000000, weight: 12 },
  { min: 2000000, max: 5000000, weight: 7 },
  { min: 5000000, max: 10000000, weight: 3 },
];

const WISH_ITEMS = {
  moldura: [
    "Moldura Luar de Cristal",
    "Moldura Sakura Celeste",
    "Moldura Jardim Lunar",
  ],
  enfeite: [
    "Lanterna da Raposa Branca",
    "Sino de Vento das Cerejeiras",
    "Amuleto da Lua Serena",
  ],
  titulo: [
    "Guardião das Pétalas",
    "Herdeiro do Luar",
    "Viajante das Estrelas",
  ],
  colecionavel: [
    "Omamori da Sorte",
    "Miniatura Kitsune Lunar",
    "Cristal do Santuário",
  ],
};

function rollWish(cap) {
  const category = weightedPick([
    { type: "kz", weight: 85 },
    { type: "moldura", weight: 4 },
    { type: "enfeite", weight: 4 },
    { type: "titulo", weight: 3 },
    { type: "colecionavel", weight: 4 },
  ]);
  if (category.type !== "kz") {
    const pool = WISH_ITEMS[category.type];
    const name = pool[Math.floor(Math.random() * pool.length)];
    const labels = {
      moldura: "Moldura lendária",
      enfeite: "Enfeite exclusivo",
      titulo: "Título especial",
      colecionavel: "Colecionável",
    };
    return {
      amount: 0,
      item: { type: category.type, name, rarity: "especial" },
      emoji: "🌠",
      color: 0xD9B7FF,
      message: "Seu desejo trouxe um item especial! Ele foi registrado na sua coleção de recompensas da Yukina.",
    };
  }
  const eligible = BANDS.filter(band => band.min <= cap);
  const selected = weightedPick(eligible);
  return {
    amount: randomInt(selected.min, Math.min(selected.max, cap)),
    emoji: "🌠",
    color: 0xD9B7FF,
    message: "Seu desejo foi atendido! A recompensa em KZ é aleatória e respeita o limite escolhido.",
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("desejo")
    .setDescription("[Infinity] Faça um desejo e receba uma recompensa aleatória.")
    .setDMPermission(false)
    .addIntegerOption(option => option
      .setName("limite")
      .setDescription("Teto máximo desejado de recompensa (não garante esse valor).")
      .setRequired(true)
      .setMinValue(100000)
      .setMaxValue(10000000)),
  aliases: ["desejo"],
  async execute(interaction) {
    const cap = interaction.options.getInteger("limite", true);
    return runPlanCommand({
      interaction,
      command: "desejo",
      minimumPlan: "infinity",
      cooldownMs: 0,
      title: "Desejo sob a Lua",
      description: "Você confiou seu desejo à Yukina. O limite escolhido foi **" + cap.toLocaleString("pt-BR") + " KZ**. Ele define o teto, não o valor garantido.",
      rewardFactory: () => {
        const amount = rollWish(cap);
        return {
          amount,
          emoji: "🌠",
          color: 0xD9B7FF,
          message: "Seu desejo foi atendido! A recompensa é aleatória. Você pode fazer outro desejo enquanto o sistema estiver em fase de testes.",
          details: { selectedCap: cap },
        };
      },
    });
  },
  async prefixExecute(message, args = []) {
    const cap = Number(String(args[0] || "").replace(/[.,]/g, ""));
    if (!Number.isInteger(cap) || cap < 100000 || cap > 10000000) {
      return message.reply("🌠 Informe um limite entre **100000** e **10000000** KZ. Exemplo: **Ydesejo 1000000**.");
    }
    const fake = {
      inGuild: () => Boolean(message.guild),
      guild: message.guild,
      user: message.author,
      options: { getInteger: () => cap },
      reply: payload => { const { flags, ephemeral, ...rest } = payload || {}; return message.channel.send(rest); },
      followUp: payload => { const { flags, ephemeral, ...rest } = payload || {}; return message.channel.send(rest); },
      deferred: false,
      replied: false,
    };
    return module.exports.execute(fake);
  },
};
