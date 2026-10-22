const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const parts = [1, 2, 3, 4].map((i) => fs.readFileSync(path.join(__dirname, `yukina-part-${i}.js`), "utf8"));
const m = new Module(path.join(__dirname, "index.runtime.js"));
m.filename = path.join(__dirname, "index.runtime.js");
m.paths = Module._nodeModulePaths(__dirname);
m._compile(parts.join(""), m.filename);
