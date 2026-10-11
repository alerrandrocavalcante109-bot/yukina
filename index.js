require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { deployCommands } = require('./deploy-commands');
const { startAeternusUpdater } = require('./aeternus-updater');
const { startYukinaUpdater } = require('./yukina-updater');
const { getPrefix, handlePrefixMessage } = require('./prefix');

if (!process.env.DISCORD_TOKEN) {
  console.error('[Yukina] DISCORD_TOKEN não foi definido no ambiente.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

const commandFiles = fs.readdirSync(commandsPath)
  .filter((name) => name.endsWith('.js'))
  .sort((a, b) => a.localeCompare(b));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    const resolvedPath = require.resolve(filePath);
    delete require.cache[resolvedPath];
    const command = require(resolvedPath);

    if (!command?.data?.name) {
      console.warn(`[Yukina] Comando ignorado: ${file} não exporta data.name.`);
      continue;
    }

    if (typeof command.execute !== 'function' &&
        typeof command.prefix?.execute !== 'function') {
      console.warn(`[Yukina] Comando ignorado: ${file} não possui execute nem prefix.execute.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    const prefixReady = typeof command.prefix?.execute === 'function';
    console.log(
      `[Yukina] Comando carregado: /${command.data.name}${prefixReady ? ' + prefixo' : ' (sem prefixo)'}`,
    );
  } catch (error) {
    console.error(`[Yukina] Falha ao carregar ${file}:`, error);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log('────────────────────────────────────');
  console.log(`[Yukina] 🟢 Bot online: ${readyClient.user.tag}`);
  console.log(`[Yukina] Comandos carregados: ${client.commands.size}`);
  console.log(`[Yukina] Prefixo ativo: ${getPrefix()}`);
  console.log(`[Yukina] Comandos com prefixo: ${[...client.commands.values()].filter((command) => typeof command.prefix?.execute === 'function').length}`);
  console.log(`[Yukina] Latência do gateway: ${Math.round(readyClient.ws.ping)} ms`);
  console.log('────────────────────────────────────');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command || typeof command.execute !== 'function') {
    await interaction.reply({
      content: 'Este comando não está disponível por slash nesta instância.',
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

client.on(Events.MessageCreate, async (message) => {
  try {
    await handlePrefixMessage(message, client.commands);
  } catch (error) {
    console.error('[Yukina] Falha no sistema de prefixo:', error);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Yukina] Promise rejeitada sem tratamento:', reason);
});

async function startBot() {
  try {
    console.log('[Yukina] Iniciando deploy automático dos comandos...');
    await deployCommands();
  } catch (error) {
    console.error('[Yukina] Deploy automático falhou; tentando iniciar mesmo assim:', error);
  }

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('[Yukina] Não foi possível conectar ao Discord:', error);
    process.exitCode = 1;
  }
}

startBot();
startAeternusUpdater();
startYukinaUpdater();
