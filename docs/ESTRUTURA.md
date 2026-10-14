# Organização do repositório

## Por que as páginas continuam na raiz?

As páginas HTML existentes usam links relativos e são publicadas pelo workflow do GitHub Pages a partir da raiz. Mover tudo de uma vez poderia quebrar URLs, imagens, scripts, autenticação OAuth, CNAME e a verificação do Google. Por isso, esta organização agrupa documentação e separa os serviços sem alterar os caminhos públicos atuais.

## Mapa de pastas

```text
/
├── .github/workflows/   # Deploy do GitHub Pages
├── assets/              # Imagens/recursos referenciados pelas páginas
├── docs/                # Documentação do projeto
├── bot/                 # Ponto de entrada para o projeto do bot Discord
├── vip-api/             # Cloudflare Worker e schema D1 da API VIP
├── index.html           # Página principal (manter na raiz)
├── vip.html             # Catálogo VIP (manter na raiz)
├── vip-comprovante.html # Protótipo de comprovante (manter na raiz)
├── wiki.html            # Wiki pública (manter na raiz)
└── *.js / *.html        # Scripts e páginas que ainda usam caminhos relativos
```

## Regras para não quebrar o site

1. Não mover páginas HTML nem scripts da raiz até mapear e atualizar todos os links relativos, redirects OAuth, caminhos do Worker e configuração de publicação.
2. Não renomear nem mover `CNAME` ou o arquivo de verificação do Google.
3. Manter `vip-api/` no local atual enquanto o Cloudflare Worker estiver configurado para esse diretório.
4. Testar a branch e o workflow Pages antes de mesclar qualquer refatoração maior.
5. Nunca adicionar `.env`, tokens, bancos de dados locais, `node_modules/`, caches ou comprovantes ao Git.

## Estado do sistema VIP

A API tem autenticação Discord em preparação; checkout, envio de comprovantes e webhook de pagamento respondem indisponível por padrão. A pasta `bot/` documenta o local do futuro serviço Discord; não representa por si só um bot já implantado.
