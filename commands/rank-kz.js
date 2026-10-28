"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { MongoClient } = require("mongodb");

const COLOR = "#c58ae8";
const FILE = path.join(process.cwd(), "data", "economia.json");
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
let mongoClient;

function formatKz(value) {
  return Math.floor(Math.max(0, Number(value) || 0)).toLocaleString("pt-BR") + " KZ";
}

function readBalance(record) {
  const value = typeof record === "number"
    ? record
    : (record?.balance ?? record?.saldo ?? record?.wallet ?? record?.kizunas ?? 0);
  const balance = Number(value);
  return Number.isFinite(balance) && balance > 0 ? balance : 0;
}

async function getMongoRanking(guildId) {
  if (!MONGODB_URI) return null;
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-Rank-KZ",
      serverSelectionTimeoutMS: 10000,
    });
  }
  await mongoClient.connect();
  const docs = await mongoClient.db(MONGODB_DB).collection("economy_balances")
    .find({ guildId: String(guildId) }, { projection: { userId: 1, balance: 1, _id: 0 } })
    .toArray();

  if (!docs.length) return null;
  return docs
    .map(doc => ({ userId: String(doc.userId), balance: readBalance(doc.balance) }))
    .filter(doc => /^\\d{15,22}$/.test(doc.userId))
    .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
}

async function getLocalRanking(guildId) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[Rank KZ] Falha ao ler economia local:", error.message);
    return [];
  }

  const guild = data?.[String(guildId)];
  const source = guild && typeof guild === "object" && !Array.isArray(guild)
    ? guild
    : Object.fromEntries(Object.entries(data || {}).filter(([id]) => /^\\d{15,22}$/.test(id)));

  return Object.entries(source)
    .map(([userId, record]) => ({ userId: String(userId), balance: readBalance(record) }))
    .filter(doc => /^\\d{15,22}$/.test(doc.userId))
    .sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));
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

