"""Sessão por aparelho (Q09): cookie HttpOnly com token aleatório; no banco só o hash."""
import hashlib
import secrets
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Response
from psycopg import Connection

from .config import config
from .db import conexao

COOKIE = "fg_sessao"
DEZ_ANOS = 10 * 365 * 24 * 3600  # "sem prazo de término" (Q09); revogação é no servidor


def _hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def nome_do_aparelho(user_agent: str) -> str:
    ua = user_agent.lower()
    sistema = ("iPhone" if "iphone" in ua else "iPad" if "ipad" in ua else "Android" if "android" in ua
               else "Windows" if "windows" in ua else "Mac" if "mac os" in ua else "Linux" if "linux" in ua else "Aparelho")
    navegador = ("Edge" if "edg/" in ua else "Chrome" if "chrome" in ua else "Firefox" if "firefox" in ua
                 else "Safari" if "safari" in ua else "Navegador")
    return f"{navegador} · {sistema}"


def criar_sessao(c: Connection, conta_id: int, request: Request, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    c.execute(
        "INSERT INTO sessoes (conta_id, token_hash, aparelho) VALUES (%s, %s, %s)",
        (conta_id, _hash(token), nome_do_aparelho(request.headers.get("user-agent", ""))[:80]),
    )
    response.set_cookie(
        COOKIE, token, max_age=DEZ_ANOS, httponly=True, samesite="lax", secure=config.cookie_seguro, path="/api"
    )


def sessao_atual(request: Request, c: Annotated[Connection, Depends(conexao)]) -> dict[str, Any]:
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 100:
        raise HTTPException(401, "Entre pelo App Flix para jogar.")
    s = c.execute(
        """
        UPDATE sessoes s SET visto_em = now()
          FROM contas ct
         WHERE s.token_hash = %s AND s.revogada_em IS NULL AND ct.id = s.conta_id AND ct.ativo
        RETURNING s.id, s.conta_id, s.perfil_id
        """,
        (_hash(token),),
    ).fetchone()
    if not s:
        raise HTTPException(401, "Sessão encerrada. Entre de novo pelo App Flix.")
    return s


def perfil_atual(s: Annotated[dict[str, Any], Depends(sessao_atual)]) -> dict[str, Any]:
    if not s["perfil_id"]:
        raise HTTPException(409, "Escolha quem vai jogar.")
    return s


Sessao = Annotated[dict[str, Any], Depends(sessao_atual)]
SessaoComPerfil = Annotated[dict[str, Any], Depends(perfil_atual)]
Db = Annotated[Connection, Depends(conexao)]
