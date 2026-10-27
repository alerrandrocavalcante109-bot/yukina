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
    "📣 Atenção, <@" + proposal.senderId + "> e <@" + proposal.recipientId + ">!" + (proposal.batchSize > 1 ? " · Proposta " + proposal.batchIndex + "/" + proposal.batchSize : ""),
    "",
    "「 " + PHRASE + " 」",
    "",
    "💴 **Valor da transferência**",
    "## " + format(proposal.amount) + " KZ",
    "🧾 **Taxa:** 0 KZ",
    "💰 **Total desta proposta:** " + format(proposal.amount) + " KZ",
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

const TRANSFER_ANIMATION_MS = 4000;
const TRANSFER_FRAMES = ["⟳", "↻", "⟲", "↺", "⟳", "↻", "⟲", "↺"];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animateTransfer(interaction, proposal) {
  const frameDelay = TRANSFER_ANIMATION_MS / TRANSFER_FRAMES.length;
  for (const frame of TRANSFER_FRAMES) {
    await interaction.message.edit({
      content: "🌸 **Transferindo Kizunas " + frame + "**\\n\\n" +
        "<@" + proposal.senderId + "> → <@" + proposal.recipientId + ">\\n" +
        "💴 **Valor:** " + format(proposal.amount) + " KZ\\n\\n" +
        "「 A Yukina está preparando a troca com cuidado... 」",
      components: [],
      allowedMentions: { parse: [] },
    });
    await wait(frameDelay);
  }
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

async function createProposals({ guild, sender, recipients, amountInput, send, client }) {
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
      scheduleExpiration(client, proposal.id);
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

    try {
      await animateTransfer(interaction, proposal);
    } catch (animationError) {
      console.warn("[Yukina Pay] A animação não pôde ser exibida por completo:", animationError.message);
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

    await proposalCollection.updateOne(
      { id: proposalId, status: "processing" },
      { $set: { status: "completed", completedAt: new Date() } }
    );
    await interaction.message.edit({
      content: "🌸 **Yukina Pay · Proposta concluída**\n\n「 O acordo foi selado; a transferência foi registrada. 」",
      components: [],
      allowedMentions: { parse: [] },
    }).catch(error => console.warn("[Yukina Pay] Transferência concluída, mas não consegui editar a proposta:", error.message));
    await interaction.message.reply({
      content: [
        "🌸 **Yukina Pay · Acordo selado!**",
        "",
        "📣 <@" + proposal.senderId + "> e <@" + proposal.recipientId + ">, vocês confirmaram e concluíram esta transferência!",
        "",
        "「 As Kizunas chegaram ao seu destino. Que a prosperidade acompanhe vocês! 」",
        "",
        "💴 **Valor transferido:** " + format(proposal.amount) + " KZ",
        "🎎 **Confirmações:** 2/2 — ambas recebidas",
        "🏮 A transferência foi concluída com sucesso.",
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
      .setName("pay")
      .setDescription("Proponha transferências individuais de Kizunas para até 10 pessoas.")
      .setDMPermission(false)
      .addStringOption(option =>
        option.setName("valor")
          .setDescription("Valor: 1500, 1.5k, 2m, 3b, 1t, all ou half")
          .setRequired(true)
          .setMaxLength(32)
      )
      .addUserOption(option =>
        option.setName("usuario")
          .setDescription("Primeiro destinatário")
          .setRequired(true)
      );
    for (let i = 2; i <= 10; i++) {
      builder.addUserOption(option =>
        option.setName("usuario" + i)
          .setDescription("Destinatário " + i + " (opcional)")
          .setRequired(false)
      );
    }
    return builder;
  })(),

  name: "pay",
  aliases: ["pix", "pagar"],

  async execute(interaction) {
    const recipients = [];
    for (let i = 1; i <= 10; i++) {
      const recipient = interaction.options.getUser(i === 1 ? "usuario" : "usuario" + i);
      if (recipient) recipients.push(recipient);
    }
    const amountInput = interaction.options.getString("valor");
    await createProposals({
      guild: interaction.guild,
      sender: interaction.user,
      recipients,
      amountInput,
      client: interaction.client,
      send: async (payload, index = 0) => {
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
