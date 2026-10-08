# Yukina Manager — Requests

A **Parte 4** cria a camada de solicitações do Manager.

Ela é responsável por transformar uma intenção em uma solicitação identificável e validada antes da execução.

## Fluxo

```text
Cliente
  ↓
 API
  ↓
Requests  ← Parte 4
  ↓
Execution
  ↓
Runner
  ↓
Lavalink
```

## Responsabilidades

- aceitar somente ações previamente definidas;
- gerar um ID único para cada solicitação;
- registrar a data de criação;
- validar a estrutura da solicitação;
- aplicar um limite básico de requisições por identificador;
- não executar comandos diretamente.

As ações permitidas atualmente são:

```text
start
stop
restart
status
logs
```

## Exemplo

```bash
node manager/requests/index.js status
```

O módulo também pode ser usado por outras partes do Manager:

```js
const { create, validate, checkRateLimit } = require("./manager/requests");
```

O controle de autenticação e permissões ficará separado para uma etapa posterior.
