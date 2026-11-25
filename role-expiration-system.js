"use strict";

const { PermissionFlagsBits } = require("discord.js");
const storage = require("./system-storage").forSystem("role-expirations");

const CHECK_INTERVAL_MS = 30_000;
let running = false;

function expirationMessage(memberId, roleName, guildName) {
  return [
    "🔔 **Yukina · Notificação de expiração**",
    "",
    "Olá, <@" + memberId + ">! 🌸",
    "",
    "Tenho um pequeno aviso para você!",
    "",
    "O período de permanência do cargo **" + roleName + "**, no servidor **" + guildName + "**, chegou ao fim. Conforme o prazo estabelecido no momento da atribuição, o cargo foi removido automaticamente do seu perfil.",
    "",
    "Essa remoção acontece quando o tempo de validade configurado se encerra, portanto, não é necessário realizar nenhuma ação adicional. Os seus demais cargos, permissões e informações dentro do servidor permanecem intactos.",
    "",
    "Se desejar receber esse cargo novamente, você poderá entrar em contato com a equipe de administração do servidor para verificar a possibilidade de uma nova atribuição.",
    "",
    "Agradecemos por ter aproveitado esse período e por continuar fazendo parte da nossa comunidade. Sua presença é muito bem-vinda, e esperamos que continue compartilhando bons momentos conosco!",
    "",
    "Não deixe de acompanhar as novidades e atividades do servidor. Sempre haverá novas oportunidades e experiências esperando por você. 💗",
    "",
    "Até a próxima!",
    "",
    "*Com carinho, Yukina.* 🌸"
  ].join("\n");
}

async function processGuild(guild) {
  const records = await storage.list(guild.id, { limit: 2000 });
  const due = records.filter(item =>
    item.key.startsWith("expiry:") &&
    item.value?.expiresAt &&
    Date.parse(item.value.expiresAt) <= Date.now()
  );

  for (const item of due) {
    const record = item.value;
    try {
      const member = await guild.members.fetch(record.userId).catch(() => null);
      const role = await guild.roles.fetch(record.roleId).catch(() => null);
      if (member && role && member.roles.cache.has(role.id)) {
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.managed || role.position >= botMember.roles.highest.position) {
          console.error("[Cargos temporários] Não foi possível remover " + role.id + " em " + guild.name + ": verifique permissões e hierarquia.");
          continue;
        }
        await member.roles.remove(role, "Prazo do cargo temporário encerrado — Yukina");
        if (record.notifyExpiration) {
          const message = expirationMessage(member.id, record.roleName || role.name, record.guildName || guild.name);
          await member.send({ content: message, allowedMentions: { users: [member.id] } }).catch(error => {
            console.warn("[Cargos temporários] Não foi possível enviar DM para " + member.id + ":", error.message);
          });
        }
      }
      await storage.delete(guild.id, item.key);
    } catch (error) {
      console.error("[Cargos temporários] Falha ao processar expiração em " + guild.name + ":", error.message);
    }
  }
}

module.exports = function startRoleExpirationSystem(client) {
  if (running) return;
  running = true;

  const run = async () => {
    for (const guild of client.guilds.cache.values()) {
      try { await processGuild(guild); }
      catch (error) { console.error("[Cargos temporários] Falha ao verificar " + guild.name + ":", error.message); }
    }
  };

  if (client.isReady()) void run();
  else client.once("clientReady", run);

  setInterval(run, CHECK_INTERVAL_MS).unref?.();
};
