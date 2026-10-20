const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const YUKINA_BLUE = 0xA7D8F0;

function yukinaEmbed(text) {
  return new EmbedBuilder()
    .setColor(YUKINA_BLUE)
    .setTitle("💬 Mensagem")
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
        .setMinLength(1)
        .setMaxLength(6000)
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName("arquivo")
        .setDescription("Arquivo .txt para enviar textos muito longos.")
        .setRequired(false)
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

    const text = cleanMessage(interaction.options.getString("mensagem") || "");
    const file = interaction.options.getAttachment("arquivo");
    const useEmbed = interaction.options.getBoolean("embed") ?? false;
    if ((!text && !file) || (text && file)) {
      return interaction.reply({
        content: "📝 Informe um texto com pelo menos 1 caractere ou anexe um arquivo .txt — escolha apenas uma opção.",
        ephemeral: true,
      });
    }

    try {
      if (file) {
        if (!file.name.toLowerCase().endsWith(".txt")) {
          return interaction.reply({ content: "📄 O anexo precisa ser um arquivo .txt.", ephemeral: true });
        }
        if (file.size > 10 * 1024 * 1024) {
          return interaction.reply({ content: "📦 O arquivo excede o limite de 10 MB.", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const response = await fetch(file.url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("Falha ao baixar o arquivo: HTTP " + response.status);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0) return interaction.editReply("📝 O arquivo está vazio; envie pelo menos 1 caractere.");
        if (buffer.length > 10 * 1024 * 1024) return interaction.editReply("📦 O arquivo excede o limite de 10 MB.");
        await interaction.channel.send({ files: [new AttachmentBuilder(buffer, { name: file.name })], allowedMentions: { parse: [] } });
        return interaction.editReply("❄️ Arquivo enviado! (" + buffer.length.toLocaleString("pt-BR") + " bytes)");
      }

      await interaction.channel.send(
        useEmbed
          ? { embeds: [yukinaEmbed(text.slice(0, 4096))], allowedMentions: { parse: [] } }
          : { content: text, allowedMentions: { parse: [] } }
      );
      return interaction.reply({
        content: useEmbed && text.length > 4096
          ? "❄️ Embed enviado; o texto foi limitado a 4.096 caracteres pelo limite do Discord."
          : useEmbed ? "❄️ Mensagem enviada em embed!" : "🌙 Mensagem enviada em texto!",
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
      await message.delete().catch(() => {});
    } catch (error) {
      console.error("[Yukina Ysay]", error);
      await message.channel.send("💧 Não consegui enviar a mensagem. Confira minhas permissões de enviar mensagens e incorporar links.").catch(() => {});
    }
  },
};
