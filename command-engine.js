/**
 * Motor central de comandos Yukina: módulos em commands/ podem exportar
 * execute(interaction) para Slash e prefixExecute(message, args, client) para Y/y.
 */
const fs = require("node:fs");
const path = require("node:path");
const PREFIXES = ["Y", "y"];
function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(file);
    return entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_") ? [file] : [];
  });
}
function loadCommands(client) {
  client.commands = client.commands || new Map();
  for (const file of findFiles(path.join(__dirname, "commands"))) {
    try {
      delete require.cache[require.resolve(file)];
      const command = require(file);
      const name = command?.data?.name || command?.name;
      if (!name || typeof command.execute !== "function") {
        console.warn(`⚠️ [Motor] Módulo ignorado: ${path.relative(__dirname, file)}`);
        continue;
      }
      if (client.commands.has(name)) {
        console.warn(`⚠️ [Motor] Comando duplicado ignorado: ${name}`);
        continue;
      }
      client.commands.set(name, command);
      console.log(`🌙 [SLASH] /${name} — carregado pelo motor`);
    } catch (error) {
      console.error(`❌ [Motor] Falha ao carregar ${path.relative(__dirname, file)}:`, error);
    }
  }
}
function startPrefixEngine(client) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    const prefix = PREFIXES.find((value) => message.content.startsWith(value));
    if (!prefix) return;
    const body = message.content.slice(prefix.length).trim();
    if (!body) return;
    const [rawName, ...args] = body.split(/\s+/);
    const name = rawName.toLowerCase();
    const entry = [...client.commands.entries()].find(([key, cmd]) =>
      key.toLowerCase() === name || (cmd.aliases || []).some((alias) => String(alias).toLowerCase() === name)
    );
    if (!entry) return;
    const [commandName, command] = entry;
    const executePrefix = command.prefixExecute || command.executePrefix;
    if (typeof executePrefix !== "function") {
      await message.reply("🌙 Este comando ainda não possui execução por prefixo.");
      return;
    }
    // Indicador nativo de digitação para todos os comandos de prefixo.
    await message.channel.sendTyping().catch(() => {});
    const typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => {});
    }, 8000);
    try {
      await executePrefix(message, args, client);
    } catch (error) {
      console.error(`❄️ [Motor] Erro em ${prefix}${commandName}:`, error);
      await message.reply("🫧 Não consegui executar esse comando. Confira as permissões e tente novamente.").catch(() => {});
    } finally {
      clearInterval(typingInterval);
    }
  });
}
module.exports = function startCommandEngine(client) {
  loadCommands(client);
  startPrefixEngine(client);
  const all = [...client.commands.entries()];
  const slash = all.filter(([, c]) => c?.data?.name).map(([, c]) => `/${c.data.name}`);
  const prefix = all.filter(([, c]) => typeof c.prefixExecute === "function" || typeof c.executePrefix === "function")
    .map(([name, c]) => `${c.prefix || "Y"}${name}`);
  console.log("");
  console.log("╭──────────── ❄️ MOTOR DE COMANDOS ❄️ ────────────╮");
  console.log(slash.length ? `🌙 Slash (${slash.length}): ${slash.join(", ")}` : "🌙 Slash: nenhum comando carregado.");
  console.log(prefix.length ? `⌨️ Prefixo Y/y (${prefix.length}): ${prefix.join(", ")}` : "⌨️ Prefixo Y/y: nenhum handler prefixado nos módulos.");
  console.log("╰─────────────────────────────────────────────────╯");
  console.log("");
};
