"use strict";
const storage = require("../system-storage").forSystem("economy");
const COOLDOWN_MS = 30 * 60 * 1000;
const timers = new Map();
function timerKey(guildId, userId) { return String(guildId) + ":" + String(userId); }
async function notifyIfReady(client, guildId, userId, expectedLastWorkAt) {
  const record = await storage.get(guildId, "profile", {}, userId);
  const lastWorkAt = Number(record?.lastWorkAt) || 0;
  if (!record?.notificationEnabled || lastWorkAt !== expectedLastWorkAt) return;
  if ((Number(record.lastWorkNotifiedAt) || 0) >= lastWorkAt) return;
  await storage.set(guildId, "profile", { ...record, lastWorkNotifiedAt: lastWorkAt }, userId);
  try {
    const user = await client.users.fetch(String(userId));
    await user.send([
      "🌸 **Yukina · Seu próximo turno está disponível!**",
      "",
      "Os 30 minutos de descanso terminaram. Você já pode iniciar outra jornada e conquistar mais Kizunas.",
      "",
      "🏮 Use **/work** ou **Ywork** para trabalhar novamente.",
      "「 Que a lua ilumine seu caminho. 」",
    ].join("\n"));
  } catch (error) {
    console.warn("[Work Notifications] Não consegui enviar DM para " + userId + ":", error.message);
  }
}
function schedule(client, guildId, userId, lastWorkAt) {
  const key = timerKey(guildId, userId);
  const oldTimer = timers.get(key);
  if (oldTimer) clearTimeout(oldTimer);
  timers.delete(key);
  const readyAt = Number(lastWorkAt) + COOLDOWN_MS;
  const delay = Math.max(0, readyAt - Date.now());
  const timer = setTimeout(() => {
    timers.delete(key);
    notifyIfReady(client, guildId, userId, Number(lastWorkAt)).catch(error =>
      console.error("[Work Notifications] Falha ao enviar aviso:", error)
    );
  }, Math.min(delay, 2147483647));
  if (typeof timer.unref === "function") timer.unref();
  timers.set(key, timer);
}
function cancel(guildId, userId) {
  const key = timerKey(guildId, userId);
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}
async function initialize(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const entries = await storage.list(guild.id, { limit: 2000 });
      for (const entry of entries) {
        if (entry.key !== "profile" || !entry.userId || !entry.value?.notificationEnabled) continue;
        const lastWorkAt = Number(entry.value.lastWorkAt) || 0;
        if (lastWorkAt > 0) schedule(client, guild.id, entry.userId, lastWorkAt);
      }
    } catch (error) {
      console.error("[Work Notifications] Falha ao restaurar avisos de " + guild.id + ":", error.message || error);
    }
  }
}
module.exports = { schedule, cancel, initialize, COOLDOWN_MS };
