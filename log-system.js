const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder, AuditLogEvent } = require("discord.js");

const DIR = path.join(__dirname, "data");
const FILE = path.join(DIR, "log-config.json");
const BLUE = 0xA7D8F0;
const configs = new Map();

function load() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const [id, value] of Object.entries(data)) configs.set(id, value);
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) console.error("[Yukina Logs]", error.message);
  }
}
function save() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(configs), null, 2));
  } catch (error) {
    console.error("[Yukina Logs] Falha ao salvar:", error.message);
  }
}
load();

function getConfig(id) { return configs.get(id) || null; }
function setConfig(id, value) { configs.set(id, value); save(); }
function short(value, limit) {
  const text = String(value || "").trim();
  return (text || "(vazio)").slice(0, limit || 900);
}
function userLabel(user) {
  return user ? (user.tag || user.username || "Usuário") + " (<@" + user.id + ">) · ID: " + user.id : "Desconhecido";
}
function embed(title, description, color) {
  return new EmbedBuilder().setColor(color || BLUE).setTitle(title).setDescription(String(description || "Sem detalhes").slice(0, 4000)).setFooter({ text: "Yukina · Registro do servidor" }).setTimestamp();
}
async function send(guild, title, description, color) {
  const config = getConfig(guild.id);
  if (!config || !config.enabled || !config.channelId) return;
  const channel = guild.channels.cache.get(config.channelId) || await guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || typeof channel.send !== "function") return;
  await channel.send({ embeds: [embed(title, description, color)], allowedMentions: { parse: [] } }).catch(error => console.warn("[Yukina Logs] Envio falhou:", error.message));
}
async function audit(guild, action, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: action, limit: 6 });
    return logs.entries.find(entry => entry.target && entry.target.id === targetId && Date.now() - entry.createdTimestamp < 15000) || null;
  } catch { return null; }
}

module.exports = function startLogSystem(client) {
  client.on("messageDelete", async message => {
    if (!message.guild || message.author && message.author.bot) return;
    await send(message.guild, "🗑️ Mensagem apagada", "**Autor:** " + userLabel(message.author) + "\n**Canal:** " + message.channel + "\n**Conteúdo:**\n" + short(message.content, 2200));
  });

  client.on("messageDeleteBulk", async messages => {
    const first = messages.first();
    if (!first || !first.guild) return;
    await send(first.guild, "🧹 Mensagens apagadas em lote", "**Canal:** " + first.channel + "\n**Quantidade:** " + messages.size + "\nO Discord pode não disponibilizar o conteúdo de todas as mensagens.");
  });

  client.on("messageUpdate", async (before, after) => {
    if (!after.guild || after.author && after.author.bot || before.content === after.content) return;
    await send(after.guild, "✏️ Mensagem editada", "**Autor:** " + userLabel(after.author) + "\n**Canal:** " + after.channel + "\n**Antes:**\n" + short(before.content, 1000) + "\n\n**Depois:**\n" + short(after.content, 1000));
  });

  client.on("guildMemberUpdate", async (before, after) => {
    if (before.nickname !== after.nickname) {
      await send(after.guild, "🏷️ Nickname alterado", "**Membro:** " + userLabel(after.user) + "\n**Antes:** " + short(before.nickname) + "\n**Depois:** " + short(after.nickname));
    }
    const beforeAvatar = before.user.displayAvatarURL({ extension: "png", size: 128 });
    const afterAvatar = after.user.displayAvatarURL({ extension: "png", size: 128 });
    if (beforeAvatar !== afterAvatar) {
      await send(after.guild, "🖼️ Avatar atualizado", "**Membro:** " + userLabel(after.user) + "\n**Novo avatar:** " + afterAvatar);
    }
    const oldRoles = new Set(before.roles.cache.keys());
    const newRoles = new Set(after.roles.cache.keys());
    const added = Array.from(newRoles).filter(id => !oldRoles.has(id)).map(id => after.guild.roles.cache.get(id)?.name || id);
    const removed = Array.from(oldRoles).filter(id => !newRoles.has(id)).map(id => after.guild.roles.cache.get(id)?.name || id);
    if (added.length || removed.length) {
      const entry = await audit(after.guild, AuditLogEvent.MemberRoleUpdate, after.id);
      await send(after.guild, "🛡️ Cargos alterados", "**Membro:** " + userLabel(after.user) + "\n**Adicionados:** " + (added.join(", ") || "Nenhum") + "\n**Removidos:** " + (removed.join(", ") || "Nenhum") + "\n**Responsável:** " + (entry?.executor ? userLabel(entry.executor) : "Não identificado"));
    }
    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp) {
      const entry = await audit(after.guild, AuditLogEvent.MemberUpdate, after.id);
      await send(after.guild, after.communicationDisabledUntilTimestamp ? "🔇 Timeout aplicado" : "🔊 Timeout removido", "**Membro:** " + userLabel(after.user) + "\n**Até:** " + (after.communicationDisabledUntil ? after.communicationDisabledUntil.toISOString() : "Sem timeout") + "\n**Responsável:** " + (entry?.executor ? userLabel(entry.executor) : "Não identificado") + "\n**Motivo:** " + (entry?.reason || "Não informado"), after.communicationDisabledUntilTimestamp ? 0xEFA6B8 : BLUE);
    }
  });

  client.on("userUpdate", async (before, after) => {
    const nameChanged = before.username !== after.username || before.globalName !== after.globalName;
    const avatarChanged = before.avatar !== after.avatar;
    if (!nameChanged && !avatarChanged) return;
    for (const guild of client.guilds.cache.values()) {
      if (!guild.members.cache.has(after.id)) continue;
      if (nameChanged) {
        const oldName = (before.globalName || before.username) + " (@" + before.username + ")";
        const newName = (after.globalName || after.username) + " (@" + after.username + ")";
        await send(guild, "👤 Perfil / nome global alterado", "**Usuário:** " + userLabel(after) + "\n**Antes:** " + short(oldName) + "\n**Depois:** " + short(newName));
      }
      if (avatarChanged) await send(guild, "🖼️ Avatar do perfil alterado", "**Usuário:** " + userLabel(after) + "\n**Novo avatar:** " + after.displayAvatarURL({ extension: "png", size: 128 }));
    }
  });

  client.on("guildBanAdd", async ban => {
    const entry = await audit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await send(ban.guild, "🔨 Banimento aplicado", "**Membro:** " + userLabel(ban.user) + "\n**Responsável:** " + (entry?.executor ? userLabel(entry.executor) : "Não identificado") + "\n**Motivo:** " + (entry?.reason || "Não informado"), 0xEFA6B8);
  });
  client.on("guildBanRemove", async ban => {
    const entry = await audit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await send(ban.guild, "🔓 Banimento removido", "**Membro:** " + userLabel(ban.user) + "\n**Responsável:** " + (entry?.executor ? userLabel(entry.executor) : "Não identificado") + "\n**Motivo:** " + (entry?.reason || "Não informado"));
  });
  client.on("guildAuditLogEntryCreate", async (entry, guild) => {
    if (entry.action === AuditLogEvent.MemberKick) {
      await send(guild, "👢 Membro expulso", "**Alvo:** " + userLabel(entry.target) + "\n**Responsável:** " + userLabel(entry.executor) + "\n**Motivo:** " + (entry.reason || "Não informado"), 0xEFA6B8);
    }
  });
};

module.exports.getConfig = getConfig;
module.exports.setConfig = setConfig;
