const crypto = require("node:crypto");

const TOKEN = process.env.YUKINA_MANAGER_TOKEN || "";

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isConfigured() {
  return TOKEN.length >= 32;
}

function authorize(value) {
  if (!isConfigured()) return false;
  return safeEqual(value, TOKEN);
}

function getToken(request) {
  const header = request.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return request.headers["x-yukina-token"] || "";
}

module.exports = { authorize, getToken, isConfigured };
