"""Ponto de entrada mínimo do bot Yukina (discord.py).

Configure DISCORD_TOKEN como variável de ambiente antes de executar:
    python index.py
"""

import os
import sys

try:
    import discord
except ImportError:
    print("Dependência ausente: instale discord.py com: python -m pip install -U discord.py", file=sys.stderr)
    raise SystemExit(1)

TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    print("Erro: defina a variável de ambiente DISCORD_TOKEN com o token do bot.", file=sys.stderr)
    raise SystemExit(1)

intents = discord.Intents.default()

client = discord.Client(intents=intents)


@client.event
async def on_ready():
    print(f"Yukina conectada como {client.user} (ID: {client.user.id})")


if __name__ == "__main__":
    client.run(TOKEN)
