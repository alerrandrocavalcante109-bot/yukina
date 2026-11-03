"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, randomInt } = require("../systems/plan-commands");

const COOLDOWN = 48 * 60 * 60 * 1000;
const ROUTES = {
  floresta: { label: "Floresta das Kitsune", emoji: "🦊", min: 50000, max: 100000, bonusChance: 0.12 },
  montanha: { label: "Montanha Nevada", emoji: "🏔️", min: 70000, max: 130000, bonusChance: 0.10 },
  santuario: { label: "Santuário Lunar", emoji: "⛩️", min: 90000, max: 160000, bonusChance: 0.08 },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("expedicao")
    .setDescription("[Ultra] Escolha uma rota e parta em uma expedição.")
    .setDMPermission(false)
    .addStringOption(option => option
      .setName("rota")
      .setDescription("Escolha o destino da sua expedição.")
      .setRequired(true)
      .addChoices(
        { name: "Floresta das Kitsune · recompensa equilibrada", value: "floresta" },
        { name: "Montanha Nevada · recompensa maior", value: "montanha" },
        { name: "Santuário Lunar · recompensa mais alta", value: "santuario" }
      )),
  aliases: ["expedicao"],
  async execute(interaction) {
    const routeKey = interaction.options.getString("rota", true);
    const route = ROUTES[routeKey];
    return runPlanCommand({
      interaction,
      command: "expedicao",
      minimumPlan: "ultra",
      cooldownMs: COOLDOWN,
      title: "Expedição de Yukina",
      description: "Você escolheu explorar **" + route.label + "**. A jornada terminou e os tesouros encontrados foram contabilizados.",
      rewardFactory: () => {
        const bonus = Math.random() < route.bonusChance;
        const amount = randomInt(route.min, route.max) * (bonus ? 2 : 1);
        return {
          amount,
          emoji: route.emoji,
          message: bonus
            ? "✨ Um encontro raro duplicou as Kizunas encontradas!"
            : "A expedição foi concluída com sucesso. Uma nova jornada estará disponível em 48 horas.",
          details: { route: routeKey, bonus },
        };
      },
    });
  },
  async prefixExecute(message, args = []) {
    const route = String(args[0] || "").toLowerCase();
    const routeKey = ({ floresta: "floresta", montanha: "montanha", santuario: "santuario", santuário: "santuario" })[route];
    if (!routeKey) return message.reply("⛩️ Use: **Yexpedicao floresta**, **Yexpedicao montanha** ou **Yexpedicao santuario**.");
    const fake = {
      inGuild: () => Boolean(message.guild),
      guild: message.guild,
      user: message.author,
      options: { getString: () => routeKey },
      reply: payload => message.channel.send(payload),
      followUp: payload => message.channel.send(payload),
      deferred: false,
      replied: false,
    };
    return module.exports.execute(fake);
  },
};
