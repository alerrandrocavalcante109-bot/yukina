import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
  GatewayIntentBits, PermissionFlagsBits
} from "discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID", "VIP_STAFF_ROLE_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Configuração obrigatória ausente: ${key}`);
    process.exit(1);
  }
}
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const STAFF_ROLE_ID = process.env.VIP_STAFF_ROLE_ID;
const CATEGORY_ID = process.env.VIP_TICKET_CATEGORY_ID || null;
const MAX_FILE = Math.min(Number(process.env.VIP_MAX_ATTACHMENT_BYTES || 5 * 1024 * 1024), 5 * 1024 * 1024);
const DB_PATH = path.resolve(process.env.VIP_DATABASE_PATH || "./data/yukina-vip.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const PLANS = {
  starter: { name: "Starter", monthly: 790, annual: 7990 },
  plus: { name: "Plus", monthly: 990, annual: 9990 },
  premium: { name: "Premium", monthly: 1490, annual: 14990 },
  ultra: { name: "Ultra", monthly: 1990, annual: 19990 },
  infinity: { name: "Infinity", monthly: 2990, annual: 29990 }
};
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    billing TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','closed')),
    transaction_ref_hash TEXT UNIQUE,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    decided_by TEXT,
    decision_note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const timestamp = () => new Date().toISOString();
const ticketName = (plan, id) => `vip-${plan}-${id.slice(-6)}`;
const isStaff = member => Boolean(member?.roles?.cache?.has(STAFF_ROLE_ID));
const audit = db.prepare("INSERT INTO audit_log(order_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?)");
const getByChannel = db.prepare("SELECT * FROM orders WHERE channel_id = ?");
const updateDecision = db.prepare("UPDATE orders SET status=?,decided_at=?,decided_by=?,decision_note=? WHERE id=? AND status='pending'");
const getOpenForUser = db.prepare("SELECT id FROM orders WHERE guild_id=? AND user_id=? AND status='pending' LIMIT 1");

function controls(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vip:approve:${orderId}`).setLabel("Pagamento conferido — aprovar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vip:reject:${orderId}`).setLabel("Recusar pedido").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`vip:close:${orderId}`).setLabel("Fechar ticket").setStyle(ButtonStyle.Secondary)
  );
}

function orderEmbed(order) {
  return new EmbedBuilder().setColor(order.status === "approved" ? 0x22c55e : order.status === "rejected" ? 0xef4444 : 0xa855f7)
    .setTitle(`Pedido Yukina VIP · ${order.id}`)
    .addFields(
      { name: "Comprador", value: `<@${order.user_id}> (ID: ${order.user_id})`, inline: false },
      { name: "Plano", value: PLANS[order.plan].name, inline: true },
      { name: "Período", value: order.billing === "annual" ? "Anual" : "Mensal", inline: true },
      { name: "Valor esperado", value: money(order.amount_cents), inline: true },
      { name: "Estado", value: order.status, inline: true }
    ).setFooter({ text: "A imagem do comprovante não é confirmação de pagamento." });
}

