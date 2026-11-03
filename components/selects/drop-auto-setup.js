"use strict";

const { MongoClient } = require("mongodb");
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  EmbedBuilder, ChannelType, PermissionFlagsBits,
} = require("discord.js");

const URI = (process.env.MONGODB_URI || "").trim();
const DB = (process.env.MONGODB_DB || "Yukina").trim();
const PLAN_CHANNELS = { starter: 1, plus: 1, premium: 2, ultra: 3, infinity: 5 };
const PLAN_NAMES = { starter: "Starter", plus: "Plus", premium: "Premium", ultra: "Ultra", infinity: "Infinity" };
let mongo, collection, connecting;

async function getCollection() {
  if (collection) return collection;
  if (!URI) throw new Error("MONGODB_URI não configurada.");
  if (!connecting) connecting = (async () => {
    mongo = mongo || new MongoClient(URI, { appName: "Yukina-Drop-Auto-Setup", serverSelectionTimeoutMS: 10000 });
    await mongo.connect();
    collection = mongo.db(DB).collection("drop_auto_configs");
    await collection.createIndex({ userId: 1 }, { unique: true });
    await collection.createIndex({ guildId: 1, enabled: 1 });
    return collection;
  })().catch(error => { connecting = null; mongo = null; throw error; });
  return connecting;
}

