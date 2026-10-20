require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const token = (process.env.DISCORD_TOKEN || "").trim();
const clientId = (process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || "").trim();
const guildId = (process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "").trim();

if (!token || !clientId) {
  console.error("Defina DISCORD_TOKEN e DISCORD_CLIENT_ID (ou CLIENT_ID) antes de registrar os comandos.");
  process.exit(1);
}

const removedModerationCommands = new Set(["cargo", "clear", "deletar", "limpar", "lock", "log", "moderar", "promover", "unlock"]);

const commandsDir = path.join(__dirname, "commands");
const commands = [];
function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_")) {
      const command = require(file);
      if (command?.data?.toJSON && typeof command.execute === "function") commands.push(command.data.toJSON());
    }
  }
}
collect(commandsDir);

const rest = new REST({ version: "10" }).setToken(token);
(async () => {
  try {
    const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
    const existing = await rest.get(route);
    const merged = new Map((Array.isArray(existing) ? existing : []).filter((command) => !removedModerationCommands.has(command.name)).map((command) => [command.name, command]));
    for (const command of commands) merged.set(command.name, command);
    const result = await rest.put(route, { body: [...merged.values()] });
    console.log("Yukina: " + commands.length + " comando(s) local(is) sincronizado(s); " + result.length +
      " comando(s) no total " + (guildId ? "no servidor " + guildId : "globalmente") + ".");
  } catch (error) {
    console.error("Falha ao registrar comandos slash:", error);
    process.exitCode = 1;
  }
})();
