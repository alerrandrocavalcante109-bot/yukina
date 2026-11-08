"use strict";

const TIME_ZONE = "America/Sao_Paulo";

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function collectionsFrom(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db.collection("yukina_ai_diary");
}

async function ensureIndexes(baseCollection) {
  const collection = collectionsFrom(baseCollection);
  await collection.createIndex({ scope: 1, ownerId: 1, day: 1 }, { unique: true });
  await collection.createIndex({ scope: 1, ownerId: 1, createdAt: -1 });
}

async function recordConversation(baseCollection, { guildId, userId, displayName = "" } = {}) {
  if (!guildId || !userId) return;
  const collection = collectionsFrom(baseCollection);
  const now = new Date();
  const day = dayKey(now);
  const safeName = String(displayName || "um membro").replace(/[\r\n<>]/g, "").slice(0, 60) || "um membro";

  // O diário pessoal registra apenas marcos agregados. Não copia mensagens,
  // conteúdo privado, prompts, respostas ou informações sensíveis.
  await collection.updateOne(
    { scope: "personal", ownerId: "yukina", day },
    {
      $setOnInsert: {
        scope: "personal",
        ownerId: "yukina",
        day,
        title: "Um dia de encontros",
        entry: "Hoje conversei com pessoas da comunidade. Cada encontro é uma oportunidade de conhecer novas histórias e aprender a conversar melhor, sempre respeitando a privacidade de cada pessoa.",
        createdAt: now
      },
      $inc: { conversations: 1 },
      $set: { updatedAt: now }
    },
    { upsert: true }
  );

  // O diário do servidor fica isolado pelo ID da guild e não é publicado em canal.
  await collection.updateOne(
    { scope: "server", ownerId: String(guildId), day },
    {
      $setOnInsert: {
        scope: "server",
        ownerId: String(guildId),
        day,
        title: "Registro diário da comunidade",
        entry: "A Yukina participou de conversas na comunidade. Este registro guarda somente a ocorrência e a contagem de interações, não o conteúdo das mensagens.",
        createdAt: now
      },
      $inc: { conversations: 1 },
      $addToSet: { participants: String(userId) },
      $set: { updatedAt: now, lastDisplayName: safeName }
    },
    { upsert: true }
  );
}

module.exports = { dayKey, ensureIndexes, recordConversation };
