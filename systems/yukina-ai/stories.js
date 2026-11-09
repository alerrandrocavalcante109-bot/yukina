"use strict";

const COLLECTION_NAME = "yukina_ai_stories";
const VOTES_COLLECTION = "yukina_ai_story_votes";
const ALLOWED_SOURCES = new Set(["creator_authored", "confirmed_lore", "confirmed_event"]);

function getDatabase(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db;
}

async function ensureIndexes(baseCollection) {
  const db = getDatabase(baseCollection);
  await db.collection(COLLECTION_NAME).createIndex({ storyId: 1 }, { unique: true });
  await db.collection(COLLECTION_NAME).createIndex({ status: 1, createdAt: -1 });
  await db.collection(VOTES_COLLECTION).createIndex({ storyId: 1, userId: 1 }, { unique: true });
  await db.collection(VOTES_COLLECTION).createIndex({ storyId: 1, choiceId: 1 });
}

function normalizeChoices(choices = []) {
  if (!Array.isArray(choices) || choices.length < 2 || choices.length > 5) {
    throw new Error("Uma história interativa precisa ter de 2 a 5 escolhas.");
  }
  const ids = new Set();
  return choices.map((choice, index) => {
    const id = String(choice?.id || "choice-" + (index + 1)).trim().slice(0, 40);
    const label = String(choice?.label || "").trim().slice(0, 120);
    const consequence = String(choice?.consequence || "").trim().slice(0, 1000);
    if (!id || !label || ids.has(id)) throw new Error("Cada escolha precisa de ID único e texto.");
    ids.add(id);
    return { id, label, ...(consequence ? { consequence } : {}) };
  });
}

async function createStory(baseCollection, {
  storyId, title, summary, content, choices = [], source = "creator_authored",
  createdBy, guildId = null
} = {}) {
  const id = String(storyId || "").trim();
  const safeTitle = String(title || "").trim().slice(0, 160);
  const safeSummary = String(summary || "").trim().slice(0, 500);
  const safeContent = String(content || "").trim().slice(0, 12000);
  if (!id || !safeTitle || !safeContent) throw new Error("A história precisa de ID, título e conteúdo.");
  if (!ALLOWED_SOURCES.has(source)) throw new Error("A origem da história não é permitida.");
  const normalizedChoices = choices.length ? normalizeChoices(choices) : [];
  const now = new Date();
  const doc = {
    storyId: id,
    title: safeTitle,
    summary: safeSummary,
    content: safeContent,
    choices: normalizedChoices,
    status: "draft",
    source,
    guildId: guildId ? String(guildId) : null,
    ...(createdBy ? { createdBy: String(createdBy) } : {}),
    createdAt: now,
    updatedAt: now
  };
  await getDatabase(baseCollection).collection(COLLECTION_NAME).insertOne(doc);
  return { ...doc, _id: undefined };
}

async function setStoryStatus(baseCollection, storyId, status, { channelId } = {}) {
  if (!["draft", "published", "archived"].includes(status)) {
    throw new Error("Status de história inválido.");
  }
  const update = { status, updatedAt: new Date() };
  if (status === "published" && channelId) update.publishedChannelId = String(channelId);
  if (status === "published") update.publishedAt = new Date();
  return getDatabase(baseCollection).collection(COLLECTION_NAME).updateOne(
    { storyId: String(storyId) },
    { $set: update }
  );
}

async function getStory(baseCollection, storyId) {
  return getDatabase(baseCollection).collection(COLLECTION_NAME).findOne(
    { storyId: String(storyId) },
    { projection: { _id: 0 } }
  );
}

async function listStories(baseCollection, { status = "published", limit = 20, guildId } = {}) {
  const query = {};
  if (status) query.status = status;
  if (guildId) query.$or = [{ guildId: null }, { guildId: String(guildId) }];
  return getDatabase(baseCollection).collection(COLLECTION_NAME).find(query, { projection: { _id: 0, content: 0 } })
    .sort({ createdAt: -1 }).limit(Math.max(1, Math.min(Number(limit) || 20, 50))).toArray();
}

async function castVote(baseCollection, { storyId, choiceId, userId } = {}) {
  const id = String(storyId || "").trim();
  const choice = String(choiceId || "").trim();
  const voter = String(userId || "").trim();
  if (!id || !choice || !voter) throw new Error("Voto exige história, escolha e usuário.");
  const db = getDatabase(baseCollection);
  const story = await db.collection(COLLECTION_NAME).findOne({ storyId: id, status: "published" });
  if (!story) throw new Error("Esta história não está publicada.");
  if (!story.choices?.some(item => item.id === choice)) throw new Error("Esta escolha não pertence à história.");
  try {
    await db.collection(VOTES_COLLECTION).insertOne({
      storyId: id, choiceId: choice, userId: voter, createdAt: new Date()
    });
    return { ok: true, changed: false };
  } catch (error) {
    if (error?.code === 11000) return { ok: false, alreadyVoted: true };
    throw error;
  }
}

async function getVoteResults(baseCollection, storyId) {
  const db = getDatabase(baseCollection);
  const story = await db.collection(COLLECTION_NAME).findOne(
    { storyId: String(storyId) },
    { projection: { _id: 0, storyId: 1, choices: 1 } }
  );
  if (!story) return null;
  const counts = await db.collection(VOTES_COLLECTION).aggregate([
    { $match: { storyId: String(storyId) } },
    { $group: { _id: "$choiceId", votes: { $sum: 1 } } }
  ]).toArray();
  const byChoice = new Map(counts.map(item => [item._id, item.votes]));
  return {
    storyId: story.storyId,
    choices: (story.choices || []).map(choice => ({ ...choice, votes: byChoice.get(choice.id) || 0 }))
  };
}

module.exports = {
  ensureIndexes,
  createStory,
  setStoryStatus,
  getStory,
  listStories,
  castVote,
  getVoteResults
};
