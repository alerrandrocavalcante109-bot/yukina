"use strict";

const RESIDENTS_COLLECTION = "yukina_ai_residents";
const MEMORIES_COLLECTION = "yukina_ai_resident_memories";

const INITIAL_RESIDENTS = Object.freeze([
  {
    residentId: "sakura-guardian-hikari",
    name: "Hikari",
    species: "Espírito guardião das cerejeiras",
    role: "Guardião dos jardins",
    homeLocationId: "jardim_sakura",
    personality: ["serena", "protetora", "atenciosa", "um pouco tímida"],
    description: "Um espírito de luz que cuida das cerejeiras antigas e percebe quando o jardim precisa de proteção.",
    interests: ["jardinagem", "lendas antigas", "observar as pétalas ao amanhecer"],
    routine: ["visitar as árvores ao amanhecer", "cuidar dos jardins durante o dia", "meditar sob a cerejeira mais antiga à noite"],
    relationships: [{ residentId: "kitsune-librarian-aoi", relation: "amiga e companheira de histórias" }],
    introduction: "Hikari é uma guardiã espiritual ligada às cerejeiras do santuário."
  },
  {
    residentId: "kitsune-librarian-aoi",
    name: "Aoi",
    species: "Kitsune",
    role: "Bibliotecária e pesquisadora de lendas",
    homeLocationId: "santuario",
    personality: ["curiosa", "inteligente", "gentil", "bem-humorada"],
    description: "Uma kitsune de espírito estudioso que organiza livros, mapas e relatos sobre os mistérios do universo.",
    interests: ["livros", "caligrafia", "enigmas", "histórias de viajantes"],
    routine: ["abrir a biblioteca pela manhã", "catalogar histórias durante a tarde", "ler junto às lanternas no começo da noite"],
    relationships: [{ residentId: "sakura-guardian-hikari", relation: "amiga e companheira de histórias" }, { residentId: "lantern-maker-ren", relation: "amiga; troca histórias por lanternas" }],
    introduction: "Aoi é uma kitsune bibliotecária, curiosa sobre histórias e mistérios."
  },
  {
    residentId: "lantern-maker-ren",
    name: "Ren",
    species: "Artesão humano",
    role: "Artesão de lanternas",
    homeLocationId: "aldeia_sakura",
    personality: ["criativo", "paciente", "prestativo", "alegre"],
    description: "Um artesão habilidoso que fabrica lanternas para iluminar caminhos, festivais e pequenas casas da vila.",
    interests: ["artesanato", "desenho", "festivais", "música tradicional"],
    routine: ["recolher materiais pela manhã", "trabalhar na oficina durante o dia", "acender lanternas ao entardecer"],
    relationships: [{ residentId: "kitsune-librarian-aoi", relation: "amiga; troca histórias por lanternas" }],
    introduction: "Ren é o artesão da Vila Sakura, conhecido por criar lanternas."
  }
]);

function getDatabase(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db;
}

async function ensureIndexes(baseCollection) {
  const db = getDatabase(baseCollection);
  await db.collection(RESIDENTS_COLLECTION).createIndex({ residentId: 1 }, { unique: true });
  await db.collection(RESIDENTS_COLLECTION).createIndex({ homeLocationId: 1, status: 1 });
  await db.collection(MEMORIES_COLLECTION).createIndex({ residentId: 1, createdAt: -1 });
  await db.collection(MEMORIES_COLLECTION).createIndex({ memoryId: 1 }, { unique: true });
}

async function seedResidents(baseCollection, { now = new Date() } = {}) {
  const collection = getDatabase(baseCollection).collection(RESIDENTS_COLLECTION);
  for (const resident of INITIAL_RESIDENTS) {
    await collection.updateOne(
      { residentId: resident.residentId },
      {
        $setOnInsert: {
          ...resident,
          status: "introduced",
          memoryCount: 0,
          createdAt: now,
          updatedAt: now,
          version: 1
        }
      },
      { upsert: true }
    );
  }
  return listResidents(baseCollection);
}

