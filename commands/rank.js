"use strict";

const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const memberData = require("../member-data");
const xpRoleStorage = require("../system-storage").forSystem("xp-level-roles");
const { getVipCollection } = require("../vip-store");
const rankKz = require("../systems/rank-kz");

const WIDTH = 1000;
const HEIGHT = 430;
async function getActivePlan(userId) {
  try {
    const subscriptions = await getVipCollection();
    const active = await subscriptions.find({
      userId: String(userId),
      status: "active",
      expiresAt: { $gt: new Date() },
    }).toArray();

    const tiers = { starter: 1, plus: 2, premium: 3, ultra: 4, infinity: 5 };
    const selected = active
      .filter(subscription => tiers[String(subscription.planKey || "").toLowerCase()])
      .sort((a, b) =>
        tiers[String(b.planKey).toLowerCase()] - tiers[String(a.planKey).toLowerCase()]
      )[0];

    if (!selected) return null;
    const planKey = String(selected.planKey).toLowerCase();
    const names = {
      starter: "Starter",
      plus: "Plus",
      premium: "Premium",
      ultra: "Ultra",
      infinity: "Infinity",
    };
    return { name: names[planKey] };
  } catch (error) {
    console.error("[Yukina /xp] Não consegui consultar o plano ativo:", error.message);
    return null;
  }
}

