/**
 * Hierarquia de membros Yukina — XP + tempo de permanência.
 * O progresso fica em data/member-ranks.json. Em hospedagens com disco efêmero,
 * configure um disco persistente ou banco de dados para preservar XP entre deploys.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PermissionFlagsBits } = require("discord.js");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "member-ranks.json");
const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 8;
const XP_MAX = 15;
const TENURE_CHECK_MS = 10 * 60_000;

const RANKS = [
  { key: "novato", name: "❄️・Novato", color: 0xA7D8F0, xp: 0, days: 0 },
  { key: "membro", name: "🌸・Membro", color: 0xF2A7C6, xp: 100, days: 3 },
  { key: "veterano", name: "🌙・Veterano", color: 0x8ECAE6, xp: 500, days: 14 },
  { key: "lenda", name: "✨・Lenda", color: 0xF4D58D, xp: 1500, days: 45 },
];

let store = { members: {} };
const lastXpAt = new Map();

function loadStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (parsed && parsed.members && typeof parsed.members === "object") store = parsed;
    }
  } catch (error) {
    console.error("[Hierarquia] Não consegui ler os dados salvos:", error.message);
  }
}

function saveStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(store, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("[Hierarquia] Não consegui salvar XP:", error.message);
  }
}

function memberKey(guildId, userId) {
  return guildId + ":" + userId;
}

function getRecord(guildId, userId) {
  const key = memberKey(guildId, userId);
  if (!store.members[key]) store.members[key] = { xp: 0, joinedAt: null, rank: null };
  return store.members[key];
}

function daysSince(date) {
  if (!date) return 0;
  return Math.max(0, (Date.now() - date) / 86_400_000);
}

async function ensureRankRoles(guild) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn("[Hierarquia] Yukina precisa da permissão Gerenciar cargos em " + guild.name + ".");
    return null;
  }

  const roles = new Map();
  for (const rank of RANKS) {
    let role = guild.roles.cache.find((item) => item.name === rank.name);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: rank.name,
          color: rank.color,
          hoist: false,
          mentionable: false,
          permissions: [],
          reason: "Hierarquia automática de membros da Yukina",
        });
      } catch (error) {
        console.error("[Hierarquia] Não consegui criar " + rank.name + " em " + guild.name + ":", error.message);
        return null;
      }
    }
    if (role.managed || role.position >= me.roles.highest.position) {
      console.warn("[Hierarquia] O cargo " + role.name + " está acima do cargo da Yukina; ajuste a hierarquia no Discord.");
      return null;
    }
    roles.set(rank.key, role);
  }
  return roles;
}

function rankFor(record, joinedAt) {
  const tenure = daysSince(joinedAt);
  let chosen = RANKS[0];
  for (const rank of RANKS) {
    if (record.xp >= rank.xp && tenure >= rank.days) chosen = rank;
  }
  return chosen;
}

async function updateMemberRank(member, announce = false) {
  if (!member || member.user.bot || !member.guild) return;
  const roles = await ensureRankRoles(member.guild);
  if (!roles) return;

  const record = getRecord(member.guild.id, member.id);
  const joinedAt = member.joinedAt || (record.joinedAt ? new Date(record.joinedAt) : new Date());
  if (!record.joinedAt) record.joinedAt = joinedAt.toISOString();
  const chosen = rankFor(record, joinedAt);
  const chosenRole = roles.get(chosen.key);
  if (!chosenRole) return;

  const rankRoleIds = new Set([...roles.values()].map((role) => role.id));
  const currentRankRoles = member.roles.cache.filter((role) => rankRoleIds.has(role.id));
  const alreadyHasChosen = currentRankRoles.has(chosenRole.id);
  const removeIds = currentRankRoles.filter((role) => role.id !== chosenRole.id).map((role) => role.id);

  try {
    if (removeIds.length) await member.roles.remove(removeIds, "Atualização da hierarquia de membros Yukina");
    if (!alreadyHasChosen) await member.roles.add(chosenRole, "Cargo automático da hierarquia Yukina");
    const changed = record.rank !== chosen.key || !alreadyHasChosen;
    record.rank = chosen.key;
    saveStore();

    if (announce && changed) {
      const channel = member.guild.systemChannel;
      if (channel && channel.viewable && channel.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        const description = chosen.key === "novato"
          ? "Boas-vindas à comunidade! Que sua jornada comece sob o luar de Yukina."
          : "Sua jornada continua! Você alcançou o patamar **" + chosen.name + "** graças à sua participação e ao tempo na comunidade.";
        await channel.send({
          content: chosen.key === "novato" ? "❄️ " + member.toString() + " recebeu o cargo **" + chosen.name + "**. " + description
            : "🌙 Parabéns, " + member.toString() + "! " + description,
          allowedMentions: { users: [member.id] },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[Hierarquia] Não consegui atualizar os cargos de " + member.user.tag + ":", error.message);
  }
}

function startRankSystem(client) {
  loadStore();

  client.on("guildMemberAdd", async (member) => {
    if (member.user.bot) return;
    const record = getRecord(member.guild.id, member.id);
    record.joinedAt = member.joinedAt?.toISOString() || new Date().toISOString();
    saveStore();
    await updateMemberRank(member, true);
  });

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;
    const key = memberKey(message.guild.id, message.author.id);
    const now = Date.now();
    if (now - (lastXpAt.get(key) || 0) < XP_COOLDOWN_MS) return;
    lastXpAt.set(key, now);

    const record = getRecord(message.guild.id, message.author.id);
    if (!record.joinedAt) record.joinedAt = message.member.joinedAt?.toISOString() || new Date().toISOString();
    const before = rankFor(record, message.member.joinedAt || new Date(record.joinedAt));
    record.xp += XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
    saveStore();
    const after = rankFor(record, message.member.joinedAt || new Date(record.joinedAt));
    if (after.key !== before.key) await updateMemberRank(message.member, true);
  });

  client.once("clientReady", async () => {
    for (const guild of client.guilds.cache.values()) {
      await ensureRankRoles(guild);
      for (const member of guild.members.cache.values()) {
        if (!member.user.bot) await updateMemberRank(member, false);
      }
    }
    console.log("[Hierarquia] Progressão por XP e tempo ativada.");
  });

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        if (member.user.bot) continue;
        const record = getRecord(guild.id, member.id);
        const before = record.rank;
        await updateMemberRank(member, before !== null);
      }
    }
  }, TENURE_CHECK_MS).unref?.();
}

module.exports = startRankSystem;
