# Yukina VIP API — setup seguro

Esta etapa adiciona a base de login Discord e o esquema inicial do D1. **Pagamentos continuam desativados**: `POST /api/vip/checkout`, `POST /api/vip/webhook` e `POST /api/vip/proofs` continuam respondendo 503.

## Arquivos desta etapa

- `worker.js`: rotas OAuth Discord, sessão opaca em cookie HttpOnly e endpoints de sessão.
- `schema.sql`: tabelas D1 para usuários Discord, estados OAuth e sessões.
- `AUTH_SETUP.md`: configuração e validação manual.

## Configuração Cloudflare

1. Crie um banco D1 no painel Cloudflare e aplique `schema.sql` com o comando D1 correspondente.
2. Configure o binding D1 com o nome `DB` no Worker.
3. Em Discord Developer Portal, crie/seleciona a aplicação, habilite OAuth2 e adicione como Redirect URL exatamente a URL pública do Worker seguida de `/auth/discord/callback`.
4. Configure estes valores no Worker, não no Pages, HTML, GitHub ou mensagens:
   - `DISCORD_CLIENT_ID`: variável de ambiente.
   - `DISCORD_CLIENT_SECRET`: secret.
   - `DISCORD_REDIRECT_URI`: variável contendo a URL completa de callback que foi registrada.
5. Configure o domínio público do Worker e confirme que a URL está em HTTPS.
6. Abra `/health`: `discordLoginConfigured` só indica presença de configuração, não comprova que o OAuth está funcionando.
7. Teste login, logout e sessão com uma conta de teste. Confirme que cookie é Secure/HttpOnly e que não aparecem tokens nos logs.

## Rotas

- `GET /auth/discord`: inicia OAuth com `state` aleatório, armazenado como hash e com validade curta.
- `GET /auth/discord/callback`: consome o estado uma única vez, troca o código no Discord e cria sessão.
- `GET /api/auth/me`: retorna o usuário autenticado ou `authenticated: false`.
- `POST /api/auth/logout`: encerra a sessão e exige o Origin do site.
- `GET /api/vip/plans`: lista os preços em centavos.
- Checkout, comprovantes e webhook permanecem desativados.

## Importante sobre domínios e cookies

O Worker permite CORS apenas para `https://yukina-6uo.pages.dev`. Se a loja for servida por um domínio próprio, ajuste a allowlist de forma explícita no Worker. Não use `Access-Control-Allow-Origin: *` com cookies. O cookie de sessão usa `Secure; HttpOnly; SameSite=None` porque a página Pages e o endpoint Worker podem estar em sites diferentes. O navegador deve chamar os endpoints de sessão com `credentials: "include"`.

## Próxima etapa

Depois que o login for testado no ambiente real, integrar os botões da página com o endpoint `/auth/discord`, e então implementar checkout Pix com preço validado no servidor, idempotência, consulta do pagamento no Mercado Pago e validação HMAC do webhook. Não habilite produção de pagamentos antes desses testes.

Nunca coloque Access Token do Mercado Pago, Client Secret Discord ou segredo de webhook em arquivos versionados.
