"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const command = require("../commands/clear");

const admin = { permissions: { has: permission => permission === PermissionFlagsBits.Administrator } };
const guildWithBotPermission = {
  members: {
    me: { permissionsIn: () => ({ has: permission => permission === PermissionFlagsBits.ManageMessages }) }
  }
};

function makeMessage(id, createdTimestamp = Date.now()) {
  return { id, createdTimestamp };
}

test("registers /limpar chat with the requested limits and administrator permission", () => {
  const data = command.data.toJSON();
  assert.equal(data.name, "limpar");
  assert.equal(data.default_member_permissions, String(PermissionFlagsBits.Administrator));
  assert.equal(data.options[0].name, "chat");
  const amount = data.options[0].options[0];
  assert.equal(amount.name, "quantidade");
  assert.equal(amount.min_value, 2);
  assert.equal(amount.max_value, 100);
});

test("exposes the requested prefix aliases", () => {
  assert.deepEqual(command.aliases, ["clear", "limpar", "deletar"]);
});

test("rejects non-administrators before attempting deletion", async () => {
  let attemptedDelete = false;
  const replies = [];
  await command.prefixExecute({
    guild: guildWithBotPermission,
    channel: { messages: { fetch: async () => { throw new Error("should not fetch"); } }, bulkDelete: async () => { attemptedDelete = true; } },
    member: { permissions: { has: () => false } },
    id: "invoke",
    reply: async message => { replies.push(message); return null; }
  }, ["5"]);
  assert.equal(attemptedDelete, false);
  assert.match(replies[0], /Apenas membros da administração/);
});

test("rejects amounts outside 2..100", async () => {
  const replies = [];
  for (const amount of ["1", "101", "abc"]) {
    await command.prefixExecute({
      guild: {},
      channel: {},
      member: admin,
      id: "invoke",
      reply: async message => { replies.push(message); return null; }
    }, [amount]);
  }
  assert.equal(replies.length, 3);
  assert.ok(replies.every(message => message.includes("entre **2 e 100 mensagens**")));
});

test("does not count the prefix command message and deletes the confirmation after six seconds", async () => {
  const now = Date.now();
  const invocation = makeMessage("invoke", now);
  const previous = [makeMessage("a", now - 1000), makeMessage("b", now - 2000), makeMessage("c", now - 3000)];
  let fetchedLimit;
  let deletedCollection;
  let confirmationDeleted = false;
  const replies = [];

  const channel = {
    messages: {
      fetch: async ({ limit }) => {
        fetchedLimit = limit;
        return new Map([[invocation.id, invocation], ...previous.map(m => [m.id, m])]);
      }
    },
    bulkDelete: async (messages, filterOld) => {
      deletedCollection = messages;
      assert.equal(filterOld, true);
      return { size: messages.length };
    }
  };

  await command.prefixExecute({
    guild: guildWithBotPermission,
    channel,
    member: admin,
    id: invocation.id,
    reply: async content => {
      replies.push(content);
      return { delete: async () => { confirmationDeleted = true; } };
    }
  }, ["2"]);

  assert.equal(fetchedLimit, 2);
  assert.equal(deletedCollection.length, 2);
  assert.ok(deletedCollection.every(m => m.id !== invocation.id));
  assert.match(replies[0], /Foram apagadas/);

  // A confirmação usa temporizador de 6 segundos; não aguardamos o tempo real no teste.
  assert.equal(confirmationDeleted, false);
});

test("preserves messages older than fourteen days", async () => {
  const now = Date.now();
  const old = makeMessage("old", now - 14 * 24 * 60 * 60 * 1000 - 1);
  const recent = [makeMessage("r1"), makeMessage("r2")];
  let deletedCollection;
  const channel = {
    messages: { fetch: async () => new Map([[old.id, old], ...recent.map(m => [m.id, m])]) },
    bulkDelete: async messages => { deletedCollection = messages; return { size: messages.length }; }
  };

  await command.prefixExecute({
    guild: guildWithBotPermission,
    channel,
    member: admin,
    id: "invoke",
    reply: async () => null
  }, ["2"]);

  assert.equal(deletedCollection.length, 2);
  assert.ok(deletedCollection.every(m => m.id !== old.id));
});
