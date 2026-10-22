# Yukina

Bot Discord + painel web de configurações da Yukina (guardiã da neve e do luar).

## Estrutura principal

| Caminho | Função |
|---------|--------|
| `index.js` | Entrada do bot Discord + API HTTP do painel |
| `commands/` | Comandos slash e prefixo |
| `components/` | Botões, selects e modais |
| `configuracoes-servidor.html` | Painel de configurações por servidor |
| `system-storage.js` | Persistência genérica (MongoDB) |
| `guild-settings-store.js` | Leitura em cache das configs do painel |
| `vip-api/` | Worker Cloudflare (OAuth / VIP) |
| `assets/` | CSS, JS e imagens do site |

Site estático: GitHub Pages (`yukina-6uo.pages.dev`).  
API do painel: serviço Node (ex.: Render) apontado em `api-config.js`.

## Requisitos

- Node.js ≥ 20
- MongoDB Atlas (`MONGODB_URI`, `MONGODB_DB`)
- Token do bot (`DISCORD_TOKEN`)

## Configuração rápida

```bash
cp .env.example .env
# preencha DISCORD_TOKEN, MONGODB_URI, etc.
npm install
npm start
```

Registre os comandos slash:

```bash
npm run deploy:commands
```

No `api-config.js`, defina a URL pública da API (sem barra final):

```js
window.YUKINA_API_URL = "https://seu-servico.onrender.com";
```

## Painel

- `/painel` no Discord abre o painel do servidor atual.
- OAuth Discord (identify + guilds) é usado para autorizar.
- Configurações são salvas em `guild_settings` e sincronizadas com sistemas (XP, hierarquia temporal, contagem, etc.).

## Segurança

- Nunca commite `.env` ou tokens.
- Pagamentos VIP permanecem manuais até o fluxo de checkout/webhook estar completo e testado.
