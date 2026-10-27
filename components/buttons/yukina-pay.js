"use strict";

const pay = require("../../commands/pay");

module.exports = {
  customId: /^yukina-pay:(?:accept|refuse):[0-9a-f-]{36}$/i,
  async execute(interaction) {
    return pay.handleButton(interaction);
  },
};
