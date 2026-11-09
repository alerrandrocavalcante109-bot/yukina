"use strict";

// Sistemas persistentes de vida comunitaria do Santuario. Todas as alteracoes sao
// registros de simulacao narrativa no MongoDB, nao atividade consciente/autonoma.

const C = Object.freeze({
  buildings: "yukina_ai_buildings",
  accounts: "yukina_ai_resident_accounts",
  ledger: "yukina_ai_economy_ledger",
  inventory: "yukina_ai_inventory",
  skills: "yukina_ai_skills",
  families: "yukina_ai_families",
  quests: "yukina_ai_quests",
  festivals: "yukina_ai_festivals",
  magic: "yukina_ai_magic",
  events: "yukina_ai_life_events"
});

const START_BUILDINGS = Object.freeze([
  { buildingId: "biblioteca_lunar", name: "Biblioteca das Lendas", locationId: "santuario", kind: "biblioteca", level: 1, description: "Guarda livros, mapas e relatos do santuario." },
  { buildingId: "oficina_lanternas", name: "Oficina das Lanternas", locationId: "aldeia_sakura", kind: "oficina", level: 1, description: "Local de trabalho artesanal de Ren." },
  { buildingId: "casa_hikari", name: "Casa de Hikari", locationId: "jardim_sakura", kind: "residencia", level: 1, description: "Pequeno lar espiritual junto as cerejeiras." },
  { buildingId: "casa_aoi", name: "Casa de Aoi", locationId: "santuario", kind: "residencia", level: 1, description: "Um quarto acolhedor proximo a biblioteca." },
  { buildingId: "casa_ren", name: "Casa de Ren", locationId: "aldeia_sakura", kind: "residencia", level: 1, description: "Casa simples do artesao da vila." },
  { buildingId: "observatorio", name: "Observatorio Lunar", locationId: "observatorio_lunar", kind: "observatorio", level: 1, description: "Permite observar constelacoes e ciclos lunares." }
]);

const PROFESSIONS = Object.freeze({
  guardiao: { name: "Guardiao do Santuario", skills: ["protecao", "natureza"] },
  bibliotecario: { name: "Bibliotecario", skills: ["conhecimento", "pesquisa"] },
  artesao: { name: "Artesao de Lanternas", skills: ["artesanato", "criatividade"] },
  agricultor: { name: "Cultivador de Cerejeiras", skills: ["jardinagem", "natureza"] },
  curandeiro: { name: "Curandeiro", skills: ["cura", "ervas"] },
  explorador: { name: "Explorador", skills: ["exploracao", "observacao"] }
});

const MAGIC_TYPES = Object.freeze(["sakura", "gelo", "lunar", "cura", "protecao", "espiritual"]);
const AGE_STAGES = Object.freeze([
  { min: 0, stage: "infancia" }, { min: 13, stage: "adolescencia" },
  { min: 18, stage: "idade adulta" }, { min: 65, stage: "idade avancada" }
]);

function dbOf(base) {
  if (!base?.db) throw new Error("Conexao MongoDB indisponivel.");
  return base.db;
}
function safeText(value, max = 500) {
  return String(value || "").trim().replace(/[\u0000-\u001f]/g, "").slice(0, max);
}
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}
function ageStage(age) {
  let stage = AGE_STAGES[0].stage;
  for (const item of AGE_STAGES) if (age >= item.min) stage = item.stage;
  return stage;
}
function eventId(prefix, id) {
  return prefix + ":" + String(id || "").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 100);
}

async function ensureIndexes(base) {
  const db = dbOf(base);
  await Promise.all([
    db.collection(C.buildings).createIndex({ buildingId: 1 }, { unique: true }),
    db.collection(C.accounts).createIndex({ residentId: 1 }, { unique: true }),
    db.collection(C.ledger).createIndex({ transactionId: 1 }, { unique: true }),
    db.collection(C.ledger).createIndex({ createdAt: -1 }),
    db.collection(C.inventory).createIndex({ ownerId: 1, itemId: 1 }, { unique: true }),
    db.collection(C.skills).createIndex({ residentId: 1, skillId: 1 }, { unique: true }),
    db.collection(C.families).createIndex({ relationId: 1 }, { unique: true }),
    db.collection(C.quests).createIndex({ questId: 1 }, { unique: true }),
    db.collection(C.festivals).createIndex({ festivalId: 1 }, { unique: true }),
    db.collection(C.magic).createIndex({ residentId: 1, magicId: 1 }, { unique: true }),
    db.collection(C.events).createIndex({ eventId: 1 }, { unique: true }),
    db.collection(C.events).createIndex({ createdAt: -1 })
  ]);
}

