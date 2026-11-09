"use strict";

const STATE_COLLECTION = "yukina_ai_world_state";
const EVENTS_COLLECTION = "yukina_ai_world_events";
const WORLD_TIME_MULTIPLIER = 1; // Um minuto real avança um minuto no relógio do mundo.

const LOCATIONS = Object.freeze([
  { id: "santuario", name: "Santuário Mágico das Cerejeiras", description: "O lar central da Yukina, protegido por magia antiga e cercado por cerejeiras." },
  { id: "jardim_sakura", name: "Jardim das Mil Cerejeiras", description: "Um jardim amplo onde pétalas rosadas dançam ao vento." },
  { id: "lago_cristalino", name: "Lago Cristalino", description: "Um lago sereno que reflete a luz do céu e das lanternas." },
  { id: "floresta_encantada", name: "Floresta Encantada", description: "Uma floresta mágica com trilhas antigas e segredos ainda não descobertos." },
  { id: "aldeia_sakura", name: "Vila Sakura", description: "Uma pequena aldeia próxima ao santuário, preparada para receber moradores no futuro." },
  { id: "observatorio_lunar", name: "Observatório Lunar", description: "Um lugar elevado para contemplar a lua e as estrelas." }
]);

const SEASONS = Object.freeze([
  { id: "primavera", name: "Primavera das Cerejeiras", days: 90 },
  { id: "verao", name: "Verão das Lanternas", days: 90 },
  { id: "outono", name: "Outono das Folhas Douradas", days: 90 },
  { id: "inverno", name: "Inverno da Lua Prateada", days: 90 }
]);

const WEATHER = Object.freeze([
  { id: "clear", name: "Céu sereno" },
  { id: "breeze", name: "Brisa suave" },
  { id: "petals", name: "Chuva de pétalas" },
  { id: "cloudy", name: "Nublado" },
  { id: "rain", name: "Chuva tranquila" },
  { id: "mist", name: "Névoa encantada" }
]);

function getDatabase(baseCollection) {
  if (!baseCollection?.db) throw new Error("A conexão do MongoDB não está disponível.");
  return baseCollection.db;
}

function hashNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getSeason(worldDay) {
  const cycleDays = SEASONS.reduce((sum, season) => sum + season.days, 0);
  let day = Math.max(0, worldDay) % cycleDays;
  for (const season of SEASONS) {
    if (day < season.days) return season;
    day -= season.days;
  }
  return SEASONS[0];
}

function getTimeOfDay(minutesOfDay) {
  if (minutesOfDay < 300) return "madrugada";
  if (minutesOfDay < 360) return "amanhecer";
  if (minutesOfDay < 720) return "manhã";
  if (minutesOfDay < 1020) return "tarde";
  if (minutesOfDay < 1140) return "entardecer";
  return "noite";
}

function buildSnapshot(state, now = new Date()) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(state.lastSimulatedAt).getTime());
  const totalMinutes = Math.floor((Number(state.elapsedWorldMinutes) || 0) + elapsedMs / 60000 * WORLD_TIME_MULTIPLIER);
  const worldDay = Math.floor(totalMinutes / 1440);
  const minutesOfDay = totalMinutes % 1440;
  const weatherIndex = hashNumber(state.worldId + ":" + worldDay) % WEATHER.length;
  const season = getSeason(worldDay);
  const location = LOCATIONS.find(item => item.id === state.currentLocationId) || LOCATIONS[0];
  return {
    worldId: state.worldId,
    name: "Santuário Mágico das Cerejeiras",
    worldDay,
    dayNumber: worldDay + 1,
    totalMinutes,
    minutesOfDay,
    timeOfDay: getTimeOfDay(minutesOfDay),
    season,
    weather: WEATHER[weatherIndex],
    currentLocation: location,
    locations: LOCATIONS,
    lastSimulatedAt: now,
    updatedAt: now
  };
}

async function ensureIndexes(baseCollection) {
  const db = getDatabase(baseCollection);
  await db.collection(STATE_COLLECTION).createIndex({ worldId: 1 }, { unique: true });
  await db.collection(EVENTS_COLLECTION).createIndex({ worldId: 1, createdAt: -1 });
  await db.collection(EVENTS_COLLECTION).createIndex({ eventId: 1 }, { unique: true });
}

async function ensureWorld(baseCollection, { now = new Date() } = {}) {
  const db = getDatabase(baseCollection);
  const collection = db.collection(STATE_COLLECTION);
  const worldId = "yukina-sanctuary";
  await collection.updateOne(
    { worldId },
    {
      $setOnInsert: {
        worldId,
        name: "Santuário Mágico das Cerejeiras",
        currentLocationId: "santuario",
        elapsedWorldMinutes: 0,
        lastSimulatedAt: now,
        createdAt: now,
        version: 1
      }
    },
    { upsert: true }
  );
  return collection.findOne({ worldId }, { projection: { _id: 0 } });
}

