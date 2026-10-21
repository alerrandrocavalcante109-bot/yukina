const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require("discord.js");
const { getVipCollection } = require("./vip-store");

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PLANS = {
  starter: "Starter",
  plus: "Plus",
  premium: "Premium",
  ultra: "Ultra",
  infinity: "Infinity",
};

function makeReminder(subscription, daysLeft, pixKey) {
  const expiresAt = new Date(subscription.expiresAt);
  const dateText = `<t:${Math.floor(expiresAt.getTime() / 1000)}:D>`;
  const container = new ContainerBuilder()
    .setAccentColor(0xA7D8F0)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ❄️ Seu Yukina VIP está perto de vencer!\nOlá! Seu plano **${PLANS[subscription.planKey] || subscription.planKey}** vence em **${daysLeft} dia(s)**, no dia ${dateText}.\n\nPara continuar com os benefícios, você pode renovar pelo Pix. Depois do pagamento, entre no servidor oficial e abra um atendimento com \`/vip-comprar\` para a equipe conferir a renovação.`
      )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Chave Pix**\n\`${pixKey}\``)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("vip:pix-copy")
            .setLabel("Copiar chave Pix")
            .setStyle(ButtonStyle.Primary)
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🌙 **Servidor oficial:** https://discord.gg/NJR3YNd2G\n\nSe você já renovou, pode ignorar este aviso até que a equipe confirme o pagamento. A aprovação continua sendo manual.`
      )
    );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function checkReminders(client) {
  const pixKey = (process.env.VIP_PIX_KEY || "").trim();
  if (!pixKey) {
    console.warn("[VIP] VIP_PIX_KEY não configurada; lembretes de renovação pausados.");
    return;
  }

  const collection = await getVipCollection();
  const now = new Date();
  const subscriptions = await collection.find({ status: "active", expiresAt: { $gt: now } }).toArray();
  for (const subscription of subscriptions) {
    const expiry = new Date(subscription.expiresAt);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
    const threshold = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : daysLeft <= 7 ? 7 : null;
    if (!threshold || (subscription.remindersSent || []).includes(threshold)) continue;

    try {
      const user = await client.users.fetch(String(subscription.userId));
      await user.send(makeReminder(subscription, daysLeft, pixKey));
      await collection.updateOne(
        { _id: subscription._id, status: "active" },
        { $addToSet: { remindersSent: threshold }, $set: { lastReminderAt: new Date() } }
      );
      console.log(`[VIP] Lembrete de ${daysLeft} dia(s) enviado para usuário ${subscription.userId}.`);
    } catch (error) {
      console.warn(`[VIP] Não consegui enviar lembrete para ${subscription.userId}:`, error.message || error);
    }
  }
}

module.exports = function startVipReminders(client) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await checkReminders(client);
    } catch (error) {
      console.error("[VIP] Falha ao verificar vencimentos:", error.message || error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, REMINDER_INTERVAL_MS);
  timer.unref?.();
  console.log("[VIP] Lembretes de vencimento ativados (7, 3 e 1 dia antes).");
};
