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

      const lastClaim = await claims.find({ userId: userKey })
        .sort({ claimedAt: -1, day: -1 }).limit(1).next();

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
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## 🌸 Resgate Diário Disponível! ・🔥 Sequência: " + streak + " dias\\n\\n" +
              "Seu presente diário de Kizunas está esperando por você! Faça seu resgate e descubra quantas Kizunas a Yukina preparou especialmente para hoje. 💜\\n\\n" +
              "🔗 [Clique aqui para realizar seu resgate diário!](<" + DAILY_URL + ">)"
            )
          )
          .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder()
                .setURL(DAILY_IMAGE_URL)
                .setDescription("Imagem do resgate diário da Yukina")
            )
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Não deixe sua sequência acabar!** Continue realizando suas coletas diariamente e mantenha sua sequência de conquistas. ✨\\n\\n" +
              "-# Yukina • Lembrete diário de Kizunas"
            )
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("Resgatar recompensa")
                .setEmoji("🎁")
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
