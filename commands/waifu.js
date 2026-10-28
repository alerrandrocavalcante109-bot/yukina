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

const RANK_BASE = [
  { rank: "E-", value: 1000, label: "⚪ Comum", weight: 30 },
  { rank: "E", value: 1500, label: "⚪ Comum", weight: 20 },
  { rank: "E+", value: 2000, label: "⚪ Comum", weight: 12 },
  { rank: "D-", value: 3000, label: "🟢 Incomum", weight: 8 },
  { rank: "D", value: 4000, label: "🟢 Incomum", weight: 5 },
  { rank: "D+", value: 5000, label: "🟢 Incomum", weight: 4 },
  { rank: "C-", value: 7000, label: "🔵 Diferenciada", weight: 3 },
  { rank: "C", value: 9000, label: "🔵 Diferenciada", weight: 2 },
  { rank: "C+", value: 12000, label: "🔵 Diferenciada", weight: 1.5 },
  { rank: "B-", value: 16000, label: "🟣 Rara", weight: 1.2 },
  { rank: "B", value: 20000, label: "🟣 Rara", weight: 1 },
  { rank: "B+", value: 25000, label: "🟣 Rara", weight: 0.8 },
  { rank: "A-", value: 30000, label: "💠 Muito rara", weight: 0.7 },
  { rank: "A", value: 35000, label: "💠 Muito rara", weight: 0.6 },
  { rank: "A+", value: 40000, label: "💠 Muito rara", weight: 0.5 },
  { rank: "S-", value: 46000, label: "🌟 Épica", weight: 0.4 },
  { rank: "S", value: 52000, label: "🌟 Épica", weight: 0.35 },
  { rank: "S+", value: 58000, label: "🌟 Épica", weight: 0.3 },
  { rank: "SS-", value: 65000, label: "✨ Lendária", weight: 0.25 },
  { rank: "SS", value: 72000, label: "✨ Lendária", weight: 0.2 },
  { rank: "SS+", value: 79000, label: "✨ Lendária", weight: 0.15 },
  { rank: "SSS-", value: 86000, label: "🌌 Mítica", weight: 0.1 },
  { rank: "SSS", value: 92000, label: "🌌 Mítica", weight: 0.08 },
  { rank: "SSS+", value: 97000, label: "🌠 Celestial", weight: 0.05 },
];
const RANK_WEIGHT_TOTAL = RANK_BASE.reduce((sum, rank) => sum + rank.weight, 0);
const RARITIES = [
  ...RANK_BASE.map(rank => ({
    rank: rank.rank,
    chance: (rank.weight / RANK_WEIGHT_TOTAL) * 99.8,
    value: rank.value,
    label: rank.label,
  })),
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
  if (typeof item === "string") return { url: item, rank: "E-", value: 1000 };
  if (!item || typeof item.url !== "string") return null;
  const rarity = RARITIES.find(entry => entry.rank === item.rank);
  return { url: item.url, rank: rarity?.rank || "E", value: Number(item.value) || rarity?.value || 1000 };
}

const WAIFU_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const MAX_DRAWS_PER_CYCLE = 10;

async function getWaifuCooldownUntil(guildId, userId) {
  const value = await storage.get(String(guildId), "cooldownUntil", 0, String(userId));
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function getDrawCount(guildId, userId) {
  const value = await storage.get(String(guildId), "drawCount", 0, String(userId));
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

async function getCooldownMessage(guildId, userId) {
  const until = await getWaifuCooldownUntil(guildId, userId);
  const remaining = until - Date.now();
  if (remaining <= 0) {
    if (until > 0) {
      await storage.set(String(guildId), "drawCount", 0, String(userId));
      await storage.set(String(guildId), "cooldownUntil", 0, String(userId));
    }
    return null;
  }
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.ceil((remaining % 3600000) / 60000);
  const timeText = hours > 0
    ? hours + "h" + (minutes > 0 ? " " + minutes + "min" : "")
    : minutes + "min";
  return "🌙 Você já sorteou **" + MAX_DRAWS_PER_CYCLE + " waifus**! O arquivo lunar entrou em cooldown. Você poderá sortear novamente em **" + timeText + "**. Enquanto isso, pode consultar seu álbum.";
}

async function registerWaifuDraw(guildId, userId) {
  const key = String(userId);
  const count = (await getDrawCount(guildId, userId)) + 1;
  await storage.set(String(guildId), "drawCount", count, key);
  if (count >= MAX_DRAWS_PER_CYCLE) {
    const until = Date.now() + WAIFU_COOLDOWN_MS;
    await storage.set(String(guildId), "cooldownUntil", until, key);
  }
  return count;
}

const notificationTimers = new Map();

function notificationKey(guildId, userId) {
  return String(guildId) + ":" + String(userId);
}

function makeCooldownButtons(ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("yukina-waifu:notify:" + ownerId)
      .setLabel("Avisar na DM quando liberar")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Success)
  );
}

