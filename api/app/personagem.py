"""Personagem Flix: arte própria da equipe (assets/personagem), uma pose de frente.

Cada visual é um personagem completo (corpo + cabelo) desenhado pela equipe. O perfil guarda só o corpo e o visual
escolhidos, conferidos contra o catálogo gerado por scripts/personagem/montar.py (web/public/personagem/catalogo.json):
nada de texto ou imagem; campo desconhecido é recusado. Personagem salvo num formato antigo volta como None:
a pessoa escolhe de novo.
"""
import json
import os
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg.types.json import Jsonb

from .sessao import Db, Sessao


def _catalogo() -> dict:
    """Na imagem Docker fica em /app/personagem; rodando direto do repositório, em web/public/personagem."""
    for p in (os.environ.get("PERSONAGEM_DIR"), Path(__file__).resolve().parent.parent / "personagem",
              Path(__file__).resolve().parents[2] / "web" / "public" / "personagem"):
        if p and (Path(p) / "catalogo.json").exists():
            return json.loads((Path(p) / "catalogo.json").read_text(encoding="utf-8"))
    raise RuntimeError("Catálogo do personagem não encontrado (web/public/personagem/catalogo.json)")


CATALOGO = _catalogo()
# Pares (corpo, visual) que existem: visual feminino só no corpo feminino e masculino só no masculino
_VISUAIS = {(v["corpo"], v["id"]) for v in CATALOGO["visuais"]}
Id = Field(min_length=1, max_length=40)


class PersonagemFlix(BaseModel):
    model_config = ConfigDict(extra="forbid")
    v: Literal[4]
    motor: Literal["flix"]
    corpo: str = Id
    visual: str = Id

    @model_validator(mode="after")
    def _no_catalogo(self) -> "PersonagemFlix":
        if (self.corpo, self.visual) not in _VISUAIS:
            raise ValueError("Personagem fora do catálogo.")
        return self


def personagem_valido(bruto) -> dict | None:
    """Personagem do formato antigo, ou com peça que saiu do catálogo, volta como None (a pessoa cria de novo)."""
    if bruto is None:
        return None
    try:
        return PersonagemFlix.model_validate(bruto).model_dump(mode="json")
    except ValueError:
        return None


router = APIRouter(prefix="/api")


@router.put("/perfis/{perfil_id}/personagem")
def salvar_personagem(perfil_id: UUID, personagem: PersonagemFlix, s: Sessao, c: Db) -> dict:
    from .consultas import montar_perfil

    r = c.execute(
        "UPDATE perfis SET personagem = %s WHERE id = %s AND conta_id = %s RETURNING id",
        (Jsonb(personagem.model_dump(mode="json")), perfil_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)


@router.delete("/perfis/{perfil_id}/personagem")
def remover_personagem(perfil_id: UUID, s: Sessao, c: Db) -> dict:
    """Opção "sem avatar" do editor: o perfil volta a não ter personagem (o hub mostra o ícone padrão)."""
    from .consultas import montar_perfil

    r = c.execute(
        "UPDATE perfis SET personagem = NULL WHERE id = %s AND conta_id = %s RETURNING id",
        (perfil_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)
