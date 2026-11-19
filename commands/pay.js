"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { MongoClient } = require("mongodb");
const crypto = require("node:crypto");

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const DEFAULT_PROPOSAL_MS = 6 * 60 * 1000;
let mongoClient = null;
let proposals = null;
let balances = null;

const PHRASE = "Uma nova troca foi proposta! Que este acordo seja marcado pela confiança e pelo respeito.";

async function getCollections() {
  if (proposals && balances) return { proposals, balances };
  if (!MONGODB_URI) throw new Error("MONGODB_URI não está configurada.");
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      appName: "Yukina-Pay",
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }
  await mongoClient.connect();
  const db = mongoClient.db(MONGODB_DB);
  proposals = db.collection("yukina_pay_proposals");
  balances = db.collection("economy_balances");
  await Promise.all([
    balances.createIndex(
      { guildId: 1, userId: 1 },
      { unique: true, name: "unique_guild_user_balance" }
    ),
    proposals.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 604800, name: "pay_proposal_ttl" }),
    proposals.createIndex({ guildId: 1, status: 1 }, { name: "pay_guild_status" }),
  ]);
  return { proposals, balances };
}

function format(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
}
function parseAmount(input, availableBalance, recipientCount) {
  const raw = String(input ?? "").trim().toLowerCase().replace(/,/g, ".");
  if (raw === "all" || raw === "half") {
    const fraction = raw === "all" ? 1 : 0.5;
    return Math.floor((Math.max(0, availableBalance) * fraction) / Math.max(1, recipientCount));
  }
  const match = raw.match(/^(\d+(?:\.\d+)?)(k|m|b|t)?$/i);
  if (!match) return NaN;
  const multipliers = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const amount = Number(match[1]) * (multipliers[(match[2] || "").toLowerCase()] || 1);
  if (!Number.isFinite(amount) || amount < 1 || amount > Number.MAX_SAFE_INTEGER) return NaN;
  return Math.floor(amount);
}

