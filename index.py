"""Entrada do bot Yukina com endpoint HTTP de saúde para o Render."""
import asyncio
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    import discord
    from aiohttp import web
except ImportError:
    print("Dependência ausente: instale com: python -m pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(1)

load_dotenv(Path(__file__).resolve().parent / ".env")
TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
if not TOKEN:
    print("Erro: DISCORD_TOKEN não foi definido nas variáveis de ambiente.", file=sys.stderr)
    raise SystemExit(1)

intents = discord.Intents.default()
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Yukina conectada como {client.user} (ID: {client.user.id})", flush=True)

async def health(_request):
    return web.json_response({"ok": True, "service": "Yukina Bot"})

async def main():
    app = web.Application()
    app.router.add_get("/", health)
    app.router.add_get("/api/health", health)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.getenv("PORT", "10000"))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"Health endpoint ativo na porta {port}", flush=True)
    try:
        await client.start(TOKEN)
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
