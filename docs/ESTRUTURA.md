# Estrutura do repositório Yukina

## Princípio

- **Site estático** (HTML/CSS/JS do painel) permanece na **raiz** para o GitHub Pages continuar funcionando sem mudança de URLs.
- **Bot + API** ficam em `src/`, com `index.js` só como ponto de entrada.

## Árvore (código Node)

```
index.js                 # Entrada fina: cria client, registra eventos, sobe API, login
src/
  config.js              # Variáveis de ambiente (TOKEN, Mongo, CORS, PORT…)
  bootstrap.js           # initializeDiscord + shutdown limpo
  bot/
    client.js            # Factory do Discord.js Client
    systems-loader.js    # Carrega rank, XP, temporal, interactions…
    events.js            # Gateway, clientReady, messageCreate, slash, AI builder
  ai/
    server-builder.js    # Planejamento com IA + criação/exclusão de canais/cargos
  systems/
    counting.js          # Sistema de contagem (fila por guild)
  api/
    settings.js          # Coleção guild_settings (Mongo)
    auth.js              # authorizePanel + cache OAuth de guilds
    panel.js             # Rotas /api/* do painel
    server.js            # http.createServer + listen
```

## Na raiz (já existentes)

| Pasta/arquivo | Papel |
|---------------|--------|
| `commands/` | Slash e prefixo |
| `components/` | Botões / selects / modais |
| `*-system.js`, `system-storage.js`, … | Sistemas e persistência |
| `*.html`, `assets/`, `CNAME` | Site + painel (Pages) |
| `vip-api/` | Worker Cloudflare |

## Por que não mover o HTML

O workflow `.github/workflows/pages.yml` publica a raiz. Mover páginas quebraria links públicos (`/configuracoes-servidor.html`, `/login.html`, etc.) e o `CNAME`.

## Como rodar

```bash
npm install
cp .env.example .env   # preencher
npm start              # node index.js
```
