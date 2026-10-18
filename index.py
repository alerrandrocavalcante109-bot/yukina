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
from ai_server_builder import create_plan, build_server, format_plan
TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
if not TOKEN:
    print("Erro: DISCORD_TOKEN não foi definido nas variáveis de ambiente.", file=sys.stderr)
    raise SystemExit(1)

intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Yukina conectada como {client.user} (ID: {client.user.id})", flush=True)

@client.event
async def on_message(message: discord.Message):
    if message.author.bot or client.user is None:
        return
    if not message.guild or client.user not in message.mentions:
        return
    if not message.author.guild_permissions.manage_guild and not message.author.guild_permissions.administrator:
        await message.reply("Para montar canais, categorias e cargos, você precisa ter **Gerenciar servidor** ou **Administrador**.", mention_author=False)
        return

    me = message.guild.me
    if me is None or not me.guild_permissions.manage_channels or not me.guild_permissions.manage_roles:
        await message.reply("Preciso das permissões **Gerenciar canais** e **Gerenciar cargos**. Confira também se meu cargo está acima dos cargos que devo criar.", mention_author=False)
        return

    request = message.content
    for mention in message.mentions:
        request = request.replace(f"<@{mention.id}>", "").replace(f"<@!{mention.id}>", "")
    request = request.strip()
    if not request:
        await message.reply("Oi! Me marque e diga o que você quer montar. Exemplo: @Yukina crie um servidor gamer com categorias, canais de texto/voz e cargos coloridos.", mention_author=False)
        return

    async with message.channel.typing():
        try:
            plan = await create_plan(request)
            preview = format_plan(plan)
            await message.reply(preview + "\n\nVou criar essa estrutura agora. Não vou apagar nem alterar canais ou cargos existentes.", mention_author=False)
            created = await build_server(message.guild, plan)
            summary = "\n".join(f"• {line}" for line in created[:40]) or "Nenhum item novo foi necessário; os itens já existiam ou o plano veio vazio."
            await message.channel.send(f"**Yukina concluiu!**\n{summary}"[:1900])
        except Exception as exc:
            print(f"Erro no construtor de servidor IA: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            await message.reply(f"Não consegui concluir a montagem: {str(exc)[:700]}", mention_author=False)

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
