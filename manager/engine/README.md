# Yukina Manager — Engine

O **Engine** é o motor de permanência do Manager.

Ele mantém o Runner executando continuamente.

## Fluxo

```text
Engine
   │
   └── Runner (watch)
          │
          └── Lavalink
```

## Responsabilidades

- iniciar o Runner automaticamente;
- manter o Runner ativo;
- detectar se o processo do Runner encerrou;
- iniciar o Runner novamente;
- registrar eventos em `manager/logs/engine.log`;
- encerrar o Runner de forma controlada quando o Engine receber SIGINT/SIGTERM.

## Iniciar

Na raiz do projeto:

```bash
node manager/engine/index.js
```

O Engine não substitui o Runner. Ele é a camada superior responsável por manter o Runner vivo.

Variáveis opcionais:

- `ENGINE_RESTART_DELAY_MS` — atraso antes de relançar o Runner, padrão 3000 ms.
- `ENGINE_CHECK_MS` — intervalo de verificação, padrão 5000 ms.
