"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { runPlanCommand, randomInt } = require("../systems/plan-commands");
const { getUserLanguage } = require("../systems/idioma");
const messages = require("../systems/idioma/locales/expedicao");

const COOLDOWN = 48 * 60 * 60 * 1000;
const ROUTES = {
  floresta: { label: "Floresta das Kitsune", messageKey: "routeFloresta", emoji: "🦊", min: 50000, max: 100000, bonusChance: 0.12 },
  montanha: { label: "Montanha Nevada", messageKey: "routeMontanha", emoji: "🏔️", min: 70000, max: 130000, bonusChance: 0.10 },
  santuario: { label: "Santuário Lunar", messageKey: "routeSantuario", emoji: "⛩️", min: 90000, max: 160000, bonusChance: 0.08 },
};

function localizedRoute(language, route) {
  return messages.getMessage(language, route.messageKey);
}

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
    const language = await getUserLanguage(interaction.user.id);
    return runPlanCommand({
      interaction,
      command: "expedicao",
      minimumPlan: "ultra",
      cooldownMs: COOLDOWN,
      title: messages.getMessage(language, "title"),
      description: messages.getMessage(language, "description", { route: localizedRoute(language, route) }),
      rewardFactory: () => {
        const bonus = Math.random() < route.bonusChance;
        const amount = randomInt(route.min, route.max) * (bonus ? 2 : 1);
        return {
          amount,
          emoji: route.emoji,
          message: bonus
            ? messages.getMessage(language, "bonus")
            : messages.getMessage(language, "normal"),
          details: { route: routeKey, bonus },
        };
      },
      messages,
      language,
    });
  },
  async prefixExecute(message, args = []) {
    const route = String(args[0] || "").toLowerCase();
    const routeKey = ({ floresta: "floresta", montanha: "montanha", santuario: "santuario", "santuário": "santuario" })[route];
    if (!routeKey) {
      const language = await getUserLanguage(message.author.id);
      return message.reply(messages.getMessage(language, "prefixUsage"));
    }
    const fake = {
      inGuild: () => Boolean(message.guild),
      guild: message.guild,
      user: message.author,
      options: { getString: () => routeKey },
      reply: payload => { const { flags, ephemeral, ...rest } = payload || {}; return message.channel.send(rest); },
      followUp: payload => { const { flags, ephemeral, ...rest } = payload || {}; return message.channel.send(rest); },
      deferred: false,
      replied: false,
    };
    return module.exports.execute(fake);
  },
};
