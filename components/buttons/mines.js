"use strict";

const mines = require("../../systems/mines");

module.exports = {
  customId: /^mines:(?:cell|random|refresh|cashout):[0-9a-f-]{36}(?::\d{1,2})?$/i,

  async initialize(client) {
    await mines.initialize(client);
  },

  async execute(interaction, client) {
    return mines.handleButton(interaction, client);
  },
};
