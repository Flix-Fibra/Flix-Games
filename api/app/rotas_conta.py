"""Sessão, login simulado (só desenvolvimento), aparelhos, perfis e favoritos."""
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Request, Response
from pydantic import BaseModel, Field, field_validator
from psycopg.errors import UniqueViolation

from .config import config
from .consultas import montar_perfil
from .sessao import COOKIE, Db, Sessao, criar_sessao

router = APIRouter(prefix="/api")

MAX_PERFIS = 4  # Q23 (era 2 até 18/11/2026)
CORES = ["#D2232A", "#2773D2", "#7654C4", "#15803D"]
RE_APELIDO = re.compile(r"^[A-Za-zÀ-ÿ0-9 _-]{3,20}$")
# [H] Lista mínima; a moderação de verdade (Q25) é revisão da equipe + denúncia.
PROIBIDOS = ("admin", "flix", "moderador", "suporte")


def _limpar_apelido(v: str) -> str:
    v = " ".join(v.split())
    if not RE_APELIDO.fullmatch(v):
        raise ValueError("Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.")
    if any(p in v.lower() for p in PROIBIDOS):
        raise ValueError("Esse apelido não pode ser usado.")
    return v


class NovoPerfil(BaseModel):
    apelido: str = Field(max_length=40)

    @field_validator("apelido")
    @classmethod
    def _apelido(cls, v: str) -> str:
        return _limpar_apelido(v)


class AlteraPerfil(BaseModel):
    apelido: str | None = Field(default=None, max_length=40)
    oculto: bool | None = None

    @field_validator("apelido")
    @classmethod
    def _apelido(cls, v: str | None) -> str | None:
        return None if v is None else _limpar_apelido(v)


class EscolhaPerfil(BaseModel):
    perfil_id: UUID = Field(alias="perfilId")


class EntradaDev(BaseModel):
    cliente_ref: str = Field(default="DEV-0001", alias="clienteRef", pattern=r"^[A-Z0-9-]{3,40}$")


def _do_dono(c, perfil_id: UUID, conta_id: int) -> None:
    """404 (e não 403) para não revelar que o perfil de outra conta existe."""
    if not c.execute("SELECT 1 FROM perfis WHERE id = %s AND conta_id = %s", (perfil_id, conta_id)).fetchone():
        raise HTTPException(404, "Perfil não encontrado.")


# ---------- Login simulado: só existe em desenvolvimento ----------
@router.post("/dev/entrar", status_code=204)
def entrar_simulado(dados: EntradaDev, request: Request, response: Response, c: Db) -> None:
    if not config.desenvolvimento:
        raise HTTPException(404)
    conta = c.execute(
        "INSERT INTO contas (cliente_ref) VALUES (%s) ON CONFLICT (cliente_ref) DO UPDATE SET cliente_ref = EXCLUDED.cliente_ref RETURNING id",
        (dados.cliente_ref,),
    ).fetchone()
    assert conta is not None
    criar_sessao(c, conta["id"], request, response)


# ---------- Sessão ----------
@router.get("/sessao")
def ver_sessao(s: Sessao, c: Db) -> dict:
    perfis = c.execute("SELECT id FROM perfis WHERE conta_id = %s ORDER BY criado_em", (s["conta_id"],)).fetchall()
    return {
        "perfilId": str(s["perfil_id"]) if s["perfil_id"] else None,
        "perfis": [montar_perfil(c, p["id"]) for p in perfis],
        "maxPerfis": MAX_PERFIS,
    }


@router.put("/sessao/perfil", status_code=204)
def escolher_perfil(dados: EscolhaPerfil, s: Sessao, c: Db) -> None:
    _do_dono(c, dados.perfil_id, s["conta_id"])
    c.execute("UPDATE sessoes SET perfil_id = %s WHERE id = %s", (dados.perfil_id, s["id"]))


@router.delete("/sessao", status_code=204)
def sair_deste_aparelho(s: Sessao, response: Response, c: Db) -> None:
    c.execute("UPDATE sessoes SET revogada_em = now() WHERE id = %s", (s["id"],))
    response.delete_cookie(COOKIE, path="/api")


