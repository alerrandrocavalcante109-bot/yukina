# Yukina Manager — Execution

A **Parte 2** é a camada de execução do Yukina Manager.

Ela fica entre futuros sistemas externos e o Runner:

```text
Sistema futuro
      ↓
  Execution
      ↓
    Runner
      ↓
   Docker
      ↓
  Lavalink
```

## Função

O Execution recebe uma ação controlada e chama o Runner correspondente.

Ações disponíveis:

- `start`
- `stop`
- `restart`
- `status`
- `logs`

Exemplo:

```bash
node manager/execution/index.js status
node manager/execution/index.js start
node manager/execution/index.js restart
node manager/execution/index.js logs
```

O resultado é retornado em JSON, preparando essa camada para ser utilizada posteriormente pela API.

## Limite desta etapa

Esta parte **não abre uma porta HTTP** e não recebe comandos arbitrários do sistema operacional. Ela apenas aceita as ações previamente definidas e encaminha cada uma ao Runner.

O Runner continua sendo o responsável por executar os comandos Docker Compose.
