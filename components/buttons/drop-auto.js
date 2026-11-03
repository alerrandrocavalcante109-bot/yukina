"use strict";

const { MongoClient, ObjectId } = require("mongodb");
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  ChannelType, PermissionFlagsBits
} = require("discord.js");

const URI = (process.env.MONGODB_URI || "").trim();
const DB = (process.env.MONGODB_DB || "Yukina").trim();
const OFFICIAL_INVITE = "https://discord.gg/NJR3YNd2G";
const NAMES = { starter: "Starter", plus: "Plus", premium: "Premium", ultra: "Ultra", infinity: "Infinity" };
const RULES = {
  starter: { interval: [18000000, 21600000], reward: [25000, 50000] },
  plus: { interval: [17100000, 19500000], reward: [60000, 120000] },
  premium: { interval: [12000000, 14400000], reward: [100000, 125000] },
  ultra: { interval: [10800000, 13200000], reward: [130000, 150000] },
  infinity: { interval: [3600000, 5700000], reward: [150000, 200000] }
};
let mongo, db, configs, runs, subs, balances, payouts, ledger, connecting;
const timers = new Map();
const locks = new Set();

async function initDb() {
  if (db) return db;
  if (!URI) throw new Error("MONGODB_URI não configurada.");
  if (!connecting) connecting = (async () => {
    mongo = mongo || new MongoClient(URI, { appName: "Yukina-Drop-Automatico", serverSelectionTimeoutMS: 10000 });
    await mongo.connect();
    db = mongo.db(DB);
    configs = db.collection("drop_auto_configs");
    runs = db.collection("drop_auto_runs");
    subs = db.collection("vip_subscriptions");
    balances = db.collection("economy_balances");
    payouts = db.collection("drop_auto_manual_payouts");
    ledger = db.collection("drop_auto_payout_ledger");
    await Promise.all([
      runs.createIndex({ status: 1, endsAt: 1 }),
      configs.createIndex({ status: 1, enabled: 1, nextRunAt: 1 }),
      payouts.createIndex({ guildId: 1, userId: 1, status: 1 }),
      payouts.createIndex({ runId: 1, userId: 1 }, { unique: true }),
      ledger.createIndex({ runId: 1, userId: 1 }, { unique: true, name: "unique_drop_payout" }),
      balances.createIndex({ guildId: 1, userId: 1 }, { unique: true, name: "unique_guild_user_balance" })
    ]);
    return db;
  })().catch(error => { connecting = null; mongo = null; db = null; throw error; });
  return connecting;
}

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fmt = n => Math.floor(n).toLocaleString("pt-BR") + " KZ";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function validPlan(userId, planKey) {
  await initDb();
  const sub = await subs.findOne({
    userId: String(userId), status: "active", expiresAt: { $gt: new Date() },
    guildId: { $exists: false }
  });
  return !!sub && String(sub.planKey).toLowerCase() === String(planKey).toLowerCase();
}

function embed(d, ended = false, winners = []) {
  const e = new EmbedBuilder().setColor(0xA7D8F0)
    .setTitle("🌸 Drop " + (NAMES[d.planKey] || "") + " Automático")
    .setDescription("Um novo Drop chegou! Participe e concorra a Kizunas.\n❄️ Boa sorte! Que a lua ilumine seu caminho.")
    .addFields(
      { name: "💴 Valor", value: fmt(d.reward), inline: true },
      { name: "🏆 Ganhadores", value: String(d.winnerCount), inline: true },
      { name: "⏳ Duração", value: "1 minuto", inline: true },
      { name: "🌙 Participantes", value: String(Object.keys(d.entries || {}).length), inline: true }
    ).setFooter({ text: ended ? "Yukina · Drop encerrado" : "Yukina · Sob o luar, entre estrelas" })
    .setTimestamp(new Date(d.createdAt));
  if (ended) e.addFields({ name: "🎉 Resultado", value: winners.length ? winners.map((id, i) => (i + 1) + ". <@" + id + ">").join("\n") : "Ninguém participou deste Drop." });
  else e.addFields({ name: "⌛ Encerra", value: "<t:" + Math.floor(d.endsAt / 1000) + ":R>" });
  return e;
}

