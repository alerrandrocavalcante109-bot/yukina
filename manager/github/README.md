# Yukina Manager — GitHub Access

Este módulo é responsável pelo **login do Manager no GitHub e pelo acesso ao repositório configurado**.

## Credenciais

Use variáveis de ambiente:

- `GITHUB_TOKEN` — credencial de acesso ao GitHub.
- `GITHUB_REPOSITORY` — repositório no formato `owner/repository`.

O valor padrão de `GITHUB_REPOSITORY` é:

`alerrandrocavalcante109-bot/yukina`

O token nunca deve ser salvo no código, no `.env.example` ou no repositório.

## Operações

### Verificar login

```bash
node manager/github/index.js
```

O módulo consulta a identidade autenticada e verifica o acesso ao repositório.

### Pela aplicação

```js
const github = require("./manager/github");

const user = await github.login();
const repo = await github.repository();
const file = await github.file("README.md");
```

## Segurança

O módulo usa o cabeçalho `Authorization: Bearer` e a API oficial do GitHub. O token deve possuir somente as permissões necessárias para o repositório que o Manager precisa administrar.

Não registre o token nos logs.
