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

async function renderRankingCard(guild, ranking, requesterId, page = 0) {
  const width = 1400;
  const height = 1280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#171329");
  background.addColorStop(0.52, "#30204a");
  background.addColorStop(1, "#111827");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 100; i++) {
    const x = (i * 197 + 61) % width;
    const y = (i * 131 + 37) % height;
    ctx.globalAlpha = 0.18 + ((i % 4) * 0.08);
    ctx.fillStyle = i % 3 === 0 ? "#f0c9ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 2.5 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const moon = ctx.createRadialGradient(1230, 110, 8, 1230, 110, 95);
  moon.addColorStop(0, "#fff7ff");
  moon.addColorStop(0.55, "#e9c9ff");
  moon.addColorStop(1, "rgba(197,138,232,0)");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(1230, 110, 95, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8eaff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("YUKINA  •  ARQUIVO DA ECONOMIA", 70, 70);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 68px sans-serif";
  ctx.fillText("Top 5 — Kizunas", 70, 145);
  ctx.fillStyle = "#d9c8f0";
  ctx.font = "29px sans-serif";
  ctx.fillText("Os membros com os maiores saldos da comunidade", 73, 192);

  roundedRect(ctx, 50, 220, 1300, 900, 30);
  ctx.fillStyle = "rgba(15, 12, 31, 0.72)";
  ctx.fill();

  const top = ranking.slice(page * 5, page * 5 + 5);
  if (!top.length) {
    ctx.fillStyle = "#eee5f7";
    ctx.font = "34px sans-serif";
    ctx.fillText("Ainda não há Kizunas registradas nesta página.", 100, 390);
  } else {
    for (let index = 0; index < top.length; index++) {
      const entry = top[index];
      const y = 232 + index * 176;
      const position = page * 5 + index + 1;
      const { user, displayName } = await resolveRankingUser(guild, String(entry.userId));
      // O ID continua visível mesmo se a API do Discord não devolver o perfil.
      const name = displayName || "Usuário " + String(entry.userId).slice(-4);
      const avatarUrl = user?.displayAvatarURL
        ? user.displayAvatarURL({ extension: "png", size: 512 })
        : null;
      const isRequester = String(entry.userId) === String(requesterId);

      roundedRect(ctx, 70, y, 1260, 164, 24);
      ctx.fillStyle = isRequester ? "rgba(197, 138, 232, 0.30)" : "rgba(255, 255, 255, 0.065)";
      ctx.fill();

      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = position === 1 ? "#ffd66b" : position === 2 ? "#e4e9f3" : position === 3 ? "#e8b28e" : "#d9c8f0";
      ctx.fillText(position === 1 ? "♛" : "#" + position, 88, y + 94);

      const avatarX = 178;
      const avatarY = y + 12;
      const avatarSize = 128;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      if (avatarUrl) {
        try {
          const avatar = await loadImage(avatarUrl);
          ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        } catch {
          ctx.fillStyle = "#6d4a89";
          ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
      } else {
        ctx.fillStyle = "#6d4a89";
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
      ctx.restore();
      ctx.strokeStyle = "#e0c0ff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Renderiza o nome do Discord com fonte maior e área dedicada.
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "bold 34px sans-serif";
      ctx.fillStyle = "#fff7ff";
      ctx.fillText(fitText(ctx, name, 570), 340, y + 65);

      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#cdb8e6";
      ctx.fillText("ID DO DISCORD", 340, y + 103);
      ctx.font = "27px sans-serif";
      ctx.fillStyle = "#f5edff";
      ctx.fillText(fitText(ctx, String(entry.userId), 570), 340, y + 139);

      ctx.textAlign = "right";
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#cdb8e6";
      ctx.fillText("SALDO EM KIZUNAS", 1295, y + 49);
      ctx.font = "bold 43px sans-serif";
      ctx.fillStyle = "#e8c9ff";
      ctx.fillText(fitText(ctx, formatKz(entry.balance), 390), 1295, y + 105);
      ctx.textAlign = "left";
    }
  }

  const ownPosition = ranking.findIndex(entry => String(entry.userId) === String(requesterId));
  const own = ownPosition >= 0 ? ranking[ownPosition] : null;
  roundedRect(ctx, 50, 1150, 1300, 68, 18);
  ctx.fillStyle = "rgba(197, 138, 232, 0.16)";
  ctx.fill();
  ctx.font = "bold 23px sans-serif";
  ctx.fillStyle = "#f5e8ff";
  ctx.fillText(own ? "Sua posição: #" + (ownPosition + 1) + "  •  " + formatKz(own.balance) : "Sua posição: ainda sem saldo no ranking", 75, 1193);
  ctx.textAlign = "right";
  ctx.fillStyle = "#cdb8e6";
  ctx.font = "22px sans-serif";
  ctx.fillText("Página " + (page + 1) + " de " + Math.max(1, Math.ceil(ranking.length / 5)), 1320, 1193);
  ctx.textAlign = "left";

  return new AttachmentBuilder(await canvas.encode("png"), { name: "rank-kz-yukina.png" });
}

async function buildRanking(guild, requesterId, page = 0) {
  const ranking = await getEconomyRanking(guild.id);
  const maxPage = Math.max(0, Math.ceil(ranking.length / 5) - 1);
  const safePage = Math.max(0, Math.min(Number(page) || 0, maxPage));
  const attachment = await renderRankingCard(guild, ranking, requesterId, safePage);
  return { attachment, ranking, page: safePage, maxPage };
}

function pageButtons(userId, page, maxPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rankkz:" + userId + ":" + (page - 1))
      .setLabel("◀ Voltar")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("rankkz:" + userId + ":" + (page + 1))
      .setLabel("Próximo ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= maxPage)
  );
}


async function showRank(guild, user, sendOrEdit, page = 0, interaction = false) {
  if (!guild) return sendOrEdit({ content: "❄️ O ranking de KZ só pode ser consultado dentro de um servidor." });
  let loading;
  try {
    loading = await sendOrEdit({
      content: "❄️ **Estou atualizando o ranking, aguarde...**",
      allowedMentions: { parse: [] }
    });
    const { attachment, page: currentPage, maxPage } = await buildRanking(guild, user.id, page);
    const payload = {
      content: "🌙 **Ranking de KZ atualizado!** Use **Voltar** e **Próximo** para navegar.",
      files: [attachment],
      components: [pageButtons(user.id, currentPage, maxPage)],
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank-kz")
    .setDescription("Veja o ranking em card dos maiores saldos de Kizunas."),
  aliases: ["rankkz", "kzrank", "topkz", "rankkizunas"],
  async execute(interaction) {
    await interaction.deferReply();
    return showRank(interaction.guild, interaction.user, payload => interaction.editReply(payload), 0, true);
  },
  async prefixExecute(message) {
    return showRank(message.guild, message.author, payload => message.reply(payload), 0, false);
  },
  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith("rankkz:")) return;
    const [, ownerId, rawPage] = interaction.customId.split(":");
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❄️ Só quem abriu este ranking pode usar esses botões.", ephemeral: true });
    }
    const page = Number(rawPage);
    await interaction.deferUpdate();
    try {
      const { attachment, page: currentPage, maxPage } = await buildRanking(interaction.guild, interaction.user.id, page);
      await interaction.editReply({
        content: "🌙 **Ranking de KZ atualizado!** Use **Voltar** e **Próximo** para navegar.",
        files: [attachment],
        attachments: [],
        components: [pageButtons(interaction.user.id, currentPage, maxPage)],
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      console.error("[Yukina Rank KZ] Falha ao trocar página:", error);
      await interaction.followUp({ content: "🫧 Não consegui carregar essa página do ranking.", ephemeral: true });
    }
  }
};
