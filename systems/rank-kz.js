"use strict";

const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { getEconomyRanking } = require("../economia-saldo");


function formatKz(value) {
  return Math.floor(Math.max(0, Number(value) || 0)).toLocaleString("pt-BR") + " KZ";
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function normalizeDisplayName(value) {
  return String(value || "Membro")
    .normalize("NFKC")
    // Converte símbolos decorativos que costumam virar quadrados na fonte do canvas.
    .replace(/[♡❤♥❥❣]/gu, "<3")
    .replace(/[☆★✦✧]/gu, "*")
    .replace(/[♛♕]/gu, "#")
    .replace(/[\\uFE0F\\u200D]/gu, "")
    .replace(/\\s+/gu, " ")
    .trim() || "Membro";
}

function fitText(ctx, text, maxWidth) {
  let result = String(text || "Membro");
  while (result.length > 1 && ctx.measureText(result).width > maxWidth) {
    result = result.slice(0, -1);
  }
  if (result !== String(text || "Membro")) {
    while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
      result = result.slice(0, -1);
    }
    result += "…";
  }
  return result;
}

async function resolveRankingUser(guild, userId) {
  let member = guild.members.cache.get(userId) || null;
  if (!member) {
    try {
      member = await guild.members.fetch({ user: userId, force: true });
    } catch {
      try { member = await guild.members.fetch(userId); } catch {}
    }
  }

  let user = member?.user || null;
  if (!user) {
    user = guild.client.users.cache.get(userId) || null;
    if (!user) {
      try { user = await guild.client.users.fetch(userId, { force: true }); } catch {}
    }
  }

  const displayName = member?.displayName
    || user?.globalName
    || user?.username
    || user?.tag
    || null;

  return { member, user, displayName };
}

async function renderRankingCard(guild, ranking, requesterId, page = 0, local = false) {
  const width = 1536;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const backgroundPath = require("node:path").join(__dirname, "../assets/images/rank/Rank.kz.png");
  const background = await loadImage(backgroundPath);
  ctx.drawImage(background, 0, 0, width, height);

  const top = ranking.slice(page * 5, page * 5 + 5);
  const rowCenters = [392, 504, 612, 717, 813];

  for (let index = 0; index < top.length; index++) {
    const entry = top[index];
    const centerY = rowCenters[index];
    const { user, displayName } = await resolveRankingUser(guild, String(entry.userId));
    const name = normalizeDisplayName(
      displayName || "Usuário " + String(entry.userId).slice(-4)
    );

    const avatarX = 940;
    const avatarY = centerY - 28;
    const avatarSize = 56;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    if (user?.displayAvatarURL) {
      try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 128 }));
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      } catch {
        ctx.fillStyle = "#5422a8";
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
    } else {
      ctx.fillStyle = "#5422a8";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(185, 92, 255, 0.9)";
    ctx.shadowBlur = 9;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 25px sans-serif";
    ctx.fillStyle = "#fff4ff";
    ctx.fillText(fitText(ctx, name, 430), 1012, centerY - 10, 430);

    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#e8c9ff";
    ctx.fillText(fitText(ctx, formatKz(entry.balance), 430), 1012, centerY + 22, 430);
    ctx.restore();
  }

  return new AttachmentBuilder(await canvas.encode("png"), { name: "rank-kz-yukina.png" });
}

async function buildRanking(guild, requesterId, page = 0, local = false) {
  let localUserIds = null;
  if (local) {
    try {
      const members = await guild.members.fetch();
      localUserIds = [...members.keys()];
    } catch {
      localUserIds = [...guild.members.cache.keys()];
      if (!localUserIds.includes(String(requesterId))) localUserIds.push(String(requesterId));
    }
  }
  const ranking = await getEconomyRanking(localUserIds);
  const maxPage = Math.max(0, Math.ceil(ranking.length / 5) - 1);
  const safePage = Math.max(0, Math.min(Number(page) || 0, maxPage));
  const attachment = await renderRankingCard(guild, ranking, requesterId, safePage, local);
  return { attachment, ranking, page: safePage, maxPage };
}

function pageButtons(userId, page, maxPage, local = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rankkz:" + userId + ":" + (local ? "local" : "global") + ":" + (page - 1))
      .setLabel("◀ Voltar")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("rankkz:" + userId + ":" + (local ? "local" : "global") + ":" + (page + 1))
      .setLabel("Próximo ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= maxPage)
  );
}


async function showRank(guild, user, sendOrEdit, page = 0, interaction = false, local = false) {
  if (!guild) return sendOrEdit({ content: "❄️ O ranking de KZ só pode ser consultado dentro de um servidor." });
  let loading;
  try {
    loading = await sendOrEdit({
      content: "❄️ **Estou atualizando o ranking, aguarde...**",
      allowedMentions: { parse: [] }
    });
    const { attachment, page: currentPage, maxPage } = await buildRanking(guild, user.id, page, local);
    const payload = {
      content: "🌙 **Ranking " + (local ? "local de KZ" : "global de KZ") + " atualizado!** Use **Voltar** e **Próximo** para navegar.",
      files: [attachment],
      components: [pageButtons(user.id, currentPage, maxPage, local)],
      allowedMentions: { parse: [] }
    };
    if (interaction) return await sendOrEdit(payload);
    return await loading.edit({ ...payload, attachments: [] });
  } catch (error) {
    console.error("[Yukina Rank KZ]", error);
    const payload = { content: "🫧 Não consegui atualizar o ranking agora. Confira a economia e tente novamente.", components: [], allowedMentions: { parse: [] } };
    if (interaction) return sendOrEdit(payload);
    if (loading?.edit) return loading.edit(payload);
    return sendOrEdit(payload);
  }
}

module.exports = { showRank, handleInteraction: async function handleInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith("rankkz:")) return;
  const [, ownerId, scope, rawPage] = interaction.customId.split(":");
  const local = scope === "local";
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "❄️ Só quem abriu este ranking pode usar esses botões.", ephemeral: true });
  }
  const page = Number(rawPage);
  await interaction.deferUpdate();
  try {
    const { attachment, page: currentPage, maxPage } = await buildRanking(interaction.guild, interaction.user.id, page, local);
    await interaction.editReply({
      content: "🌙 **Ranking " + (local ? "local de KZ" : "global de KZ") + " atualizado!** Use **Voltar** e **Próximo** para navegar.",
      files: [attachment],
      attachments: [],
      components: [pageButtons(interaction.user.id, currentPage, maxPage, local)],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    console.error("[Yukina Rank KZ] Falha ao trocar página:", error);
    await interaction.followUp({ content: "🫧 Não consegui carregar essa página do ranking.", ephemeral: true });
  }
} };