async function advanceWorld(baseCollection, { now = new Date() } = {}) {
  const db = getDatabase(baseCollection);
  const collection = db.collection(STATE_COLLECTION);
  const state = await collection.findOne({ worldId: "yukina-sanctuary" });
  if (!state) throw new Error("O mundo da Yukina ainda não foi inicializado.");
  const snapshot = buildSnapshot(state, now);
  await collection.updateOne(
    { worldId: state.worldId },
    {
      $set: {
        elapsedWorldMinutes: snapshot.totalMinutes,
        lastSimulatedAt: now,
        lastSnapshot: {
          worldDay: snapshot.worldDay,
          minutesOfDay: snapshot.minutesOfDay,
          timeOfDay: snapshot.timeOfDay,
          seasonId: snapshot.season.id,
          weatherId: snapshot.weather.id
        },
        updatedAt: now
      }
    }
  );
  return snapshot;
}

async function getWorldSnapshot(baseCollection, { now = new Date() } = {}) {
  const db = getDatabase(baseCollection);
  const state = await db.collection(STATE_COLLECTION).findOne({ worldId: "yukina-sanctuary" });
  if (!state) return null;
  return buildSnapshot(state, now);
}

async function setCurrentLocation(baseCollection, locationId) {
  const location = LOCATIONS.find(item => item.id === String(locationId));
  if (!location) throw new Error("Esse local não existe no mapa inicial do santuário.");
  const db = getDatabase(baseCollection);
  const result = await db.collection(STATE_COLLECTION).updateOne(
    { worldId: "yukina-sanctuary" },
    { $set: { currentLocationId: location.id, updatedAt: new Date() } }
  );
  return { ...location, changed: result.modifiedCount > 0 };
}

async function addWorldEvent(baseCollection, {
  eventId, title, description, locationId = "santuario", source = "creator_authored"
} = {}) {
  const id = String(eventId || "").trim();
  const safeTitle = String(title || "").trim().slice(0, 160);
  const safeDescription = String(description || "").trim().slice(0, 1500);
  if (!id || !safeTitle || !safeDescription) throw new Error("Evento exige ID, título e descrição.");
  if (!["creator_authored", "confirmed_event", "confirmed_lore"].includes(source)) {
    throw new Error("A origem do evento não é permitida.");
  }
  if (!LOCATIONS.some(item => item.id === locationId)) throw new Error("Local do evento desconhecido.");
  const event = {
    eventId: id,
    worldId: "yukina-sanctuary",
    title: safeTitle,
    description: safeDescription,
    locationId,
    source,
    createdAt: new Date()
  };
  await getDatabase(baseCollection).collection(EVENTS_COLLECTION).insertOne(event);
  return { ...event, _id: undefined };
}

async function listWorldEvents(baseCollection, { limit = 20 } = {}) {
  return getDatabase(baseCollection).collection(EVENTS_COLLECTION).find(
    { worldId: "yukina-sanctuary" },
    { projection: { _id: 0 } }
  ).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(Number(limit) || 20, 50))).toArray();
}

function buildWorldContext(snapshot, events = []) {
  if (!snapshot) return "";
  const recentEvents = events.slice(0, 5).map(event => "- " + event.title + ": " + event.description).join("\n");
  return [
    "MUNDO FICCIONAL PERSISTENTE DA YUKINA:",
    "Você vive narrativamente no " + snapshot.name + ".",
    "Dia " + snapshot.dayNumber + ", " + snapshot.timeOfDay + ", estação " + snapshot.season.name + ".",
    "Clima: " + snapshot.weather.name + ".",
    "Local atual registrado: " + snapshot.currentLocation.name + ".",
    "Locais conhecidos: " + snapshot.locations.map(item => item.name).join(", ") + ".",
    recentEvents ? "Acontecimentos confirmados recentes:\n" + recentEvents : "",
    "O relógio e o clima são simulações persistidas; não afirme que moradores, construções ou atividades autônomas já existem sem registros próprios."
  ].filter(Boolean).join("\n");
}

module.exports = {
  LOCATIONS,
  SEASONS,
  WEATHER,
  ensureIndexes,
  ensureWorld,
  advanceWorld,
  getWorldSnapshot,
  setCurrentLocation,
  addWorldEvent,
  listWorldEvents,
  buildWorldContext
};
