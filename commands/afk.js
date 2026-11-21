"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { SlashCommandBuilder } = require("discord.js");
const storage = require("../system-storage").forSystem("afk-status");
const languageSystem = require("../systems/idioma");
const afkLocale = require("../systems/idioma/locales/afk");
function tr(language, key, variables) { return afkLocale.getMessage(language, key, variables); }
const DATA_FILE = path.join(process.cwd(), "data", "afk-status.json");
const active = new Map();
const hooked = new WeakSet();
let localData;

function loadLocal() {
  if (localData) return localData;
  try { localData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { localData = {}; }
  if (!localData || typeof localData !== "object" || Array.isArray(localData)) localData = {};
  return localData;
}
function saveLocal() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(localData || {}, null, 2));
    fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (error) { console.error("[AFK] Falha no fallback local:", error.message); }
}
function keyFor(guildId, userId) { return String(guildId) + ":" + String(userId); }
async function persist(guildId, userId, record) {
  const key = keyFor(guildId, userId);
  localData = loadLocal();
  if (record) localData[key] = record; else delete localData[key];
  saveLocal();
  try {
    if (record) await storage.set(guildId, "member", record, userId);
    else await storage.delete(guildId, "member", userId);
  } catch (error) { console.warn("[AFK] MongoDB indisponível; usando fallback local:", error.message); }
}
async function getStatus(guildId, userId) {
  const key = keyFor(guildId, userId);
  if (active.has(key)) return active.get(key);
  try {
    const record = await storage.get(guildId, "member", null, userId);
    if (record) { active.set(key, record); return record; }
  } catch {}
  const local = loadLocal()[key];
  if (local) { active.set(key, local); return local; }
  return null;
}
function statusText(user, record, language) {
  return [
    tr(language, "activeTitle"),
    tr(language, "userLabel") + " " + user.toString(),
    record.reason ? tr(language, "reasonLabel") + "\n### " + record.reason : "",
    tr(language, "instruction")
  ].filter(Boolean).join("\n");
}
function installHooks(client) {
  if (hooked.has(client)) return;
  hooked.add(client);
  client.on("messageCreate", async message => {
    if (!message.guild || message.author.bot) return;
    const own = await getStatus(message.guild.id, message.author.id);
    if (own) {
      active.delete(keyFor(message.guild.id, message.author.id));
      await persist(message.guild.id, message.author.id, null);
      const ownLanguage = await languageSystem.getUserLanguage(message.author.id);
      await message.reply({
        content: tr(ownLanguage, "welcomeTitle") + "\n" + tr(ownLanguage, "welcomeBody"),
        allowedMentions: { repliedUser: false }
      }).catch(() => {});
      for (const notice of (own.mentions || [])) {
        const channel = await message.guild.channels.fetch(notice.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const noticeLanguage = await languageSystem.getUserLanguage(notice.userId);
          await channel.send({
            content: tr(noticeLanguage, "returnedNotice", { mention: "<@" + notice.userId + ">", user: message.author.toString() }),
            allowedMentions: { users: [notice.userId] }
          }).catch(() => {});
        }
      }
    }
    const mentions = [...message.mentions.users.values()].filter(user => !user.bot && user.id !== message.author.id).slice(0, 3);
    for (const user of mentions) {
      const record = await getStatus(message.guild.id, user.id);
      if (!record) continue;
      const elapsed = Math.max(0, Date.now() - (record.startedAt || Date.now()));
      const hours = Math.floor(elapsed / 3600000);
      const days = Math.floor(elapsed / 86400000);
      const language = await languageSystem.getUserLanguage(user.id);
      const reason = record.reason ? "\n" + tr(language, "reasonLabel") + "\n### " + record.reason : "";
      await message.reply({
        content: tr(language, "awayNotice", {
          author: message.author.toString(), user: user.toString(), reason, hours, days
        }),
        allowedMentions: { repliedUser: false, parse: [] }
      }).catch(() => null);
      record.mentions = Array.isArray(record.mentions) ? record.mentions : [];
      if (!record.mentions.some(item => item.userId === message.author.id && item.channelId === message.channel.id)) {
        record.mentions.push({ userId: message.author.id, channelId: message.channel.id });
        await persist(message.guild.id, user.id, record);
      }
    }
  });
}
async function run(guild, user, reasonRaw, reply, client) {
  installHooks(client);
  const key = keyFor(guild.id, user.id);
  const existing = await getStatus(guild.id, user.id);
  const language = await languageSystem.getUserLanguage(user.id);
  if (existing) {
    active.delete(key);
    await persist(guild.id, user.id, null);
    return reply(tr(language, "welcomeTitle") + "\n" + tr(language, "welcomeManual"));
  }
  const record = {
    userId: user.id,
    username: user.username,
    reason: String(reasonRaw || "").trim().slice(0, 350),
    startedAt: Date.now(),
    mentions: []
  };
  active.set(key, record);
  await persist(guild.id, user.id, record);
  return reply(statusText(user, record, language));
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName("ativar")
    .setDescription("Ative ou gerencie sua ausência.")
    .setDMPermission(false)
    .addSubcommand(sub => sub.setName("afk").setDescription("Ative o estado de ausência.")
      .addStringOption(option => option.setName("motivo").setDescription("Motivo da ausência (opcional).").setRequired(false).setMaxLength(350))),
  name: "afk",
  aliases: ["ausente", "ausentar"],
  async execute(interaction) {
    if (!interaction.guild) {
      const language = await languageSystem.getUserLanguage(interaction.user.id);
      return interaction.reply({ content: tr(language, "serverOnly"), ephemeral: true });
    }
    if (interaction.options.getSubcommand() !== "afk") return;
    await run(interaction.guild, interaction.user, interaction.options.getString("motivo"),
      text => interaction.reply({ content: text }), interaction.client);
  },
  async prefixExecute(message, args = [], client) {
    if (!message.guild) {
      const language = await languageSystem.getUserLanguage(message.author.id);
      return message.reply(tr(language, "serverOnly"));
    }
    const reason = args.join(" ").replace(/^motivo\s*:?\s*/i, "");
    await run(message.guild, message.author, reason, text => message.reply({ content: text, allowedMentions: { repliedUser: false } }), client || message.client);
  }
};