async function getActiveMultiplierRole(guild, userId) {
  try {
    const storage = require("../system-storage").forSystem("xp-multipliers");
    const config = await storage.get(guild.id, "config", null);
    let rules = Array.isArray(config?.multiplierRules) ? config.multiplierRules : null;

    if (!rules) {
      const { getGuildSettings } = require("../guild-settings-store");
      const legacy = await getGuildSettings(guild.id);
      rules = Array.isArray(legacy?.multiplierRules) ? legacy.multiplierRules : [];
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return null;

    const eligible = rules.map(rule => ({
      roleId: String(rule?.role || rule?.roleId || rule?.role_id || ""),
      multiplier: Number(rule?.multiplier),
    })).filter(rule =>
      rule.roleId &&
      member.roles.cache.has(rule.roleId) &&
      Number.isFinite(rule.multiplier) &&
      rule.multiplier >= 0.1
    ).sort((a, b) => b.multiplier - a.multiplier);

    if (!eligible.length) return null;
    const selected = eligible[0];
    const role = guild.roles.cache.get(selected.roleId)
      || await guild.roles.fetch(selected.roleId).catch(() => null);

    return {
      roleName: role?.name || "Cargo não encontrado",
      multiplier: selected.multiplier,
    };
  } catch (error) {
    console.error("[Yukina /xp] Não consegui consultar o cargo multiplicador:", error.message);
    return null;
  }
}

async function getHighestConfiguredXpRole(guild) {
  try {
    const config = await xpRoleStorage.get(guild.id, "config", null);
    const rules = Array.isArray(config?.xpRules) ? config.xpRules : [];
    const highestRule = rules
      .map(rule => ({
        level: Number(rule?.level),
        roleId: String(rule?.roleId || rule?.role_id || rule?.role || ""),
      }))
      .filter(rule => Number.isInteger(rule.level) && rule.level > 0 && rule.roleId)
      .sort((a, b) => b.level - a.level)[0];
    if (!highestRule) return null;
    const role = guild.roles.cache.get(highestRule.roleId)
      || await guild.roles.fetch(highestRule.roleId).catch(() => null);
    return {
      level: highestRule.level,
      roleName: role?.name || "Cargo não encontrado",
      requiredXp: highestRule.level * 1000,
    };
  } catch (error) {
    console.error("[Yukina /xp] Não consegui consultar o cargo máximo de XP:", error.message);
    return null;
  }
}

function levelForXp(xp) {
  // A progressão começa no nível 0 e avança a cada 1.000 XP acumulados.
  // O progresso considera somente o XP dentro do nível atual, sem perder o total histórico.
  const parsed = Number(xp);
  const total = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const level = Math.floor(total / 1000);
  const xpIntoLevel = total - (level * 1000);
  const xpForNextLevel = 1000;
  return {
    level,
    name: level < 5 ? "Iniciante" : level < 15 ? "Aprendiz" : level < 30 ? "Explorador" : level < 50 ? "Veterano" : level < 100 ? "Lendário" : "Mítico",
    totalXp: total,
    xpIntoLevel,
    xpForNextLevel,
    nextLevelXp: (level + 1) * 1000,
    progress: Math.max(0, Math.min(100, Math.floor((xpIntoLevel / xpForNextLevel) * 100))),
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

function normalizeCanvasName(value) {
  const emojiFallbacks = new Map([
    ["🌸", "❀"], ["🌺", "✿"], ["❄", "✧"], ["✨", "✦"],
    ["⭐", "★"], ["🌙", "☾"], ["💗", "♡"], ["❤️", "♥"],
    ["🎀", "◇"], ["🦋", "❋"], ["🔥", "✹"], ["🍁", "❖"],
  ]);
  let text = String(value ?? "Aventureiro").normalize("NFKC");
  for (const [emoji, fallback] of emojiFallbacks) text = text.split(emoji).join(fallback);
  // Remove seletores de emoji e conectores invisíveis que podem virar quadradinhos.
  text = text.replace(/[\uFE0E\uFE0F\u200D\u200B\u2060]/g, "");
  // Mantém letras, acentos, números e símbolos comuns; evita glifos sem suporte no servidor.
  text = Array.from(text).map(char => {
    const cp = char.codePointAt(0);
    if (cp > 0x2FFF) return "·";
    return char;
  }).join("");
  return text.replace(/\s+/g, " ").trim().slice(0, 28) || "Aventureiro";
}

function drawText(ctx, text, x, y, font, color, maxWidth) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(String(text), x, y, maxWidth);
}

async function buildXpRankingCard(guild) {
  const width = 1536;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const backgroundPath = require("node:path").join(__dirname, "../assets/images/rank/Rank.xp.png");
  const background = await loadImage(backgroundPath);
  ctx.drawImage(background, 0, 0, width, height);

  const members = Object.entries(memberData.getMembers())
    .filter(([key, value]) => key.startsWith(guild.id + ":") && value && typeof value === "object")
    .map(([key, value]) => ({
      userId: key.slice(guild.id.length + 1),
      xp: Math.max(0, Number(value.xp) || 0),
    }))
    .sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId))
    .slice(0, 5);

  const rowCenters = [371, 477, 583, 688, 793];
  for (let index = 0; index < members.length; index++) {
    const entry = members[index];
    const centerY = rowCenters[index];
    let member = guild.members.cache.get(entry.userId) || null;
    if (!member) {
      member = await guild.members.fetch(entry.userId).catch(() => null);
    }
    let user = member?.user || guild.client.users.cache.get(entry.userId) || null;
    if (!user) user = await guild.client.users.fetch(entry.userId).catch(() => null);

    const name = normalizeCanvasName(
      member?.displayName || user?.globalName || user?.username || ("Usuário " + entry.userId.slice(-4))
    );

    const avatarX = 932;
    const avatarY = centerY - 37;
    const avatarSize = 74;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    if (user) {
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
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 34px sans-serif";
    ctx.fillStyle = "#fff4ff";
    ctx.fillText(name, 1024, centerY, 340);
    ctx.textAlign = "right";
    ctx.font = "bold 29px sans-serif";
    ctx.fillStyle = "#e8c9ff";
    ctx.fillText(entry.xp.toLocaleString("pt-BR") + " XP", 1450, centerY + 30, 390);
    ctx.restore();
  }

  return new AttachmentBuilder(await canvas.encode("png"), { name: "rank-xp-yukina.png" });
}

async function respond(interaction) {
  await memberData.initialize();
  const attachment = await buildXpRankingCard(interaction.guild);
  return interaction.reply({
    files: [attachment],
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Consulte seu ranking de XP ou de Kizunas.")
    .setDMPermission(false)
    .addSubcommand(subcommand => subcommand
      .setName("xp")
      .setDescription("Mostra os cinco maiores acumuladores de XP deste servidor."))
    .addSubcommand(subcommand => subcommand
      .setName("kz")
      .setDescription("Mostra o ranking global de Kizunas.")
      .addBooleanOption(option => option.setName("local").setDescription("Limitar aos membros deste servidor.").setRequired(false))),
  aliases: ["xp"],
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({ content: "❄️ Este comando só funciona dentro de um servidor.", ephemeral: true });
    }
    const action = interaction.options.getSubcommand();
    try {
      if (action === "kz") {
        await interaction.deferReply();
        return rankKz.showRank(
          interaction.guild,
          interaction.user,
          payload => interaction.editReply(payload),
          0,
          true,
          interaction.options.getBoolean("local") || false
        );
      }
      return await respond(interaction);
    } catch (error) {
      console.error("[Yukina /rank]", error);
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: "💧 Não consegui gerar seu ranking agora.", ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: "💧 Não consegui gerar seu ranking agora.", ephemeral: true }).catch(() => {});
    }
  },
  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    const action = String(args[0] || "xp").toLowerCase();
    if (action === "kz") {
      const local = args.slice(1).some(value => String(value).toLowerCase() === "local");
      return rankKz.showRank(
        message.guild,
        message.author,
        payload => message.reply(payload),
        0,
        false,
        local
      );
    }
    const interactionLike = {
      guild: message.guild,
      user: message.author,
      reply: payload => message.channel.send({ ...payload, allowedMentions: { parse: [] } }),
    };
    try {
      return await respond(interactionLike);
    } catch (error) {
      console.error("[Yukina Yrank xp]", error);
      return message.reply("💧 Não consegui gerar seu cartão de rank agora.").catch(() => {});
    }
  },
  async handleInteraction(interaction) {
    return rankKz.handleInteraction(interaction);
  },
};