async function scheduleAvailabilityNotification(client, guildId, userId, until) {
  const key = notificationKey(guildId, userId);
  const existing = notificationTimers.get(key);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, Number(until) - Date.now());
  const timer = setTimeout(async () => {
    notificationTimers.delete(key);
    try {
      const subscribedUntil = Number(await storage.get(String(guildId), "notifyAt", 0, String(userId))) || 0;
      if (!subscribedUntil || subscribedUntil !== Number(until)) return;
      const user = await client.users.fetch(String(userId));
      await user.send("🌸 **O arquivo lunar está aberto novamente!** Seu cooldown de waifus terminou. Você já pode usar **Ywaifu** ou **/waifu** para sortear novas personagens.");
      await storage.set(String(guildId), "notifyAt", 0, String(userId));
    } catch (error) {
      console.error("[Yukina waifu DM]", error);
    }
  }, Math.min(delay, 2147483647));
  notificationTimers.set(key, timer);
}

async function getCooldownPayload(guildId, userId, client) {
  const until = await getWaifuCooldownUntil(guildId, userId);
  const remainingDraws = Math.max(0, MAX_DRAWS_PER_CYCLE - await getDrawCount(guildId, userId));
  const cooldownMessage = await getCooldownMessage(guildId, userId);
  if (!cooldownMessage) return null;
  const notifyAt = Number(await storage.get(String(guildId), "notifyAt", 0, String(userId))) || 0;
  if (notifyAt > Date.now()) await scheduleAvailabilityNotification(client, guildId, userId, notifyAt);
  return {
    content: cooldownMessage + "\\n\\n🎲 **Sorteios restantes nesta rodada:** " + remainingDraws + "/" + MAX_DRAWS_PER_CYCLE,
    components: [makeCooldownButtons(userId)],
    allowedMentions: { parse: [] },
  };
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

function makeAlbumEmbed(item, user, index, total) {
  const rarity = RARITIES.find(entry => entry.rank === item.rank) || RARITIES[0];
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Álbum Lunar", iconURL: user.displayAvatarURL({ size: 128 }) })
    .setTitle("📖 Álbum de Waifus")
    .setDescription("**Personagem " + (index + 1) + " de " + total + "**\n\n🌸 **Tipo:** Waifu de anime\n🏷️ **Raridade:** " + (rarity.rank === "∞" ? "Suprema (∞)" : rarity.rank) + " · " + rarity.label + "\n💎 **Valor:** " + money(item.value))
    .setImage(item.url)
    .setFooter({ text: "Yukina · Use ◀️ e ▶️ para navegar pelo seu álbum." })
    .setTimestamp();
}

function makeAlbumButtons(ownerId, index, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("yukina-waifu:album:" + ownerId + ":" + (index - 1))
      .setLabel("Voltar")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index <= 0),
    new ButtonBuilder()
      .setCustomId("yukina-waifu:album:" + ownerId + ":" + (index + 1))
      .setLabel("Próximo")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index >= total - 1)
  );
}

