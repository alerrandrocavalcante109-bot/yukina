# Yukina

Bot para Discord em Node.js com Discord.js v14, comandos slash modulares e tratamento centralizado de erros.

## Requisitos

- Node.js 20 ou superior
- Git instalado e acessível no PATH
- Uma aplicação e um bot criados no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação

```bash
npm install
cp .env.example .env
```

Edite o arquivo `.env` local e preencha `DISCORD_TOKEN` e `CLIENT_ID`. Para configurar o prefixo de mensagens, use `YUKINA_PREFIX=Y`. Não use a variável `PREFIX`, pois ela já é usada pelo Termux. Opcionalmente, defina `GUILD_ID` para registrar comandos de teste rapidamente.

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

Crie um arquivo JavaScript em `commands/` que exporte `data` (um `SlashCommandBuilder`) e uma função assíncrona `execute(interaction)`. Para aceitar comandos por prefixo, o arquivo também deve exportar `prefix: { name: 'nome', aliases: [], async execute(message, args) { ... } }`. Depois execute `npm run deploy` novamente se alterou os comandos slash.

## Segurança

- Nunca faça commit do arquivo `.env` nem compartilhe o token do bot ou o Deploy Hook do Render.
- Se um segredo for exposto, revogue-o e gere outro no serviço correspondente.
- Conceda ao bot apenas as permissões necessárias.
- O bot precisa da opção **Message Content Intent** habilitada no Discord Developer Portal para ler comandos por prefixo em mensagens.

## Atualização automática da Yukina

Enquanto a Yukina estiver rodando, o atualizador verifica a branch `main` do próprio repositório a cada 60 segundos. Quando detecta um commit novo, só aplica atualização se a branch e a árvore de trabalho estiverem em estado seguro; usa fast-forward, instala dependências quando os arquivos de dependência mudam e reinicia o processo.

A sincronização Git tem limite de tempo de 30 segundos e tenta novamente o `git fetch` uma vez após uma falha. Isso ajuda a lidar com falhas transitórias de rede, mas não consegue impedir que o Android encerre o processo por falta de memória ou por restrições de segundo plano.

## Atualização automática do Aeternus

A Yukina monitora o repositório do Aeternus a cada 60 segundos e aciona um novo deploy no Render quando detecta um commit novo. O Aeternus continua hospedado no Render; a Yukina não baixa nem executa o serviço Aeternus localmente no Termux.

Configure estas variáveis no ambiente da Yukina:

- `AETERNUS_REPO`: repositório no formato `owner/repository` (também aceita a URL do GitHub).
- `AETERNUS_BRANCH`: branch monitorada; padrão: `main`.
- `AETERNUS_RENDER_DEPLOY_HOOK`: URL secreta do Deploy Hook do serviço Aeternus no Render; deve usar HTTPS.
- `GITHUB_TOKEN`: opcional; recomendado se o repositório do Aeternus for privado.

As consultas de rede do monitor têm limite de tempo. A primeira verificação apenas registra o commit observado como referência; um commit novo detectado depois disso dispara o Deploy Hook. O Render ainda precisa concluir o deploy, portanto o log da Yukina confirma que o deploy foi solicitado, não que o serviço já esteja saudável.
