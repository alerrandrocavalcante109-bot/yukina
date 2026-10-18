/**
 * Boas-vindas e despedidas — Yukina.
 * Persiste por servidor no MongoDB quando disponível e mantém fallback local.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "welcome-settings.json");
const URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const BLUE = 0xA7D8F0;
const configs = new Map();
let clientMongo = null;
let collection = null;
let initPromise = null;

function loadLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [guildId, config] of Object.entries(data)) configs.set(guildId, config);
  } catch (error) {
    console.error("[Boas-vindas] Falha ao ler fallback local:", error.message);
  }
}
function saveLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(Object.fromEntries(configs), null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (error) {
    console.error("[Boas-vindas] Falha ao salvar fallback local:", error.message);
  }
}
async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    loadLocal();
    if (!URI) {
      console.warn("[Boas-vindas] MONGODB_URI ausente; usando fallback local.");
      return;
    }
    try {
      clientMongo = new MongoClient(URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      });
      await clientMongo.connect();
      collection = clientMongo.db(DB_NAME).collection("welcome_settings");
      const docs = await collection.find({}).toArray();
      for (const doc of docs) {
        if (doc._id && doc.config && typeof doc.config === "object") configs.set(String(doc._id), doc.config);
      }
      // Migra configurações locais ausentes no MongoDB sem sobrescrever as já existentes.
      for (const [guildId, config] of configs) {
        await collection.updateOne({ _id: guildId }, { $setOnInsert: { config, updatedAt: new Date() } }, { upsert: true });
      }
      saveLocal();
      console.log("[Boas-vindas] Configurações persistidas no MongoDB.");
    } catch (error) {
      collection = null;
      if (clientMongo) await clientMongo.close().catch(() => {});
      clientMongo = null;
      console.error("[Boas-vindas] MongoDB indisponível; usando fallback local:", error.message);
    }
  })();
  return initPromise;
}
function getConfig(guildId) {
  return configs.get(String(guildId)) || { welcome: { enabled: false }, goodbye: { enabled: false } };
}
async function setConfig(guildId, config) {
  const id = String(guildId);
  configs.set(id, config);
  saveLocal();
  if (collection) {
    try {
      await collection.updateOne({ _id: id }, { $set: { config, updatedAt: new Date() } }, { upsert: true });
    } catch (error) {
      console.error("[Boas-vindas] Falha ao salvar no MongoDB:", error.message);
    }
  }
}
function fillTemplate(template, member) {
  const guild = member.guild;
  const values = {
    "{user}": member.user.username,
    "{username}": member.user.username,
    "{mention}": "<@" + member.id + ">",
    "{server}": guild.name,
    "{memberCount}": String(guild.memberCount),
  };
  let output = String(template || "");
  for (const [token, value] of Object.entries(values)) output = output.split(token).join(value);
  return output.slice(0, 4000);
}
function makeEmbed(config, member, event) {
  const isWelcome = event === "welcome";
  const title = fillTemplate(config.title || (isWelcome ? "❄️ Uma nova estrela chegou!" : "🌙 Uma estrela segue viagem"), member).slice(0, 256);
  const description = fillTemplate(config.message || (isWelcome
    ? "Seja bem-vindo(a) a **{server}**, {mention}! Esperamos que sua jornada seja especial."
    : "{user} deixou **{server}**. Desejamos tudo de bom em sua próxima jornada."), member);
  const colorText = String(config.color || "#A7D8F0");
  const color = /^#[0-9a-f]{6}$/i.test(colorText) ? Number.parseInt(colorText.slice(1), 16) : BLUE;
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "Yukina · Sob o luar, entre estrelas" })
    .setTimestamp();
  return embed;
}
async function sendEvent(member, event) {
  if (!member.guild || member.user.bot) return;
  await initialize();
  const key = event === "welcome" ? "welcome" : "goodbye";
  const config = getConfig(member.guild.id)[key];
  if (!config?.enabled || !config.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId) ||
    await member.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const me = member.guild.members.me;
  const permissions = channel.permissionsFor(me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    console.warn("[Boas-vindas] Sem permissões de envio/embed em #" + channel.name + " (" + member.guild.name + ").");
    return;
  }
  try {
    await channel.send({
      embeds: [makeEmbed(config, member, key)],
      allowedMentions: { parse: [], users: key === "welcome" ? [member.id] : [] },
    });
  } catch (error) {
    console.error("[Boas-vindas] Falha ao enviar mensagem:", error.message);
  }
}
function register(client) {
  client.on("guildMemberAdd", member => sendEvent(member, "welcome"));
  client.on("guildMemberRemove", member => sendEvent(member, "goodbye"));
  client.once("clientReady", () => initialize().catch(error => console.error("[Boas-vindas]", error.message)));
  console.log("[Boas-vindas] Eventos de entrada e saída registrados.");
}
module.exports = { register, initialize, getConfig, setConfig, fillTemplate, makeEmbed };
