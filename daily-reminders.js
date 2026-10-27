const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();
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

const SEQUENCE = [
  { title: "❄️ Sua recompensa diária está esperando!", phrase: "Até a neve mais delicada volta a brilhar a cada novo amanhecer. Passe no Daily e resgate suas Kizunas de hoje." },
  { title: "🌙 Um novo dia, uma nova chance!", phrase: "Cada pequeno passo deixa sua jornada mais especial. A Yukina guardou uma nova recompensa diária para você." },
  { title: "✨ Sua próxima recompensa te chama!", phrase: "A sorte gosta de quem volta para tentar de novo. Venha buscar suas Kizunas e continue sua aventura." },
  { title: "🌸 Não deixe sua jornada esfriar!", phrase: "Mesmo nas noites mais frias, sempre existe uma nova luz. Seu Daily de hoje já pode ser coletado." },
  { title: "💜 Um carinho da Yukina para você", phrase: "Sua presença deixa nossa comunidade mais especial. Passe no painel e pegue a recompensa de hoje!" },
  { title: "⭐ Hora de visitar o Yukina Daily!", phrase: "Um novo dia traz novas possibilidades — e sua recompensa diária também. Te espero por lá!" },
  { title: "🩵 A neve trouxe uma nova recompensa", phrase: "Que seu dia seja leve como a neve e brilhante como as estrelas. Suas Kizunas diárias estão esperando." }
];

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
    const eligible = await claims.distinct("userId", { guildId });
    for (const userId of eligible) {
      const userKey = String(userId);
      const claimedToday = await claims.findOne({ guildId, userId: userKey, day });
      const state = await reminders.findOne({ guildId, userId: userKey });

      // A taxa começa depois de 3 dias completos sem Daily. Avise uma única vez
      // durante a janela entre 2 e 3 dias, usando o mesmo timestamp do último claim
      // como identificador do ciclo para que reinicializações não dupliquem a DM.
      const lastClaim = await claims.find({ guildId, userId: userKey })
        .sort({ claimedAt: -1, day: -1 }).limit(1).next();
      const lastClaimAt = lastClaim?.claimedAt ? new Date(lastClaim.claimedAt) : null;
      if (lastClaimAt && !Number.isNaN(lastClaimAt.getTime())) {
        const elapsedDays = (now.getTime() - lastClaimAt.getTime()) / (24 * 60 * 60 * 1000);
        const warningCycle = lastClaimAt.toISOString();
        const warningAlreadySent = state?.inactivityWarningForClaimAt === warningCycle;
        if (!claimedToday && elapsedDays >= 2 && elapsedDays < 3 && !warningAlreadySent) {
          try {
            const user = await client.users.fetch(userKey);
            await user.send({
              embeds: [{
                color: 0xA7D8F0,
                title: "❄️ Nee~ um aviso importante da Yukina",
                description: "Oii~! 💙 Faz quase 3 dias que você não coleta seu Daily. Se passar de **3 dias completos sem coletar**, o Banco Central começará a cobrar uma taxa de **3% ao dia** sobre suas Kizunas guardadas no banco.\n\nAinda dá tempo de evitar a taxa: venha coletar seu Daily antes do prazo!",
                fields: [{ name: "🌙 Seu Daily", value: "[Abrir o painel e coletar agora](" + DAILY_URL + ")" }],
                footer: { text: "Yukina • Aviso preventivo de inatividade" },
                timestamp: now.toISOString()
              }],
              allowedMentions: { parse: [] }
            });
            await reminders.updateOne(
              { guildId, userId: userKey },
              { $set: { inactivityWarningForClaimAt: warningCycle, inactivityWarningSentAt: now }, $setOnInsert: { createdAt: now } },
              { upsert: true }
            );
            console.log("[Daily Reminder] Aviso preventivo de taxa enviado para " + userKey + ".");
            await new Promise(resolve => setTimeout(resolve, 900));
          } catch (error) {
            if (error?.code === 50007) {
              console.log("[Daily Reminder] DM fechada para aviso de taxa: " + userKey + ".");
            } else {
              console.warn("[Daily Reminder] Falha no aviso preventivo para " + userKey + ":", error?.message || error);
            }
          }
        }
      }

      // O lembrete comum só é enviado a quem ainda não coletou hoje.
      if (claimedToday || state?.lastReminderDay === day) continue;
      const sequenceIndex = Number(state?.sequenceIndex || 0) % SEQUENCE.length;
      const item = SEQUENCE[sequenceIndex];
      try {
        const user = await client.users.fetch(String(userId));
        await user.send({
          embeds: [{
            color: 0xe85cba,
            title: item.title,
            description: item.phrase,
            fields: [{ name: "❄️ Seu Daily", value: "[Abrir o painel e coletar](" + DAILY_URL + ")" }],
            footer: { text: "Yukina • Lembrete diário de Kizunas" },
            timestamp: now.toISOString()
          }],
          allowedMentions: { parse: [] }
        });
        await reminders.updateOne(
          { guildId, userId: String(userId) },
          { $set: { lastReminderDay: day, sequenceIndex: (sequenceIndex + 1) % SEQUENCE.length, lastSentAt: now }, $setOnInsert: { createdAt: now } },
          { upsert: true }
        );
        await new Promise(resolve => setTimeout(resolve, 900));
      } catch (error) {
        if (error?.code === 50007) {
          console.log("[Daily Reminder] DM fechada para usuário " + userId + "; pulando.");
        } else {
          console.warn("[Daily Reminder] Falha ao enviar DM para " + userId + ":", error?.message || error);
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
