require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

if (!process.env.DISCORD_TOKEN) {
  console.error('[Yukina] DISCORD_TOKEN não foi definido no ambiente.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

for (const file of fs.readdirSync(commandsPath).filter((name) => name.endsWith('.js'))) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`[Yukina] Comando ignorado: ${file} não exporta data e execute.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    console.log(`[Yukina] Comando carregado: /${command.data.name}`);
  } catch (error) {
    console.error(`[Yukina] Falha ao carregar ${file}:`, error);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Yukina] Online como ${readyClient.user.tag}`);
  console.log(`[Yukina] Comandos carregados: ${client.commands.size}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: 'Este comando não está disponível nesta instância.',
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Yukina] Erro em /${interaction.commandName}:`, error);

    const payload = {
      content: 'Não foi possível concluir o comando. Tente novamente em instantes.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Yukina] Promise rejeitada sem tratamento:', reason);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[Yukina] Não foi possível conectar ao Discord:', error);
  process.exitCode = 1;
});