function row(id, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dropauto:join:" + id).setLabel("Participar do Drop")
      .setEmoji("🎁").setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}

async function schedule(client, config, channelId, dueAt) {
  const key = String(config.userId) + ":" + String(channelId);
  const old = timers.get(key);
  if (old) clearTimeout(old);
  const target = Number(dueAt) || Date.now() + 1000;
  const delay = Math.max(1000, target - Date.now());
  const timer = setTimeout(() => {
    timers.delete(key);
    publish(client, config, channelId).catch(async error => {
      console.error("[Drop Automático] Falha ao publicar:", error);
      await schedule(client, config, channelId, Date.now() + 120000);
    });
  }, delay);
  timer.unref?.();
  timers.set(key, timer);
}

async function scheduleNext(client, config, channelId) {
  const rule = RULES[String(config.planKey).toLowerCase()];
  if (!rule) return;
  const nextRunAt = Date.now() + rnd(...rule.interval);
  await configs.updateOne(
    { _id: config._id, status: "active", enabled: true },
    { $set: { ["nextRunAtByChannel." + String(channelId)]: nextRunAt, updatedAt: new Date() }, $unset: { nextRunAt: "" } }
  );
  await schedule(client, config, channelId, nextRunAt);
}

async function publish(client, config, channelId) {
  await initDb();
  const key = String(config.userId) + ":" + String(channelId);
  if (locks.has(key)) return;
  locks.add(key);
  try {
    const current = await configs.findOne({ userId: String(config.userId), status: "active", enabled: true });
    if (!current || !current.channelIds?.includes(String(channelId))) return;
    if (!await validPlan(current.userId, current.planKey)) {
      await configs.updateOne({ _id: current._id }, { $set: { status: "paused", enabled: false, pausedAt: new Date(), pauseReason: "plan_expired" }, $unset: { nextRunAt: "" } });
      return;
    }
    const guild = await client.guilds.fetch(String(current.guildId)).catch(() => null);
    const channel = guild ? await guild.channels.fetch(String(channelId)).catch(() => null) : null;
    if (!channel?.isTextBased() || !channel.send) {
      await scheduleNext(client, current, channelId);
      return;
    }
    const now = Date.now();
    const rule = RULES[String(current.planKey).toLowerCase()];
    const doc = {
      userId: String(current.userId), planKey: String(current.planKey).toLowerCase(),
      guildId: guild.id, channelId: String(channelId), guildName: guild.name,
      reward: rnd(...rule.reward), winnerCount: rnd(1, 5), createdAt: now,
      endsAt: now + 60000, status: "active", entries: {}, winners: [], payouts: []
    };
    const inserted = await runs.insertOne(doc);
    doc._id = inserted.insertedId;
    try {
      const message = await channel.send({ embeds: [embed(doc)], components: [row(String(doc._id))], allowedMentions: { parse: [] } });
      await runs.updateOne({ _id: doc._id }, { $set: { messageId: message.id } });
      const timer = setTimeout(() => finish(client, String(doc._id)).catch(console.error), 60000);
      timer.unref?.();
      timers.set("run:" + doc._id, timer);
    } catch (error) {
      await runs.deleteOne({ _id: doc._id });
      throw error;
    }
    await configs.updateOne({ _id: current._id }, { $unset: { ["nextRunAtByChannel." + String(channelId)]: "", nextRunAt: "" } });
  } finally {
    locks.delete(key);
  }
}

