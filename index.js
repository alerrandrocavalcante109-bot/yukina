/**
 * Yukina entry — reconstitui o app a partir de partes versionadas no repo.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const a = fs.readFileSync(path.join(__dirname, "yukina-part-a.js"), "utf8");
const b = fs.readFileSync(path.join(__dirname, "yukina-part-b.js"), "utf8");
const m = new Module(path.join(__dirname, "index.runtime.js"));
m.filename = path.join(__dirname, "index.runtime.js");
m.paths = Module._nodeModulePaths(__dirname);
m._compile(a + b, m.filename);
