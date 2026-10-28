"use strict";

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

const COLOR = 0xA9DDF5;
const CATEGORY_ORDER = [
  { key: "geral", label: "🌸 Geral", description: "Comandos básicos e informações", match: /ajuda|help|ping|info|sobre|avatar|server|servidor|convite|say|dizer/i },
  { key: "diversao", label: "🎮 Jogos e diversão", description: "Jogos, brincadeiras e interação", match: /jogo|game|waifu|domino|forca|quiz|ship|beijo|abraco|abraço|cafune|carinho|meme|sorte|coin|cara|coroa/i },
  { key: "economia", label: "💴 Economia", description: "Kizunas, carteira e banco", match: /saldo|banco|deposit|sacar|transfer|pagar|emprest|loan|work|trabalh|daily|colet|loja|comprar|vender|invent|econom|kizuna|sonho/i },
  { key: "progressao", label: "📈 Níveis e atividade", description: "XP, rank e progresso", match: /rank|ranking|nivel|nível|xp|level|tempo|hierarquia|top|leaderboard/i },
  { key: "moderacao", label: "🛡️ Moderação", description: "Ferramentas de moderação", match: /ban|kick|mute|timeout|warn|aviso|clear|limpar|purge|modera|castigo|expuls/i },
  { key: "painel", label: "⚙️ Servidor e painel", description: "Configurações e sistemas do servidor", match: /painel|config|prefix|canal|cargo|role|promo|staff|ticket|contagem|count|sorteio|giveaway/i },
  { key: "vip", label: "🎟️ VIP e recompensas", description: "Planos, benefícios e recompensas", match: /vip|plano|daily|recompensa|bonus|bônus|multiplicador/i },
];

function getCategory(command) {
  const name = String(command?.data?.name || command?.name || "").toLowerCase();
  const description = String(command?.data?.description || "");
  const text = name + " " + description;
  for (const category of CATEGORY_ORDER) {
    if (category.match.test(text)) return category.key;
  }
  return "outros";
}

function getCategories(commands) {
  const grouped = new Map(CATEGORY_ORDER.map(category => [category.key, []]));
  grouped.set("outros", []);
  for (const [name, command] of commands) {
    if (!command || typeof command.execute !== "function") continue;
    grouped.get(getCategory(command)).push({ name, command });
  }
  const categories = CATEGORY_ORDER.filter(category => grouped.get(category.key).length > 0);
  if (grouped.get("outros").length) {
    categories.push({ key: "outros", label: "❄️ Outros", description: "Outros comandos disponíveis" });
  }
  return { grouped, categories };
}

function buildHelpPayload(commands, selectedKey = null) {
  const { grouped, categories } = getCategories(commands);
  const selected = categories.find(category => category.key === selectedKey);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: "Yukina · Biblioteca de Comandos" })
    .setTitle(selected ? selected.label + " — Comandos" : "❄️ Como posso ajudar?")
    .setDescription(selected
      ? selected.description + "\n\n" + grouped.get(selected.key).map(({ name, command }) => {
          const description = String(command?.data?.description || "Sem descrição cadastrada.");
          return "**/" + name + "** · `Y" + name + "`\n" + description;
        }).join("\n\n").slice(0, 3900)
      : "Bem-vindo à biblioteca da Yukina! 🌙\nEscolha uma categoria no menu abaixo para explorar os comandos disponíveis.\n\n" +
        categories.map(category => {
          const count = grouped.get(category.key).length;
          return category.label + " — **" + count + "** comando" + (count === 1 ? "" : "s");
        }).join("\n"))
    .setFooter({ text: "Use /comando ou Ycomando · Selecione uma categoria para continuar." })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId("yukina-help-category")
    .setPlaceholder("🌸 Escolha uma categoria de comandos")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(categories.slice(0, 25).map(category => ({
      label: category.label.replace(/^\S+\s/, "").slice(0, 100),
      value: category.key,
      description: category.description.slice(0, 100),
      emoji: category.label.split(" ")[0],
      default: category.key === selectedKey,
    })));

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
    allowedMentions: { parse: [] },
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Abre a biblioteca da Yukina com categorias de comandos."),
  aliases: ["help", "comandos", "comando"],
  async execute(interaction) {
    return interaction.reply({
      ...buildHelpPayload(interaction.client.commands || new Map()),
      flags: MessageFlags.Ephemeral,
    });
  },
  async prefixExecute(message) {
    return message.channel.send(buildHelpPayload(message.client.commands || new Map()));
  },
  buildHelpPayload,
};