async function creditWinner(guildId, userId, amount, runId) {
  const session = mongo.startSession();
  try {
    let alreadyPaid = false;
    await session.withTransaction(async () => {
      const existing = await ledger.findOne({ runId: String(runId), userId: String(userId) }, { session });
      if (existing) { alreadyPaid = true; return; }
      await ledger.insertOne({
        runId: String(runId), userId: String(userId), guildId: String(guildId),
        amount, createdAt: new Date()
      }, { session });
      await balances.updateOne(
        { guildId: String(guildId), userId: String(userId) },
        { $inc: { balance: amount }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, session }
      );
    });
    return alreadyPaid || true;
  } finally {
    await session.endSession();
  }
}

async function createManualPayout(client, run, userId, reason) {
  await payouts.updateOne(
    { runId: String(run._id), userId: String(userId) },
    { $setOnInsert: {
      runId: String(run._id), userId: String(userId), guildId: String(run.guildId),
      channelId: String(run.channelId), amount: Number(run.reward), status: "waiting_member",
      reason, createdAt: new Date()
    } },
    { upsert: true }
  );
  const invite = await client.fetchInvite(OFFICIAL_INVITE).catch(error => {
    console.error("[Drop Automático] Não foi possível resolver o convite oficial:", error.message || error);
    return null;
  });
  const officialGuildId = String(invite?.guild?.id || process.env.YUKINA_OFFICIAL_GUILD_ID || run.guildId);
  await payouts.updateOne(
    { runId: String(run._id), userId: String(userId) },
    { $set: { officialGuildId } }
  );
  const officialGuild = client.guilds.cache.get(officialGuildId) || await client.guilds.fetch(officialGuildId).catch(() => null);
  const alreadyMember = officialGuild ? await officialGuild.members.fetch(String(userId)).catch(() => null) : null;
  if (alreadyMember) await onMemberJoin(alreadyMember);
  const channel = await client.channels.fetch(String(run.channelId)).catch(() => null);
  if (channel) {
    await channel.send({
      content: "⚠️ Não foi possível entregar automaticamente o prêmio de <@" + userId + "> após 5 tentativas. A pessoa precisa entrar no servidor oficial da Yukina para receber as instruções: " + OFFICIAL_INVITE,
      allowedMentions: { users: [String(userId)] }
    }).catch(error => console.error("[Drop Automático] Não foi possível avisar sobre pagamento manual:", error));
  }
}

