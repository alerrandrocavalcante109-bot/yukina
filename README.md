# Yukina

Bot de Discord + Lavalink

---

## Lavalink

Este repositório contém a configuração pronta para rodar um servidor **Lavalink** (usado para música no Discord).

### Como subir o Lavalink

1. Entre na pasta:
```bash
cd lavalink
```

2. Suba com Docker:
```bash
docker compose up -d
```

3. Pronto. O Lavalink estará rodando na porta **2333**.

### Configuração importante

Arquivo: `lavalink/application.yml`

- **Senha:** definida pela variável `LAVALINK_SERVER_PASSWORD`
  → Não armazene a senha diretamente no repositório.

- Porta: `2333`
- Plugin do YouTube já incluído (versão 1.18.2)

### Como conectar no bot

No seu bot (ex: discord.js, discord.py, etc), use:

- Host: `IP_DO_SEU_SERVIDOR`
- Port: `2333`
- Password: valor definido em `LAVALINK_SERVER_PASSWORD`

---

## Site da Yukina

O site estático continua disponível normalmente (`index.html`).
