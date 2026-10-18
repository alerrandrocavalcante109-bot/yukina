/**
 * Cargos de nível da Yukina — compartilha XP persistido no MongoDB com rank-system.js.
 * Não altera nem remove cargos da hierarquia por tempo de permanência.
 */
const { PermissionFlagsBits } = require("discord.js");
const memberData = require("./member-data");
const CHECK_INTERVAL_MS = 10 * 60_000;

const LEVEL_ROLES = [
  { level: 1, name: "❄️・Nível 1 | Iniciante", xp: 0, color: 0xA7D8F0 },
  { level: 5, name: "🌱・Nível 5 | Aprendiz", xp: 500, color: 0xB7E4C7 },
  { level: 10, name: "🌸・Nível 10 | Explorador", xp: 1500, color: 0xF2A7C6 },
  { level: 15, name: "🩵・Nível 15 | Participante", xp: 3000, color: 0x83D6C5 },
  { level: 20, name: "🌙・Nível 20 | Dedicado", xp: 5000, color: 0x8ECAE6 },
  { level: 25, name: "✨・Nível 25 | Experiente", xp: 7500, color: 0xF4D58D },
  { level: 30, name: "💎・Nível 30 | Veterano", xp: 10500, color: 0x7DA0FA },
  { level: 40, name: "🪻・Nível 40 | Elite", xp: 15000, color: 0xB9A7E8 },
  { level: 50, name: "👑・Nível 50 | Mestre", xp: 20000, color: 0xFFD166 },
  { level: 60, name: "🌌・Nível 60 | Lendário", xp: 26000, color: 0x6C63FF },
  { level: 75, name: "🔮・Nível 75 | Mítico", xp: 35000, color: 0xC77DFF },
  { level: 100, name: "♾️・Nível 100 | Imortal", xp: 50000, color: 0xE0FBFC },
];

function getLevelRole(xp) {
  let selected = LEVEL_ROLES[0];
  for (const item of LEVEL_ROLES) {
    if (xp >= item.xp) selected = item;
  }
  return selected;
}

async function ensureLevelRoles(guild) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn("[Níveis XP] Yukina precisa da permissão Gerenciar cargos em " + guild.name + ".");
    return null;
  }

  const roles = new Map();
  for (const item of LEVEL_ROLES) {
    let role = guild.roles.cache.find((role) => role.name === item.name);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: item.name,
          color: item.color,
          hoist: false,
          mentionable: false,
          permissions: [],
          reason: "Progressão automática de nível por XP da Yukina",
        });
      } catch (error) {
        console.error("[Níveis XP] Falha ao criar " + item.name + ":", error.message);
        return null;
      }
    }
    if (role.managed || role.position >= me.roles.highest.position) {
      console.warn("[Níveis XP] Coloque o cargo da Yukina acima de " + role.name + ".");
      return null;
    }
    roles.set(item.level, role);
  }
  return roles;
}

async function updateLevel(member, announce = false) {
  if (!member || member.user.bot || !member.guild) return;
  const roles = await ensureLevelRoles(member.guild);
  if (!roles) return;

  const record = memberData.getRecord(member.guild.id, member.id);
  const xp = Math.max(0, Number(record.xp) || 0);
  const selected = getLevelRole(xp);
  const selectedRole = roles.get(selected.level);
  if (!selectedRole) return;

  const levelRoleIds = new Set([...roles.values()].map((role) => role.id));
  const current = member.roles.cache.filter((role) => levelRoleIds.has(role.id));
  const hadSelected = current.has(selectedRole.id);
  const removeIds = current.filter((role) => role.id !== selectedRole.id).map((role) => role.id);

  try {
    if (removeIds.length) await member.roles.remove(removeIds, "Atualização de cargo por nível de XP");
    if (!hadSelected) await member.roles.add(selectedRole, "Cargo automático por nível de XP da Yukina");

    if (announce && !hadSelected) {
      const channel = member.guild.systemChannel;
      if (channel && channel.viewable &&
          channel.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        await channel.send({
          content: "✨ Parabéns, " + member.toString() + "! Você alcançou **" + selected.name +
            "** com **" + xp.toLocaleString("pt-BR") + " XP**!",
          allowedMentions: { users: [member.id] },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[Níveis XP] Não consegui atualizar " + member.user.tag + ":", error.message);
  }
}

function startXpLevelSystem(client) {
  client.on("guildMemberAdd", async (member) => {
    if (member.user.bot) return;
    await memberData.initialize();
    await updateLevel(member, false);
  });

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    await memberData.initialize();
    await updateLevel(message.member, true);
  });

  client.once("clientReady", async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      await ensureLevelRoles(guild);
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateLevel(member, false);
      }
    }
    console.log("[Níveis XP] 12 cargos automáticos de nível ativados.");
  });

  setInterval(async () => {
    await memberData.initialize();
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateLevel(member, false);
      }
    }
  }, CHECK_INTERVAL_MS).unref?.();
}

module.exports = startXpLevelSystem;
