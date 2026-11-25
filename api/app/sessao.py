"""Sessão por aparelho (Q09): cookie HttpOnly com token aleatório; no banco só o hash.

Validade (modelo do FlixTV+, 24/11/2026): a sessão cai depois de 5 h sem uso e se renova sozinha enquanto o cliente
joga; mesmo em uso, dura no máximo 24 h, e aí o cliente entra de novo (é no login que a API Própria confere se o
contrato continua com o Games e sem bloqueio). No máximo MAX_APARELHOS sessões ao mesmo tempo por conta.
"""
import hashlib
import secrets
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Response
from psycopg import Connection

from .config import config
from .db import conexao

COOKIE = "fg_sessao"
SEM_USO_H = 5  # cai depois de 5 h parada; cada requisição renova
MAXIMO_H = 24  # prazo total, mesmo em uso: força o login (e a nova conferência do contrato) uma vez por dia
MAX_APARELHOS = 5  # sessões ativas por conta; a 6ª derruba a usada há mais tempo


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
    # Limite de aparelhos: fica com as MAX_APARELHOS sessões usadas por último (a nova entra nessa conta)
    c.execute(
        """
        UPDATE sessoes SET revogada_em = now()
         WHERE conta_id = %s AND revogada_em IS NULL
           AND id NOT IN (SELECT id FROM sessoes WHERE conta_id = %s AND revogada_em IS NULL
                           ORDER BY visto_em DESC, criado_em DESC LIMIT %s)
        """,
        (conta_id, conta_id, MAX_APARELHOS),
    )
    response.set_cookie(
        COOKIE, token, max_age=MAXIMO_H * 3600, httponly=True, samesite="lax", secure=config.cookie_seguro, path="/api"
    )


def sessao_atual(request: Request, c: Annotated[Connection, Depends(conexao)]) -> dict[str, Any]:
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 100:
        raise HTTPException(401, "Entre com seu CPF ou CNPJ para jogar.")
    s = c.execute(
        """
        UPDATE sessoes s SET visto_em = now()
          FROM contas ct
         WHERE s.token_hash = %s AND s.revogada_em IS NULL AND ct.id = s.conta_id AND ct.ativo
           AND s.visto_em > now() - make_interval(hours => %s)
           AND s.criado_em > now() - make_interval(hours => %s)
        RETURNING s.id, s.conta_id, s.perfil_id
        """,
        (_hash(token), SEM_USO_H, MAXIMO_H),
    ).fetchone()
    if not s:
        raise HTTPException(401, "Sessão encerrada. Entre de novo para jogar.")
    return s


def perfil_atual(s: Annotated[dict[str, Any], Depends(sessao_atual)]) -> dict[str, Any]:
    if not s["perfil_id"]:
        raise HTTPException(409, "Escolha quem vai jogar.")
    return s


Sessao = Annotated[dict[str, Any], Depends(sessao_atual)]
SessaoComPerfil = Annotated[dict[str, Any], Depends(perfil_atual)]
Db = Annotated[Connection, Depends(conexao)]