async function listResidents(baseCollection, { locationId, limit = 30 } = {}) {
  const query = { status: { $ne: "archived" } };
  if (locationId) query.homeLocationId = String(locationId);
  return getDatabase(baseCollection).collection(RESIDENTS_COLLECTION).find(
    query,
    { projection: { _id: 0 } }
  ).sort({ name: 1 }).limit(Math.max(1, Math.min(Number(limit) || 30, 100))).toArray();
}

async function getResident(baseCollection, residentId) {
  return getDatabase(baseCollection).collection(RESIDENTS_COLLECTION).findOne(
    { residentId: String(residentId), status: { $ne: "archived" } },
    { projection: { _id: 0 } }
  );
}

async function addResidentMemory(baseCollection, {
  memoryId, residentId, summary, source = "confirmed_event", relatedResidentIds = []
} = {}) {
  const id = String(memoryId || "").trim();
  const targetId = String(residentId || "").trim();
  const safeSummary = String(summary || "").trim().slice(0, 1200);
  if (!id || !targetId || !safeSummary) throw new Error("Memória exige ID, morador e resumo.");
  if (!["confirmed_event", "creator_authored", "resident_interaction"].includes(source)) {
    throw new Error("A origem desta memória não é permitida.");
  }
  const db = getDatabase(baseCollection);
  const resident = await db.collection(RESIDENTS_COLLECTION).findOne({ residentId: targetId });
  if (!resident) throw new Error("Morador não encontrado.");
  const validRelated = [...new Set((Array.isArray(relatedResidentIds) ? relatedResidentIds : [])
    .map(value => String(value).trim()).filter(Boolean).slice(0, 10))];
  const knownRelated = validRelated.length
    ? await db.collection(RESIDENTS_COLLECTION).find({ residentId: { $in: validRelated } }, { projection: { residentId: 1 } }).toArray()
    : [];
  const memory = {
    memoryId: id,
    residentId: targetId,
    summary: safeSummary,
    source,
    relatedResidentIds: knownRelated.map(item => item.residentId),
    createdAt: new Date()
  };
  await db.collection(MEMORIES_COLLECTION).insertOne(memory);
  await db.collection(RESIDENTS_COLLECTION).updateOne(
    { residentId: targetId },
    { $inc: { memoryCount: 1 }, $set: { updatedAt: new Date() } }
  );
  return { ...memory, _id: undefined };
}

async function getResidentMemories(baseCollection, residentId, { limit = 5 } = {}) {
  return getDatabase(baseCollection).collection(MEMORIES_COLLECTION).find(
    { residentId: String(residentId) },
    { projection: { _id: 0 } }
  ).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(Number(limit) || 5, 20))).toArray();
}

function buildResidentsContext(residentList, memoriesByResident = {}) {
  if (!Array.isArray(residentList) || !residentList.length) return "";
  const lines = ["MORADORES REGISTRADOS DO MUNDO FICCIONAL:"];
  for (const resident of residentList.slice(0, 12)) {
    lines.push(
      "- " + resident.name + " (" + resident.species + "), função: " + resident.role +
      "; lar: " + resident.homeLocationId + ". Personalidade: " + resident.personality.join(", ") +
      ". Interesses: " + resident.interests.join(", ") + ". Rotina planejada: " + resident.routine.join("; ") +
      ". Relações registradas: " + resident.relationships.map(item => item.residentId + " — " + item.relation).join("; ") +
      ". " + resident.description
    );
    const memories = memoriesByResident[resident.residentId] || [];
    for (const memory of memories.slice(0, 3)) lines.push("  Lembrança registrada de " + resident.name + ": " + memory.summary);
  }
  lines.push("Esses moradores são personagens ficcionais cadastrados. As rotinas descrevem planos narrativos; não alegue que foram executadas fora de eventos registrados.");
  return lines.join("\n");
}

async function getResidentsContext(baseCollection) {
  const residentList = await listResidents(baseCollection, { limit: 12 });
  const entries = await Promise.all(residentList.map(async resident => [
    resident.residentId,
    await getResidentMemories(baseCollection, resident.residentId, { limit: 3 })
  ]));
  return buildResidentsContext(residentList, Object.fromEntries(entries));
}

module.exports = {
  INITIAL_RESIDENTS,
  ensureIndexes,
  seedResidents,
  listResidents,
  getResident,
  addResidentMemory,
  getResidentMemories,
  buildResidentsContext,
  getResidentsContext
};
