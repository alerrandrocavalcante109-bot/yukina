"use strict";

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const memberData = require("../member-data");

function isAdministrator(member) {
  const permissions = member?.permissions ?? member?.memberPermissions;
  if (permissions && typeof permissions.has === "function") {
    return permissions.has(PermissionFlagsBits.Administrator);
  }
  try {
    return (BigInt(permissions || "0") & BigInt(PermissionFlagsBits.Administrator)) !== 0n;
  } catch {
    return false;
  }
}

async function runResetConfirmation({ guild, member, sendPrompt, actorId }) {
  if (!guild || !member || !isAdministrator(member)) {
    return sendPrompt({ content: "🌙 Você precisa da permissão **Administrador** para zerar o XP do servidor.", ephemeral: true });
  }

  const confirmId = "yukina-xp-reset-confirm";
  const cancelId = "yukina-xp-reset-cancel";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel("Sim, zerar todo o XP").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
  );

  const prompt = await sendPrompt({
    content: "⚠️ **Atenção: esta ação é irreversível.**\nIsso vai zerar o XP acumulado de todos os membros deste servidor. Os avisos, dados de entrada e outras informações serão preservados.\n\nDeseja continuar?",
    components: [row],
    ephemeral: true,
  });
  if (!prompt?.awaitMessageComponent) return;

  try {
    const choice = await prompt.awaitMessageComponent({
      time: 30000,
      filter: interaction => {
        if (interaction.user.id !== String(actorId)) {
          interaction.reply({ content: "Somente quem iniciou o reset pode confirmar esta ação.", flags: MessageFlags.Ephemeral }).catch(() => {});
          return false;
        }
        return [confirmId, cancelId].includes(interaction.customId);
      },
    });

    if (choice.customId === cancelId) {
      await choice.update({ content: "🌸 Reset cancelado. Nenhum XP foi alterado.", components: [] });
      return;
    }

    await choice.deferUpdate();
    const result = await memberData.resetGuildXp(guild.id);
    choice.editReply({
      content: "🌸 **Reset de XP concluído!**\nO XP de **" + result.count.toLocaleString("pt-BR") +
        "** membro(s) registrado(s) neste servidor foi zerado. A progressão recomeça no nível 0.",
      components: [],
    }).catch(() => {});
    // Atualiza os cargos de nível sem enviar anúncios de evolução.
    const client = guild.client;
    client.emit("yukinaXpReset", { guildId: guild.id, userIds: result.userIds });
  } catch (error) {
    if (error?.code === "InteractionCollectorError" || error?.name === "InteractionCollectorError") {
      await prompt.edit({ content: "⌛ O tempo de confirmação terminou. O XP não foi alterado.", components: [] }).catch(() => {});
      return;
    }
    console.error("[Yukina XP] Falha ao executar reset:", error);
    await prompt.edit({ content: "🫧 Não consegui concluir o reset de XP. Nenhum sucesso foi confirmado; verifique os logs.", components: [] }).catch(() => {});
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Gerenciar a progressão de XP do servidor.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => subcommand
      .setName("reset")
      .setDescription("Zerar o XP acumulado de todos os membros deste servidor.")),

  aliases: ["xp"],

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", flags: MessageFlags.Ephemeral });
    }
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "🌙 Você precisa da permissão **Administrador**.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.options.getSubcommand() !== "reset") return;
    return runResetConfirmation({
      guild: interaction.guild,
      member: interaction.member,
      actorId: interaction.user.id,
      sendPrompt: async payload => {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        return interaction.fetchReply();
      },
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    if (String(args[0] || "").toLowerCase() !== "reset") {
      return message.reply("🌸 Use **Yxp reset** para iniciar o reset de XP do servidor.");
    }
    return runResetConfirmation({
      guild: message.guild,
      member: message.member,
      actorId: message.author.id,
      sendPrompt: payload => message.reply({ content: payload.content, components: payload.components }),
    });
  },
};
