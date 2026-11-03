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
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const xp = Math.max(0, Number(record.xp) || 0);
  const current = levelForXp(xp);
  const nextXp = current.nextLevelXp;
  const progress = current.progress;
  const nextRole = await getNextConfiguredRole(guild, current.level);
  const displayName = user.globalName || user.username || "Aventureiro";

  // Fundo personalizado: noite azul, luar e detalhes de neve da Yukina.
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#101a36");
  bg.addColorStop(0.55, "#263e68");
  bg.addColorStop(1, "#765f91");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Brilho lunar no canto superior direito.
  const moon = ctx.createRadialGradient(830, 48, 4, 830, 48, 210);
  moon.addColorStop(0, "rgba(224,245,255,0.24)");
  moon.addColorStop(1, "rgba(224,245,255,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(600, 0, 400, 250);

  // Flocos decorativos.
  for (let i = 0; i < 48; i++) {
    const x = (i * 137 + 29) % WIDTH;
    const y = (i * 71 + 17) % HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 2.2 : 1.1, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,220,242,0.72)" : "rgba(220,244,255,0.65)";
    ctx.fill();
  }

  // Painel de vidro.
  roundedRect(ctx, 18, 18, WIDTH - 36, HEIGHT - 36, 28);
  ctx.fillStyle = "rgba(9, 17, 39, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(219, 241, 255, 0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar com aro de gelo.
  const avatarSize = 176;
  const avatarX = 58;
  const avatarY = 92;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(183, 231, 255, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "#c9f0ff";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 256 }));
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } catch {
    ctx.fillStyle = "#6f8fb8";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    drawText(ctx, "❄", avatarX + 58, avatarY + 108, "64px sans-serif", "#ffffff");
  }
  ctx.restore();

  drawText(ctx, "YUKINA  /  JORNADA DO MEMBRO", 270, 65, "bold 18px sans-serif", "#bfeaff", 600);
  drawText(ctx, displayName, 270, 112, "bold 38px sans-serif", "#ffffff", 650);
  drawText(ctx, "Seu caminho continua sob o luar.", 272, 143, "18px sans-serif", "#c8d9f2", 620);

  // Blocos de estatística.
  const stats = [
    { x: 270, label: "NÍVEL", value: current.level },
    { x: 455, label: "POSIÇÃO", value: position ? "#" + position : "—" },
    { x: 650, label: "PATAMAR", value: current.name },
  ];
  for (const stat of stats) {
    roundedRect(ctx, stat.x, 166, stat.x === 650 ? 286 : 160, 68, 14);
    ctx.fillStyle = "rgba(211, 235, 255, 0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(211, 235, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    drawText(ctx, stat.label, stat.x + 14, 190, "bold 12px sans-serif", "#a9c7e8", stat.x === 650 ? 250 : 135);
    drawText(ctx, stat.value, stat.x + 14, 219, "bold 21px sans-serif", "#ffffff", stat.x === 650 ? 250 : 135);
  }

  drawText(ctx, "XP TOTAL ACUMULADO", 62, 300, "bold 14px sans-serif", "#bfeaff");
  drawText(ctx, xp.toLocaleString("pt-BR") + " XP", 62, 328, "bold 21px sans-serif", "#ffffff");
  drawText(ctx, "PRÓXIMO NÍVEL", 62, 370, "bold 13px sans-serif", "#bfeaff");
  drawText(ctx, (nextXp - xp).toLocaleString("pt-BR") + " XP restantes", 62, 395, "bold 17px sans-serif", "#ffffff");
  const barX = 270, barY = 270, barW = 650, barH = 17;
  roundedRect(ctx, barX, barY, barW, barH, 9);
  ctx.fillStyle = "rgba(230, 243, 255, 0.18)";
  ctx.fill();
  if (progress > 0) {
    roundedRect(ctx, barX, barY, Math.max(18, barW * progress / 100), barH, 9);
    const fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fill.addColorStop(0, "#a5e8ff");
    fill.addColorStop(1, "#f4b8e5");
    ctx.fillStyle = fill;
    ctx.fill();
  }
  drawText(ctx, progress + "%", 930, 284, "bold 14px sans-serif", "#ffffff", 48);
  drawText(ctx, xp.toLocaleString("pt-BR") + " / " + nextXp.toLocaleString("pt-BR") + " XP para o próximo nível", 270, 316, "15px sans-serif", "#d4e5f8", 650);
  if (nextRole) {
    drawText(ctx, "PRÓXIMO CARGO: " + nextRole.roleName, 270, 360, "bold 17px sans-serif", "#f4c9e8", 650);
    drawText(ctx, "Nível " + nextRole.level + "  ·  " + (nextRole.requiredXp ?? ((nextRole.level - 1) * 1000)).toLocaleString("pt-BR") + " XP necessários", 270, 386, "15px sans-serif", "#d4e5f8", 650);
  } else {
    drawText(ctx, "PRÓXIMO CARGO: nenhum cargo futuro configurado", 270, 370, "bold 15px sans-serif", "#c8d9f2", 650);
  }
  drawText(ctx, total + " membros registrados  ·  Yukina ❄", 270, 405, "12px sans-serif", "#a9c7e8", 650);

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