function serverMenu(guilds) {
  const options = guilds.slice(0, 25).map(guild => ({
    label: guild.name.slice(0, 100),
    description: ("ID: " + guild.id).slice(0, 100),
    value: guild.id,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId("dropauto:server").setPlaceholder("Selecione um servidor")
      .addOptions(options)
  );
}

function introEmbed(planKey) {
  return new EmbedBuilder().setColor(0xA7D8F0)
    .setTitle("❄️ Seu plano da Yukina está ativo!")
    .setDescription([
      "A configuração do **Drop Automático** agora é feita diretamente no painel do site.",
      "",
      "**Plano:** " + (PLAN_NAMES[planKey] || planKey),
      "**Canais permitidos:** " + (PLAN_CHANNELS[planKey] || 1),
      "",
      "Acesse o painel, entre com sua conta Discord e escolha o servidor e os canais. Você poderá revisar tudo antes de confirmar.",
      "",
      "🌸 https://yukina-6uo.pages.dev/drop-config.html"
    ].join("\n"))
    .setFooter({ text: "Yukina · Sob o luar, entre estrelas" });
}

async function eligibleGuilds(client, userId) {
  const result = [];
  for (const guild of client.guilds.cache.values()) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) result.push(guild);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function start(client, userId, planKey) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return false;
  const message = await user.send({
    embeds: [introEmbed(planKey)],
    allowedMentions: { parse: [] },
  }).catch(error => {
    console.warn("[Drop Automático] Não foi possível enviar o aviso por DM para " + userId + ": " + (error.message || error));
    return null;
  });
  if (!message) return false;
  try {
    const col = await getCollection();
    await col.updateOne({ userId: String(userId) }, { $set: {
      userId: String(userId), planKey, status: "awaiting-web-setup", surface: "web-panel",
      setupMessageId: message.id, startedAt: new Date(), updatedAt: new Date()
    } }, { upsert: true });
  } catch (error) {
    console.error("[Drop Automático] Aviso enviado, mas não consegui registrar o estado:", error.message || error);
  }
  return true;
}

async function getSetup(userId) {
  const col = await getCollection();
  return col.findOne({ userId, status: "selecting" });
}

async function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

module.exports = {
  customId: /^dropauto:(?:server|open-channels|channels|confirm|again)$/,
  async execute(interaction) {
    const col = await getCollection();
    const setup = await getSetup(interaction.user.id);
    if (!setup) return respond(interaction, { content: "🌙 Esta configuração não está mais ativa. Se o plano foi ativado agora, aguarde um instante ou fale com a equipe.", ephemeral: true });
    const customId = interaction.customId;

    if (customId === "dropauto:server") {
      const guildId = interaction.values?.[0];
      const guild = interaction.client.guilds.cache.get(guildId);
      if (!guild) return respond(interaction, { content: "Não encontrei esse servidor ou a Yukina não está mais nele. Escolha outro.", ephemeral: true });
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) return respond(interaction, { content: "Você não faz mais parte desse servidor. Escolha outro.", ephemeral: true });
      const owner = await guild.fetchOwner().catch(() => null);
      await col.updateOne({ userId: interaction.user.id }, { $set: {
        selectedGuildId: guild.id, selectedGuildName: guild.name,
        selectedOwnerId: guild.ownerId, selectedOwnerName: owner?.user?.tag || owner?.user?.username || "Não identificado",
        selectedChannelIds: [], updatedAt: new Date(),
      } });
      const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle("🌸 Servidor selecionado")
        .setDescription("**Servidor:** " + guild.name + "\n**ID:** `" + guild.id + "`\n**Dono:** " + (owner?.user?.tag || owner?.user?.username || "Não identificado") +
          "\n\nAgora clique em **Escolher canais** para selecionar todos os canais que seu plano permite.")
        .setFooter({ text: "Yukina · Configuração do Drop Automático" });
      return respond(interaction, { embeds: [embed], components: [
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("dropauto:open-channels").setLabel("Escolher canais").setEmoji("📢").setStyle(ButtonStyle.Primary))
      ] });
    }

    if (customId === "dropauto:open-channels") {
      const guild = interaction.client.guilds.cache.get(setup.selectedGuildId);
      if (!guild) return respond(interaction, { content: "Não encontrei o servidor selecionado. Escolha novamente.", ephemeral: true });
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      const max = PLAN_CHANNELS[setup.planKey] || 1;
      const channels = guild.channels.cache.filter(channel =>
        channel.type === ChannelType.GuildText && channel.viewable &&
        (!member || channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel))
      ).sort((a, b) => a.rawPosition - b.rawPosition).first(25);
      if (!channels.length) return respond(interaction, { content: "Não encontrei canais de texto que você possa visualizar nesse servidor.", ephemeral: true });
      const menu = new StringSelectMenuBuilder().setCustomId("dropauto:channels")
        .setPlaceholder("Selecione até " + max + " canal(is)")
        .setMinValues(1).setMaxValues(Math.min(max, channels.length))
        .addOptions(channels.map(channel => ({ label: ("#" + channel.name).slice(0, 100), description: ("ID: " + channel.id).slice(0, 100), value: channel.id })));
      return respond(interaction, { content: "📢 **Escolha os canais para publicar os Drops.** Você pode selecionar até **" + max + "** canal(is) de uma só vez.", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: false });
    }

    if (customId === "dropauto:channels") {
      const guild = interaction.client.guilds.cache.get(setup.selectedGuildId);
      if (!guild) return respond(interaction, { content: "O servidor selecionado não está mais disponível.", ephemeral: true });
      const max = PLAN_CHANNELS[setup.planKey] || 1;
      const ids = [...new Set(interaction.values || [])].slice(0, max);
      const channels = [];
      for (const id of ids) {
        const channel = await guild.channels.fetch(id).catch(() => null);
        if (channel?.type === ChannelType.GuildText) channels.push(channel);
      }
      if (!channels.length) return respond(interaction, { content: "Selecione pelo menos um canal de texto válido.", ephemeral: true });
      await col.updateOne({ userId: interaction.user.id }, { $set: { selectedChannelIds: channels.map(c => c.id), updatedAt: new Date() } });
      const embed = new EmbedBuilder().setColor(0xA7D8F0).setTitle("❄️ Revise sua configuração")
        .setDescription("**Servidor:** " + guild.name + "\n**ID:** `" + guild.id + "`\n**Dono:** " + (setup.selectedOwnerName || "Não identificado") +
          "\n\n**📢 Canais selecionados:**\n" + channels.map(c => "• " + c).join("\n") +
          "\n\nConfira tudo antes de confirmar. A configuração só será ativada após sua confirmação.");
      return respond(interaction, { embeds: [embed], components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("dropauto:confirm").setLabel("Confirmar configuração").setEmoji("✅").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("dropauto:again").setLabel("Escolher novamente").setStyle(ButtonStyle.Secondary),
        )
      ] });
    }

    if (customId === "dropauto:again") {
      const guilds = await eligibleGuilds(interaction.client, interaction.user.id);
      if (!guilds.length) return respond(interaction, { content: "Não encontrei servidores compartilhados com a Yukina.", ephemeral: true });
      return respond(interaction, { embeds: [introEmbed(setup.planKey)], components: [serverMenu(guilds)] });
    }

    if (customId === "dropauto:confirm") {
      const guild = interaction.client.guilds.cache.get(setup.selectedGuildId);
      if (!guild || !Array.isArray(setup.selectedChannelIds) || !setup.selectedChannelIds.length) {
        return respond(interaction, { content: "Sua seleção está incompleta. Escolha o servidor e os canais novamente.", ephemeral: true });
      }
      const channels = [];
      for (const id of setup.selectedChannelIds) {
        const channel = await guild.channels.fetch(id).catch(() => null);
        if (channel?.type === ChannelType.GuildText) channels.push(channel);
      }
      if (!channels.length) return respond(interaction, { content: "Os canais escolhidos não estão mais disponíveis. Faça a seleção novamente.", ephemeral: true });
      const now = new Date();
      await col.updateOne({ userId: interaction.user.id }, { $set: {
        status: "active", enabled: true, guildId: guild.id, guildName: guild.name,
        channelIds: channels.map(channel => channel.id), planKey: setup.planKey,
        activatedAt: now, updatedAt: now,
      }, $unset: { setupMessageId: "", selectedGuildId: "", selectedGuildName: "", selectedOwnerId: "", selectedOwnerName: "", selectedChannelIds: "", pausedChannelIds: "", nextRunAtByChannel: "" } });
      let schedulerStarted = false;
      try {
        const dropAuto = require("../buttons/drop-auto");
        await dropAuto.activateConfig(interaction.client, interaction.user.id);
        schedulerStarted = true;
      } catch (scheduleError) {
        console.error("[Drop Setup] Configuração salva, mas não consegui iniciar o agendador:", scheduleError);
      }
      await respond(interaction, {
        content: "🌸 **Drop Automático ativado!**\nServidor: **" + guild.name + "**\nCanais: " + channels.map(c => c.toString()).join(", ") +
          (schedulerStarted ? "\n\n❄️ O primeiro Drop já foi agendado." : "\n\n⚠️ A configuração foi salva, mas o agendador não iniciou. A equipe deve verificar os logs.") +
          "\n\nObrigado por configurar! ❄️",
        components: []
      });
      if (setup.surface === "guild-channel" && setup.setupChannelId) {
        const temporary = await interaction.client.channels.fetch(setup.setupChannelId).catch(() => null);
        if (temporary) await temporary.delete("Configuração do Drop Automático concluída").catch(() => {});
      }
      return;
    }
  },
  start,
};