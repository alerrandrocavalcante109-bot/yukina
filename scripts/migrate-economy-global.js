"use strict";

require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const COLLECTION = "economy_balances";

async function main() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");

  const client = new MongoClient(MONGODB_URI, {
    appName: "Yukina-Global-Economy-Migration",
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const balances = db.collection(COLLECTION);
    const docs = await balances.find({}).toArray();

    if (!docs.length) {
      console.log("[Migração KZ] Coleção vazia. Criando índice global por userId.");
      await balances.createIndex({ userId: 1 }, { unique: true, name: "unique_global_user_balance" });
      return;
    }

    const invalid = docs.filter(doc => !/^\\d{15,22}$/.test(String(doc.userId || "")));
    if (invalid.length) {
      throw new Error("Existem registros sem userId Discord válido. Nenhum dado foi alterado.");
    }

    const seen = new Set();
    const duplicates = [];
    for (const doc of docs) {
      const userId = String(doc.userId);
      if (seen.has(userId)) duplicates.push(userId);
      seen.add(userId);
    }
    if (duplicates.length) {
      throw new Error("Há mais de um saldo para o mesmo usuário. Nenhum dado foi alterado. IDs duplicados: " +
        [...new Set(duplicates)].join(", "));
    }

    const backupName = COLLECTION + "_backup_global_" + new Date().toISOString().replace(/[:.]/g, "-");
    await db.collection(backupName).insertMany(docs);
    console.log("[Migração KZ] Backup criado:", backupName);

    const indexes = await balances.indexes();
    for (const index of indexes) {
      if (index.name !== "_id_" && index.key && Object.prototype.hasOwnProperty.call(index.key, "guildId")) {
        await balances.dropIndex(index.name);
      }
    }

    await balances.updateMany({}, { $unset: { guildId: "" } });
    await balances.createIndex({ userId: 1 }, { unique: true, name: "unique_global_user_balance" });

    console.log("[Migração KZ] Concluída. Carteiras migradas:", docs.length);
    console.log("[Migração KZ] Novo formato: { userId, balance, createdAt, updatedAt }");
    console.log("[Migração KZ] Backup preservado em:", backupName);
    console.log("[Migração KZ] Atualize os comandos para consultar somente userId antes de reativar a economia.");
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error("[Migração KZ] Falha:", error.message || error);
  process.exitCode = 1;
});
