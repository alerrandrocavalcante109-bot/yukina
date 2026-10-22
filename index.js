const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const parts = [1,2,3,4,5,6,7,8].map((i) => {
  const b64 = fs.readFileSync(path.join(__dirname, `yukina-b64-${i}.txt`), "utf8").trim();
  return Buffer.from(b64, "base64").toString("utf8");
});
const m = new Module(path.join(__dirname, "index.runtime.js"));
m.filename = path.join(__dirname, "index.runtime.js");
m.paths = Module._nodeModulePaths(__dirname);
m._compile(parts.join(""), m.filename);
