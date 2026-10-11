require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

async function deployCommands() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error('Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env.');
  }

  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.existsSync(commandsPath)
    ? fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))
    : [];

  const commands = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if (!command.data || typeof command.data.toJSON !== 'function') {
      console.warn(`[Yukina] Ignorando ${file}: definição inválida.`);
      continue;
    }

    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  console.log(`[Yukina] Registrando ${commands.length} comando(s) ${GUILD_ID ? 'no servidor de teste' : 'globalmente'}...`);
  await rest.put(route, { body: commands });
  console.log('[Yukina] Deploy dos comandos concluído.');

  return commands.length;
}

if (require.main === module) {
  deployCommands().catch((error) => {
    console.error('[Yukina] Falha no deploy dos comandos:', error);
    process.exitCode = 1;
  });
}

module.exports = { deployCommands };
