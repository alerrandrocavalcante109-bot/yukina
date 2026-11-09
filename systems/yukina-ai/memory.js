"use strict";

const MAX_MEMORIES = 20;
const MAX_THREAD_MESSAGES = 20;
const SENSITIVE = /senha|password|token|api.?key|cpf|rg|endereço|endereco|telefone|cartão|cartao|diagnóstico|doença|remédio|medicamento|religião|política|sexualidade|orientação sexual|trauma|depressão|ansiedade|dados bancários/i;
const SAFE_FACT_START = /\b(?:eu gosto de|gosto de|prefiro|meu hobby é|meus hobbies são|estou criando|estou desenvolvendo|meu projeto é|quero aprender|tenho interesse em)\b/i;

function collectionsFrom(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return {
    profiles: baseCollection.db.collection("yukina_ai_profiles"),
    threads: baseCollection.db.collection("yukina_ai_threads")
  };
}

async function ensureIndexes(baseCollection) {
  const { profiles, threads } = collectionsFrom(baseCollection);
  await Promise.all([
    profiles.createIndex({ userId: 1 }, { unique: true }),
    threads.createIndex({ userId: 1, channelId: 1 }, { unique: true })
  ]);
}

async function getMemories(baseCollection, userId) {
  const { profiles } = collectionsFrom(baseCollection);
  const doc = await profiles.findOne({ userId: String(userId) }, { projection: { memories: 1 } });
  return Array.isArray(doc?.memories) ? doc.memories.slice(-MAX_MEMORIES) : [];
}

async function captureSafeMemory(baseCollection, userId, rawText) {
  const text = String(rawText || "").replace(/<@!?\d+>/g, "").replace(/@everyone|@here/g, "").trim();
  if (!text || text.length > 260 || !SAFE_FACT_START.test(text) || SENSITIVE.test(text)) return;
  if (/https?:\/\/|\b\d{7,}\b|\x60{3}/.test(text)) return;

  const { profiles } = collectionsFrom(baseCollection);
  const normalized = text.toLocaleLowerCase("pt-BR");
  await profiles.updateOne(
    { userId: String(userId) },
    {
      $setOnInsert: { userId: String(userId), createdAt: new Date() },
      $pull: { memories: { normalized } }
    },
    { upsert: true }
  );
  await profiles.updateOne(
    { userId: String(userId) },
    { $push: { memories: { $each: [{ text, normalized, createdAt: new Date() }], $slice: -MAX_MEMORIES } }, $set: { updatedAt: new Date() } }
  );
}

async function forgetMemories(baseCollection, userId, requestText) {
  const { profiles, threads } = collectionsFrom(baseCollection);
  const text = String(requestText || "").toLocaleLowerCase("pt-BR");
  const forgetAll = /esqueça tudo|esqueca tudo|apague tudo sobre mim|apagar todas as minhas memórias|apagar todas as minhas memorias|não lembre de nada sobre mim|nao lembre de nada sobre mim/.test(text);
  if (forgetAll) {
    await profiles.deleteOne({ userId: String(userId) });
    await threads.deleteMany({ userId: String(userId) });
    return { all: true };
  }

  const words = text
    .replace(/esqueça|esqueca|apague|apagar|não lembre|nao lembre|disso|disto|sobre mim|por favor|que eu|que|de|do|da|o|a/gi, " ")
    .split(/\s+/).filter(word => word.length >= 4);
  if (words.length) {
    const doc = await profiles.findOne({ userId: String(userId) });
    const remaining = (doc?.memories || []).filter(memory => {
      const candidate = String(memory.normalized || memory.text || "").toLocaleLowerCase("pt-BR");
      return !words.some(word => candidate.includes(word));
    });
    await profiles.updateOne(
      { userId: String(userId) },
      { $set: { memories: remaining, updatedAt: new Date() } },
      { upsert: false }
    );
  }
  if (/conversa|histórico|historico|mensagens/.test(text)) {
    await threads.deleteMany({ userId: String(userId) });
  }
  return { all: false };
}

async function getThread(baseCollection, userId, channelId) {
  const { threads } = collectionsFrom(baseCollection);
  const doc = await threads.findOne({ userId: String(userId), channelId: String(channelId) });
  return Array.isArray(doc?.messages) ? doc.messages.slice(-MAX_THREAD_MESSAGES) : [];
}

async function appendThread(baseCollection, userId, channelId, messages) {
  const { threads } = collectionsFrom(baseCollection);
  await threads.updateOne(
    { userId: String(userId), channelId: String(channelId) },
    {
      $setOnInsert: { userId: String(userId), channelId: String(channelId), createdAt: new Date() },
      $push: { messages: { $each: messages, $slice: -MAX_THREAD_MESSAGES } },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

module.exports = {
  collectionsFrom,
  ensureIndexes,
  getMemories,
  captureSafeMemory,
  forgetMemories,
  getThread,
  appendThread
};
