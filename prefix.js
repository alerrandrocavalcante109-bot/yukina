const DEFAULT_PREFIX = 'Y';

function getPrefix() {
  // PREFIX é reservado pelo próprio Termux; não o use para configuração do bot.
  const configured = String(process.env.YUKINA_PREFIX ?? '').trim();
  return configured || DEFAULT_PREFIX;
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function resolvePrefixCommand(commands, commandName) {
  const normalizedName = normalizeName(commandName);
  if (!normalizedName || !commands) return null;

  for (const command of commands.values()) {
    if (typeof command?.prefix?.execute !== 'function') continue;

    const names = [
      command?.data?.name,
      command?.prefix?.name,
      ...(Array.isArray(command?.prefix?.aliases) ? command.prefix.aliases : []),
    ].map(normalizeName).filter(Boolean);

    if (names.includes(normalizedName)) return command;
  }

  return null;
}

async function handlePrefixMessage(message, commands) {
  if (!message || message.author?.bot || !message.guild) return false;

  const prefix = getPrefix();
  const content = String(message.content ?? '');

  if (!content.slice(0, prefix.length).toLowerCase().startsWith(prefix.toLowerCase())) {
    return false;
  }

  const commandText = content.slice(prefix.length).trim();
  if (!commandText) return true;

  const parts = commandText.split(/\s+/);
  const commandName = parts.shift();
  const args = parts;
  const command = resolvePrefixCommand(commands, commandName);

  if (!command) {
    console.warn(`[Yukina] Comando de prefixo não encontrado: ${prefix}${commandName}`);
    return true;
  }

  try {
    await command.prefix.execute(message, args);
  } catch (error) {
    console.error(`[Yukina] Erro no comando de prefixo ${prefix}${commandName}:`, error);
    await message.reply('Ocorreu um erro ao executar esse comando.').catch(() => {});
  }

  return true;
}

module.exports = {
  DEFAULT_PREFIX,
  getPrefix,
  resolvePrefixCommand,
  handlePrefixMessage,
};
