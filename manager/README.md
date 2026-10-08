# Yukina Manager

Sistema próprio para gerenciar a execução do Lavalink.

## Arquitetura

```text
                 ┌──────────────┐
                 │    Cliente   │
                 └──────┬───────┘
                        │ HTTP
                 ┌──────▼───────┐
                 │      API     │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │   Requests   │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │  Execution   │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │    Runner    │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │    Docker    │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │   Lavalink   │
                 └──────────────┘

       ┌───────────────┐
       │ Configuration │
       └───────────────┘
       ┌───────────────┐
       │ Authentication│
       └───────────────┘
       ┌───────────────┐
       │    Monitor    │
       └───────────────┘
