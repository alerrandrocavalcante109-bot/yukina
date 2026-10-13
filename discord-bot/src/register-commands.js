import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Configuração obrigatória ausente: ${key}`);
    process.exit(1);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Inicia um pedido VIP da Yukina em um ticket privado.")
    .addStringOption(option => option.setName("plano").setDescription("Plano desejado").setRequired(true)
      .addChoices(
        { name: "Starter", value: "starter" },
        { name: "Plus", value: "plus" },
        { name: "Premium", value: "premium" },
        { name: "Ultra", value: "ultra" },
        { name: "Infinity", value: "infinity" }
      ))
    .addStringOption(option => option.setName("periodo").setDescription("Duração").setRequired(true)
      .addChoices({ name: "Mensal", value: "monthly" }, { name: "Anual", value: "annual" }))
    .setDMPermission(false)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("vip-referencia")
    .setDescription("Registra o identificador da transação Pix no ticket atual.")
    .addStringOption(option => option.setName("referencia").setDescription("ID/referência da transação, não senha nem código de autenticação").setRequired(true).setMinLength(4).setMaxLength(120))
    .setDMPermission(false)
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
console.log("Comando /vip registrado no servidor configurado.");
