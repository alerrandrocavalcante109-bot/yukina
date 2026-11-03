"use strict";

const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const memberData = require("../member-data");
const xpRoleStorage = require("../system-storage").forSystem("xp-level-roles");

const WIDTH = 1000;
const HEIGHT = 430;
async function getNextConfiguredRole(guild, currentLevel) {
  try {
    const config = await xpRoleStorage.get(guild.id, "config", null);
    const rules = Array.isArray(config?.xpRules) ? config.xpRules : [];
    const nextRule = rules
      .map(rule => ({
        level: Number(rule?.level),
        roleId: String(rule?.roleId || rule?.role_id || rule?.role || ""),
      }))
      .filter(rule => Number.isInteger(rule.level) && rule.level > currentLevel && rule.roleId)
      .sort((a, b) => a.level - b.level)[0];
    if (!nextRule) return null;
    const role = guild.roles.cache.get(nextRule.roleId)
      || await guild.roles.fetch(nextRule.roleId).catch(() => null);
    if (!role) return { level: nextRule.level, roleName: "Cargo configurado (não encontrado)" };
    return {
      level: nextRule.level,
      roleName: role.name,
      requiredXp: (nextRule.level - 1) * 1000,
    };
  } catch (error) {
    console.error("[Yukina /xp] Não consegui consultar o próximo cargo:", error.message);
    return null;
  }
}

function levelForXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  const level = Math.floor(total / 1000) + 1;
  const currentLevelXp = (level - 1) * 1000;
  const nextLevelXp = level * 1000;
  return {
    level,
    name: level < 5 ? "Iniciante" : level < 15 ? "Aprendiz" : level < 30 ? "Explorador" : level < 50 ? "Veterano" : level < 100 ? "Lendário" : "Mítico",
    currentLevelXp,
    nextLevelXp,
    progress: Math.max(0, Math.min(100, Math.floor(((total - currentLevelXp) / 1000) * 100))),
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawText(ctx, text, x, y, font, color, maxWidth) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(String(text), x, y, maxWidth);
}