async function finish(client, runId) {
  await initDb();
  const id = new ObjectId(runId);
  let run = await runs.findOne({ _id: id, status: { $in: ["active", "paying"] } });
  if (!run) return;
  if (run.status === "active" && Date.now() < run.endsAt) {
    const timer = setTimeout(() => finish(client, runId).catch(console.error), run.endsAt - Date.now());
    timer.unref?.();
    timers.set("run:" + runId, timer);
    return;
  }

  if (run.status === "active") {
    const participantIds = Object.keys(run.entries || {});
    const winners = [];
    while (participantIds.length && winners.length < Math.min(5, Math.max(1, run.winnerCount))) {
      winners.push(participantIds.splice(rnd(0, participantIds.length - 1), 1)[0]);
    }
    const claimed = await runs.updateOne(
      { _id: id, status: "active" },
      { $set: { status: "paying", winners, winnerCount: winners.length, payoutStartedAt: new Date() } }
    );
    if (!claimed.modifiedCount) return;
    run = await runs.findOne({ _id: id });
  }

  const guild = await client.guilds.fetch(String(run.guildId)).catch(() => null);
  const channel = guild ? await guild.channels.fetch(String(run.channelId)).catch(() => null) : null;
  const message = channel && run.messageId ? await channel.messages.fetch(String(run.messageId)).catch(() => null) : null;
  if (message) await message.edit({ embeds: [embed(run, true, run.winners || [])], components: [row(runId, true)] }).catch(() => {});

  if (!(run.winners || []).length) {
    if (channel) await channel.send({ content: "🌙 O Drop foi encerrado por falta de participantes. Ninguém recebeu Kizunas desta vez.", allowedMentions: { parse: [] } }).catch(() => {});
  } else {
    const paid = [], forfeited = [];
    for (const userId of run.winners) {
      const existingManual = await payouts.findOne({
        runId: String(run._id), userId: String(userId), status: { $in: ["waiting_member", "staff_review"] }
      });
      if (existingManual) continue;
      const member = guild ? await guild.members.fetch(String(userId)).catch(() => null) : null;
      if (!member) {
        forfeited.push(String(userId));
        await runs.updateOne({ _id: id }, { $addToSet: { forfeited: String(userId) } });
        continue;
      }
      let success = false;
      let leftDuringAttempts = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const stillInServer = guild ? await guild.members.fetch(String(userId)).catch(() => null) : null;
        if (!stillInServer) {
          leftDuringAttempts = true;
          break;
        }
        try {
          await creditWinner(run.guildId, userId, run.reward, runId);
          success = true;
          break;
        } catch (error) {
          console.error("[Drop Automático] Tentativa " + attempt + "/5 falhou para " + userId + ":", error.message || error);
          if (attempt < 5) await wait(attempt * 2500);
        }
      }
      if (leftDuringAttempts) {
        forfeited.push(String(userId));
        await runs.updateOne({ _id: id }, { $addToSet: { forfeited: String(userId) } });
        continue;
      }
      if (success) {
        paid.push(String(userId));
        await runs.updateOne({ _id: id }, { $addToSet: { payouts: String(userId) } });
      } else {
        await createManualPayout(client, run, userId, "five_automatic_attempts_failed");
      }
    }
    if (channel && paid.length) {
      await channel.send({
        content: paid.map(userId => "🌸 Parabéns <@" + userId + ">! Você acaba de ganhar o Drop de **" + fmt(run.reward) + "**.").join("\n"),
        allowedMentions: { users: paid }
      }).catch(() => {});
    }
    if (channel && forfeited.length) {
      await channel.send({
        content: forfeited.map(userId => "🌙 <@" + userId + "> perdeu o prêmio do Drop por não estar mais no servidor no momento da entrega.").join("\n"),
        allowedMentions: { users: forfeited }
      }).catch(() => {});
    }
  }

  await runs.updateOne({ _id: id }, { $set: { status: "ended", endedAt: Date.now() } });
  const config = await configs.findOne({ userId: String(run.userId), status: "active", enabled: true });
  if (config && config.channelIds?.includes(String(run.channelId)) && await validPlan(config.userId, config.planKey)) {
    await scheduleNext(client, config, run.channelId);
  }
}

async function onMemberJoin(member) {
  await initDb();
  const pending = await payouts.find({
    officialGuildId: String(member.guild.id), userId: String(member.id), status: "waiting_member"
  }).toArray();
  for (const payout of pending) {
    const claim = await payouts.updateOne(
      { _id: payout._id, status: "waiting_member" },
      { $set: { status: "creating_channel", channelCreationStartedAt: new Date() } }
    );
    if (!claim.modifiedCount) continue;
    const botMember = member.guild.members.me || await member.guild.members.fetch(member.client.user.id).catch(() => null);
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await payouts.updateOne({ _id: payout._id, status: "creating_channel" }, { $set: { status: "waiting_member" } });
      console.error("[Drop Automático] Sem permissão para criar canal de entrega manual em " + member.guild.id);
      continue;
    }
    const staff = await member.guild.roles.fetch().catch(() => null);
    const overwrites = [
      { id: member.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: member.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
    ];
    for (const role of staff?.values?.() || []) {
      if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild) || role.permissions.has(PermissionFlagsBits.ManageChannels)) {
        overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
    }
    const privateChannel = await member.guild.channels.create({
      name: "entrega-drop-" + member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 12) + "-" + member.id.slice(-4),
      type: ChannelType.GuildText,
      topic: "Entrega manual do Drop " + payout.runId + " · Usuário " + member.id,
      permissionOverwrites: overwrites,
      reason: "Entrega manual de prêmio do Drop Automático"
    }).catch(error => {
      console.error("[Drop Automático] Não foi possível criar canal privado de entrega:", error);
      return null;
    });
    if (!privateChannel) {
      await payouts.updateOne({ _id: payout._id, status: "creating_channel" }, { $set: { status: "waiting_member" } });
      continue;
    }
    await payouts.updateOne({ _id: payout._id, status: "creating_channel" }, { $set: { status: "staff_review", privateChannelId: privateChannel.id, joinedAt: new Date() } });
    await privateChannel.send({
      content: "🌸 **Entrega manual de Drop Automático**\nMembro: <@" + member.id + ">\nPrêmio pendente: **" + fmt(payout.amount) + "**\nServidor: **" + member.guild.name + "**\nID do Drop: `" + payout.runId + "`\n\nA equipe deve conferir o registro e atribuir o valor manualmente. Após a entrega, marque este atendimento como concluído e feche o canal.",
      allowedMentions: { users: [member.id] }
    });
  }
}

