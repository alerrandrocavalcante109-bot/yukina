"use strict";

const { MongoClient } = require("mongodb");
const { MONGODB_URI, MONGODB_DB } = require("../config");

let settingsMongoClient = null;
let settingsCollection = null;

async function getSettingsCollection() {
  if (settingsCollection) return settingsCollection;
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada no Render.");
  settingsMongoClient = settingsMongoClient || new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await settingsMongoClient.connect();
  settingsCollection = settingsMongoClient.db(MONGODB_DB).collection("guild_settings");
  await settingsCollection.createIndex({ guildId: 1 }, { unique: true });
  return settingsCollection;
}

module.exports = { getSettingsCollection };
