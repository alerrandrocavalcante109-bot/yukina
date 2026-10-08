# Yukina Manager — Monitor

Monitora o estado do Lavalink em intervalos regulares.

Funções:

- consultar o status;
- detectar indisponibilidade;
- solicitar reinício automático;
- registrar o resultado no stdout.

Configuração por ambiente:

- MONITOR_INTERVAL_MS — padrão: 15000;
- MONITOR_AUTO_RESTART — padrão: true.

O monitor é um processo separado e não substitui o restart: unless-stopped do Docker Compose.