client.once("ready", () => console.log(`Yukina VIP conectada como ${client.user.tag}`));

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      if (interaction.isRepliable()) await interaction.reply({ content: "Este comando só pode ser usado no servidor oficial configurado.", ephemeral: true }).catch(() => {});
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "vip") {
      await interaction.deferReply({ ephemeral: true });
      const planKey = interaction.options.getString("plano", true);
      const billing = interaction.options.getString("periodo", true);
      const plan = PLANS[planKey];
      if (!plan || !["monthly", "annual"].includes(billing)) {
        await interaction.editReply("Plano inválido. Nenhum pedido foi criado.");
        return;
      }
      if (getOpenForUser.get(GUILD_ID, interaction.user.id)) {
        await interaction.editReply("Você já tem um pedido pendente. Continue no ticket existente ou peça à equipe para verificá-lo.");
        return;
      }

      const orderId = `YK-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const perms = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles], deny: [PermissionFlagsBits.ManageChannels] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles] }
      ];
      // The staff role is explicitly granted access; no @everyone visibility.
      perms.push({ id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] });
      const channel = await interaction.guild.channels.create({
        name: ticketName(planKey, orderId),
        type: ChannelType.GuildText,
        ...(CATEGORY_ID ? { parent: CATEGORY_ID } : {}),
        permissionOverwrites: perms,
        reason: `Ticket VIP ${orderId} criado pelo comprador ${interaction.user.id}`
      });
      const amount = plan[billing];
      const createdAt = timestamp();
      const order = { id: orderId, guild_id: GUILD_ID, user_id: interaction.user.id, channel_id: channel.id, plan: planKey, billing, amount_cents: amount, status: "pending", created_at: createdAt };
      try {
        db.prepare("INSERT INTO orders(id,guild_id,user_id,channel_id,plan,billing,amount_cents,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(order.id, order.guild_id, order.user_id, order.channel_id, order.plan, order.billing, order.amount_cents, order.status, order.created_at);
        audit.run(order.id, interaction.user.id, "created", `Plano ${planKey}; período ${billing}`, createdAt);
      } catch (error) {
        await channel.delete("Falha ao registrar pedido no banco").catch(() => {});
        throw error;
      }
      const embed = orderEmbed(order).setDescription(
        "Este ticket é privado. A equipe vai fornecer as instruções de pagamento. **Não pague até receber instruções oficiais neste ticket.**\n\n" +
        "Depois de pagar, anexe aqui o comprovante e, se disponível, o identificador da transação. Não envie senhas, tokens, códigos de autenticação ou documentos desnecessários.\n\n" +
        "A equipe verificará o recebimento diretamente na fonte de pagamento. A imagem sozinha nunca aprova o pedido."
      );
      await channel.send({ content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [controls(order.id)], allowedMentions: { users: [interaction.user.id], roles: [STAFF_ROLE_ID] } });
      await interaction.editReply(`Seu ticket privado foi criado: <#${channel.id}>. **Não faça pagamento até receber instruções oficiais da equipe.**`);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("vip:")) {
      const [, action, orderId] = interaction.customId.split(":");
      const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
      if (!order || order.guild_id !== interaction.guildId || order.channel_id !== interaction.channelId) {
        await interaction.reply({ content: "Pedido não encontrado para este ticket.", ephemeral: true });
        return;
      }
      if (action === "close") {
        if (interaction.user.id !== order.user_id && !isStaff(interaction.member)) {
          await interaction.reply({ content: "Somente o comprador ou a equipe autorizada pode fechar este ticket.", ephemeral: true });
          return;
        }
        await interaction.reply({ content: "Ticket será fechado em breve. A equipe pode reabri-lo se necessário.", ephemeral: true });
        await interaction.channel.permissionOverwrites.edit(order.user_id, { ViewChannel: false, SendMessages: false }).catch(() => {});
        audit.run(order.id, interaction.user.id, "ticket_closed", "Acesso do comprador removido", timestamp());
        db.prepare("UPDATE orders SET status='closed' WHERE id=? AND status IN ('pending','rejected')").run(order.id);
        return;
      }
      if (!isStaff(interaction.member)) {
        await interaction.reply({ content: "Ação restrita à equipe de VIP autorizada.", ephemeral: true });
        return;
      }
      if (action === "approve" || action === "reject") {
        if (order.status !== "pending") {
          await interaction.reply({ content: `Este pedido já está ${order.status}; nenhuma alteração foi feita.`, ephemeral: true });
          return;
        }
        const nextStatus = action === "approve" ? "approved" : "rejected";
      const note = action === "approve"
        ? "Aprovação manual; a equipe declara ter verificado o recebimento na fonte oficial."
        : "Recusado pela equipe";
      if (action === "approve") {
        // The button is an explicit human attestation. The bot never infers payment from an image.
        await interaction.reply({ content: "Confirme apenas se verificou o crédito na conta oficial, o valor exato e que a transação não foi usada em outro pedido. Ao confirmar, você assume a decisão manual.", ephemeral: true });
      }
      const changed = updateDecision.run(nextStatus, timestamp(), interaction.user.id, note, order.id);
      if (changed.changes !== 1) {
        if (!interaction.replied) await interaction.reply({ content: "O pedido foi alterado por outra ação. Atualize o ticket.", ephemeral: true });
        return;
      }
      audit.run(order.id, interaction.user.id, nextStatus, note, timestamp());
      const updated = { ...order, status: nextStatus };
      const description = action === "approve"
        ? "Pagamento marcado como conferido manualmente pela equipe. A aprovação não libera automaticamente benefícios do bot; a vinculação de cargos/recursos deve ser configurada e testada separadamente."
        : "Pedido recusado pela equipe. Entre em contato com o suporte para obter detalhes.";
      const payload = { embeds: [orderEmbed(updated).setDescription(description)], components: [controls(order.id)] };
      if (interaction.replied) await interaction.message.edit(payload);
      else await interaction.update(payload);
      }
    }

  } catch (error) {
    console.error("Erro em interação VIP:", error?.message || "erro desconhecido");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Não foi possível concluir a ação. Nenhuma aprovação foi registrada.", ephemeral: true }).catch(() => {});
    } else if (interaction.isRepliable() && interaction.deferred) {
      await interaction.editReply("Não foi possível concluir a ação. Nenhuma aprovação foi registrada.").catch(() => {});
    }
  }
});

client.on("messageCreate", async message => {
  try {
    if (!message.inGuild() || message.guildId !== GUILD_ID || message.author.bot) return;
    const order = getByChannel.get(message.channelId);
    if (!order || order.status !== "pending") return;
    for (const attachment of message.attachments.values()) {
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
      if (!allowed.has(attachment.contentType || "") || attachment.size > MAX_FILE) {
        await message.reply("Arquivo não aceito. Envie JPG, PNG, WEBP ou PDF de até 5 MB. O arquivo não será baixado nem armazenado pelo bot.");
        audit.run(order.id, message.author.id, "attachment_rejected", `tipo=${attachment.contentType || "desconhecido"}; tamanho=${attachment.size}`, timestamp());
      } else {
        audit.run(order.id, message.author.id, "attachment_received", `anexo_id=${attachment.id}; tipo=${attachment.contentType}; tamanho=${attachment.size}`, timestamp());
        await message.reply("Anexo recebido no Discord para análise manual. Isso **não** confirma o pagamento; a equipe precisa verificar a transação na fonte oficial.");
      }
    }
  } catch (error) {
    console.error("Erro ao validar anexo:", error?.message || "erro desconhecido");
  }
});

client.login(process.env.DISCORD_TOKEN);