function buildRows(proposal, disabled = false, completed = false) {
  const count = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy.length : 0;
  const accept = new ButtonBuilder()
    .setCustomId("yukina-pay:accept:" + proposal.id)
    .setLabel(completed ? "Transferência concluída" : "Aceitar " + count + "/2")
    .setStyle(completed ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(disabled || completed);
  return [new ActionRowBuilder().addComponents(accept)];
}

function proposalText(proposal) {
  const timestamp = Math.floor(new Date(proposal.expiresAt).getTime() / 1000);
  return [
    "# 💸 Pagamento de Kizunas",
    "",
    "<@" + proposal.senderId + "> está prestes a transferir **" + format(proposal.amount) + "** <:1000008301:1572057568086335508> para <@" + proposal.recipientId + ">!",
    "",
    "**🏧 •** Para concluir a transferência, você e <@" + proposal.recipientId + "> precisam aceitar a transação clicando no botão abaixo.",
    "",
    "**⏳ •** Vocês têm até **<t:" + timestamp + ":F> (<t:" + timestamp + ":R>)** para aceitar a transferência!",
    "",
    "**⚠️ •** Não se esqueça: envie Kizunas apenas para pessoas confiáveis! Confira o destinatário e o valor antes de aceitar. Não aceite pagamentos de desconhecidos, não empreste Kizunas por promessas de devolução e desconfie de propostas suspeitas. Após a confirmação, a transação não poderá ser desfeita pela Yukina.",
    "",
    "**🌸 •** Eu não me responsabilizo por acordos particulares entre membros."
  ].join("\n");
}

async function editProposalMessage(client, proposal, content, components = []) {
  if (!proposal.channelId || !proposal.messageId) return;
  try {
    const channel = await client.channels.fetch(proposal.channelId);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(proposal.messageId);
    await message.edit({ content, components, allowedMentions: { parse: [] } });
  } catch (error) {
    console.warn("[Yukina Pay] Não consegui atualizar a mensagem da proposta:", error.message);
  }
}

async function expireProposal(client, proposalId) {
  try {
    const { proposals } = await getCollections();
    const now = new Date();
    const result = await proposals.updateOne(
      { id: proposalId, status: "pending", expiresAt: { $lte: now } },
      { $set: { status: "expired", closedAt: now } }
    );
    if (!result.modifiedCount) return;
    const proposal = await proposals.findOne({ id: proposalId });
    if (!proposal) return;
    await editProposalMessage(
      client,
      proposal,
      "🍃 **Yukina Pay · Proposta expirada**\nO momento da decisão passou. O prazo da proposta terminou e nenhuma Kizuna foi transferida.",
      []
    );
  } catch (error) {
    console.error("[Yukina Pay] Falha ao expirar proposta:", error.message || error);
  }
}

async function createProposals({ guild, sender, recipients, amountInput, autoAccept = false, durationMs = DEFAULT_PROPOSAL_MS, send, client }) {
  if (!guild) return send({ content: "🌸 O Yukina Pay só pode ser usado dentro de um servidor.", ephemeral: true });

  const uniqueRecipients = [];
  const seen = new Set();
  for (const recipient of recipients || []) {
    if (!recipient || recipient.bot || recipient.id === sender.id || seen.has(String(recipient.id))) continue;
    seen.add(String(recipient.id));
    uniqueRecipients.push(recipient);
  }
  if (!uniqueRecipients.length) {
    return send({
      content: "🏮 Mencione uma ou mais pessoas válidas do servidor. Não é possível enviar para si mesmo, para bots ou repetir o mesmo destinatário.",
      ephemeral: true,
    });
  }
  try {
    const { proposals: proposalCollection, balances: balanceCollection } = await getCollections();
    const validRecipients = [];
    for (const recipient of uniqueRecipients) {
      const member = await guild.members.fetch(recipient.id).catch(() => null);
      if (member) validRecipients.push(recipient);
    }
    if (!validRecipients.length) {
      return send({ content: "🏮 Nenhum dos destinatários informados é membro deste servidor.", ephemeral: true });
    }

    const senderBalance = await balanceCollection.findOne(
      { guildId: String(guild.id), userId: String(sender.id) },
      { projection: { balance: 1 } }
    );
    const available = Math.max(0, Number(senderBalance?.balance) || 0);
    const amount = parseAmount(amountInput, available, validRecipients.length);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return send({ content: "💴 Valor inválido. Use 1500, 1.5k, 2m, 3b, 1t, all ou half.", ephemeral: true });
    }
    const total = amount * validRecipients.length;
    if (!Number.isSafeInteger(total)) {
      return send({ content: "💴 O total da transferência é muito alto. Reduza o valor ou a quantidade de destinatários.", ephemeral: true });
    }
    if (available < total) {
      return send({
        content: "🌸 <@" + sender.id + ">, suas Kizunas não são suficientes para iniciar esta troca.\n\n" +
          "💴 **Necessário:** " + format(total) + " KZ\n" +
          "💰 **Seu saldo:** " + format(available) + " KZ\n" +
          "🏮 **Falta:** " + format(total - available) + " KZ\n\n" +
          "O valor é calculado para todas as propostas: " + validRecipients.length + " pessoa(s), com " + format(amount) + " KZ para cada uma.",
        ephemeral: true,
      });
    }

    // Cada destinatário recebe sua própria proposta, mensagem, contador e prazo.
    for (let index = 0; index < validRecipients.length; index++) {
      const recipient = validRecipients[index];
      const now = new Date();
      const proposal = {
        id: crypto.randomUUID(),
        guildId: String(guild.id),
        senderId: String(sender.id),
        recipientId: String(recipient.id),
        amount,
        batchSize: validRecipients.length,
        batchIndex: index + 1,
        acceptedBy: autoAccept ? [String(sender.id)] : [],
        status: "pending",
        createdAt: now,
        expiresAt: new Date(now.getTime() + durationMs),
        channelId: null,
        messageId: null,
      };
      await proposalCollection.insertOne(proposal);
      const message = await send({
        content: proposalText(proposal),
        components: buildRows(proposal),
        allowedMentions: { users: [sender.id, recipient.id], parse: [] },
      }, index);
      if (!message || !message.id) {
        await proposalCollection.updateOne(
          { id: proposal.id, status: "pending" },
          { $set: { status: "cancelled", closedAt: new Date(), failureReason: "MESSAGE_SEND_FAILED" } }
        );
        continue;
      }
      await proposalCollection.updateOne(
        { id: proposal.id },
        { $set: { channelId: String(message.channelId), messageId: String(message.id) } }
      );
      const timer = setTimeout(() => expireProposal(client, proposal.id), durationMs + 500);
      if (typeof timer.unref === "function") timer.unref();
    }
  } catch (error) {
    console.error("[Yukina Pay] Não foi possível criar as propostas:", error);
    return send({
      content: "🌙 Não consegui iniciar as transferências agora. Verifique a conexão com o banco de dados e tente novamente.",
      ephemeral: true,
    });
  }
}

