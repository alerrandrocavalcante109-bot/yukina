# Yukina Manager — Runner

Esta é a **Parte 1** do sistema de gerenciamento do Lavalink.

O Runner é responsável somente pela execução básica do Lavalink. A API, sistema de requisições, configuração avançada e monitoramento externo serão adicionados em etapas posteriores.

## Comandos

Na raiz do projeto:

```bash
node manager/runner/index.js start
node manager/runner/index.js stop
node manager/runner/index.js restart
node manager/runner/index.js status
node manager/runner/index.js logs
```

## O que ele faz

- inicia o serviço Lavalink usando Docker Compose;
- para o serviço;
- reinicia o serviço;
- consulta o estado do container;
- registra saídas em `manager/logs/lavalink.log`;
- utiliza o `restart: unless-stopped` já definido no Compose para recuperação automática do container.

## Estrutura

```text
manager/
├── logs/
└── runner/
    ├── index.js
    └── README.md
```

O Runner precisa ser executado em uma máquina/servidor que tenha Docker disponível. O GitHub Pages continua sendo apenas a parte estática do projeto.
