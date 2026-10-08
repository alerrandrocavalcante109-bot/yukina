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
- verifica o container e a disponibilidade real pela API do Lavalink;
- para e reinicia o serviço;
- captura os logs do container em `manager/logs/lavalink.log`;
- expõe um status JSON simples;
- oferece o modo `watch`, que verifica o serviço periodicamente e solicita reinício quando ele fica indisponível.

### Comandos

```bash
node manager/runner/index.js start
node manager/runner/index.js stop
node manager/runner/index.js restart
node manager/runner/index.js status
node manager/runner/index.js logs
node manager/runner/index.js watch
```

O Compose continua usando `restart: unless-stopped`, que é a política de reinício automático do container. O modo `watch` adiciona uma camada de monitoramento do próprio Manager. citeturn0search0turn0search3

O GitHub Pages continua sendo apenas a parte estática do projeto.
