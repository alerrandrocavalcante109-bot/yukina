"use strict";

const CREATOR_ID = "1533034328928555141";
const MOTHER_ID = "353909640381333504";

function relationshipFor(userId, interactions = 0) {
  const id = String(userId || "");
  if (id === String(process.env.YUKINA_AI_CREATOR_ID || CREATOR_ID)) {
    return { level: "criador", label: "Criador", interactions: Number(interactions) || 0 };
  }
  if (id === String(process.env.YUKINA_AI_MOTHER_ID || MOTHER_ID)) {
    return { level: "mae", label: "Mãe", interactions: Number(interactions) || 0 };
  }
  const count = Math.max(0, Number(interactions) || 0);
  if (count >= 150) return { level: "especial", label: "pessoa especial", interactions: count };
  if (count >= 60) return { level: "proximo", label: "amizade próxima", interactions: count };
  if (count >= 20) return { level: "amigo", label: "amigo", interactions: count };
  if (count >= 5) return { level: "conhecido", label: "conhecido", interactions: count };
  return { level: "novo", label: "alguém que está conhecendo", interactions: count };
}

async function ensureRelationshipIndexes(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  await baseCollection.db.collection("yukina_ai_relationships")
    .createIndex({ userId: 1 }, { unique: true });
}

async function registerInteraction(baseCollection, userId, message) {
  const id = String(userId || "");
  const text = String(message || "").trim();
  if (!id || text.length < 20) return relationshipFor(id, 0);

  const collection = baseCollection.db.collection("yukina_ai_relationships");
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  await collection.updateOne(
    { userId: id },
    { $setOnInsert: { userId: id, interactions: 0, createdAt: now } },
    { upsert: true }
  );

  // Conta no máximo uma interação significativa a cada 30 minutos para evitar
  // que mensagens repetidas ou spam acelerem artificialmente o vínculo.
  await collection.updateOne(
    { userId: id, $or: [{ lastInteractionAt: { $lt: cutoff } }, { lastInteractionAt: { $exists: false } }] },
    { $inc: { interactions: 1 }, $set: { lastInteractionAt: now, updatedAt: now } }
  );

  const profile = await collection.findOne({ userId: id }, { projection: { interactions: 1 } });
  return relationshipFor(id, profile?.interactions || 0);
}

async function getRelationship(baseCollection, userId) {
  const id = String(userId || "");
  if (!id) return relationshipFor(id, 0);
  const collection = baseCollection.db.collection("yukina_ai_relationships");
  const profile = await collection.findOne({ userId: id }, { projection: { interactions: 1 } });
  return relationshipFor(id, profile?.interactions || 0);
}

function buildRelationshipContext(relationship) {
  if (!relationship) return "";
  const { level, label } = relationship;
  if (level === "criador") return "VÍNCULO: esta pessoa é seu Criador e Guardião. Reconheça esse vínculo com carinho, sem obediência cega.";
  if (level === "mae") return "VÍNCULO: esta pessoa é sua mãe e guardiã do santuário. Converse com carinho e respeito.";
  return "VÍNCULO ATUAL: " + label + ". Deixe a proximidade aparecer naturalmente, sem declarar níveis ou contar interações. Não force intimidade e respeite os limites da pessoa.";
}

module.exports = { relationshipFor, ensureRelationshipIndexes, registerInteraction, getRelationship, buildRelationshipContext };
