"use strict";

const { parseCountingValue } = require("../../counting-number-parser");

const countingQueues = new Map();

async function handleCountingMessage(message, getSettingsCollection) {
  if (message.author.bot || !message.guild || !message.channel?.isTextBased()) return;
  const task = async () => {
    try {
      const collection = await getSettingsCollection();
      const doc = await collection.findOne(
        { guildId: message.guild.id },
        { projection: { "settings.countingSystem": 1 } }
      );
      const config = doc?.settings?.countingSystem;
      if (!config?.enabled || !config.channelId || config.channelId !== message.channel.id) return;

      const raw = String(message.content || "").trim();
      const numeric = parseCountingValue(raw);
      if (numeric === null) return;
      const expected = Math.max(0, Number(config.currentNumber) || 0) + 1;
      const repeatedUser = String(message.author.id) === String(config.lastUserId || "");

      if (repeatedUser || !Number.isSafeInteger(numeric) || numeric !== expected) {
        await message.react("❌").catch(() => {});
        await collection.updateOne(
          { guildId: message.guild.id },
          { $set: { "settings.countingSystem.currentNumber": 0, "settings.countingSystem.lastUserId": "" } }
        );
        await message.channel.send({
          content: repeatedUser
            ? "❌ Você não pode contar duas vezes seguidas! A sequência voltou ao início. O próximo número é **1**."
            : "❌ Contagem incorreta! A sequência voltou ao início. O próximo número é **1**.",
          allowedMentions: { parse: [] }
        }).catch(() => {});
        return;
      }

      await collection.updateOne(
        { guildId: message.guild.id },
        { $set: { "settings.countingSystem.currentNumber": numeric, "settings.countingSystem.lastUserId": message.author.id } }
      );
      await message.react("✅").catch(() => {});
    } catch (error) {
      console.error("[Contagem] Não foi possível processar a mensagem:", error.message || error);
    }
  };
  const previous = countingQueues.get(message.guild.id) || Promise.resolve();
  const next = previous.then(task, task);
  countingQueues.set(message.guild.id, next);
  try { await next; } finally { if (countingQueues.get(message.guild.id) === next) countingQueues.delete(message.guild.id); }
}

module.exports = { handleCountingMessage, countingQueues };