# ---------- Aparelhos (sessões da conta) ----------
@router.get("/aparelhos")
def listar_aparelhos(s: Sessao, c: Db) -> list[dict]:
    linhas = c.execute(
        "SELECT id, aparelho, visto_em FROM sessoes WHERE conta_id = %s AND revogada_em IS NULL ORDER BY visto_em DESC",
        (s["conta_id"],),
    ).fetchall()
    return [{"id": str(l["id"]), "nome": l["aparelho"], "vistoEm": l["visto_em"].isoformat(), "atual": l["id"] == s["id"]} for l in linhas]


@router.delete("/aparelhos/{aparelho_id}", status_code=204)
def desconectar_aparelho(aparelho_id: UUID, s: Sessao, c: Db) -> None:
    r = c.execute(
        "UPDATE sessoes SET revogada_em = now() WHERE id = %s AND conta_id = %s AND revogada_em IS NULL RETURNING id",
        (aparelho_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Aparelho não encontrado.")


# ---------- Perfis ----------
@router.post("/perfis", status_code=201)
def criar_perfil(dados: NovoPerfil, s: Sessao, c: Db) -> dict:
    # Trava a conta: duas requisições ao mesmo tempo não passam do limite de MAX_PERFIS
    c.execute("SELECT id FROM contas WHERE id = %s FOR UPDATE", (s["conta_id"],))
    usadas = [r["cor"] for r in c.execute("SELECT cor FROM perfis WHERE conta_id = %s", (s["conta_id"],))]
    if len(usadas) >= MAX_PERFIS:
        raise HTTPException(409, f"Limite de {MAX_PERFIS} perfis por conta.")
    cor = next((x for x in CORES if x not in usadas), CORES[0])
    try:
        with c.transaction():
            p = c.execute(
                "INSERT INTO perfis (conta_id, apelido, cor) VALUES (%s, %s, %s) RETURNING id", (s["conta_id"], dados.apelido, cor)
            ).fetchone()
    except UniqueViolation:
        raise HTTPException(409, "Esse apelido já está em uso nesta conta.") from None
    assert p is not None
    return montar_perfil(c, p["id"])


@router.patch("/perfis/{perfil_id}")
def alterar_perfil(perfil_id: UUID, dados: AlteraPerfil, s: Sessao, c: Db) -> dict:
    _do_dono(c, perfil_id, s["conta_id"])
    try:
        with c.transaction():
            if dados.apelido is not None:
                c.execute("UPDATE perfis SET apelido = %s WHERE id = %s", (dados.apelido, perfil_id))
            if dados.oculto is not None:
                c.execute("UPDATE perfis SET oculto = %s WHERE id = %s", (dados.oculto, perfil_id))
    except UniqueViolation:
        raise HTTPException(409, "Esse apelido já está em uso nesta conta.") from None
    return montar_perfil(c, perfil_id)


@router.delete("/perfis/{perfil_id}", status_code=204)
def excluir_perfil(perfil_id: UUID, s: Sessao, c: Db) -> None:
    c.execute("SELECT id FROM contas WHERE id = %s FOR UPDATE", (s["conta_id"],))
    _do_dono(c, perfil_id, s["conta_id"])
    total = c.execute("SELECT count(*) AS n FROM perfis WHERE conta_id = %s", (s["conta_id"],)).fetchone()
    if total and total["n"] <= 1:
        raise HTTPException(409, "A conta precisa de pelo menos um perfil.")
    c.execute("DELETE FROM perfis WHERE id = %s", (perfil_id,))


# ---------- Favoritos ----------
@router.put("/perfis/{perfil_id}/favoritos/{jogo_id}", status_code=204)
def favoritar(perfil_id: UUID, jogo_id: Annotated[str, Path(pattern=r"^g[0-9]{2}$")], s: Sessao, c: Db) -> None:
    _do_dono(c, perfil_id, s["conta_id"])
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado", (jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo não encontrado.")
    c.execute("INSERT INTO favoritos (perfil_id, jogo_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (perfil_id, jogo_id))


@router.delete("/perfis/{perfil_id}/favoritos/{jogo_id}", status_code=204)
def desfavoritar(perfil_id: UUID, jogo_id: str, s: Sessao, c: Db) -> None:
    _do_dono(c, perfil_id, s["conta_id"])
    c.execute("DELETE FROM favoritos WHERE perfil_id = %s AND jogo_id = %s", (perfil_id, jogo_id))
