"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const loans = require("../../systems/bank-loans");
const CUSTOM_ID = /^yukina-bank:(loan|debt|repay):(\d{17,20})$/;
module.exports = {
  customId: CUSTOM_ID,
  async execute(interaction) {
    const match = interaction.customId.match(CUSTOM_ID);
    if (!match) return;
    const [, action, ownerId] = match;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "🌸 Esse painel bancário pertence a outra pessoa. Abra seu próprio comando Ybanco.", flags: MessageFlags.Ephemeral });
    }
    if (!interaction.guildId) return interaction.reply({ content: "Use o Banco Central dentro do servidor.", flags: MessageFlags.Ephemeral });
    if (action === "loan" || action === "repay") {
      const modal = new ModalBuilder()
        .setCustomId("yukina-bank:" + action + "-submit")
        .setTitle(action === "loan" ? "❄️ Solicitar empréstimo" : "🌙 Pagar dívida");
      const amount = new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Valor em Kizunas (ex.: 5000 ou 5k)")
        .setPlaceholder(action === "loan" ? "Máximo de 100.000 KZ" : "Digite quanto deseja pagar")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(24);
      modal.addComponents(new ActionRowBuilder().addComponents(amount));
      return interaction.showModal(modal);
    }
    const result = await loans.getDebt(interaction.guildId, interaction.user.id);
    const container = new ContainerBuilder().setAccentColor(0xA7D8F0).addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 📜 Yukina · Sua dívida bancária\n" +
        (result.debt > 0
          ? "Você ainda tem **" + result.debt.toLocaleString("pt-BR") + " KZ** para pagar.\n\nValor originalmente emprestado: **" + result.principal.toLocaleString("pt-BR") + " KZ**."
          : "Você não possui dívidas ativas. Yatta~! Suas contas estão em dia. 🌸") +
        "\n\n「 Um passo de cada vez, vamos deixar tudo em ordem. 」")
    );
    return interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }
};
