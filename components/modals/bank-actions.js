"use strict";
const { MessageFlags, ContainerBuilder, TextDisplayBuilder } = require("discord.js");
const loans = require("../../systems/bank-loans");
const { applyDailyInactivityFee } = require("../../systems/bank-inactivity-fee");
const CUSTOM_ID = /^yukina-bank:(loan|repay)-submit$/;
module.exports = {
  customId: CUSTOM_ID,
  async execute(interaction) {
    const match = interaction.customId.match(CUSTOM_ID);
    if (!match || !interaction.guildId) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = match[1];
    const input = interaction.fields.getTextInputValue("amount");
    try {
      const { db } = await loans.getCollections();
      await applyDailyInactivityFee({ db, guildId: interaction.guildId, userId: interaction.user.id });
      const result = action === "loan"
        ? await loans.requestLoan(interaction.guildId, interaction.user.id, input)
        : await loans.repayLoan(interaction.guildId, interaction.user.id, input);
      const container = new ContainerBuilder().setAccentColor(result.ok ? 0xA7D8F0 : 0xE8A0A0)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          "## " + (result.ok ? "❄️ Yukina · Operação concluída" : "🌙 Yukina · Vamos conferir") +
          "\n" + result.message +
          (result.ok ? "\n\n**Dívida restante:** " + result.debt.toLocaleString("pt-BR") + " KZ" : "")
        ));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error("[Banco/Empréstimos] Falha:", error);
      return interaction.editReply({ content: "🫧 O Banco Central não conseguiu concluir a operação. Tente novamente daqui a pouquinho." });
    }
  }
};
