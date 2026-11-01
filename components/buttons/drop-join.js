"use strict";
const MATCH=/^yukina-drop:join:([a-f0-9]{24})$/i;
const manager=require("../../systems/drop-manager");
module.exports={
 customId:MATCH,
 async execute(interaction){
  const match=interaction.customId.match(MATCH);if(!match)return;
  return manager.join(interaction,match[1]);
 },
 initialize:manager.initialize
};
