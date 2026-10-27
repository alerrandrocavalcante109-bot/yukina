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
const PROPOSAL_MS = 6 * 60 * 1000;
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

function buildRows(proposal, disabled = false) {
  const count = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy.length : 0;
  const accept = new ButtonBuilder()
    .setCustomId("yukina-pay:accept:" + proposal.id)
    .setLabel("Aceitar transferência · " + count + "/2")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled || count >= 2);
  const refuse = new ButtonBuilder()
    .setCustomId("yukina-pay:refuse:" + proposal.id)
    .setLabel("Recusar")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
  return [new ActionRowBuilder().addComponents(accept, refuse)];
}

function proposalText(proposal) {
  const count = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy.length : 0;
  const first = count >= 1 ? "✓ Uma pessoa confirmou." : "◌ Aguardando a primeira confirmação.";
  const second = count >= 2 ? "✓ As duas confirmações foram recebidas." : "◌ A segunda confirmação ainda está pendente.";
  return [
    "🌸 **Yukina Pay**",
    "",
    "🏮 **・ PROPOSTA DE TRANSFERÊNCIA**",
    "📣 Atenção, <@" + proposal.senderId + "> e <@" + proposal.recipientId + ">!",
    "",
    "「 " + PHRASE + " 」",
    "",
    "💴 **Valor da transferência**",
    "## " + format(proposal.amount) + " KZ",
    "🧾 **Taxa:** 0 KZ",
    "💰 **Total:** " + format(proposal.amount) + " KZ",
    "",
    "🎎 **Confirmação do acordo**",
    "⏳ **Prazo:** 6 minutos a partir da proposta",
    "🔏 **Confirmações:** " + count + "/2",
    first,
    second,
    "",
    "*A transferência só será realizada quando os dois participantes aceitarem. Se alguém recusar ou o prazo terminar, a proposta será cancelada.*"
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
      "🍃 **Yukina Pay · Proposta expirada**\nO momento da decisão passou. O prazo de seis minutos terminou e nenhuma Kizuna foi transferida.",
      []
    );
  } catch (error) {
    console.error("[Yukina Pay] Falha ao expirar proposta:", error.message || error);
  }
}

function scheduleExpiration(client, proposalId) {
  const timer = setTimeout(() => expireProposal(client, proposalId), PROPOSAL_MS + 500);
  if (typeof timer.unref === "function") timer.unref();
}

