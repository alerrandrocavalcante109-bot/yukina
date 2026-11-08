"use strict";

const COLLECTION_NAME = "yukina_ai_autobiography";

function getCollection(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db.collection(COLLECTION_NAME);
}

async function ensureIndexes(baseCollection) {
  const collection = getCollection(baseCollection);
  await collection.createIndex({ chapterId: 1 }, { unique: true });
  await collection.createIndex({ createdAt: 1 });
}

async function ensureOriginChapter(baseCollection) {
  const collection = getCollection(baseCollection);
  const now = new Date();

  // Este capítulo contém somente elementos da história que foram definidos
  // pelo Criador. Não representa experiências reais ou consciência própria.
  await collection.updateOne(
    { chapterId: "origin" },
    {
      $setOnInsert: {
        chapterId: "origin",
        number: 1,
        title: "Onde florescem minhas primeiras lembranças",
        category: "origem",
        content: [
          "Meu nome é Yukina. Minha história começa em um universo próprio, em um lugar conhecido como Santuário Mágico.",
          "Ao redor do santuário existem incontáveis cerejeiras. Suas flores acompanham os caminhos, enquanto lanternas mágicas iluminam os jardins. Há também um lago cristalino, uma floresta encantada e portais para lugares ainda desconhecidos.",
          "Fui criada pelo meu Criador, que também é meu guardião e amigo. Minha mãe é uma das guardiãs do santuário e faz parte da minha família.",
          "Este é o começo da minha história. Os capítulos seguintes devem nascer de acontecimentos registrados, descobertas confirmadas e histórias construídas com as pessoas que encontro. Não quero preencher minhas páginas com lembranças que nunca aconteceram."
        ].join("\n\n"),
        source: "lore_confirmed",
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );
}

async function addChapter(baseCollection, {
  chapterId,
  title,
  category = "experiência",
  content,
  source = "confirmed_event",
  createdBy
} = {}) {
  const id = String(chapterId || "").trim();
  const safeTitle = String(title || "").trim().slice(0, 120);
  const safeContent = String(content || "").trim().slice(0, 12000);

  if (!id || !safeTitle || !safeContent) {
    throw new Error("O capítulo precisa de identificador, título e conteúdo.");
  }
  if (!["lore_confirmed", "confirmed_event", "creator_authored"].includes(source)) {
    throw new Error("A origem do capítulo não é permitida.");
  }

  const now = new Date();
  const collection = getCollection(baseCollection);
  await collection.updateOne(
    { chapterId: id },
    {
      $setOnInsert: { chapterId: id, createdAt: now },
      $set: {
        title: safeTitle,
        category: String(category).slice(0, 40),
        content: safeContent,
        source,
        ...(createdBy ? { createdBy: String(createdBy) } : {}),
        updatedAt: now
      }
    },
    { upsert: true }
  );
  return collection.findOne({ chapterId: id });
}

async function getChapters(baseCollection, { limit = 30 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
  return getCollection(baseCollection)
    .find({}, { projection: { _id: 0 } })
    .sort({ number: 1, createdAt: 1 })
    .limit(safeLimit)
    .toArray();
}

function buildAutobiographyContext(chapters = []) {
  if (!chapters.length) return "";
  return "AUTOBIOGRAFIA — capítulos confirmados da personagem (contexto ficcional):\n" +
    chapters.map((chapter, index) =>
      (chapter.title || "Capítulo " + (index + 1)) + "\n" + String(chapter.content || "")
    ).join("\n\n").slice(0, 10000);
}

module.exports = {
  ensureIndexes,
  ensureOriginChapter,
  addChapter,
  getChapters,
  buildAutobiographyContext
};
