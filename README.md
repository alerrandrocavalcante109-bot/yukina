# Yukina

Bot para Discord em Node.js com Discord.js v14, comandos slash modulares e tratamento centralizado de erros.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação e um bot criados no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação

```bash
npm install
cp .env.example .env
```

Edite o arquivo `.env` local e preencha `DISCORD_TOKEN` e `CLIENT_ID`. Opcionalmente, defina `GUILD_ID` para registrar comandos em um servidor de teste.

## Registrar os comandos

```bash
npm run deploy
```

Com `GUILD_ID`, os comandos são registrados no servidor de teste e normalmente ficam disponíveis mais rápido. Sem ele, o registro é global e pode levar algum tempo para aparecer.

## Iniciar o bot

```bash
npm start
```

Durante o desenvolvimento, use `npm run dev` com uma versão compatível do Node.js.

## Adicionar comandos

Crie um arquivo JavaScript em `commands/` que exporte `data` (um `SlashCommandBuilder`) e uma função assíncrona `execute(interaction)`. Depois execute `npm run deploy` novamente.

## Segurança

- Nunca faça commit do arquivo `.env` nem compartilhe o token do bot.
- Se o token for exposto, regenere-o no Developer Portal.
- Conceda ao bot apenas as permissões necessárias.

## Atualização automática do Aeternus

A Yukina pode monitorar o repositório do Aeternus a cada 5 segundos e acionar um novo deploy no Render quando detectar um commit novo.

Configure estas variáveis no ambiente da Yukina:

- `AETERNUS_REPO`: repositório no formato `owner/repository` (também aceita a URL do GitHub).
- `AETERNUS_BRANCH`: branch monitorada; padrão: `main`.
- `AETERNUS_RENDER_DEPLOY_HOOK`: URL secreta do Deploy Hook do serviço Aeternus no Render.
- `GITHUB_TOKEN`: opcional; recomendado se o repositório do Aeternus for privado.

A primeira verificação apenas registra o commit atual como referência. Um commit novo detectado depois disso dispara o Deploy Hook uma única vez.

