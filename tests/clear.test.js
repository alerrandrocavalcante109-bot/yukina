"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const command = require("../commands/clear");

test("registers /limpar chat with the requested limits and administrator permission", () => {
  const data = command.data.toJSON();
  assert.equal(data.name, "limpar");
  assert.equal(data.default_member_permissions, String(PermissionFlagsBits.Administrator));
  assert.equal(data.options.length, 1);
  assert.equal(data.options[0].name, "chat");
  const amount = data.options[0].options[0];
  assert.equal(amount.name, "quantidade");
  assert.equal(amount.min_value, 2);
  assert.equal(amount.max_value, 100);
});

test("exposes only the requested prefix aliases", () => {
  assert.deepEqual(command.aliases, ["clear", "limpar", "deletar"]);
});

test("rejects non-administrators before attempting deletion", async () => {
  let attemptedDelete = false;
  const member = { permissions: { has: permission => permission === PermissionFlagsBits.Administrator ? false : true } };
  const replies = [];
  await command.prefixExecute({
    guild: { members: { me: { permissionsIn: () => ({ has: () => true }) } } },
    channel: { bulkDelete: async () => { attemptedDelete = true; return { size: 5 }; } },
    member,
    reply: async message => replies.push(message)
  }, ["5"]);

  assert.equal(attemptedDelete, false);
  assert.match(replies[0], /Apenas membros da administração/);
});

test("rejects amounts outside 2..100", async () => {
  const replies = [];
  const member = { permissions: { has: permission => permission === PermissionFlagsBits.Administrator } };
  for (const amount of ["1", "101", "abc"]) {
    await command.prefixExecute({
      guild: {},
      channel: {},
      member,
      reply: async message => replies.push(message)
    }, [amount]);
  }
  assert.equal(replies.length, 3);
  assert.ok(replies.every(message => message.includes("entre **2 e 100 mensagens**")));
});

test("uses bulkDelete with old-message filtering enabled", async () => {
  let received;
  const member = { permissions: { has: permission => permission === PermissionFlagsBits.Administrator } };
  const channel = {
    bulkDelete: async (...args) => {
      received = args;
      return { size: 4 };
    }
  };
  const guild = {
    members: {
      me: { permissionsIn: () => ({ has: permission => permission === PermissionFlagsBits.ManageMessages }) }
    }
  };
  const replies = [];

  await command.prefixExecute({
    guild,
    channel,
    member,
    reply: async message => replies.push(message)
  }, ["4"]);

  assert.deepEqual(received, [4, true]);
  assert.match(replies[0], /4/);
});
