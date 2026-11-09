"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { getEngine } = require("../systems/yukina-ai");

async function run(userId, channelId, guildId, prompt, displayName, discordContext) {
  return getEngine().answer({ userId, channelId, guildId, prompt, displayName, discordContext });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ia")
    .setDescription("Converse com a Yukina IA.")
    .addStringOption(option => option
      .setName("mensagem")
      .setDescription("O que você gostaria de conversar com a Yukina?")
      .setRequired(true)
      .setMaxLength(2500))
    .setDMPermission(false),

  aliases: ["yukinaia", "conversar"],

  async execute(interaction) {
    const prompt = interaction.options.getString("mensagem", true);
    await interaction.deferReply();
    const result = await run(
      interaction.user.id,
      interaction.channelId,
      interaction.guildId,
      prompt,
      interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
      {
        guild: interaction.guild,
        channel: interaction.channel,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        source: "slash"
      }
    );
    return interaction.editReply({ content: result.text, allowedMentions: { parse: [] } });
  },

  async prefixExecute(message) {
    const prompt = String(message.content || "").replace(/^\S+\s*/, "").trim();
    if (!prompt) return message.reply("🌸 Use Yia sua mensagem ou /ia para conversar comigo.");
    await message.channel.sendTyping().catch(() => {});
    const result = await run(
      message.author.id,
      message.channel.id,
      message.guild.id,
      prompt,
      message.member?.displayName || message.author.globalName || message.author.username,
      {
        guild: message.guild,
        channel: message.channel,
        actorId: message.author.id,
        actorTag: message.author.tag,
        source: "prefix"
      }
    );
    return message.reply({ content: result.text, allowedMentions: { parse: [], repliedUser: false } });
  }
};
