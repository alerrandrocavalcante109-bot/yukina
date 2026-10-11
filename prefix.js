const DEFAULT_PREFIX = '!';

function getPrefix() {
  const configured = process.env.PREFIX?.trim();
  return configured || DEFAULT_PREFIX;
}

function resolvePrefixCommand(commands, commandName) {
  if (!commandName) return null;

  const normalizedName = String(commandName).trim().toLowerCase();

  for (const command of commands.values()) {
    const commandDataName = String(command?.data?.name || '').trim().toLowerCase();

    if (commandDataName === normalizedName && command?.prefix?.execute) {
      return command;
    }

    if (
      Array.isArray(command?.prefix?.aliases) &&
      command.prefix.aliases.some(
        (alias) =>
          String(alias).trim().toLowerCase() === normalizedName,
      ) &&
      command?.prefix?.execute
    ) {
      return command;
    }
  }

  return null;
}

async function handlePrefixMessage(message, commands) {
  if (message.author?.bot || !message.guild) return false;

  const prefix = getPrefix();
  const content = String(message.content || '');

  if (!content.startsWith(prefix)) return false;

  const commandText = content.slice(prefix.length).trim();
  if (!commandText) return true;

  const parts = commandText.split(/s+/);
  const commandName = parts.shift();
  const args = parts;

  const command = resolvePrefixCommand(commands, commandName);
  if (!command) return true;

  try {
    await command.prefix.execute(message, args);
  } catch (error) {
    console.error(
      `[Yukina] Erro no comando de prefixo ${prefix}${commandName}:`,
      error,
    );
  }

  return true;
}

module.exports = {
  DEFAULT_PREFIX,
  getPrefix,
  resolvePrefixCommand,
  handlePrefixMessage,
};