async function initialize(client) {
  await initDb();
  client.on("guildMemberAdd", member => onMemberJoin(member).catch(error => console.error("[Drop Automático] Falha no fluxo de entrega manual:", error)));
  for (const run of await runs.find({ status: { $in: ["active", "paying"] } }).toArray()) {
    const delay = run.status === "active" ? Math.max(0, run.endsAt - Date.now()) : 1000;
    const timer = setTimeout(() => finish(client, String(run._id)).catch(console.error), delay);
    timer.unref?.();
    timers.set("run:" + run._id, timer);
  }
  for (const config of await configs.find({ status: "active", enabled: true }).toArray()) {
    if (!await validPlan(config.userId, config.planKey)) {
      await configs.updateOne({ _id: config._id }, { $set: { status: "paused", enabled: false, pausedAt: new Date(), pauseReason: "plan_expired" }, $unset: { nextRunAt: "" } });
      continue;
    }
    for (const channelId of config.channelIds || []) {
      const savedDueAt = Number(config.nextRunAtByChannel?.[String(channelId)]) || 0;
      const dueAt = savedDueAt || Date.now() + rnd(...RULES[String(config.planKey).toLowerCase()].interval);
      if (!savedDueAt) await configs.updateOne(
        { _id: config._id },
        { $set: { ["nextRunAtByChannel." + String(channelId)]: dueAt }, $unset: { nextRunAt: "" } }
      );
      await schedule(client, config, channelId, dueAt);
    }
  }
  console.log("[Drop Automático] Agendador iniciado; execuções e próximos horários restaurados.");
}

async function join(interaction, id) {
  await initDb();
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return interaction.reply({ content: "🌙 Este Drop não é válido.", flags: MessageFlags.Ephemeral });
  }
  const _id = new ObjectId(id);
  const run = await runs.findOne({ _id, status: "active" });
  if (!run || Date.now() >= run.endsAt) {
    if (run) await finish(interaction.client, id);
    return interaction.reply({ content: "🌙 Este Drop já foi encerrado ou o tempo acabou.", flags: MessageFlags.Ephemeral });
  }
  if (String(interaction.guildId) !== String(run.guildId) || String(interaction.channelId) !== String(run.channelId)) {
    return interaction.reply({ content: "❄️ Este botão não pertence a este canal.", flags: MessageFlags.Ephemeral });
  }
  const result = await runs.updateOne(
    { _id, status: "active", endsAt: { $gt: Date.now() }, ["entries." + interaction.user.id]: { $exists: false } },
    { $set: { ["entries." + interaction.user.id]: { joinedAt: Date.now() } } }
  );
  if (!result.modifiedCount) {
    return interaction.reply({ content: "🌸 Você já está participando deste Drop ou o tempo acabou.", flags: MessageFlags.Ephemeral });
  }
  return interaction.reply({ content: "🎁 Sua participação foi registrada. Boa sorte!", flags: MessageFlags.Ephemeral });
}

module.exports = {
  customId: /^dropauto:join:[a-f0-9]{24}$/i,
  async execute(interaction) { return join(interaction, interaction.customId.split(":")[2]); },
  async initialize(client) { return initialize(client); }
};