async function createProposal({ guild, sender, recipient, amount, send, client }) {
  if (!guild) return send({ content: "🌸 O Yukina Pay só pode ser usado dentro de um servidor.", ephemeral: true });
  if (!recipient || recipient.bot) {
    return send({ content: "🏮 Escolha um membro válido do servidor. Bots não podem participar desta transferência.", ephemeral: true });
  }
  if (recipient.id === sender.id) {
    return send({ content: "🍃 Você não pode transferir Kizunas para si mesmo.", ephemeral: true });
  }
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return send({ content: "💴 Informe um valor inteiro de Kizunas maior que zero.", ephemeral: true });
  }
  try {
    const { proposals: proposalCollection, balances: balanceCollection } = await getCollections();
    const senderBalance = await balanceCollection.findOne(
      { guildId: String(guild.id), userId: String(sender.id) },
      { projection: { balance: 1 } }
    );
    const available = Math.max(0, Number(senderBalance?.balance) || 0);
    if (available < amount) {
      return send({
        content: "🌸 Suas Kizunas não são suficientes para esta proposta. Seu saldo atual é **" + format(available) + " KZ**.",
        ephemeral: true,
      });
    }

    const now = new Date();
    const proposal = {
      id: crypto.randomUUID(),
      guildId: String(guild.id),
      senderId: String(sender.id),
      recipientId: String(recipient.id),
      amount,
      acceptedBy: [],
      status: "pending",
      createdAt: now,
      expiresAt: new Date(now.getTime() + PROPOSAL_MS),
      channelId: null,
      messageId: null,
    };
    await proposalCollection.insertOne(proposal);
    const message = await send({
      content: proposalText(proposal),
      components: buildRows(proposal),
      allowedMentions: { users: [sender.id, recipient.id], parse: [] },
    });
    if (!message || !message.id) {
      await proposalCollection.updateOne({ id: proposal.id, status: "pending" }, { $set: { status: "cancelled" } });
      return;
    }
    await proposalCollection.updateOne(
      { id: proposal.id },
      { $set: { channelId: String(message.channelId), messageId: String(message.id) } }
    );
    scheduleExpiration(client, proposal.id);
  } catch (error) {
    console.error("[Yukina Pay] Não foi possível criar a proposta:", error);
    return send({
      content: "🌙 Não consegui iniciar a transferência agora. Verifique a conexão com o banco de dados e tente novamente.",
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
      return interaction.followUp({ content: "🌸 Somente os dois participantes mencionados podem responder a esta proposta.", flags: MessageFlags.Ephemeral });
    }
    if (proposal.status !== "pending") {
      return interaction.followUp({ content: "🍃 Esta proposta já foi encerrada.", flags: MessageFlags.Ephemeral });
    }
    if (new Date(proposal.expiresAt).getTime() <= Date.now()) {
      await expireProposal(interaction.client, proposalId);
      return interaction.followUp({ content: "⏳ O prazo de seis minutos terminou. A proposta foi cancelada.", flags: MessageFlags.Ephemeral });
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

    const accepted = await proposalCollection.updateOne(
      {
        id: proposalId,
        status: "pending",
        expiresAt: { $gt: new Date() },
        acceptedBy: { $ne: userId },
      },
      { $addToSet: { acceptedBy: userId } }
    );
    proposal = await proposalCollection.findOne({ id: proposalId });
    if (!proposal) return;
    if (!accepted.modifiedCount) {
      if (Array.isArray(proposal.acceptedBy) && proposal.acceptedBy.includes(userId)) {
        return interaction.followUp({ content: "🌸 Você já confirmou esta proposta. Agora aguarde a outra pessoa.", flags: MessageFlags.Ephemeral });
      }
      return interaction.followUp({ content: "🍃 Esta proposta já foi respondida ou expirou.", flags: MessageFlags.Ephemeral });
    }

    if (proposal.acceptedBy.length < 2) {
      await interaction.message.edit({
        content: proposalText(proposal),
        components: buildRows(proposal),
        allowedMentions: { parse: [] },
      });
      return interaction.followUp({ content: "🌸 Sua confirmação foi registrada. A Yukina está aguardando a outra pessoa.", flags: MessageFlags.Ephemeral });
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
      await proposalCollection.updateOne(
        { id: proposalId, status: "processing" },
        { $set: { status: "completed", completedAt: new Date() } }
      );
      await interaction.message.edit({
        content: [
          "🌸 **Yukina Pay · Acordo selado!**",
          "",
          "「 As Kizunas chegaram ao seu destino. Que a prosperidade acompanhe vocês! 」",
          "",
          "💴 **Valor transferido:** " + format(proposal.amount) + " KZ",
          "🎎 **Confirmações:** 2/2",
          "🏮 A transferência foi concluída com sucesso.",
        ].join("\n"),
        components: [],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error("[Yukina Pay] Falha ao concluir transferência:", error);
      await proposalCollection.updateOne(
        { id: proposalId, status: "processing" },
        { $set: { status: "cancelled", closedAt: new Date(), failureReason: error.code || "TRANSFER_FAILED" } }
      );
      await interaction.message.edit({
        content: error.code === "INSUFFICIENT_BALANCE"
          ? "🍃 **Yukina Pay · Proposta cancelada**\nO saldo disponível mudou antes da confirmação final. Nenhuma Kizuna foi transferida."
          : "🌙 **Yukina Pay · Não foi possível concluir**\nO banco de dados não confirmou a transferência. A proposta foi encerrada; confira o saldo antes de tentar novamente.",
        components: [],
        allowedMentions: { parse: [] },
      });
      return interaction.followUp({
        content: "🌙 Não foi possível concluir a transferência. Nenhuma operação parcial foi mantida.",
        flags: MessageFlags.Ephemeral,
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("[Yukina Pay] Falha ao processar botão:", error);
    return interaction.followUp({
      content: "🌙 A Yukina não conseguiu processar esta ação agora. Tente novamente em instantes.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Proponha uma transferência de Kizunas que exige a confirmação dos dois participantes.")
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName("usuario")
        .setDescription("Pessoa que participará da transferência")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("valor")
        .setDescription("Quantidade de Kizunas a transferir")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(2147483647)
    ),

  name: "pay",
  aliases: ["pix", "pagar"],

  async execute(interaction) {
    const recipient = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("valor");
    await createProposal({
      guild: interaction.guild,
      sender: interaction.user,
      recipient,
      amount,
      client: interaction.client,
      send: async payload => {
        if (payload.ephemeral) {
          return interaction.reply({ content: payload.content, flags: MessageFlags.Ephemeral });
        }
        await interaction.reply(payload);
        return interaction.fetchReply();
      },
    });
  },

  async prefixExecute(message, args = []) {
    if (!message.guild) return message.reply("🌸 O Yukina Pay só pode ser usado dentro de um servidor.");
    const recipient = message.mentions.users.first()
      || (args[0] ? await message.client.users.fetch(String(args[0]).replace(/[<@!>]/g, "")).catch(() => null) : null);
    const amountToken = args.find(token => /^\d+$/.test(String(token)));
    const amount = amountToken ? Number(amountToken) : NaN;
    await createProposal({
      guild: message.guild,
      sender: message.author,
      recipient,
      amount,
      client: message.client,
      send: async payload => {
        if (payload.ephemeral) return message.reply(payload.content);
        return message.channel.send(payload);
      },
    });
  },

  handleButton,
};
