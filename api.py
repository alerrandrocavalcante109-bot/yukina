"""API da Yukina para o painel web.

Pode ser executada junto ao bot no Termux ou como serviço web separado.
O token do bot fica exclusivamente no servidor.
"""
import json
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
ALLOWED_ORIGINS = [
    item.strip() for item in os.getenv(
        "PANEL_ORIGINS", "https://yukina-6uo.pages.dev"
    ).split(",") if item.strip()
]
DATA_FILE = Path(os.getenv("YUKINA_SETTINGS_FILE", "data/guild-settings.json"))
DISCORD_API = "https://discord.com/api/v10"

app = FastAPI(title="Yukina API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

class Settings(BaseModel):
    welcome: bool = False
    moderation: bool = False
    notifications: bool = False

    class Config:
        extra = "forbid"

def read_settings() -> dict[str, Any]:
    try:
        return json.loads(DATA_FILE.read_text("utf-8"))
    except FileNotFoundError:
        return {}
    except (json.JSONDecodeError, OSError):
        raise HTTPException(500, "Não foi possível ler as configurações salvas.")

def write_settings(data: dict[str, Any]) -> None:
    try:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp = DATA_FILE.with_suffix(".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        temp.replace(DATA_FILE)
    except OSError:
        raise HTTPException(500, "Não foi possível salvar as configurações. Configure armazenamento persistente.")

async def discord_get(path: str, token: str, *, bot: bool = False):
    prefix = "Bot " if bot else "Bearer "
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            DISCORD_API + path,
            headers={"Authorization": prefix + token},
        )
    if response.status_code in (401, 403):
        raise HTTPException(401 if not bot else 503, "Autorização do Discord inválida ou insuficiente.")
    if response.status_code == 404:
        raise HTTPException(404, "Servidor não encontrado ou Yukina não está nele.")
    if response.status_code >= 400:
        raise HTTPException(502, "O Discord não conseguiu concluir a solicitação.")
    return response.json()

def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Entre com sua conta Discord.")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Entre com sua conta Discord.")
    return token

async def authorize_guild(guild_id: str, user_token: str) -> dict:
    user = await discord_get("/users/@me", user_token)
    guilds = await discord_get("/users/@me/guilds", user_token)
    guild = next((g for g in guilds if g.get("id") == guild_id), None)
    if not guild:
        raise HTTPException(403, "Este servidor não pertence à sua conta Discord.")
    try:
        permissions = int(guild.get("permissions", "0"))
    except (TypeError, ValueError):
        permissions = 0
    if not (permissions & 0x8 or permissions & 0x20):
        raise HTTPException(403, "É necessário ser administrador ou ter Gerenciar servidor.")
    if not DISCORD_TOKEN:
        raise HTTPException(503, "DISCORD_TOKEN não está configurado no servidor da API.")
    await discord_get(f"/guilds/{guild_id}", DISCORD_TOKEN, bot=True)
    return {"user": user, "guild": guild}

@app.get("/api/health")
async def health():
    return {"ok": True, "service": "Yukina API", "bot_token_configured": bool(DISCORD_TOKEN)}

@app.get("/api/guilds/{guild_id}/settings")
async def get_guild_settings(guild_id: str, authorization: str | None = Header(default=None)):
    await authorize_guild(guild_id, bearer(authorization))
    data = read_settings()
    return {"guild_id": guild_id, "settings": data.get(guild_id, {
        "welcome": False, "moderation": False, "notifications": False
    })}

@app.put("/api/guilds/{guild_id}/settings")
async def put_guild_settings(guild_id: str, settings: Settings, authorization: str | None = Header(default=None)):
    await authorize_guild(guild_id, bearer(authorization))
    data = read_settings()
    data[guild_id] = settings.dict()
    write_settings(data)
    return {"ok": True, "guild_id": guild_id, "settings": data[guild_id]}

@app.delete("/api/guilds/{guild_id}/settings")
async def delete_guild_settings(guild_id: str, authorization: str | None = Header(default=None)):
    await authorize_guild(guild_id, bearer(authorization))
    data = read_settings()
    data.pop(guild_id, None)
    write_settings(data)
    return {"ok": True, "guild_id": guild_id}
