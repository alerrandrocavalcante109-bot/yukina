const DEFAULT_PREFIX = '!';

function getPrefix() {
  const configured = process.env.PREFIX?.trim();
  return configured || DEFAULT_PREFIX;
}

function resolvePrefixCommand(commands, commandName) {
  if (!commandName) return null;

  const normalizedName = commandName.toLowerCase();

  for (const command of commands.values()) {
    if (command?.data?.name === normalizedName && command?.prefix?.execute) {
      return command;
    }

    if (
      Array.isArray(command?.prefix?.aliases) &&
      command.prefix.aliases.some(
        (alias) => String(alias).toLowerCase() === normalizedName,
      ) &&
      command?.prefix?.execute
    ) {
      return command;
    }
  }

  return null;
}

async function handlePrefixMessage(message, commands) {
  if (message.author.bot || !message.guild) return false;

  const prefix = getPrefix();
  if (!message.content.startsWith(prefix)) return false;

  const content = message.content.slice(prefix.length).trim();
  if (!content) return true;

  const parts = content.split(/\s+/);
  const commandName = parts.shift()?.toLowerCase();
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
