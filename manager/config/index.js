const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(ROOT, "manager", "config", "manager.json");

const DEFAULT_CONFIG = {
  api: { host: "127.0.0.1", port: 8080 },
  monitoring: { intervalMs: 15000, autoRestart: true },
  security: { requireToken: true }
};

function ensureConfig() {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  }
}

function load() {
  ensureConfig();
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function save(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  return config;
}

function get(pathName) {
  return pathName.split(".").reduce((value, key) => value?.[key], load());
}

module.exports = { DEFAULT_CONFIG, load, save, get, CONFIG_PATH };

if (require.main === module) {
  console.log(JSON.stringify(load(), null, 2));
}
