const { MongoClient } = require("mongodb");
const { MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();
const DAILY_IMAGE_URL = "https://cdn.discordapp.com/attachments/1561408732318138509/1569489628262834186/file_000000006dfc820ea46fa09063fe4d0a.png?ex=6af3a49f&is=6af2531f&hm=66459d95ef6834b7a25a65d3504b53429c5f99af7e9f22ad45be8de3b75fc312";
const TIME_ZONE = "America/Sao_Paulo";

function getLocalDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
}

function localDayKey(parts) {
  return String(parts.year).padStart(4, "0") + "-" + String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0");
}

function previousDayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return localDayKey({ year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1, day: previous.getUTCDate() });
}

async function getDailyStreak(claims, guildId, userId, todayKey) {
  const records = await claims.find({ userId }).sort({ day: -1 }).limit(370).toArray();
  const claimedDays = new Set(records.map(record => String(record.day)));
  let expected = previousDayKey(todayKey);
  let streak = 0;
  while (claimedDays.has(expected)) {
    streak++;
    expected = previousDayKey(expected);
  }
  return streak;
}

function saoPauloMidnightUtc(year, month, day) {
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getLocalDateTime(new Date(guess));
    const representedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = targetUtc - representedUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

let lastCycleDay = null;

let mongoClient;
let running = false;

async function runDailyReminders(client, scheduled = false) {
  if (running || !MONGODB_URI || !client.isReady()) return;
  const localNow = getLocalDateTime();
  const day = localDayKey(localNow);
  if ((!scheduled && (localNow.hour !== 0 || localNow.minute !== 0)) || lastCycleDay === day) return;
  running = true;
  let cycleCompleted = false;
  try {
    if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Daily-Reminders", serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const claims = db.collection("daily_claims");
    const reminders = db.collection("daily_reminder_state");
    await reminders.createIndex({ guildId: 1, userId: 1 }, { unique: true });
    const now = new Date();
    const day = localDayKey(getLocalDateTime(now));
    const guildId = (process.env.VIP_GUILD_ID || "").trim();
    if (!/^\d{17,20}$/.test(guildId)) {
      console.warn("[Daily Reminder] VIP_GUILD_ID não configurado; lembretes ignorados.");
      return;
    }
    const eligible = await claims.distinct("userId", {});
    for (const userId of eligible) {
      const userKey = String(userId);
      const claimedToday = await claims.findOne({ userId: userKey, day });
      const state = await reminders.findOne({ guildId, userId: userKey });

      // O aviso do Banco Central continua enquanto houver Kizunas na conta bancária.
      // Ele é independente dos lembretes comuns, que param após mais de 4 dias sem Daily.
      const lastClaim = await claims.find({ userId: userKey })
        .sort({ claimedAt: -1, day: -1 }).limit(1).next();
      const lastClaimAt = lastClaim?.claimedAt ? new Date(lastClaim.claimedAt) : null;
      if (lastClaimAt && !Number.isNaN(lastClaimAt.getTime())) {
        const elapsedDays = (now.getTime() - lastClaimAt.getTime()) / (24 * 60 * 60 * 1000);
        const bankAccount = await db.collection("yukina_bank_accounts").findOne({ guildId, userId: userKey });
        const bankBalance = Math.max(0, Number(bankAccount?.balance) || 0);
        const warningDay = localDayKey(getLocalDateTime(now));
        if (!claimedToday && elapsedDays >= 2 && bankBalance > 0 && state?.lastBankWarningDay !== warningDay) {
          try {
            const user = await client.users.fetch(userKey);
            await user.send({
              embeds: [{
                color: 0xA7D8F0,
                title: "❄️ Nee~ um aviso importante da Yukina",
                description: elapsedDays < 3
                  ? "Oii~! 💙 Faz quase 3 dias que você não coleta seu Daily. Se passar de **3 dias completos sem coletar**, o Banco Central começará a cobrar uma taxa de **3% ao dia** sobre suas Kizunas guardadas no banco.\n\nAinda dá tempo de evitar a taxa: venha coletar seu Daily antes do prazo!"
                  : "Oii~! 💙 Você continua sem coletar seu Daily e a taxa de inatividade do Banco Central já pode estar sendo aplicada. Enquanto houver Kizunas guardadas no banco, continuarei avisando você. Volte ao Daily para interromper esse ciclo! 🌸",
                fields: [{ name: "🌙 Seu Daily", value: "[Abrir o painel e coletar agora](" + DAILY_URL + ")" }],
                footer: { text: "Yukina • Aviso do Banco Central" },
                timestamp: now.toISOString()
              }],
              allowedMentions: { parse: [] }
            });
            await reminders.updateOne(
              { guildId, userId: userKey },
              { $set: { lastBankWarningDay: warningDay, lastBankWarningAt: now }, $setOnInsert: { createdAt: now } },
              { upsert: true }
            );
            console.log("[Daily Reminder] Aviso do Banco Central enviado para " + userKey + ".");
            await new Promise(resolve => setTimeout(resolve, 900));
          } catch (error) {
            if (error?.code === 50007) {
              console.log("[Daily Reminder] DM fechada para aviso do Banco Central: " + userKey + ".");
            } else {
              console.warn("[Daily Reminder] Falha no aviso do Banco Central para " + userKey + ":", error?.message || error);
            }
          }
        }
      }

      // O lembrete comum é único e para após mais de 4 dias completos sem coleta.
      if (claimedToday || state?.lastReminderDay === day) continue;
      if (lastClaim?.claimedAt) {
        const elapsedDays = (now.getTime() - new Date(lastClaim.claimedAt).getTime()) / (24 * 60 * 60 * 1000);
        if (elapsedDays > 4) continue;
      }
      const streak = await getDailyStreak(claims, guildId, userKey, day);
      try {
        const user = await client.users.fetch(userKey);
        const message = new ContainerBuilder()
          .setAccentColor(0xe85cba)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "## ❄️ Seu Daily está esperando!\n" +
                  "Oii~! 💙 Um novo dia chegou e sua recompensa diária já está disponível!\n\n" +
                  "Continue sua jornada, acumule Kizunas e não deixe sua sequência acabar. Estou esperando por você! 🌸"
                )
              )
              .setButtonAccessory(
                new ButtonBuilder()
                  .setLabel(streak + " dias")
                  .setEmoji("🔥")
                  .setStyle(ButtonStyle.Link)
                  .setURL(DAILY_URL)
              )
          )
          .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder()
                .setURL(DAILY_IMAGE_URL)
                .setDescription("Yukina convidando você para coletar suas Kizunas diárias")
            )
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("-# Yukina • Lembrete diário de Kizunas")
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("Coletar Kizunas")
                .setEmoji("🌸")
                .setStyle(ButtonStyle.Link)
                .setURL(DAILY_URL)
            )
          );
        await user.send({
          components: [message],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] }
        });
        await reminders.updateOne(
          { guildId, userId: userKey },
          { $set: { lastReminderDay: day, lastSentAt: now }, $setOnInsert: { createdAt: now } },
          { upsert: true }
        );
        await new Promise(resolve => setTimeout(resolve, 900));
      } catch (error) {
        if (error?.code === 50007) {
          console.log("[Daily Reminder] DM fechada para usuário " + userKey + "; pulando.");
        } else {
          console.warn("[Daily Reminder] Falha ao enviar DM para " + userKey + ":", error?.message || error);
        }
      }
    }
    cycleCompleted = true;
  } catch (error) {
    console.error("[Daily Reminder] Falha no ciclo:", error?.message || error);
  } finally {
    if (cycleCompleted) lastCycleDay = day;
    running = false;
  }
}

function scheduleNextMidnight(client) {
  const now = new Date();
  const local = getLocalDateTime(now);
  const nextCalendarDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const nextMidnight = saoPauloMidnightUtc(nextCalendarDay.getUTCFullYear(), nextCalendarDay.getUTCMonth() + 1, nextCalendarDay.getUTCDate());
  const delay = Math.max(1000, nextMidnight.getTime() - Date.now());
  const timer = setTimeout(async () => {
    await runDailyReminders(client, true);
    scheduleNextMidnight(client);
  }, delay);
  timer.unref();
}

module.exports = function startDailyReminders(client) {
  if (!MONGODB_URI) {
    console.warn("[Daily Reminder] MONGODB_URI ausente; lembretes diários desativados.");
    return;
  }
  console.log("[Daily Reminder] Agendado diariamente para 00:00 (America/Sao_Paulo).");
  runDailyReminders(client);
  scheduleNextMidnight(client);
};
