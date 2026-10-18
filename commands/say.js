const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const YUKINA_BLUE = 0xA7D8F0;

function yukinaEmbed(text) {
  return new EmbedBuilder()
    .setColor(YUKINA_BLUE)
    .setDescription(text)
    .setFooter({ text: "Yukina · Cuidando deste cantinho" })
    .setTimestamp();
}

function cleanMessage(value) {
  return String(value || "").trim();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz a Yukina enviar uma mensagem.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("Texto que a Yukina vai enviar.")
        .setMaxLength(2000)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName("embed")
        .setDescription("Enviar a mensagem em um embed azul-claro.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.channel || !interaction.channel.isTextBased()) {
      return interaction.reply({
        content: "❄️ Só posso enviar mensagens em um canal de texto do servidor.",
        ephemeral: true,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "🔒 Você precisa da permissão **Gerenciar mensagens** para usar este comando.",
        ephemeral: true,
      });
    }

    const text = cleanMessage(interaction.options.getString("mensagem", true));
    const useEmbed = interaction.options.getBoolean("embed") ?? false;
    if (!text) {
      return interaction.reply({ content: "📝 Escreva a mensagem que deseja enviar.", ephemeral: true });
    }

    try {
      await interaction.channel.send(
        useEmbed
          ? { embeds: [yukinaEmbed(text)], allowedMentions: { parse: [] } }
          : { content: text, allowedMentions: { parse: [] } }
      );
      return interaction.reply({
        content: useEmbed ? "❄️ Mensagem enviada em embed!" : "🌙 Mensagem enviada em texto!",
        ephemeral: true,
      });
    } catch (error) {
      console.error("[Yukina /say]", error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: "💧 Não consegui enviar. Confira minhas permissões de enviar mensagens e incorporar links.", ephemeral: true }).catch(() => {});
      }
      return interaction.reply({
        content: "💧 Não consegui enviar. Confira minhas permissões de enviar mensagens e incorporar links.",
        ephemeral: true,
      });
    }
  },

  async prefixExecute(message, args = []) {
    if (!message.guild || !message.channel) {
      return message.reply("❄️ Este comando só funciona dentro de um servidor.");
    }

    if (!message.member?.permissions?.has(PermissionFlagsBits.ManageMessages) &&
        !message.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return message.reply("🔒 Você precisa da permissão **Gerenciar mensagens** para usar este comando.");
    }

    const first = String(args[0] || "").toLowerCase();
    const useEmbed = first === "embed";
    const text = cleanMessage((useEmbed ? args.slice(1) : args).join(" "));
    if (!text) {
      return message.reply("📝 Use `Ysay sua mensagem` para texto normal ou `Ysay embed sua mensagem` para embed.");
    }

    try {
      await message.channel.send(
        useEmbed
          ? { embeds: [yukinaEmbed(text)], allowedMentions: { parse: [] } }
          : { content: text, allowedMentions: { parse: [] } }
      );
      // Apaga a mensagem que invocou o comando depois que o envio foi concluído.
      await message.delete().catch(() => {});
    } catch (error) {
      console.error("[Yukina Ysay]", error);
      await message.channel.send("💧 Não consegui enviar a mensagem. Confira minhas permissões de enviar mensagens e incorporar links.").catch(() => {});
    }
  },
};
