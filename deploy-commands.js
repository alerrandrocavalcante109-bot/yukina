require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('[Yukina] Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env.');
  process.exit(1);
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.existsSync(commandsPath)
  ? fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))
  : [];

const commands = [];

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (!command.data || typeof command.data.toJSON !== 'function') {
      console.warn(`[Yukina] Ignorando ${file}: definição inválida.`);
      continue;
    }
    commands.push(command.data.toJSON());
  } catch (error) {
    console.error(`[Yukina] Falha ao ler ${file}:`, error);
    process.exit(1);
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    console.log(`[Yukina] Registrando ${commands.length} comando(s) ${GUILD_ID ? 'no servidor de teste' : 'globalmente'}...`);
    await rest.put(route, { body: commands });
    console.log('[Yukina] Registro de comandos concluído.');
  } catch (error) {
    console.error('[Yukina] Falha ao registrar comandos:', error);
    process.exitCode = 1;
  }
})();
