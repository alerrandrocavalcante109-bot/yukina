"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const aliases = require("../systems/idioma/prefix-aliases");

const expectedCommands = [
  "bj", "cofre", "daily", "roleta", "bloquear", "desbloquear",
  "advertencias", "expedicao", "drop", "iniciar", "painel", "addkz",
  "enigma", "mensagens", "desejo", "slow", "infoserver", "ajuda",
  "usuario", "say", "advertir", "limpar", "ativar", "idioma",
  "calcular", "ship", "trabalhar", "fim", "ticket", "membro",
  "banir", "transferencias", "pay"
];

test("all prefix commands have multilingual aliases", () => {
  for (const command of expectedCommands) {
    assert.ok(Array.isArray(aliases[command]) && aliases[command].length > 0, command);
  }
});

test("prefix aliases are single tokens and do not collide across commands", () => {
  const owners = new Map();
  for (const [command, values] of Object.entries(aliases)) {
    for (const alias of values) {
      assert.ok(alias.length > 0);
      assert.ok(!/\\s/.test(alias), `${command}: ${alias} must be one token`);
      const owner = owners.get(alias);
      assert.ok(!owner || owner === command, `${alias} belongs to both ${owner} and ${command}`);
      owners.set(alias, command);
    }
  }
});
