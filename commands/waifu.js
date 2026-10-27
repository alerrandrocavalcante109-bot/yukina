"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const storage = require("../system-storage").forSystem("waifu");

const COLOR = 0xC58AE8;
const API_URL = "https://nekos.best/api/v2/waifu";
const MAX_COLLECTION = 100;
const REQUEST_TIMEOUT_MS = 12000;

const RARITIES = [
  { rank: "E", chance: 40, value: 1000, label: "⚪ Comum" },
  { rank: "D", chance: 25, value: 3000, label: "🟢 Incomum" },
  { rank: "C", chance: 15, value: 5000, label: "🔵 Diferenciada" },
  { rank: "B", chance: 9, value: 10000, label: "🟣 Rara" },
  { rank: "A", chance: 5, value: 15000, label: "💠 Muito rara" },
  { rank: "S", chance: 3, value: 25000, label: "🌟 Épica" },
  { rank: "SS", chance: 1.5, value: 40000, label: "✨ Lendária" },
  { rank: "SSS", chance: 0.8, value: 60000, label: "🌌 Mítica" },
  { rank: "SSS+", chance: 0.5, value: 80000, label: "🌠 Celestial" },
  { rank: "∞", chance: 0.2, value: 100000, label: "👑 Suprema" },
];

function rollRarity() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const rarity of RARITIES) {
    cumulative += rarity.chance;
    if (roll < cumulative) return rarity;
  }
  return RARITIES[0];
}

function normalizeItem(item) {
  if (typeof item === "string") return { url: item, rank: "E", value: 1000 };
  if (!item || typeof item.url !== "string") return null;
  const rarity = RARITIES.find(entry => entry.rank === item.rank);
  return { url: item.url, rank: rarity?.rank || "E", value: Number(item.value) || rarity?.value || 1000 };
}

function money(value) {
  return Number(value).toLocaleString("pt-BR") + " Kizunas";
}

async function getRandomWaifu() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "YukinaDiscordBot/1.0 (Discord bot; https://github.com/alerrandrocavalcante109-bot/yukina)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("A API de imagens respondeu HTTP " + response.status);
    const data = await response.json();
    const imageUrl = data?.results?.[0]?.url;
    if (typeof imageUrl !== "string" || !/^https:\/\//i.test(imageUrl)) {
      throw new Error("A API não retornou uma imagem válida.");
    }
    return imageUrl;
  } finally {
    clearTimeout(timeout);
  }
}

function safeImageUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : null;
}

function makeEmbed(url, user, savedCount = 0, isCollection = false, rarity = RARITIES[0]) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({
      name: "Yukina · Arquivo de Waifus",
      iconURL: user.displayAvatarURL({ size: 128 }),
    })
    .setTitle(isCollection ? "🌸 Sua coleção de waifus" : "❄️ Um encontro sob o luar")
    .setDescription(
      isCollection
        ? "Estas são as personagens que você guardou em sua jornada. Cuide bem da sua coleção!"
        : "「 Uma nova estrela apareceu no céu de Yukina! 」\n\nGostou desta personagem? Guarde-a na sua coleção ou peça outra para o arquivo lunar."
    )
    .setFooter({ text: "Yukina · Colecione suas personagens favoritas com carinho." })
    .setTimestamp();

  if (url) embed.setImage(url);
  if (!isCollection) {
    embed.addFields(
      { name: "🏷️ Rank", value: "**" + (rarity.rank === "∞" ? "Suprema (∞)" : rarity.rank) + "** · " + rarity.label, inline: true },
      { name: "💎 Valor", value: "**" + money(rarity.value) + "**", inline: true },
      { name: "📚 Sua coleção", value: savedCount + "/" + MAX_COLLECTION + " personagens guardadas", inline: true }
    );
  }
  return embed;
}

