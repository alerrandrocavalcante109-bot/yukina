"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, weightedPick, randomInt } = require("../systems/plan-commands");

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const BANDS = [
  { min: 100000, max: 250000, weight: 35 },
  { min: 250000, max: 500000, weight: 25 },
  { min: 500000, max: 1000000, weight: 18 },
  { min: 1000000, max: 2000000, weight: 12 },
  { min: 2000000, max: 5000000, weight: 7 },
  { min: 5000000, max: 10000000, weight: 3 },
];

function rollWish(cap) {
  const eligible = BANDS.filter(band => band.min <= cap);
  const selected = weightedPick(eligible);
  return randomInt(selected.min, Math.min(selected.max, cap));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("desejo")
    .setDescription("[Infinity] Faça um desejo semanal e receba uma recompensa aleatória.")
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
      cooldownMs: COOLDOWN,
      title: "Desejo sob a Lua",
      description: "Você confiou seu desejo à Yukina. O limite escolhido foi **" + cap.toLocaleString("pt-BR") + " KZ**. Ele define o teto, não o valor garantido.",
      rewardFactory: () => {
        const amount = rollWish(cap);
        return {
          amount,
          emoji: "🌠",
          color: 0xD9B7FF,
          message: "Seu desejo foi atendido! A recompensa é aleatória e a próxima tentativa chega em 7 dias. Tentativas não utilizadas não acumulam.",
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
      reply: payload => message.channel.send(payload),
      followUp: payload => message.channel.send(payload),
      deferred: false,
      replied: false,
    };
    return module.exports.execute(fake);
  },
};