async function renderRankingCard(guild, ranking, requesterId) {
  const width = 1200;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#171329");
  background.addColorStop(0.52, "#30204a");
  background.addColorStop(1, "#111827");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Brilhos suaves para o tema lunar da Yukina.
  for (let i = 0; i < 70; i++) {
    const x = (i * 197 + 61) % width;
    const y = (i * 131 + 37) % height;
    ctx.globalAlpha = 0.18 + ((i % 4) * 0.08);
    ctx.fillStyle = i % 3 === 0 ? "#f0c9ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Lua decorativa.
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
  ctx.font = "bold 56px sans-serif";
  ctx.fillText("Top 5 — Kizunas", 64, 132);
  ctx.fillStyle = "#d9c8f0";
  ctx.font = "24px sans-serif";
  ctx.fillText("Os cinco membros mais ricos desta comunidade", 66, 174);

  roundedRect(ctx, 48, 210, 1104, 610, 28);
  ctx.fillStyle = "rgba(15, 12, 31, 0.72)";
  ctx.fill();

  const top = ranking.slice(0, 5);
  if (!top.length) {
    ctx.fillStyle = "#eee5f7";
    ctx.font = "28px sans-serif";
    ctx.fillText("Ainda não há Kizunas registradas neste servidor.", 90, 350);
    ctx.fillText("Junte KZ e seja o primeiro no ranking!", 90, 400);
  } else {
    for (let index = 0; index < top.length; index++) {
      const entry = top[index];
      const y = 230 + index * 112;
      const position = index + 1;
      let member = guild.members.cache.get(entry.userId);
      if (!member) {
        try { member = await guild.members.fetch(entry.userId); } catch {}
      }
      const name = member?.displayName || member?.user?.username || ("Membro " + entry.userId.slice(-4));
      const avatarUrl = member?.user?.displayAvatarURL
        ? member.user.displayAvatarURL({ extension: "png", size: 128 })
        : null;
      const isRequester = entry.userId === String(requesterId);

      roundedRect(ctx, 68, y, 1064, 100, 18);
      ctx.fillStyle = isRequester ? "rgba(197, 138, 232, 0.28)" : "rgba(255, 255, 255, 0.045)";
      ctx.fill();

      // Posição do ranking.
      ctx.font = "bold 30px sans-serif";
      ctx.fillStyle = position === 1 ? "#ffd66b" : position === 2 ? "#e4e9f3" : position === 3 ? "#e8b28e" : "#d9c8f0";
      ctx.fillText(position === 1 ? "♛" : "#" + position, 86, y + 40);

      // Foto do membro, com moldura lilás.
      const avatarX = 145;
      const avatarY = y + 9;
      const avatarSize = 62;
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
      ctx.strokeStyle = "#d9b5ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 1, 0, Math.PI * 2);
      ctx.stroke();

      // Nome abaixo da foto; ID e saldo lado a lado à direita.
      ctx.textAlign = "center";
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "#f5f0fc";
      ctx.fillText(fitText(ctx, name, 115), avatarX + avatarSize / 2, y + 91);
      ctx.textAlign = "left";

      ctx.font = "17px sans-serif";
      ctx.fillStyle = "#cdb8e6";
      ctx.fillText("ID: " + entry.userId, 245, y + 40);

      ctx.font = "bold 24px sans-serif";
      ctx.fillStyle = "#e8c9ff";
      ctx.textAlign = "right";
      ctx.fillText(formatKz(entry.balance), 1105, y + 58);
      ctx.textAlign = "left";
    }
  }

  const ownPosition = ranking.findIndex(entry => entry.userId === String(requesterId));
  const own = ownPosition >= 0 ? ranking[ownPosition] : null;
  roundedRect(ctx, 48, 840, 1104, 42, 15);
  ctx.fillStyle = "rgba(197, 138, 232, 0.16)";
  ctx.fill();
  ctx.font = "bold 19px sans-serif";
  ctx.fillStyle = "#f5e8ff";
  ctx.fillText(own ? "Sua posição: #" + (ownPosition + 1) + "  •  " + formatKz(own.balance) : "Sua posição: ainda sem saldo no ranking", 70, 867);
  ctx.textAlign = "right";
  ctx.fillStyle = "#cdb8e6";
  ctx.font = "18px sans-serif";
  ctx.fillText("Exibindo os 5 maiores saldos", 1125, 867);
  ctx.textAlign = "left";

  return new AttachmentBuilder(await canvas.encode("png"), { name: "rank-kz-yukina.png" });
}

async function buildRanking(guild, requesterId) {
  let ranking = null;
  try {
    ranking = await getMongoRanking(guild.id);
  } catch (error) {
    console.error("[Rank KZ] Falha ao consultar MongoDB:", error.message || error);
  }
  if (!ranking) ranking = await getLocalRanking(guild.id);
  const positive = ranking.filter(entry => entry.balance > 0);
  const attachment = await renderRankingCard(guild, positive, requesterId);
  return { attachment, ranking: positive };
}

async function run(guild, user, reply) {
  if (!guild) {
    return reply({ content: "❄️ O ranking de KZ só pode ser consultado dentro de um servidor." });
  }
  try {
    const { attachment } = await buildRanking(guild, user.id);
    return reply({ files: [attachment], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Yukina Rank KZ]", error);
    return reply({ content: "🫧 Não consegui montar o card de KZ agora. Confira a economia e tente novamente." });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank-kz")
    .setDescription("Veja o ranking em card dos maiores saldos de Kizunas."),
  aliases: ["rankkz", "kzrank", "topkz", "rankkizunas"],
  async execute(interaction) {
    await interaction.deferReply();
    return run(interaction.guild, interaction.user, payload => interaction.editReply(payload));
  },
  async prefixExecute(message) {
    return run(message.guild, message.author, payload => message.reply(payload));
  },
};