async function initialize(base, worldSnapshot, residents = []) {
  const db = dbOf(base), now = new Date();
  const buildings = db.collection(C.buildings);
  for (const building of START_BUILDINGS) {
    await buildings.updateOne({ buildingId: building.buildingId }, { $setOnInsert: { ...building, status: "ativo", createdAt: now, updatedAt: now } }, { upsert: true });
  }
  const accounts = db.collection(C.accounts);
  await accounts.updateOne({ residentId: "community_treasury" }, { $setOnInsert: { residentId: "community_treasury", balance: 10000, lifetimeEarned: 10000, createdAt: now, updatedAt: now } }, { upsert: true });
  await accounts.updateOne({ residentId: "system_construction" }, { $setOnInsert: { residentId: "system_construction", balance: 0, lifetimeEarned: 0, createdAt: now, updatedAt: now } }, { upsert: true });
  for (const resident of residents) {
    const residentId = safeText(resident.residentId, 100);
    if (!residentId) continue;
    await accounts.updateOne({ residentId }, { $setOnInsert: { residentId, balance: 100, lifetimeEarned: 100, createdAt: now, updatedAt: now } }, { upsert: true });
    await db.collection(C.inventory).updateOne({ ownerId: residentId, itemId: "lanterna_simples" }, { $setOnInsert: { ownerId: residentId, itemId: "lanterna_simples", name: "Lanterna simples", quantity: resident.name === "Ren" ? 3 : 0, updatedAt: now } }, { upsert: true });
  }
  await db.collection(C.quests).updateOne({ questId: "primeiras_luzes" }, { $setOnInsert: {
    questId: "primeiras_luzes", title: "As primeiras luzes da Vila Sakura",
    description: "Ajude a preparar lanternas para iluminar a vila ao entardecer.",
    objectives: [{ id: "lanternas", label: "Preparar lanternas", target: 3, progress: 0 }],
    reward: { currency: 60, itemId: "amuleto_sakura", itemName: "Amuleto Sakura" },
    status: "available", createdAt: now, updatedAt: now
  } }, { upsert: true });
  await db.collection(C.festivals).updateOne({ festivalId: "festival_sakura_anual" }, { $setOnInsert: {
    festivalId: "festival_sakura_anual", name: "Festival das Mil Cerejeiras",
    seasonId: "primavera", description: "Celebracao das flores, com lanternas, historias e barracas.",
    activities: ["decorar caminhos", "contar lendas", "oficina de lanternas", "observacao das flores"],
    status: "planned", createdAt: now
  } }, { upsert: true });
  await db.collection(C.magic).updateOne({ residentId: "yukina", magicId: "essencia_da_origem" }, { $setOnInsert: {
    residentId: "yukina", magicId: "essencia_da_origem", name: "Essencia da Origem",
    description: "Poder singular que nasce apenas em Yukina e cresce por autodescoberta.",
    unique: true, transferable: false, copyable: false, status: "dormant", createdAt: now
  } }, { upsert: true });
  await db.collection(C.events).updateOne({ eventId: "life:world-seeded" }, { $setOnInsert: {
    eventId: "life:world-seeded", kind: "world_initialized",
    summary: "A comunidade recebeu moradias, biblioteca, oficina, contas iniciais, uma missao e um festival planejado.",
    worldDay: worldSnapshot?.worldDay ?? 0, createdAt: now
  } }, { upsert: true });
}