async function buildRankCard(user, record, position, total, guild) {
  // Renderização em alta densidade: mantém proporção 220x160 e textos nítidos.
  const SCALE = 3;
  const CARD_W = 220;
  const CARD_H = 160;
  const canvas = createCanvas(CARD_W * SCALE, CARD_H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  const xp = Math.max(0, Number(record.xp) || 0);
  const current = levelForXp(xp);
  const nextRole = await getNextConfiguredRole(guild, current.level);
  const displayName = user.globalName || user.username || "Aventureiro";

  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#101b3b");
  bg.addColorStop(0.55, "#263f70");
  bg.addColorStop(1, "#77558f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const moon = ctx.createRadialGradient(188, 12, 2, 188, 12, 72);
  moon.addColorStop(0, "rgba(224,248,255,0.32)");
  moon.addColorStop(1, "rgba(224,248,255,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(130, 0, 90, 85);

  for (let i = 0; i < 28; i++) {
    const x = (i * 47 + 13) % CARD_W;
    const y = (i * 29 + 7) % CARD_H;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 1 : 0.55, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,220,246,0.9)" : "rgba(220,246,255,0.9)";
    ctx.fill();
  }

  roundedRect(ctx, 5, 5, 210, 150, 12);
  ctx.fillStyle = "rgba(7,14,34,0.76)";
  ctx.fill();
  ctx.strokeStyle = "rgba(207,239,255,0.72)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Avatar e identificação.
  const avatarX = 13, avatarY = 17, avatarSize = 48;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + 24, avatarY + 24, 25.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(174,232,255,0.35)";
  ctx.fill();
  ctx.strokeStyle = "#c8f2ff";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(avatarX + 24, avatarY + 24, 23.5, 0, Math.PI * 2);
  ctx.clip();
  try {
    const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 128 }));
    ctx.drawImage(avatar, avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2);
  } catch {
    ctx.fillStyle = "#5279a8";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  ctx.shadowColor = "rgba(112,213,255,0.55)";
  ctx.shadowBlur = 5;
  drawText(ctx, "YUKINA  ❄  PERFIL XP", 70, 25, "bold 8px sans-serif", "#9fe8ff", 142);
  ctx.shadowBlur = 0;
  drawText(ctx, displayName, 70, 43, "bold 12px sans-serif", "#ffffff", 140);
  drawText(ctx, "POSIÇÃO  " + (position ? "#" + position : "—"), 70, 56, "bold 7.5px sans-serif", "#ffd4f0", 140);

  // Nível em destaque e XP total.
  roundedRect(ctx, 13, 74, 54, 47, 7);
  ctx.fillStyle = "rgba(120,190,255,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(164,225,255,0.48)";
  ctx.stroke();
  drawText(ctx, "NÍVEL", 20, 86, "bold 7px sans-serif", "#aeeaff");
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = 4;
  drawText(ctx, current.level.toLocaleString("pt-BR"), 19, 109, "bold 21px sans-serif", "#ffffff", 43);
  ctx.shadowBlur = 0;

  drawText(ctx, "XP ACUMULADO", 77, 83, "bold 7.5px sans-serif", "#aeeaff", 130);
  drawText(ctx, xp.toLocaleString("pt-BR") + " XP", 77, 101, "bold 13px sans-serif", "#ffffff", 130);
  drawText(ctx, "PRÓXIMO NÍVEL  " + current.progress + "%", 77, 114, "bold 7px sans-serif", "#f6d6ef", 130);

  // Barra de progresso viva e de alto contraste.
  roundedRect(ctx, 77, 119, 128, 7, 3.5);
  ctx.fillStyle = "rgba(230,244,255,0.25)";
  ctx.fill();
  if (current.progress > 0) {
    roundedRect(ctx, 77, 119, Math.max(3, 128 * current.progress / 100), 7, 3.5);
    const bar = ctx.createLinearGradient(77, 0, 205, 0);
    bar.addColorStop(0, "#65dcff");
    bar.addColorStop(0.55, "#b5eaff");
    bar.addColorStop(1, "#ff9bd8");
    ctx.fillStyle = bar;
    ctx.fill();
  }

  // Cargo seguinte e requisito.
  if (nextRole) {
    drawText(ctx, "PRÓXIMO CARGO: " + nextRole.roleName, 13, 139, "bold 7.5px sans-serif", "#ffbce8", 192);
    drawText(ctx, "Nível " + nextRole.level + "  •  " + (nextRole.requiredXp ?? ((nextRole.level - 1) * 1000)).toLocaleString("pt-BR") + " XP", 13, 149, "bold 7px sans-serif", "#e5f4ff", 192);
  } else {
    drawText(ctx, "Sem próximo cargo configurado", 13, 144, "bold 7.5px sans-serif", "#d9eaff", 192);
  }

  return canvas.toBuffer("image/png");
}
async function respond(interaction, target) {
  await memberData.initialize();
  const guildId = interaction.guild.id;
  const record = memberData.getRecord(guildId, target.id);
  const members = Object.entries(memberData.getMembers())
    .filter(([key, value]) => key.startsWith(guildId + ":") && value && typeof value === "object")
    .map(([key, value]) => ({
      userId: key.slice(guildId.length + 1),
      xp: Math.max(0, Number(value.xp) || 0),
    }))
    .sort((a, b) => b.xp - a.xp);
  const index = members.findIndex(item => item.userId === target.id);
  const buffer = await buildRankCard(target, record, index >= 0 ? index + 1 : null, members.length, interaction.guild);
  const attachment = new AttachmentBuilder(buffer, { name: "yukina-rank.png" });
  return interaction.reply({
    files: [attachment],
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Mostra seu nível, XP e posição no servidor.")
    .setDMPermission(false)
    .addUserOption(option => option.setName("membro").setDescription("Membro cujo perfil deseja consultar.").setRequired(false)),
  aliases: ["rank", "ranking", "nivel", "nível"],
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    }
    const target = interaction.options.getUser("membro") || interaction.user;
    try {
      return await respond(interaction, target);
    } catch (error) {
      console.error("[Yukina /xp]", error);
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: "💧 Não consegui gerar seu cartão de rank agora.", ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: "💧 Não consegui gerar seu cartão de rank agora.", ephemeral: true }).catch(() => {});
    }
  },
  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    let target = message.author;
    const mention = message.mentions.users.first();
    if (mention) target = mention;
    else if (args[0] && /^\d{17,20}$/.test(args[0])) {
      target = await message.client.users.fetch(args[0]).catch(() => null) || message.author;
    }
    const interactionLike = {
      guild: message.guild,
      user: message.author,
      reply: payload => message.channel.send({ ...payload, allowedMentions: { parse: [] } }),
    };
    try {
      return await respond(interactionLike, target);
    } catch (error) {
      console.error("[Yukina Yxp]", error);
      return message.reply("💧 Não consegui gerar seu cartão de rank agora.").catch(() => {});
    }
  },
};
