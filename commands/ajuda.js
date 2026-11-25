"use strict";

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getUserLanguage } = require("../systems/idioma");
const { getMessage } = require("../systems/idioma/locales/help");

const COLOR = 0xA9DDF5;
const CATEGORY_ORDER = [
  { key: "[ geral ]", match: /ajuda|help|ping|info|sobre|avatar|server|servidor|convite|say|dizer/i },
  { key: "[ diversao ]", match: /jogo|game|forca|quiz|ship|beijo|abraco|abraço|cafune|carinho|meme|sorte|coin|cara|coroa/i },
  { key: "[ economia ]", match: /saldo|transfer|pagar|work|trabalh|daily|colet|loja|comprar|vender|invent|econom|kizuna|sonho/i },
  { key: "[ progressão ]", match: /rank|ranking|nivel|nível|xp|level|tempo|hierarquia|top|leaderboard/i },
  { key: "[ moderação ]", match: /ban|kick|mute|timeout|warn|aviso|clear|limpar|purge|modera|castigo|expuls/i },
  { key: "[ painel ]", match: /painel|config|prefix|canal|cargo|role|promo|staff|ticket|contagem|count|sorteio|giveaway/i },
  { key: "[ vip ]", match: /vip|plano|daily|recompensa|bonus|bônus|multiplicador/i },
];
const CATEGORY_KEYS = ["[ geral ]", "[ diversao ]", "[ economia ]", "[ progressão ]", "[ moderação ]", "[ painel ]", "[ vip ]"];

function getCategory(command) {
  const name = String(command?.data?.name || command?.name || "").toLowerCase();
  const description = String(command?.data?.description || "");
  const text = name + " " + description;
  for (const category of CATEGORY_ORDER) if (category.match.test(text)) return category.key;
  return "outros";
}

function getCategories(commands, language = "pt-BR") {
  const grouped = new Map([...CATEGORY_KEYS, "outros"].map(key => [key, []]));
  for (const [name, command] of commands) {
    if (!command || typeof command.execute !== "function") continue;
    const categoryKey = getCategory(command);
    const bucket = grouped.get(categoryKey) || grouped.get("outros");
    bucket.push({ name, command });
  }
  const categories = CATEGORY_KEYS.filter(key => grouped.get(key).length > 0).map(key => ({
    key, label: getMessage(language, key + "Label"), description: getMessage(language, key + "Description"),
  }));
  if (grouped.get("outros").length) categories.push({
    key: "outros", label: getMessage(language, "outrosLabel"), description: getMessage(language, "outrosDescription"),
  });
  return { grouped, categories };
}

function buildHelpPayload(commands, selectedKey = null, language = "pt-BR") {
  const { grouped, categories } = getCategories(commands, language);
  const selected = categories.find(category => category.key === selectedKey);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · " + getMessage(language, "commandsLabel") })
    .setTitle(selected ? selected.label + " — " + getMessage(language, "commandsLabel") : getMessage(language, "title"))
    .setDescription(selected
      ? selected.description + "\n\n" + grouped.get(selected.key).map(({ name, command }) => {
          const description = String(command?.data?.description || getMessage(language, "noDescription"));
          return "**/" + name + "** · `Y" + name + "`\n" + description;
        }).join("\n\n").slice(0, 3900)
      : getMessage(language, "overview") + "\n\n" + categories.map(category => {
          const count = grouped.get(category.key).length;
          return category.label + " — **" + count + "** " + getMessage(language, count === 1 ? "singular" : "plural");
        }).join("\n"))
    .setFooter({ text: getMessage(language, "footer") })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId("yukina-help-category")
    .setPlaceholder(getMessage(language, "placeholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(categories.slice(0, 25).map(category => ({
      label: category.label.replace(/^\S+\s/, "").slice(0, 100),
      value: category.key,
      description: category.description.slice(0, 100),
      emoji: category.label.split(" ")[0],
      default: category.key === selectedKey,
    })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], allowedMentions: { parse: [] } };
}

module.exports = {
  data: new SlashCommandBuilder().setName("ajuda").setDescription("Abre a biblioteca da Yukina com categorias de comandos."),
  aliases: ["help", "comandos", "comando"],
  async execute(interaction) {
    const language = await getUserLanguage(interaction.user.id);
    return interaction.reply({ ...buildHelpPayload(interaction.client.commands || new Map(), null, language) });
  },
  async prefixExecute(message) {
    const language = await getUserLanguage(message.author.id);
    return message.channel.send(buildHelpPayload(message.client.commands || new Map(), null, language));
  },
  buildHelpPayload,
};
