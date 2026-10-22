"use strict";

let systemsLoaded = false;

function loadYukinaSystems(client) {
  if (systemsLoaded) return;
  systemsLoaded = true;
  console.log("[Yukina] Conexão estabelecida; iniciando os sistemas em seguida...");
  require("../../command-engine")(client);
  require("../../rank-system")(client);
  require("../../xp-level-system")(client);
  require("../../time-role-system")(client);
  require("../../staff-promotion-announcements")(client);
  require("../../interaction")(client);
}

module.exports = { loadYukinaSystems };