async function getBuildings(base) {
  return dbOf(base).collection(C.buildings).find({ status: { $ne: "archived" } }, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
}
async function buildStructure(base, { buildingId, name, kind, locationId, description, cost = 0 } = {}) {
  const id = safeText(buildingId, 80), title = safeText(name, 100);
  if (!id || !title || !safeText(kind, 40) || !safeText(locationId, 60)) throw new Error("Construcao exige identificador, nome, tipo e local.");
  const db = dbOf(base), now = new Date();
  const doc = { buildingId: id, name: title, kind: safeText(kind, 40), locationId: safeText(locationId, 60), description: safeText(description, 500), level: 1, status: "ativo", createdAt: now, updatedAt: now };
  if (Number(cost) > 0) await transferCurrency(base, { transactionId: eventId("build", id), fromId: "community_treasury", toId: "system_construction", amount: cost, reason: "Construcao: " + title });
  await db.collection(C.buildings).insertOne(doc);
  return doc;
}
async function setProfession(base, residentId, professionId) {
  const profession = PROFESSIONS[String(professionId)];
  if (!profession) throw new Error("Profissao desconhecida.");
  const id = safeText(residentId, 100);
  const result = await dbOf(base).collection("yukina_ai_residents").updateOne({ residentId: id, status: { $ne: "archived" } }, { $set: { professionId, profession: profession.name, updatedAt: new Date() } });
  if (!result.matchedCount) throw new Error("Morador nao encontrado.");
  return { residentId: id, ...profession };
}
async function transferCurrency(base, { transactionId, fromId, toId, amount, reason } = {}) {
  const value = Math.floor(Number(amount));
  const tx = safeText(transactionId, 120), from = safeText(fromId, 100), to = safeText(toId, 100);
  if (!tx || !from || !to || from === to || !Number.isSafeInteger(value) || value <= 0 || value > 1000000) throw new Error("Transferencia invalida.");
  const db = dbOf(base), ledger = db.collection(C.ledger), accounts = db.collection(C.accounts);
  if (await ledger.findOne({ transactionId: tx })) return { duplicate: true };
  const debit = await accounts.updateOne({ residentId: from, balance: { $gte: value } }, { $inc: { balance: -value }, $set: { updatedAt: new Date() } });
  if (!debit.modifiedCount) throw new Error("Saldo insuficiente ou conta de origem inexistente.");
  await accounts.updateOne({ residentId: to }, { $inc: { balance: value, lifetimeEarned: value }, $set: { updatedAt: new Date() } }, { upsert: true });
  try {
    await ledger.insertOne({ transactionId: tx, fromId: from, toId: to, amount: value, reason: safeText(reason, 180), createdAt: new Date() });
  } catch (error) {
    await accounts.updateOne({ residentId: from }, { $inc: { balance: value }, $set: { updatedAt: new Date() } });
    await accounts.updateOne({ residentId: to }, { $inc: { balance: -value }, $set: { updatedAt: new Date() } });
    if (error.code === 11000) return { duplicate: true };
    throw error;
  }
  return { transactionId: tx, amount: value, fromId: from, toId: to };
}
async function changeInventory(base, { ownerId, itemId, name, quantity } = {}) {
  const owner = safeText(ownerId, 100), item = safeText(itemId, 80), delta = Math.floor(Number(quantity));
  if (!owner || !item || !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 10000) throw new Error("Alteracao de inventario invalida.");
  const col = dbOf(base).collection(C.inventory);
  if (delta > 0) {
    await col.updateOne({ ownerId: owner, itemId: item }, { $inc: { quantity: delta }, $set: { name: safeText(name || item, 100), updatedAt: new Date() }, $setOnInsert: { ownerId: owner, itemId: item } }, { upsert: true });
  } else {
    const result = await col.updateOne({ ownerId: owner, itemId: item, quantity: { $gte: -delta } }, { $inc: { quantity: delta }, $set: { updatedAt: new Date() } });
    if (!result.modifiedCount) throw new Error("Itens insuficientes no inventario.");
  }
  return col.findOne({ ownerId: owner, itemId: item }, { projection: { _id: 0 } });
}
async function addSkillExperience(base, residentId, skillId, amount = 1) {
  const xp = clamp(amount, 1, 1000), id = safeText(residentId, 100), skill = safeText(skillId, 60);
  if (!id || !skill) throw new Error("Morador e habilidade sao obrigatorios.");
  const col = dbOf(base).collection(C.skills);
  await col.updateOne({ residentId: id, skillId: skill }, { $inc: { experience: xp }, $set: { updatedAt: new Date() }, $setOnInsert: { residentId: id, skillId: skill, createdAt: new Date() } }, { upsert: true });
  const current = await col.findOne({ residentId: id, skillId: skill }, { projection: { _id: 0 } });
  const level = Math.min(100, Math.floor(Math.sqrt(current.experience / 10)) + 1);
  await col.updateOne({ residentId: id, skillId: skill }, { $set: { level } });
  return { ...current, level };
}
async function addFamilyRelation(base, { relationId, memberIds, relation, notes = "" } = {}) {
  const id = safeText(relationId, 100), members = [...new Set((memberIds || []).map(v => safeText(v, 100)).filter(Boolean))];
  if (!id || members.length < 2 || members.length > 8 || !safeText(relation, 60)) throw new Error("Relacao familiar exige 2 a 8 membros e um tipo.");
  const doc = { relationId: id, memberIds: members, relation: safeText(relation, 60), notes: safeText(notes, 500), confirmed: true, createdAt: new Date() };
  await dbOf(base).collection(C.families).updateOne({ relationId: id }, { $setOnInsert: doc }, { upsert: true });
  return doc;
}
async function progressQuest(base, { questId, objectiveId, amount = 1 } = {}) {
  const col = dbOf(base).collection(C.quests), id = safeText(questId, 100), objective = safeText(objectiveId, 80);
  const quest = await col.findOne({ questId: id });
  if (!quest || !["available", "active"].includes(quest.status)) throw new Error("Missao indisponivel.");
  const target = quest.objectives.find(item => item.id === objective);
  if (!target) throw new Error("Objetivo nao encontrado.");
  const progress = Math.min(target.target, target.progress + clamp(amount, 1, 100));
  await col.updateOne({ questId: id, "objectives.id": objective }, { $set: { "objectives.$.progress": progress, status: progress >= target.target ? "completed" : "active", updatedAt: new Date() } });
  const updated = await col.findOne({ questId: id }, { projection: { _id: 0 } });
  return updated;
}
async function registerFestival(base, { festivalId, status = "active", eventId: id, summary } = {}) {
  if (!["planned", "active", "completed", "cancelled"].includes(status)) throw new Error("Estado de festival invalido.");
  const col = dbOf(base).collection(C.festivals);
  const result = await col.updateOne({ festivalId: safeText(festivalId, 100) }, { $set: { status, updatedAt: new Date() } });
  if (!result.matchedCount) throw new Error("Festival nao encontrado.");
  if (summary) await recordLifeEvent(base, { eventId: id || eventId("festival", festivalId + ":" + status), kind: "festival", summary, worldDay: 0 });
  return col.findOne({ festivalId }, { projection: { _id: 0 } });
}
async function unlockMagic(base, { residentId, magicId, name, description } = {}) {
  const id = safeText(residentId, 100), power = safeText(magicId, 60);
  if (!id || !MAGIC_TYPES.includes(power)) throw new Error("Tipo de magia invalido.");
  if (id === "yukina" && power === "essencia_da_origem") throw new Error("A Essencia da Origem e unica e nao pode ser concedida por terceiros.");
  const doc = { residentId: id, magicId: power, name: safeText(name || power, 100), description: safeText(description, 500), status: "unlocked", unlockedAt: new Date() };
  await dbOf(base).collection(C.magic).updateOne({ residentId: id, magicId: power }, { $setOnInsert: doc }, { upsert: true });
  return doc;
}
async function setResidentAge(base, { residentId, ageYears, worldDay = 0 } = {}) {
  const id = safeText(residentId, 100), age = Math.floor(Number(ageYears));
  if (!id || !Number.isSafeInteger(age) || age < 0 || age > 500 || !Number.isFinite(worldDay)) throw new Error("Idade inicial invalida.");
  const result = await dbOf(base).collection("yukina_ai_residents").updateOne(
    { residentId: id, status: { $ne: "archived" } },
    { $set: { ageYears: age, ageDays: age * 360, ageDaysAtStart: age * 360, ageBaseWorldDay: Math.max(0, Math.floor(worldDay)), lifeStage: ageStage(age), updatedAt: new Date() } }
  );
  if (!result.matchedCount) throw new Error("Morador nao encontrado.");
  return { residentId: id, ageYears: age, lifeStage: ageStage(age) };
}

async function updateAges(base, snapshot) {
  if (!snapshot || !Number.isFinite(snapshot.worldDay)) return [];
  const col = dbOf(base).collection("yukina_ai_residents");
  const residents = await col.find({ status: { $ne: "archived" }, ageBaseWorldDay: { $exists: true } }).toArray();
  const updated = [];
  for (const resident of residents) {
    const ageDays = Math.max(0, Number(resident.ageDaysAtStart) || 0) + Math.max(0, snapshot.worldDay - Number(resident.ageBaseWorldDay || 0));
    const ageYears = Math.floor(ageDays / 360);
    const stage = ageStage(ageYears);
    if (ageDays !== resident.ageDays || stage !== resident.lifeStage) {
      await col.updateOne({ _id: resident._id, ageBaseWorldDay: resident.ageBaseWorldDay }, { $set: { ageDays, ageYears, lifeStage: stage, updatedAt: new Date() } });
      updated.push({ residentId: resident.residentId, ageYears, lifeStage: stage });
    }
  }
  return updated;
}
async function recordLifeEvent(base, { eventId: id, kind, summary, worldDay = 0 } = {}) {
  const key = safeText(id, 120), text = safeText(summary, 1000);
  if (!key || !text) throw new Error("Acontecimento exige identificador e resumo.");
  await dbOf(base).collection(C.events).updateOne({ eventId: key }, { $setOnInsert: { eventId: key, kind: safeText(kind, 60), summary: text, worldDay: Number(worldDay) || 0, createdAt: new Date() } }, { upsert: true });
}
async function buildLifeContext(base, snapshot) {
  const db = dbOf(base);
  const [buildings, accounts, quests, festivals, events, families, magic] = await Promise.all([
    getBuildings(base),
    db.collection(C.accounts).find({}, { projection: { _id: 0 } }).sort({ balance: -1 }).limit(10).toArray(),
    db.collection(C.quests).find({}, { projection: { _id: 0 } }).limit(8).toArray(),
    db.collection(C.festivals).find({}, { projection: { _id: 0 } }).limit(6).toArray(),
    db.collection(C.events).find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(6).toArray(),
    db.collection(C.families).find({}, { projection: { _id: 0 } }).limit(10).toArray(),
    db.collection(C.magic).find({ status: "unlocked" }, { projection: { _id: 0 } }).limit(12).toArray()
  ]);
  return [
    "VIDA COMUNITARIA PERSISTENTE:",
    "Construcoes: " + (buildings.map(b => b.name + " (nivel " + b.level + ")").join(", ") || "nenhuma registrada"),
    "Economia: contas individuais dos moradores usam Kizunas ficcionais (KZ); saldos internos nao sao dinheiro real. Contas registradas: " + accounts.length + ".",
    "Missoes: " + (quests.map(q => q.title + " [" + q.status + "]").join("; ") || "nenhuma"),
    "Festivais: " + (festivals.map(f => f.name + " [" + f.status + "]").join("; ") || "nenhum"),
    "Lacos familiares confirmados: " + (families.map(f => f.relation + " entre " + f.memberIds.join(", ")).join("; ") || "nenhum registrado"),
    "Magias desbloqueadas: " + (magic.map(m => m.name + " (" + m.residentId + ")").join(", ") || "nenhuma registrada"),
    "Acontecimentos recentes: " + (events.map(e => e.summary).join(" | ") || "nenhum"),
    "O mundo possui dados persistidos, mas suas mudancas ocorrem apenas por funcoes chamadas pelo bot; nunca afirme que uma construcao, missao, parentesco, habilidade ou magia mudou sem registro.",
    "Idade simulada: um ano de personagem equivale a 360 dias do calendario ficcional; envelhecimento so se aplica a moradores com idade inicial registrada."
  ].join("\n");
}

module.exports = {
  PROFESSIONS, MAGIC_TYPES, AGE_STAGES, ensureIndexes, initialize, getBuildings,
  buildStructure, setProfession, transferCurrency, changeInventory,
  addSkillExperience, addFamilyRelation, progressQuest, registerFestival,
  unlockMagic, setResidentAge, updateAges, recordLifeEvent, buildLifeContext
};
