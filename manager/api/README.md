# Yukina Manager — API

A **Parte 3** adiciona uma API HTTP para controlar o Manager.

A API usa o módulo HTTP nativo do Node.js, sem dependências externas. O Node.js fornece `http.createServer()` para criar servidores HTTP. citeturn0search0

## Iniciar

Na raiz do projeto:

```bash
node manager/api/index.js
```

Por padrão:

- Host: `127.0.0.1`
- Porta: `8080`

Podem ser alterados pelas variáveis `API_HOST` e `API_PORT`.

## Endpoints

### GET

```text
/
 /api/health
 /api/status
```

### POST

```text
/api/start
/api/stop
/api/restart
/api/logs
```

## Arquitetura

```text
Cliente
  ↓ HTTP
 API
  ↓
Execution
  ↓
Runner
  ↓
Docker
  ↓
Lavalink
```

## Segurança nesta etapa

A API fica limitada a `127.0.0.1` por padrão. Ela **não deve ser exposta diretamente à internet** ainda.

Autenticação, permissões, HTTPS e exposição externa serão tratados em uma etapa própria antes de abrir essa API para o painel.
