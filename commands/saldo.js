"use strict";
const command = require("../economia-saldo").makeCommand("saldo", "Consulte seu saldo de Kizunas ou o de outro membro.");
// atm e bal são aliases de prefixo; só /saldo é registrado como comando slash.
command.aliases = ["atm", "bal"];
module.exports = command;
