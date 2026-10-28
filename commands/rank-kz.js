"use strict";

const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { getEconomyRanking } = require("../economia-saldo");
const GIFEncoder = require("gif-encoder-2");


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
  while (result.length > 3 && ctx.measureText(result).width > maxWidth) {
    result = result.slice(0, -2) + "…";
  }
  return result;
}

async function renderRankingCard(guild, ranking, requesterId, page = 0) {
  const width = 1200;
  const height = 1120;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#171329");
  background.addColorStop(0.52, "#30204a");
  background.addColorStop(1, "#111827");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 85; i++) {
    const x = (i * 197 + 61) % width;
    const y = (i * 131 + 37) % height;
    ctx.globalAlpha = 0.18 + ((i % 4) * 0.08);
    ctx.fillStyle = i % 3 === 0 ? "#f0c9ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const moon = ctx.createRadialGradient(1040, 105, 8, 1040, 105, 88);
  moon.addColorStop(0, "#fff7ff");
  moon.addColorStop(0.55, "#e9c9ff");
  moon.addColorStop(1, "rgba(197,138,232,0)");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(1040, 105, 88, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8eaff";
  ctx.font = "bold 25px sans-serif";
  ctx.fillText("YUKINA  •  ARQUIVO DA ECONOMIA", 64, 65);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 58px sans-serif";
  ctx.fillText("Top 5 — Kizunas", 64, 132);
  ctx.fillStyle = "#d9c8f0";
  ctx.font = "25px sans-serif";
  ctx.fillText("Os membros com os maiores saldos da comunidade", 66, 174);

  roundedRect(ctx, 48, 210, 1104, 790, 28);
  ctx.fillStyle = "rgba(15, 12, 31, 0.72)";
  ctx.fill();

  const top = ranking.slice(page * 5, page * 5 + 5);
  if (!top.length) {
    ctx.fillStyle = "#eee5f7";
    ctx.font = "30px sans-serif";
    ctx.fillText("Ainda não há Kizunas registradas nesta página.", 90, 350);
  } else {
    for (let index = 0; index < top.length; index++) {
      const entry = top[index];
      const y = 225 + index * 153;
      const position = page * 5 + index + 1;
      let member = guild.members.cache.get(entry.userId) || null;
      let user = member?.user || null;
      if (!member) {
        try { member = await guild.members.fetch(entry.userId); user = member.user; } catch {}
      }
      if (!user) {
        try { user = await guild.client.users.fetch(entry.userId); } catch {}
      }
      const name = member?.displayName || user?.globalName || user?.username || ("Membro " + entry.userId.slice(-4));
      const avatarUrl = user?.displayAvatarURL
        ? user.displayAvatarURL({ extension: "png", size: 256 })
        : null;
      const isRequester = entry.userId === String(requesterId);

      roundedRect(ctx, 68, y, 1064, 140, 22);
      ctx.fillStyle = isRequester ? "rgba(197, 138, 232, 0.30)" : "rgba(255, 255, 255, 0.055)";
      ctx.fill();

      ctx.font = "bold 40px sans-serif";
      ctx.fillStyle = position === 1 ? "#ffd66b" : position === 2 ? "#e4e9f3" : position === 3 ? "#e8b28e" : "#d9c8f0";
      ctx.fillText(position === 1 ? "♛" : "#" + position, 88, y + 61);

      const avatarX = 170;
      const avatarY = y + 8;
      const avatarSize = 92;
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
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = "bold 19px sans-serif";
      ctx.fillStyle = "#fff7ff";
      ctx.fillText(fitText(ctx, name, 150), avatarX + avatarSize / 2, y + 126);
      ctx.textAlign = "left";

      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#cdb8e6";
      ctx.fillText("ID DO DISCORD", 300, y + 43);
      ctx.font = "23px sans-serif";
      ctx.fillStyle = "#f5edff";
      ctx.fillText(entry.userId, 300, y + 78);

      ctx.textAlign = "right";
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#cdb8e6";
      ctx.fillText("SALDO EM KIZUNAS", 1100, y + 43);
      ctx.font = "bold 34px sans-serif";
      ctx.fillStyle = "#e8c9ff";
      ctx.fillText(formatKz(entry.balance), 1100, y + 86);
      ctx.textAlign = "left";
    }
  }

  const ownPosition = ranking.findIndex(entry => entry.userId === String(requesterId));
  const own = ownPosition >= 0 ? ranking[ownPosition] : null;
  roundedRect(ctx, 48, 1020, 1104, 54, 17);
  ctx.fillStyle = "rgba(197, 138, 232, 0.16)";
  ctx.fill();
  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#f5e8ff";
  ctx.fillText(own ? "Sua posição: #" + (ownPosition + 1) + "  •  " + formatKz(own.balance) : "Sua posição: ainda sem saldo no ranking", 70, 1054);
  ctx.textAlign = "right";
  ctx.fillStyle = "#cdb8e6";
  ctx.font = "19px sans-serif";
  ctx.fillText("Página " + (page + 1) + " de " + Math.max(1, Math.ceil(ranking.length / 5)), 1125, 1054);
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

async function makeLoadingGif() {
  const width = 240;
  const height = 240;
  const encoder = new GIFEncoder(width, height, "neuquant", true);
  encoder.setDelay(140);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  const chunks = [];
  encoder.on("data", chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    encoder.once("end", () => resolve(Buffer.concat(chunks)));
    encoder.once("error", reject);
  });

  for (let frame = 0; frame < 8; frame++) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const bounce = Math.sin(frame * Math.PI / 4) * 7;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(37, 25, 58, 0.92)";
    ctx.beginPath();
    ctx.arc(120, 120, 108, 0, Math.PI * 2);
    ctx.fill();

    // Mascote animada: Yukina de capuz nevado, piscando e ofegante como um cachorrinho.
    ctx.fillStyle = "#f0e8ff";
    ctx.beginPath();
    ctx.moveTo(52, 105 + bounce);
    ctx.quadraticCurveTo(35, 30 + bounce, 88, 49 + bounce);
    ctx.quadraticCurveTo(120, 20 + bounce, 152, 48 + bounce);
    ctx.quadraticCurveTo(205, 25 + bounce, 190, 105 + bounce);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9a6f2";
    ctx.beginPath();
    ctx.arc(120, 111 + bounce, 72, Math.PI, Math.PI * 2);
    ctx.lineTo(192, 143 + bounce);
    ctx.quadraticCurveTo(120, 198 + bounce, 48, 143 + bounce);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffe8d9";
    ctx.beginPath();
    ctx.ellipse(120, 126 + bounce, 57, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7c4a88";
    for (const x of [99, 141]) {
      if (frame % 4 === 0) {
        ctx.fillRect(x - 7, 119 + bounce, 14, 3);
      } else {
        ctx.beginPath();
        ctx.ellipse(x, 119 + bounce, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ed9bb9";
    ctx.beginPath();
    ctx.arc(83, 139 + bounce, 10, 0, Math.PI * 2);
    ctx.arc(157, 139 + bounce, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7c4a88";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(108, 145 + bounce);
    ctx.quadraticCurveTo(120, 158 + bounce, 132, 145 + bounce);
    ctx.stroke();
    ctx.fillStyle = "#f06c9d";
    ctx.beginPath();
    ctx.ellipse(120, 160 + bounce + (frame % 2 ? 2 : 0), 10, frame % 2 ? 14 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("✦", 25 + (frame % 3) * 3, 65);
    ctx.fillText("✧", 190, 175 - (frame % 3) * 3);
    encoder.addFrame(ctx);
  }
  encoder.finish();
  return new AttachmentBuilder(await done, { name: "yukina-loading.gif" });
}

async function showRank(guild, user, sendOrEdit, page = 0, interaction = false) {
  if (!guild) return sendOrEdit({ content: "❄️ O ranking de KZ só pode ser consultado dentro de um servidor." });
  let loading;
  try {
    const gif = await makeLoadingGif();
    loading = await sendOrEdit({
      content: "❄️ **Estou atualizando o rank, aguarde...** 🐶👅",
      files: [gif],
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
