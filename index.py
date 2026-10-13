"""Entrada do bot Yukina.

As credenciais são carregadas de variáveis de ambiente; em desenvolvimento,
python-dotenv lê o arquivo .env local. Nunca coloque o .env no Git.
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("Dependência ausente: instale com: python -m pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1)

# Carrega .env da pasta deste arquivo, independente da pasta atual do terminal.
load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    import discord
except ImportError:
    print("Dependência ausente: instale com: python -m pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1)

TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
if not TOKEN:
    print("Erro: DISCORD_TOKEN não foi definido. Crie um .env baseado em .env.example.", file=sys.stderr)
    raise SystemExit(1)

intents = discord.Intents.default()
client = discord.Client(intents=intents)


@client.event
async def on_ready():
    print(f"Yukina conectada como {client.user} (ID: {client.user.id})")


if __name__ == "__main__":
    client.run(TOKEN)
