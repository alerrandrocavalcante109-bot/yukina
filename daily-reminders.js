const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME = (process.env.MONGODB_DB || "yukina").trim();
const DAILY_URL = (process.env.DAILY_PANEL_URL || "https://yukina-6uo.pages.dev/daily.html").trim();
const DAY_MS = 24 * 60 * 60 * 1000;

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

async function runDailyReminders(client) {
  if (running || !MONGODB_URI || !client.isReady()) return;
  running = true;
  try {
    if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI, { appName: "Yukina-Daily-Reminders", serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const claims = db.collection("daily_claims");
    const reminders = db.collection("daily_reminder_state");
    await reminders.createIndex({ guildId: 1, userId: 1 }, { unique: true });
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const guildId = (process.env.VIP_GUILD_ID || "").trim();
    if (!/^\d{17,20}$/.test(guildId)) {
      console.warn("[Daily Reminder] VIP_GUILD_ID não configurado; lembretes ignorados.");
      return;
    }
    const eligible = await claims.distinct("userId", { guildId });
    for (const userId of eligible) {
      const claimedToday = await claims.findOne({ guildId, userId: String(userId), day });
      if (claimedToday) continue;
      const state = await reminders.findOne({ guildId, userId: String(userId) });
      if (state?.lastReminderDay === day) continue;
      const sequenceIndex = Number(state?.sequenceIndex || 0) % SEQUENCE.length;
      const item = SEQUENCE[sequenceIndex];
      try {
        const user = await client.users.fetch(String(userId));
        await user.send({
          embeds: [{
            color: 0xe85cba,
            title: item.title,
            description: item.phrase,
            fields: [{ name: "❄️ Seu Daily", value: "[Abrir o painel e coletar]( " + DAILY_URL + " )" }],
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
  } catch (error) {
    console.error("[Daily Reminder] Falha no ciclo:", error?.message || error);
  } finally {
    running = false;
  }
}

module.exports = function startDailyReminders(client) {
  if (!MONGODB_URI) {
    console.warn("[Daily Reminder] MONGODB_URI ausente; lembretes diários desativados.");
    return;
  }
  runDailyReminders(client);
  const timer = setInterval(() => runDailyReminders(client), 15 * 60 * 1000);
  timer.unref();
};
