"""Construtor de estrutura de servidor Discord com apoio de IA."""
import json
import os
import re

import aiohttp
import discord

AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_API_URL = os.getenv("AI_API_URL", "https://openrouter.ai/api/v1/chat/completions").strip()
AI_MODEL = os.getenv("AI_MODEL", "meta-llama/llama-3.3-70b-instruct:free").strip()

SYSTEM_PROMPT = """Você é a planejadora de servidores Discord da Yukina. Converta o pedido em um plano JSON válido, sem Markdown, com esta estrutura:
{
 "style_tips": ["dica de estilo", "..."],
 "roles": [{"name":"Nome","color":"#5865F2","hoist":false,"mentionable":false}],
 "categories": [{"name":"Nome"}],
 "channels": [{"name":"nome-do-canal","type":"text|voice|forum|stage","category":"Nome exato da categoria ou null","topic":"descrição curta"}]
}
Crie apenas o que foi pedido e complemente com sugestões úteis. Nomes de canais em minúsculas com hífens são preferíveis. Cores devem ser HEX. Não inclua permissões administrativas nos cargos; a aplicação usará permissões seguras padrão. Limites: até 12 cargos, 12 categorias e 30 canais. Para categorias/canais, mantenha nomes únicos e coerentes. Responda SOMENTE com JSON válido.
"""

def _clean_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$", "", text, flags=re.I)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("A IA não retornou um JSON válido.")
    return json.loads(text[start:end + 1])

async def create_plan(prompt: str) -> dict:
    if not AI_API_KEY:
        raise RuntimeError("A API de IA não está configurada. Adicione AI_API_KEY nas variáveis de ambiente do Render.")
    timeout = aiohttp.ClientTimeout(total=50)
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": AI_MODEL,
        "temperature": 0.35,
        "max_tokens": 3000,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt[:2500]}
        ]
    }
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(AI_API_URL, headers=headers, json=payload) as response:
            if response.status >= 400:
                detail = (await response.text())[:400]
                raise RuntimeError(f"Erro na API de IA ({response.status}): {detail}")
            data = await response.json()
    content = data["choices"][0]["message"]["content"]
    plan = _clean_json(content)
    for key in ("roles", "categories", "channels", "style_tips"):
        if not isinstance(plan.get(key, []), list):
            plan[key] = []
    plan["roles"] = plan["roles"][:12]
    plan["categories"] = plan["categories"][:12]
    plan["channels"] = plan["channels"][:30]
    plan["style_tips"] = [str(x)[:250] for x in plan["style_tips"][:6]]
    return plan

async def build_server(guild: discord.Guild, plan: dict) -> list[str]:
    results = []
    category_map = {c.name.casefold(): c for c in guild.categories}
    for item in plan.get("categories", []):
        name = str(item.get("name", "")).strip()[:100]
        if not name or name.casefold() in category_map:
            continue
        category = await guild.create_category(name, reason="Estrutura solicitada à Yukina por administrador")
        category_map[name.casefold()] = category
        results.append(f"Categoria criada: {name}")

    for item in plan.get("roles", []):
        name = str(item.get("name", "")).strip()[:100]
        if not name or any(r.name.casefold() == name.casefold() for r in guild.roles):
            continue
        color_text = str(item.get("color", "#5865F2"))
        try:
            color = discord.Color(int(color_text.lstrip("#"), 16))
        except (ValueError, TypeError):
            color = discord.Color.blurple()
        await guild.create_role(
            name=name, colour=color,
            hoist=bool(item.get("hoist", False)),
            mentionable=bool(item.get("mentionable", False)),
            permissions=discord.Permissions.none(),
            reason="Cargo sugerido pela Yukina com IA"
        )
        results.append(f"Cargo criado: {name}")

    allowed_types = {"text", "voice", "forum", "stage"}
    for item in plan.get("channels", []):
        name = str(item.get("name", "")).strip().lower().replace(" ", "-")[:100]
        kind = str(item.get("type", "text")).lower()
        if not name or kind not in allowed_types:
            continue
        category_name = str(item.get("category") or "").casefold()
        category = category_map.get(category_name)
        if any(ch.name.casefold() == name.casefold() and ch.category == category for ch in guild.channels):
            continue
        reason = "Canal criado pela Yukina a pedido de administrador"
        topic = str(item.get("topic", ""))[:1024]
        if kind == "voice":
            await guild.create_voice_channel(name, category=category, reason=reason)
        elif kind == "stage":
            await guild.create_stage_channel(name, category=category, reason=reason)
        elif kind == "forum":
            await guild.create_forum(name, category=category, topic=topic or None, reason=reason)
        else:
            await guild.create_text_channel(name, category=category, topic=topic or None, reason=reason)
        results.append(f"Canal {kind} criado: {name}")
    return results

def format_plan(plan: dict) -> str:
    lines = ["**Sugestões de estilo da Yukina**"]
    tips = plan.get("style_tips", [])
    lines.extend(f"• {tip}" for tip in tips[:5])
    roles = plan.get("roles", [])
    cats = plan.get("categories", [])
    channels = plan.get("channels", [])
    lines.append(f"\n**Plano:** {len(cats)} categorias · {len(roles)} cargos · {len(channels)} canais")
    if cats:
        lines.append("Categorias: " + ", ".join(str(x.get("name", "")) for x in cats[:12]))
    if roles:
        lines.append("Cargos: " + ", ".join(str(x.get("name", "")) for x in roles[:12]))
    return "\n".join(lines)[:3800]
