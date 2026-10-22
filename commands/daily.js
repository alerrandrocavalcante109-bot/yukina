"use strict";

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();

const PHRASES = [
  "❄️ A neve cai devagar, mas cada novo dia traz uma oportunidade. Sua recompensa diária está esperando por você!",
  "🌙 Sob a luz da lua, até os pequenos passos brilham. Passe no painel e resgate seu Daily de hoje!",
  "✨ Uma nova página, uma nova chance e uma recompensa para você. Não deixe seu Daily passar!",
  "🌸 Que seu dia seja leve como sakura ao vento. Sua recompensa diária pode ser resgatada no painel!",
  "💎 Sua jornada também merece pequenas recompensas. Visite o painel da Yukina e pegue seu Daily!"
];

function buildMessage() {
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  return {
    content: [
      "❄️ **Yukina Daily**",
      "",
      phrase,
      "",
      `🔗 **Painel:** <${DAILY_URL}>`
    ].join("\n"),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🎁 Pegar Daily no painel")
          .setStyle(ButtonStyle.Link)
          .setURL(DAILY_URL)
      )
    ],
    allowedMentions: { parse: [] }
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Receba uma frase da Yukina e acesse o painel para pegar seu Daily."),
  name: "daily",
  aliases: ["daily"],
  async execute(interaction) {
    await interaction.reply(buildMessage());
  },
  async prefixExecute(message) {
    await message.channel.send(buildMessage());
  }
};
