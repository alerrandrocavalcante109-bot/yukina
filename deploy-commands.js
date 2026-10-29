require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const token = (process.env.TOKEN || process.env.DISCORD_TOKEN || "").trim();
const clientId = (process.env.DISCORD_CLIENT_ID || "").trim();
const guildId = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "").trim();

if (!token || !clientId) {
  console.error("Defina TOKEN (ou DISCORD_TOKEN) e DISCORD_CLIENT_ID antes de registrar os comandos.");
  process.exit(1);
}

const commandsDir = path.join(__dirname, "commands");
const commandsByName = new Map();
const invalidFiles = [];

function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(file);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".js") || entry.name.startsWith("_")) continue;
    try {
      const command = require(file);
      if (!command?.data?.toJSON || typeof command.execute !== "function") continue;
      const payload = command.data.toJSON();
      if (!payload?.name || typeof payload.name !== "string") throw new Error("Definição slash sem nome válido.");
      if (commandsByName.has(payload.name)) {
        throw new Error("Nome slash duplicado também declarado em " + commandsByName.get(payload.name).file);
      }
      commandsByName.set(payload.name, { payload, file: path.relative(__dirname, file) });
    } catch (error) {
      invalidFiles.push({ file: path.relative(__dirname, file), message: error.message });
    }
  }
}

collect(commandsDir);
for (const item of invalidFiles) {
  console.error("[Slash] Módulo ignorado/duplicado: " + item.file + " — " + item.message);
}

const commands = [...commandsByName.values()].map(item => item.payload);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);
const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    // Substitui integralmente os comandos do escopo selecionado e remove os antigos.
    const result = await rest.put(route, { body: commands });
    console.log("Sincronização limpa: " + result.length + " comando(s) registrados; " +
      commands.length + " comando(s) válidos encontrados no código.");
    console.log("Publicados: " + (commands.map(command => "/" + command.name).join(", ") || "nenhum"));
    if (invalidFiles.length) console.warn("Revise " + invalidFiles.length + " aviso(s) de arquivos inválidos/duplicados.");
  } catch (error) {
    console.error("Falha ao registrar comandos slash:", error);
    process.exitCode = 1;
  }
})();
