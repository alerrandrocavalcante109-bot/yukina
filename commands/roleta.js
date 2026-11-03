"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, weightedPick } = require("../systems/plan-commands");

const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleta")
    .setDescription("[Premium] Gire a roleta e descubra sua recompensa.")
    .setDMPermission(false),
  aliases: ["roleta"],
  async execute(interaction) {
    return runPlanCommand({
      interaction,
      command: "roleta",
      minimumPlan: "premium",
      cooldownMs: COOLDOWN,
      title: "Roleta Lunar",
      description: "As lanternas giram sob o luar. A sorte vai escolher quantas Kizunas você leva desta vez.",
      rewardFactory: () => {
        const prize = weightedPick([
          { amount: 5000, weight: 30 },
          { amount: 20000, weight: 30 },
          { amount: 50000, weight: 20 },
          { amount: 100000, weight: 15 },
          { amount: 250000, weight: 5 },
        ]);
        return { amount: prize.amount, emoji: "🎡", message: "A roleta parou! Seu resultado foi escolhido aleatoriamente." };
      },
    });
  },
  async prefixExecute(message) {
    return module.exports.execute({
      inGuild: () => Boolean(message.guild),
      guild: message.guild,
      user: message.author,
      reply: payload => message.channel.send(payload),
      followUp: payload => message.channel.send(payload),
      deferred: false,
      replied: false,
    });
  },
};
