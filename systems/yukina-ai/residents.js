"use strict";

const RESIDENTS_COLLECTION = "yukina_ai_residents";
const MEMORIES_COLLECTION = "yukina_ai_resident_memories";
const EVENTS_COLLECTION = "yukina_ai_resident_events";

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
  await db.collection(EVENTS_COLLECTION).createIndex({ eventId: 1 }, { unique: true });
  await db.collection(EVENTS_COLLECTION).createIndex({ worldDay: -1, timeSlot: 1 });
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


const DAILY_SCHEDULE = Object.freeze({
  madrugada: [
    { residentId: "sakura-guardian-hikari", activity: "Descansa no recanto protegido do jardim." },
    { residentId: "kitsune-librarian-aoi", activity: "Descansa na pequena sala da biblioteca." },
    { residentId: "lantern-maker-ren", activity: "Descansa em sua casa na Vila Sakura." }
  ],
  amanhecer: [
    { residentId: "sakura-guardian-hikari", activity: "Visita as cerejeiras e observa os primeiros botões de flores." },
    { residentId: "kitsune-librarian-aoi", activity: "Abre a biblioteca e organiza a mesa de leitura." },
    { residentId: "lantern-maker-ren", activity: "Prepara materiais para a oficina de lanternas." }
  ],
  manhã: [
    { residentId: "sakura-guardian-hikari", activity: "Cuida dos jardins e verifica as árvores antigas." },
    { residentId: "kitsune-librarian-aoi", activity: "Cataloga livros e pesquisa lendas do santuário." },
    { residentId: "lantern-maker-ren", activity: "Recolhe e prepara materiais para seus trabalhos artesanais." }
  ],
  tarde: [
    { residentId: "sakura-guardian-hikari", activity: "Percorre os caminhos do jardim para manter a proteção espiritual." },
    { residentId: "kitsune-librarian-aoi", activity: "Estuda mapas e relatos antigos na biblioteca." },
    { residentId: "lantern-maker-ren", activity: "Trabalha na oficina, desenhando e montando lanternas." }
  ],
  entardecer: [
    { residentId: "sakura-guardian-hikari", activity: "Caminha pelo jardim enquanto as lanternas começam a brilhar." },
    { residentId: "kitsune-librarian-aoi", activity: "Fecha os registros do dia e escolhe um livro para ler." },
    { residentId: "lantern-maker-ren", activity: "Acende as lanternas da Vila Sakura e confere sua iluminação." }
  ],
  noite: [
    { residentId: "sakura-guardian-hikari", activity: "Medita sob a cerejeira mais antiga." },
    { residentId: "kitsune-librarian-aoi", activity: "Lê histórias à luz das lanternas." },
    { residentId: "lantern-maker-ren", activity: "Recolhe as ferramentas e descansa após o trabalho." }
  ]
});

const SHARED_INTERACTIONS = Object.freeze({
  entardecer: {
    eventId: "hikari-ren-lanterns",
    residentIds: ["sakura-guardian-hikari", "lantern-maker-ren"],
    summary: "Hikari acompanha Ren enquanto ele acende as lanternas; os dois conversam sobre como a luz transforma o jardim ao entardecer."
  },
  noite: {
    eventId: "aoi-hikari-stories",
    residentIds: ["kitsune-librarian-aoi", "sakura-guardian-hikari"],
    summary: "Aoi compartilha uma lenda antiga com Hikari, que acrescenta uma lembrança sobre as cerejeiras do santuário."
  }
});

async function simulateCurrentSlot(baseCollection, snapshot) {
  if (!snapshot || !Number.isInteger(snapshot.worldDay) || !snapshot.timeOfDay) return [];
  const db = getDatabase(baseCollection);
  const events = db.collection(EVENTS_COLLECTION);
  const slot = String(snapshot.timeOfDay);
  const schedule = DAILY_SCHEDULE[slot] || [];
  const created = [];
  for (const item of schedule) {
    const resident = await getResident(baseCollection, item.residentId);
    if (!resident) continue;
    const eventId = "routine:" + snapshot.worldDay + ":" + slot + ":" + item.residentId;
    const event = {
      eventId,
      kind: "routine",
      worldDay: snapshot.worldDay,
      dayNumber: snapshot.dayNumber,
      timeSlot: slot,
      residentIds: [item.residentId],
      summary: resident.name + ": " + item.activity,
      createdAt: new Date()
    };
    const result = await events.updateOne({ eventId }, { $setOnInsert: event }, { upsert: true });
    if (result.upsertedCount) created.push(event);
  }

  const shared = SHARED_INTERACTIONS[slot];
  if (shared && shared.residentIds.every(id => Boolean(id))) {
    const existingResidents = await db.collection(RESIDENTS_COLLECTION).countDocuments({
      residentId: { $in: shared.residentIds },
      status: { $ne: "archived" }
    });
    if (existingResidents === shared.residentIds.length) {
      const eventId = "interaction:" + snapshot.worldDay + ":" + slot + ":" + shared.eventId;
      const event = {
        eventId,
        kind: "interaction",
        worldDay: snapshot.worldDay,
        dayNumber: snapshot.dayNumber,
        timeSlot: slot,
        residentIds: shared.residentIds,
        summary: shared.summary,
        createdAt: new Date()
      };
      const result = await events.updateOne({ eventId }, { $setOnInsert: event }, { upsert: true });
      if (result.upsertedCount) created.push(event);
    }
  }
  return created;
}

async function getRecentResidentEvents(baseCollection, { limit = 8 } = {}) {
  return getDatabase(baseCollection).collection(EVENTS_COLLECTION).find(
    {},
    { projection: { _id: 0 } }
  ).sort({ worldDay: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 8, 20))).toArray();
}

function buildResidentEventsContext(events = []) {
  if (!Array.isArray(events) || !events.length) return "";
  return [
    "ATIVIDADES E ENCONTROS RECENTEMENTE REGISTRADOS NO SANTUÁRIO:",
    ...events.map(event => "- Dia " + (event.dayNumber || (event.worldDay + 1)) + ", " + event.timeSlot + ": " + event.summary),
    "Esses acontecimentos são registros da simulação narrativa do mundo; não acrescente detalhes como fatos registrados se não estiverem aqui."
  ].join("\\n");
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