async function handleButton(interaction) {
  const match = interaction.customId.match(/^yukina-pay:(accept|refuse):([0-9a-f-]{36})$/i);
  if (!match) return;
  const action = match[1].toLowerCase();
  const proposalId = match[2];
  await interaction.deferUpdate();
  try {
    const { proposals: proposalCollection, balances: balanceCollection } = await getCollections();
    let proposal = await proposalCollection.findOne({ id: proposalId });
    if (!proposal) {
      return interaction.followUp({ content: "🍃 Esta proposta não existe mais ou já foi removida.", flags: MessageFlags.Ephemeral });
    }
    if (String(interaction.guildId) !== String(proposal.guildId)) {
      return interaction.followUp({ content: "🏮 Esta proposta pertence a outro servidor.", flags: MessageFlags.Ephemeral });
    }
    const userId = String(interaction.user.id);
    if (userId !== proposal.senderId && userId !== proposal.recipientId) {
      return interaction.followUp({
        content: "🏮 <@" + userId + ">, esta transferência não é sua. Apenas <@" + proposal.senderId + "> e <@" + proposal.recipientId + "> podem aceitar ou recusar esta proposta.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: { users: [userId, proposal.senderId, proposal.recipientId], parse: [] },
      });
    }
    if (proposal.status !== "pending") {
      return interaction.followUp({ content: "🍃 Esta proposta já foi encerrada.", flags: MessageFlags.Ephemeral });
    }
    if (new Date(proposal.expiresAt).getTime() <= Date.now()) {
      await expireProposal(interaction.client, proposalId);
      return interaction.followUp({ content: "⏳ O prazo desta proposta terminou. Ela foi cancelada.", flags: MessageFlags.Ephemeral });
    }

    if (action === "refuse") {
      const cancelled = await proposalCollection.updateOne(
        { id: proposalId, status: "pending", expiresAt: { $gt: new Date() } },
        { $set: { status: "cancelled", closedAt: new Date(), refusedBy: userId } }
      );
      if (!cancelled.modifiedCount) {
        return interaction.followUp({ content: "🍃 Esta proposta já foi respondida ou encerrada.", flags: MessageFlags.Ephemeral });
      }
      proposal = await proposalCollection.findOne({ id: proposalId });
      await interaction.message.edit({
        content: "🌸 **Yukina Pay · Proposta cancelada**\nTudo bem: nem todo acordo precisa ser concluído. A proposta foi recusada e nenhuma Kizuna foi movimentada.",
        components: [],
        allowedMentions: { parse: [] },
      });
      return;
    }

    const wasAccepted = Array.isArray(proposal.acceptedBy) && proposal.acceptedBy.includes(userId);
    const changed = wasAccepted
      ? await proposalCollection.updateOne(
          { id: proposalId, status: "pending", expiresAt: { $gt: new Date() }, acceptedBy: userId },
          { $pull: { acceptedBy: userId } }
        )
      : await proposalCollection.updateOne(
          { id: proposalId, status: "pending", expiresAt: { $gt: new Date() }, acceptedBy: { $ne: userId } },
          { $addToSet: { acceptedBy: userId } }
        );
    proposal = await proposalCollection.findOne({ id: proposalId });
    if (!proposal) return;
    if (!changed.modifiedCount) {
      return interaction.followUp({ content: "🍃 Esta proposta já foi respondida ou expirou. Tente novamente se ela ainda estiver aberta.", flags: MessageFlags.Ephemeral });
    }

    if (proposal.acceptedBy.length < 2) {
      await interaction.message.edit({
        content: proposalText(proposal),
        components: buildRows(proposal),
        allowedMentions: { parse: [] },
      });
      return interaction.followUp({
        content: wasAccepted
          ? "🌸 Sua aceitação foi retirada. Você pode aceitar novamente enquanto a proposta estiver aberta."
          : "🌸 Sua aceitação foi registrada. Clique novamente se quiser retirar sua confirmação.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Apenas um clique pode assumir o processamento depois da segunda confirmação.
    const claim = await proposalCollection.updateOne(
      {
        id: proposalId,
        status: "pending",
        acceptedBy: { $all: [proposal.senderId, proposal.recipientId] },
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: "processing", processingAt: new Date() } }
    );
    if (!claim.modifiedCount) {
      return interaction.followUp({ content: "🌙 As duas confirmações foram recebidas. A Yukina está concluindo o acordo.", flags: MessageFlags.Ephemeral });
    }

    const session = mongoClient.startSession();
    let transferError = null;
    try {
      await session.withTransaction(async () => {
        const debit = await balanceCollection.updateOne(
          {
            guildId: String(proposal.guildId),
            userId: String(proposal.senderId),
            balance: { $gte: Number(proposal.amount) },
          },
          { $inc: { balance: -Number(proposal.amount) }, $set: { updatedAt: new Date() } },
          { session }
        );
        if (debit.modifiedCount !== 1) {
          const error = new Error("INSUFFICIENT_BALANCE");
          error.code = "INSUFFICIENT_BALANCE";
          throw error;
        }
        await balanceCollection.updateOne(
          { guildId: String(proposal.guildId), userId: String(proposal.recipientId) },
          {
            $inc: { balance: Number(proposal.amount) },
            $set: { updatedAt: new Date() },
            $setOnInsert: {
              guildId: String(proposal.guildId),
              userId: String(proposal.recipientId),
              createdAt: new Date(),
            },
          },
          { upsert: true, session }
        );
      });
    } catch (error) {
      transferError = error;
    } finally {
      await session.endSession();
    }

    if (transferError) {
      console.error("[Yukina Pay] Falha ao concluir transferência:", transferError);
      await proposalCollection.updateOne(
        { id: proposalId, status: "processing" },
        { $set: { status: "cancelled", closedAt: new Date(), failureReason: transferError.code || "TRANSFER_FAILED" } }
      );
      await interaction.message.edit({
        content: transferError.code === "INSUFFICIENT_BALANCE"
          ? "🍃 **Yukina Pay · Proposta cancelada**\n\n<@" + proposal.senderId + "> e <@" + proposal.recipientId + ">, o saldo de Kizunas disponível mudou antes da confirmação final. Nenhuma Kizuna foi transferida. Verifiquem o saldo e criem uma nova proposta, se desejarem."
          : "🌙 **Yukina Pay · Não foi possível concluir**\n\n<@" + proposal.senderId + "> e <@" + proposal.recipientId + ">, o banco de dados não confirmou a transferência. A proposta foi encerrada; confiram o saldo antes de tentar novamente.",
        components: [],
        allowedMentions: { parse: [] },
      }).catch(() => {});
      return interaction.followUp({
        content: "🌙 Não foi possível concluir a transferência. Nenhuma operação parcial foi mantida.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Consulta os saldos atualizados e a posição de cada pessoa no ranking de Kizunas.
    const senderBalanceDoc = await balanceCollection.findOne({
      guildId: String(proposal.guildId),
      userId: String(proposal.senderId),
    });
    const recipientBalanceDoc = await balanceCollection.findOne({
      guildId: String(proposal.guildId),
      userId: String(proposal.recipientId),
    });
    const senderBalance = Number(senderBalanceDoc?.balance || 0);
    const recipientBalance = Number(recipientBalanceDoc?.balance || 0);
    const [senderAhead, recipientAhead] = await Promise.all([
      balanceCollection.countDocuments({
        guildId: String(proposal.guildId),
        balance: { $gt: senderBalance },
      }),
      balanceCollection.countDocuments({
        guildId: String(proposal.guildId),
        balance: { $gt: recipientBalance },
      }),
    ]);
    const senderRank = senderAhead + 1;
    const recipientRank = recipientAhead + 1;

    await proposalCollection.updateOne(
      { id: proposalId, status: "processing" },
      { $set: { status: "completed", completedAt: new Date() } }
    );
    await interaction.message.edit({
      content: proposalText(proposal),
      components: buildRows(proposal, true, true),
      allowedMentions: { parse: [] },
    }).catch(error => console.warn("[Yukina Pay] Transferência concluída, mas não consegui editar a proposta:", error.message));
    await interaction.message.reply({
      content: [
        "🌸 **Transação concluída**",
        "",
        "・<@" + proposal.senderId + "> acaba de transferir **" + format(proposal.amount) + "** para <@" + proposal.recipientId + ">.",
        "",
        "・Agora <@" + proposal.senderId + "> possui **" + format(senderBalance) + "**",
        "E está em **" + format(senderRank) + "º lugar** no rank de Kizunas!",
        "",
        "・E <@" + proposal.recipientId + "> agora possui **" + format(recipientBalance) + "**",
        "E está em **" + format(recipientRank) + "º lugar** no rank de Kizunas!",
      ].join("\n"),
      allowedMentions: { users: [proposal.senderId, proposal.recipientId], parse: [] },
    }).catch(error => console.warn("[Yukina Pay] Transferência concluída, mas não consegui publicar a resposta:", error.message));
  } catch (error) {
    console.error("[Yukina Pay] Falha ao processar botão:", error);
    return interaction.followUp({
      content: "🌙 A Yukina não conseguiu processar esta ação agora. Tente novamente em instantes.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}

module.exports = {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("pagar")
      .setDescription("Comandos para transferir Kizunas.")
      .setDMPermission(false)
      .addSubcommand(subcommand =>
        subcommand
          .setName("kizunas")
          .setDescription("Transfira Kizunas para outro membro.")
          .addUserOption(option =>
            option.setName("usuario")
              .setDescription("Pessoa que receberá as Kizunas")
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName("quantidade")
              .setDescription("Quantidade de Kizunas: 100k, all, half ou 100000")
              .setRequired(true)
              .setMaxLength(32)
          )
          .addBooleanOption(option =>
            option.setName("autopay")
              .setDescription("Aceitar automaticamente em seu nome; o destinatário ainda precisa aceitar")
              .setRequired(false)
          )
          .addStringOption(option =>
            option.setName("duracao")
              .setDescription("Prazo para as duas confirmações")
              .setRequired(false)
              .addChoices(
                { name: "6 minutos", value: "6min" },
                { name: "8 minutos", value: "8min" },
                { name: "12 minutos", value: "12min" },
                { name: "1 hora", value: "1h" },
                { name: "3 horas", value: "3h" },
                { name: "7 horas", value: "7h" },
                { name: "12 horas", value: "12h" },
                { name: "24 horas", value: "24h" }
              )
          )
      );
    return builder;
  })(),

  name: "pay",
  aliases: ["pix", "pagar"],

  async execute(interaction) {
    const recipient = interaction.options.getUser("usuario");
    const amountInput = interaction.options.getString("quantidade");
    const autoAccept = interaction.options.getBoolean("autopay") ?? false;
    const durationChoice = interaction.options.getString("duracao") || "6min";
    const durationMs = ({
      "6min": 6 * 60 * 1000,
      "8min": 8 * 60 * 1000,
      "12min": 12 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "3h": 3 * 60 * 60 * 1000,
      "7h": 7 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    })[durationChoice] || DEFAULT_PROPOSAL_MS;
    await createProposals({
      guild: interaction.guild,
      sender: interaction.user,
      recipients: recipient ? [recipient] : [],
      amountInput,
      autoAccept,
      durationMs,
      client: interaction.client,
      send: async payload => {
        if (payload.ephemeral) {
          if (interaction.replied || interaction.deferred) {
            return interaction.followUp({ content: payload.content, flags: MessageFlags.Ephemeral });
          }
          return interaction.reply({ content: payload.content, flags: MessageFlags.Ephemeral });
        }
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(payload);
          return interaction.fetchReply();
        }
        return interaction.followUp(payload);
      },
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("🌸 O Yukina Pay só pode ser usado dentro de um servidor.");
    const recipients = [...message.mentions.users.values()];
    const amountInput = args.find(token => /^(?:all|half|\d+(?:[.,]\d+)?[kmbt]?)$/i.test(String(token))) ?? "";
    if (!recipients.length && args[0]) {
      const possibleIds = args.filter(token => /^\d{17,20}$/.test(String(token)));
      for (const id of possibleIds) {
        const user = await message.client.users.fetch(String(id)).catch(() => null);
        if (user) recipients.push(user);
      }
    }
    await createProposals({
      guild: message.guild,
      sender: message.author,
      recipients,
      amountInput,
      client: message.client,
      send: async payload => {
        if (payload.ephemeral) return message.reply(payload.content);
        return message.channel.send(payload);
      },
    });
  },

  handleButton,
};
