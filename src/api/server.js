"use strict";

const http = require("node:http");
const { PORT } = require("../config");
const { panelApi } = require("./panel");

function startApiServer(client) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    panelApi(req, res, url, client).catch((error) => {
      console.error("[API]", error?.message || error);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ detail: "Erro interno da API." }));
      } else {
        res.end();
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`API do painel e health endpoint ativos na porta ${PORT}`);
  });

  return server;
}

module.exports = { startApiServer };
