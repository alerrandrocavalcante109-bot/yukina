"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, weightedPick } = require("../systems/plan-commands");

const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cofre")
    .setDescription("[Plus] Abra seu cofre diário e receba Kizunas.")
    .setDMPermission(false),
  aliases: ["cofre"],
  async execute(interaction) {
    return runPlanCommand({
      interaction,
      command: "cofre",
      minimumPlan: "plus",
      cooldownMs: COOLDOWN,
      title: "Cofre das Cerejeiras",
      description: "Um pequeno baú foi deixado sob as árvores de sakura. Abra e descubra quantas Kizunas estão guardadas para você.",
      rewardFactory: () => {
        const prize = weightedPick([
          { amount: 10000, weight: 35 },
          { amount: 20000, weight: 30 },
          { amount: 35000, weight: 20 },
          { amount: 50000, weight: 10 },
          { amount: 100000, weight: 5 },
        ]);
        return { amount: prize.amount, emoji: "🎁", message: "O cofre foi aberto! Volte amanhã para tentar novamente." };
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
