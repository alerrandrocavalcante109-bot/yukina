const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const PLANS = {
  starter: { name: "Starter" }, plus: { name: "Plus" }, premium: { name: "Premium" },
  ultra: { name: "Ultra" }, infinity: { name: "Infinity" },
};
module.exports = {
  customId: /^vip:(approve|cancel):(\d{17,20}):(starter|plus|premium|ultra|infinity):(monthly|annual)$/,
  async execute(interaction) {
    const match = interaction.customId.match(/^vip:(approve|cancel):(\d{17,20}):(starter|plus|premium|ultra|infinity):(monthly|annual)$/);
    if (!match) return;
    const [, action, buyerId, planKey, period] = match;
    const adminId = (process.env.VIP_ADMIN_ID || "").trim();
    if (!adminId || interaction.user.id !== adminId) {
      return interaction.reply({ content: "Somente o administrador VIP autorizado pode aprovar ou cancelar esta compra.", ephemeral: true });
    }
    if (!interaction.guild || !interaction.channel) {
      return interaction.reply({ content: "Esta ação só pode ser usada no canal privado da compra.", ephemeral: true });
    }
    const topic = interaction.channel.topic || "";
    if (topic !== `yukina-vip:${buyerId}:${planKey}:${period}`) {
      return interaction.reply({ content: "Os dados deste pedido não correspondem ao canal. Ação bloqueada por segurança.", ephemeral: true });
    }
    if (action === "cancel") {
      await interaction.reply({ content: "Compra cancelada. O canal será fechado e o comprador será avisado.", ephemeral: true });
      const buyer = await interaction.client.users.fetch(buyerId).catch(() => null);
      if (buyer) await buyer.send({ embeds: [new EmbedBuilder().setColor(0xEF4444).setTitle("❄️ Atualização do seu pedido VIP").setDescription([`Olá! A equipe da Yukina cancelou seu pedido do plano **${PLANS[planKey].name}**.`, "", "Nenhum cargo VIP foi liberado para esta compra.", "Se foi um engano ou você ainda precisa de ajuda, entre no servidor oficial e fale com a equipe.", "", "🌙 **Servidor oficial da Yukina**", "https://discord.gg/NJR3YNd2G"].join("\n")).setFooter({ text: "Yukina · Atendimento VIP" }).setTimestamp()] }).catch(() => {});
      await interaction.channel.send("❌ Compra cancelada pelo administrador autorizado. Este canal será fechado em alguns segundos.");
      setTimeout(() => interaction.channel.delete("Compra VIP cancelada pelo administrador autorizado").catch(() => {}), 5000).unref?.();
      return;
    }
    const guild = interaction.guild;
    const buyer = await guild.members.fetch(buyerId).catch(() => null);
    if (!buyer) return interaction.reply({ content: "Não consegui localizar o comprador neste servidor. Nenhum cargo foi aplicado.", ephemeral: true });
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: "A Yukina precisa da permissão Gerenciar cargos para liberar o VIP.", ephemeral: true });
    }
    const roleName = `Yukina VIP · ${PLANS[planKey].name}`;
    let role = guild.roles.cache.find(item => item.name === roleName) || null;
    if (!role) {
      role = await guild.roles.create({
        name: roleName, color: 0xA855F7, permissions: [],
        reason: "Cargo VIP criado após aprovação manual de pagamento",
      });
    }
    if (role.position >= guild.members.me.roles.highest.position) {
      return interaction.reply({ content: "O cargo VIP está acima do cargo da Yukina. Mova o cargo do bot acima do cargo VIP e tente novamente.", ephemeral: true });
    }
    await buyer.roles.add(role, `Compra VIP aprovada manualmente por ${interaction.user.id}`);
    await interaction.reply({ content: `Pagamento aprovado. Cargo ${role} atribuído a <@${buyerId}>. O canal será fechado em alguns segundos.`, allowedMentions: { users: [buyerId], roles: [role.id] } });
    const user = await interaction.client.users.fetch(buyerId).catch(() => null);
    if (user) await user.send({ embeds: [new EmbedBuilder().setColor(0x22C55E).setTitle("✨ Pagamento aprovado — Yukina VIP").setDescription([`Olá, <@${buyerId}>! Seu pagamento foi conferido e aprovado pela equipe.`, "", `**Plano:** ${PLANS[planKey].name}`, `**Duração:** ${period === "annual" ? "Anual" : "Mensal"}`, `**Cargo liberado:** ${role.name}`, "", "Seu acesso VIP já foi ativado no servidor da Yukina. Obrigado por apoiar o projeto! ❄️", "", "Se o cargo não aparecer imediatamente, aguarde um instante e confira sua lista de cargos no servidor."].join("\n")).setFooter({ text: "Yukina · Obrigado por fazer parte da nossa comunidade" }).setTimestamp()] }).catch(() => {});
    await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x22C55E).setTitle("Compra VIP aprovada").setDescription(`O cargo ${role} foi atribuído ao comprador. Este canal será fechado em alguns segundos.`)] });
    setTimeout(() => interaction.channel.delete("Compra VIP aprovada e cargo atribuído").catch(() => {}), 10000).unref?.();
  },
};
