"use strict";
const setup = require("../selects/drop-auto-setup");
module.exports = {
  customId: /^dropauto:(?:open-channels|confirm|again)$/,
  async execute(interaction, client) {
    return setup.execute(interaction, client);
  },
};
