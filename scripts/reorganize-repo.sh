#!/usr/bin/env bash
# Reorganiza o repositório Yukina: bot/, website/, tools/
# Rode na raiz do clone (branch main com a estrutura antiga).
set -euo pipefail

if [ ! -f package.json ] || [ ! -f index.js ]; then
  echo "Execute este script na raiz do repositório Yukina (com index.js na raiz)."
  exit 1
fi

if [ -d bot ] || [ -d website ]; then
  echo "Pastas bot/ ou website/ já existem. Abortando para não sobrescrever."
  exit 1
fi

echo "→ Criando pastas..."
mkdir -p bot website tools/server-builder bot/assets/images/rank

echo "→ Movendo bot..."
for f in index.js command-engine.js custom-command-engine.js deploy-commands.js interaction.js \
  counting-number-parser.js economia-saldo.js guild-settings-store.js member-data.js \
  rank-system.js role-expiration-system.js system-storage.js staff-promotion-announcements.js \
  time-role-system.js xp-level-system.js daily-reminders.js vip-reminders.js vip-store.js; do
  [ -f "$f" ] && git mv "$f" "bot/$f"
done
for d in commands components systems; do
  [ -d "$d" ] && git mv "$d" "bot/$d"
done
[ -d tests ] && git mv tests bot/tests

echo "→ Movendo website..."
for f in index.html login.html comandos.html daily.html vip.html vip-comprovante.html \
  loja.html wiki.html sistemas.html configuracoes.html configuracoes-servidor.html \
  visao-geral-servidor.html painel-economia.html drop-config.html \
  googleb04baa779fbc794f.html tema.js vip-menu.js wiki-menu.js api-config.js CNAME; do
  [ -f "$f" ] && git mv "$f" "website/$f"
done
[ -d assets ] && git mv assets website/assets
[ -d imagem-daily ] && git mv imagem-daily website/imagem-daily

echo "→ Assets de rank para o bot..."
if [ -f website/assets/images/rank/Rank.kz.png ]; then
  cp website/assets/images/rank/Rank.kz.png bot/assets/images/rank/
  cp website/assets/images/rank/Rank.xp.png bot/assets/images/rank/
  git add bot/assets
fi

echo "→ Tools Python..."
for f in index.py ai_server_builder.py requirements.txt; do
  [ -f "$f" ] && git mv "$f" "tools/server-builder/$f"
done

echo "→ Removendo desnecessários..."
[ -f imagens-links ] && git rm -f imagens-links || true
[ -f teste-api.html ] && git rm -f teste-api.html || true
if git ls-files node_modules 2>/dev/null | grep -q .; then
  git rm -r --cached node_modules || true
fi
rm -rf node_modules

echo "→ Atualizando package.json, Procfile, workflows..."
cat > package.json << 'EOF'
{
  "name": "yukina",
  "version": "1.0.0",
  "private": true,
  "description": "Yukina — bot Discord + site (painel, daily, VIP)",
  "main": "bot/index.js",
  "scripts": {
    "start": "node bot/index.js",
    "deploy:commands": "node bot/deploy-commands.js",
    "test": "node --test bot/tests/**/*.js",
    "migrate:economy:global": "node scripts/migrate-economy-global.js"
  },
  "engines": {
    "node": ">=24.17.0"
  },
  "dependencies": {
    "@discordjs/voice": "^0.19.2",
    "@napi-rs/canvas": "^0.1.80",
    "discord.js": "^14.22.1",
    "dotenv": "^16.4.7",
    "ffmpeg-static": "^5.2.0",
    "mongodb": "^6.20.0",
    "opusscript": "^0.0.8",
    "prism-media": "^1.3.5",
    "gif-encoder-2": "^1.0.5"
  }
}
EOF

echo 'web: node bot/index.js' > Procfile

mkdir -p .github/workflows
cat > .github/workflows/pages.yml << 'EOF'
name: Deploy Yukina site to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Configure GitHub Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true
      - name: Inject navigation scripts into homepage
        run: |
          sed -i 's#</body>#<script src="./wiki-menu.js" defer></script><script src="./vip-menu.js" defer></script></body>#i' website/index.html
      - name: Upload site artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: website
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
EOF

cat > .github/workflows/tests.yml << 'EOF'
name: Yukina tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  calculator-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install
      - run: npm test
EOF

cat > .gitignore << 'EOF'
.env
.env.*
!.env.example
!.env.production.example
*.pem
*.key
node_modules/
npm-debug.log*
.yarn/
dist/
build/
.cache/
__pycache__/
*.py[cod]
.venv/
venv/
.DS_Store
Thumbs.db
.idea/
.vscode/
data/
*.log
EOF

cat > README.md << 'EOF'
# Yukina

Bot de Discord + site (painel, daily, VIP).

## Estrutura

- `bot/` — código do bot (Node.js + discord.js)
- `website/` — site estático (GitHub Pages)
- `scripts/` — migrações
- `tools/` — utilitários opcionais
- `vip-api/` — worker/API de VIP

## Bot

```bash
cp .env.example .env
npm install
npm start
```

## Site

Deploy automático da pasta `website/` no GitHub Pages.
EOF

git add -A
echo "✓ Pronto. Revise com: git status"
echo "Depois: git commit -m 'chore: reorganizar bot/, website/, tools/' && git push"
