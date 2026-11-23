"use strict";
const bj=require("../../systems/blackjack");
module.exports={customId:/^bj:(?:hit|stand|double|insurance|insurebuy):[0-9a-f-]{36}$/i,async initialize(client){await bj.initialize(client);},async execute(interaction,client){return bj.handleButton(interaction,client);}};