async function showAlbumPage({ guildId, user, reply, index = 0, edit = false }) {
  const items = (await getCollection(guildId, user.id)).map(normalizeItem).filter(Boolean);
  if (!items.length) {
    const payload = {
      content: "🌸 Seu álbum ainda está vazio. Use **Ywaifu** para encontrar uma personagem e toque em **Guardar**.",
      embeds: [],
      components: [],
    };
    return reply(payload);
  }
  const safeIndex = Math.max(0, Math.min(Number(index) || 0, items.length - 1));
  const item = items[safeIndex];
  const payload = {
    embeds: [makeAlbumEmbed(item, user, safeIndex, items.length)],
    components: [makeAlbumButtons(user.id, safeIndex, items.length)],
    allowedMentions: { parse: [] },
  };
  return reply(payload);
}


async function showWaifu({ guildId, user, reply, edit = false }) {
  const imageUrl = await getRandomWaifu();
  const rarity = rollRarity();
  const items = await getCollection(guildId, user.id);
  const drawCount = await registerWaifuDraw(guildId, user.id);
  const payload = {
    embeds: [makeEmbed(imageUrl, user, items.length, false, rarity).setDescription(
      "「 Uma nova estrela apareceu no céu de Yukina! 」\\n\\nGostou desta personagem? Guarde-a na sua coleção ou peça outra para o arquivo lunar.\\n\\n🎲 **Sorteios nesta rodada:** " + drawCount + "/" + MAX_DRAWS_PER_CYCLE + (drawCount >= MAX_DRAWS_PER_CYCLE ? "\\n🌙 Você atingiu o limite. O cooldown de 2 horas já começou." : "")
    )],
    components: [makeButtons(user.id, imageUrl, items.length)],
    allowedMentions: { parse: [] },
  };
  return edit ? reply.update(payload) : reply(payload);
}

async function showCollection({ guildId, user, reply, edit = false }) {
  return showAlbumPage({ guildId, user, reply, index: 0, edit });
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
        return await showAlbumPage({
          guildId: interaction.guildId,
          user: interaction.user,
          reply: payload => interaction.editReply(payload),
        });
      }
      const cooldownPayload = await getCooldownPayload(interaction.guildId, interaction.user.id, interaction.client);
      if (cooldownPayload) return interaction.editReply(cooldownPayload);
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
      if (["colecao", "coleção", "collection", "colecoes", "coleções", "album", "álbum"].includes(action)) {
        return await showAlbumPage({
          guildId: message.guildId,
          user: message.author,
          reply: payload => message.reply(payload),
        });
      }
      const cooldownPayload = await getCooldownPayload(message.guildId, message.author.id, message.client);
      if (cooldownPayload) return message.reply(cooldownPayload);
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
      if (action === "notify") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const until = await getWaifuCooldownUntil(interaction.guildId, interaction.user.id);
        if (until <= Date.now()) {
          return interaction.editReply("🌸 Seu cooldown já terminou! Você pode sortear outra waifu agora.");
        }
        await storage.set(String(interaction.guildId), "notifyAt", until, String(interaction.user.id));
        await scheduleAvailabilityNotification(interaction.client, interaction.guildId, interaction.user.id, until);
        return interaction.editReply("🔔 **Aviso ativado!** Vou enviar uma mensagem na sua DM quando o sorteio de waifus estiver disponível novamente. Confira se suas mensagens diretas estão abertas.");
      }

      if (action === "again" || action === "back") {
        await interaction.deferUpdate();
        const cooldownPayload = await getCooldownPayload(interaction.guildId, interaction.user.id, interaction.client);
        if (cooldownPayload) return interaction.followUp({ ...cooldownPayload, flags: MessageFlags.Ephemeral });
        return await showWaifu({
          guildId: interaction.guildId,
          user: interaction.user,
          reply: payload => interaction.editReply(payload),
        });
      }

      if (action === "album") {
        const pageIndex = Number(parts[3]);
        await interaction.deferUpdate();
        return await showAlbumPage({
          guildId: interaction.guildId,
          user: interaction.user,
          index: pageIndex,
          edit: true,
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
        const rankText = rankField?.value?.match(/\*\*(SSS\+|SSS-|SSS|SS\+|SS-|SS|S\+|S-|S|A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|E\+|E-|E|∞)\*\*/)?.[1] || "E-";
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
