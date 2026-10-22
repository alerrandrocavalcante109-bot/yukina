"use strict";

require("dotenv").config();

const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const AI_API_URL = (process.env.AI_API_URL || "https://openrouter.ai/api/v1/chat/completions").trim();
const AI_MODEL = (process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free").trim();
const PANEL_ORIGINS = (process.env.PANEL_ORIGINS || "https://yukina-6uo.pages.dev")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const MONGODB_DB = (process.env.MONGODB_DB || "yukina").trim();
const PORT = Number(process.env.PORT) || 3000;
const DISCORD_REDIRECT_URI = (process.env.DISCORD_REDIRECT_URI || "https://yukina-6uo.pages.dev/login.html").trim();

module.exports = {
  TOKEN,
  AI_API_URL,
  AI_MODEL,
  PANEL_ORIGINS,
  MONGODB_URI,
  MONGODB_DB,
  PORT,
  DISCORD_REDIRECT_URI,
};
