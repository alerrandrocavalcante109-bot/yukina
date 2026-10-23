/**
 * Carrega e executa os comandos personalizados salvos pelo painel da Yukina.
 * O prefixo segue o motor atual: Y ou y (ex.: Yregras).
 */
const { EmbedBuilder } = require("discord.js");

const PREFIXES = ["Y", "y"];
const URL_PATTERN = /^https?:\/\//i;

function safeUrl(value) {
  const url = String(value || "").trim();
  return URL_PATTERN.test(url) ? url : null;
}

function renderEmbed(item) {
  const embed = new EmbedBuilder();
  const title = String(item?.title || "").trim().slice(0, 256);
  const description = String(item?.message ?? item?.description ?? "").trim().slice(0, 4096);
  const colorText = String(item?.color || "#A7D8F0");
  if (/^#[0-9a-f]{6}$/i.test(colorText)) embed.setColor(Number.parseInt(colorText.slice(1), 16));
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  const link = safeUrl(item?.link);
  const image = safeUrl(item?.image);
  if (link) embed.setURL(link);
  if (image) embed.setImage(image);
  return embed;
}

module.exports = function startCustomCommandEngine(client, getSettingsCollection) {
  if (client.__yukinaCustomCommandEngine) return;
  client.__yukinaCustomCommandEngine = true;

  client.on("messageCreate", async (message) => {
    if (message.author?.bot || !message.guild || !message.content) return;

    const prefix = PREFIXES.find((value) => message.content.startsWith(value));
    if (!prefix) return;

    const body = message.content.slice(prefix.length).trim();
    if (!body) return;
    const [rawName] = body.split(/\s+/);
    const name = String(rawName || "").toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) return;

    try {
      const collection = await getSettingsCollection();
      const doc = await collection.findOne(
        { guildId: message.guild.id },
        { projection: { "settings.customCommands": 1 } }
      );
      const commands = Array.isArray(doc?.settings?.customCommands)
        ? doc.settings.customCommands
        : [];
      const command = commands.find((item) =>
        String(item?.name || "").toLowerCase() === name
      );
      if (!command) return;

      const type = String(command.type || "text").toLowerCase();
      const allowedMentions = { parse: ["users", "roles", "everyone"], repliedUser: false };

      if (type === "text" || type === "texto" || type === "simple") {
        const text = String(command.message || "").trim().slice(0, 2000);
        if (!text) {
          await message.reply({ content: "❄️ Este comando personalizado ainda não tem uma mensagem.", allowedMentions: { parse: [] } });
          return;
        }
        await message.reply({ content: text, allowedMentions });
        console.log(`[Comandos personalizados] ${message.guild.id}: Y${name} executado por ${message.author.id}`);
        return;
      }

      if (type === "embed") {
        const items = Array.isArray(command.embeds) ? command.embeds.slice(0, 10) : [];
        const main = {
          title: command.title || "",
          message: command.message || "",
          color: command.color || command.embedColor || "#A7D8F0",
          link: command.link || command.embedLink || "",
          image: command.image || command.embedImage || "",
        };
        const sources = [main, ...items];
        const embeds = sources
          .map(renderEmbed)
          .filter((embed) => embed.data.title || embed.data.description || embed.data.image || embed.data.url)
          .slice(0, 10);
        if (!embeds.length) {
          await message.reply({ content: "❄️ Este comando embed ainda não tem conteúdo para enviar.", allowedMentions: { parse: [] } });
          return;
        }
        await message.reply({ embeds, allowedMentions });
        console.log(`[Comandos personalizados] ${message.guild.id}: Y${name} executado por ${message.author.id}`);
      }
    } catch (error) {
      console.error("[Comandos personalizados] Falha ao executar:", {
        guildId: message.guild.id,
        command: name,
        message: error?.message || String(error),
      });
      await message.reply({
        content: "🫧 Não consegui carregar esse comando agora. Tente novamente em instantes.",
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  });

  console.log("[Comandos personalizados] Executor conectado; comandos serão lidos do armazenamento do painel.");
};