function makeButtons(ownerId, imageUrl, collectionCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("yukina-waifu:again:" + ownerId)
      .setLabel("Outra waifu")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("yukina-waifu:save:" + ownerId)
      .setLabel("Guardar")
      .setEmoji("🌸")
      .setStyle(ButtonStyle.Success)
      .setDisabled(collectionCount >= MAX_COLLECTION),
    new ButtonBuilder()
      .setCustomId("yukina-waifu:collection:" + ownerId)
      .setLabel("Minha coleção")
      .setEmoji("📚")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function getCollection(guildId, userId) {
  const record = await storage.get(String(guildId), "collection", { items: [] }, String(userId));
  return Array.isArray(record?.items) ? record.items : [];
}

async function showWaifu({ guildId, user, reply, edit = false }) {
  const imageUrl = await getRandomWaifu();
  const rarity = rollRarity();
  const items = await getCollection(guildId, user.id);
  const payload = {
    embeds: [makeEmbed(imageUrl, user, items.length, false, rarity)],
    components: [makeButtons(user.id, imageUrl, items.length)],
    allowedMentions: { parse: [] },
  };
  return edit ? reply.update(payload) : reply(payload);
}

async function showCollection({ guildId, user, reply, edit = false }) {
  const items = await getCollection(guildId, user.id);
  if (!items.length) {
    const payload = {
      content: "🌸 Sua coleção ainda está vazia. Use **Ywaifu** para encontrar uma personagem e toque em **Guardar** para adicioná-la ao seu arquivo lunar.",
      embeds: [],
      components: [],
    };
    return edit ? reply.update(payload) : reply(payload);
  }

  const normalizedItems = items.map(normalizeItem).filter(Boolean);
  const selected = normalizedItems.slice(-10).reverse();
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Arquivo Lunar", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle("📚 Coleção de " + (user.globalName || user.username))
    .setDescription("Você guardou **" + items.length + "/" + MAX_COLLECTION + "** personagens. Mostrando as últimas " + selected.length + " adicionadas.")
    .addFields(selected.map((item, index) => ({
      name: "🌸 Personagem " + (normalizedItems.length - index) + " · Rank " + (item.rank === "∞" ? "Suprema (∞)" : item.rank),
      value: "**Valor:** " + money(item.value) + "\n[Ver imagem](" + item.url + ")",
      inline: false,
    })))
    .setFooter({ text: "Yukina · Cada encontro vira uma lembrança." })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("yukina-waifu:back:" + user.id)
      .setLabel("Voltar ao sorteio")
      .setEmoji("❄️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("yukina-waifu:collection:" + user.id)
      .setLabel("Atualizar coleção")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary)
  );
  const payload = { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
  return edit ? reply.update(payload) : reply(payload);
}

async function saveWaifu(guildId, user, imageUrl, rank) {
  const url = safeImageUrl(imageUrl);
  if (!url) throw new Error("Imagem inválida.");
  const rarity = RARITIES.find(entry => entry.rank === rank) || RARITIES[0];
  const items = await getCollection(guildId, user.id);
  if (items.some(item => normalizeItem(item)?.url === url)) return { saved: false, count: items.length, duplicate: true };
  if (items.length >= MAX_COLLECTION) return { saved: false, count: items.length, full: true };
  items.push({ url, rank: rarity.rank, value: rarity.value });
  await storage.set(String(guildId), "collection", { items }, String(user.id));
  return { saved: true, count: items.length, rarity };
}

function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("waifu")
    .setDescription("Encontre waifus, guarde personagens e consulte sua coleção.")
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName("acao")
        .setDescription("Escolha o que deseja fazer.")
        .setRequired(false)
        .addChoices(
          { name: "Sortear uma waifu", value: "sortear" },
          { name: "Ver minha coleção", value: "colecao" }
        )
    ),

  aliases: ["waifus", "colecaowaifu", "colecaowaifus"],

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      return interaction.reply(ephemeral("❄️ O arquivo lunar só está disponível dentro de um servidor."));
    }
    await interaction.deferReply();
    try {
      const action = interaction.options.getString("acao") || "sortear";
      if (action === "colecao") {
        const items = await getCollection(interaction.guildId, interaction.user.id);
        if (!items.length) {
          return interaction.editReply("🌸 Sua coleção está vazia! Use **/waifu** para encontrar sua primeira personagem.");
        }
        const normalizedItems = items.map(normalizeItem).filter(Boolean);
        const selected = normalizedItems.slice(-10).reverse();
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setAuthor({ name: "Yukina · Arquivo Lunar", iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
          .setTitle("📚 Sua coleção de waifus")
          .setDescription("Personagens guardadas: **" + items.length + "/" + MAX_COLLECTION + "**. Exibindo as últimas " + selected.length + ".")
          .addFields(selected.map((item, index) => ({ name: "🌸 Personagem " + (normalizedItems.length - index) + " · Rank " + (item.rank === "∞" ? "Suprema (∞)" : item.rank), value: "**Valor:** " + money(item.value) + "\n[Ver imagem](" + item.url + ")", inline: false })))
          .setFooter({ text: "Yukina · Cada encontro vira uma lembrança." });
        return interaction.editReply({ embeds: [embed] });
      }
      return await showWaifu({
        guildId: interaction.guildId,
        user: interaction.user,
        reply: payload => interaction.editReply(payload),
      });
    } catch (error) {
      console.error("[Yukina /waifu]", error);
      return interaction.editReply("🫧 O arquivo lunar está indisponível no momento. Tente novamente em instantes.").catch(() => {});
    }
  },

  async prefixExecute(message, args = []) {
    if (!message.guildId) return message.reply("❄️ O arquivo lunar só está disponível dentro de um servidor.");
    const action = String(args[0] || "").toLowerCase();
    try {
      if (["colecao", "coleção", "collection", "colecoes", "coleções"].includes(action)) {
        const items = await getCollection(message.guildId, message.author.id);
        if (!items.length) return message.reply("🌸 Sua coleção está vazia! Use **Ywaifu** para encontrar sua primeira personagem.");
        const normalizedItems = items.map(normalizeItem).filter(Boolean);
        const selected = normalizedItems.slice(-10).reverse();
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setAuthor({ name: "Yukina · Arquivo Lunar", iconURL: message.author.displayAvatarURL({ size: 128 }) })
          .setTitle("📚 Sua coleção de waifus")
          .setDescription("Personagens guardadas: **" + items.length + "/" + MAX_COLLECTION + "**. Exibindo as últimas " + selected.length + ".")
          .addFields(selected.map((item, index) => ({ name: "🌸 Personagem " + (normalizedItems.length - index) + " · Rank " + (item.rank === "∞" ? "Suprema (∞)" : item.rank), value: "**Valor:** " + money(item.value) + "\n[Ver imagem](" + item.url + ")", inline: false })))
          .setFooter({ text: "Yukina · Cada encontro vira uma lembrança." });
        return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }
      return await showWaifu({
        guildId: message.guildId,
        user: message.author,
        reply: payload => message.reply(payload),
      });
    } catch (error) {
      console.error("[Yukina Ywaifu]", error);
      return message.reply("🫧 O arquivo lunar está indisponível no momento. Tente novamente em instantes.");
    }
  },

  async handleInteraction(interaction) {
    const parts = String(interaction.customId || "").split(":");
    if (parts[0] !== "yukina-waifu") return;
    const action = parts[1];
    const ownerId = parts[2];
    if (!ownerId) return;
    if (interaction.user.id !== ownerId) {
      return interaction.reply(ephemeral("🌙 Este pequeno arquivo pertence a quem iniciou o sorteio. Use **/waifu** para criar o seu."));
    }
    if (!interaction.guildId) {
      return interaction.reply(ephemeral("❄️ Esta opção só funciona dentro do servidor."));
    }

    try {
      if (action === "again" || action === "back") {
        await interaction.deferUpdate();
        if (action === "back") {
          const items = await getCollection(interaction.guildId, interaction.user.id);
          if (!items.length) {
            return interaction.editReply({ content: "🌸 Sua coleção está vazia. Use **Ywaifu** para encontrar uma personagem.", embeds: [], components: [] });
          }
          const normalizedItems = items.map(normalizeItem).filter(Boolean);
          const selected = normalizedItems.slice(-10).reverse();
          const embed = new EmbedBuilder()
            .setColor(COLOR)
            .setAuthor({ name: "Yukina · Arquivo Lunar", iconURL: interaction.user.displayAvatarURL({ size: 128 }) })
            .setTitle("📚 Sua coleção de waifus")
            .setDescription("Personagens guardadas: **" + items.length + "/" + MAX_COLLECTION + "**. Exibindo as últimas " + selected.length + ".")
            .addFields(selected.map((item, index) => ({ name: "🌸 Personagem " + (normalizedItems.length - index) + " · Rank " + (item.rank === "∞" ? "Suprema (∞)" : item.rank), value: "**Valor:** " + money(item.value) + "\n[Ver imagem](" + item.url + ")", inline: false })))
            .setFooter({ text: "Yukina · Cada encontro vira uma lembrança." });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("yukina-waifu:back:" + interaction.user.id).setLabel("Voltar ao sorteio").setEmoji("❄️").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("yukina-waifu:collection:" + interaction.user.id).setLabel("Atualizar coleção").setEmoji("🔄").setStyle(ButtonStyle.Secondary)
          );
          return interaction.editReply({ embeds: [embed], components: [row] });
        }
        return await showWaifu({
          guildId: interaction.guildId,
          user: interaction.user,
          reply: payload => interaction.editReply(payload),
        });
      }

      if (action === "collection") {
        await interaction.deferUpdate();
        return await showCollection({
          guildId: interaction.guildId,
          user: interaction.user,
          reply: payload => interaction.editReply(payload),
        });
      }

      if (action === "save") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const imageUrl = interaction.message.embeds?.[0]?.image?.url;
        const rankField = interaction.message.embeds?.[0]?.fields?.find(field => field.name === "🏷️ Rank");
        const rankText = rankField?.value?.match(/\*\*(SSS\+|SSS|SS|S|A|B|C|D|E|∞)\*\*/)?.[1] || "E";
        if (!imageUrl) return interaction.editReply("💧 Não consegui identificar esta personagem. Sorteie outra e tente novamente.");
        const result = await saveWaifu(interaction.guildId, interaction.user, imageUrl, rankText);
        if (result.duplicate) return interaction.editReply("🌸 Você já guardou esta personagem na sua coleção. (" + result.count + "/" + MAX_COLLECTION + ")");
        if (result.full) return interaction.editReply("📚 Sua coleção atingiu o limite de " + MAX_COLLECTION + " personagens.");
        return interaction.editReply("🌸 **Personagem guardada!** Rank **" + (result.rarity.rank === "∞" ? "Suprema (∞)" : result.rarity.rank) + "** · Valor **" + money(result.rarity.value) + "**. Agora você tem **" + result.count + "/" + MAX_COLLECTION + "** waifus no seu arquivo lunar.");
      }
    } catch (error) {
      console.error("[Yukina waifu button]", error);
      if (interaction.deferred || interaction.replied) return interaction.followUp(ephemeral("🫧 O arquivo lunar não conseguiu concluir essa ação. Tente novamente.")).catch(() => {});
      return interaction.reply(ephemeral("🫧 O arquivo lunar não conseguiu concluir essa ação. Tente novamente.")).catch(() => {});
    }
  },
};
