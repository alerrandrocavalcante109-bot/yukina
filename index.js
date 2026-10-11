require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { deployCommands } = require('./deploy-commands');
const { startAeternusUpdater } = require('./aeternus-updater');
const { startYukinaUpdater } = require('./yukina-updater');

if (!process.env.DISCORD_TOKEN) {
  console.error('[Yukina] DISCORD_TOKEN não foi definido no ambiente.');
  process.exit(1);
}

const prefix = process.env.PREFIX || '!';

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
  console.log('────────────────────────────────────');
  console.log(`[Yukina] 🟢 Bot online: ${readyClient.user.tag}`);
  console.log(`[Yukina] Comandos carregados: ${client.commands.size}`);
  console.log(`[Yukina] Prefixo: ${prefix}`);
  console.log(`[Yukina] Comandos carregados: ${client.commands.size}`);
  console.log(`[Yukina] Latência do gateway: ${Math.round(readyClient.ws.ping)} ms`);
  console.log('────────────────────────────────────');
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

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = client.commands.get(commandName);
  if (!command?.prefix?.execute) return;

  try {
    await command.prefix.execute(message, args);
  } catch (error) {
    console.error(`[Yukina] Erro no comando de prefixo ${prefix}${commandName}:`, error);
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
    // Um erro de deploy não impede o bot de iniciar com os comandos já registrados.
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
