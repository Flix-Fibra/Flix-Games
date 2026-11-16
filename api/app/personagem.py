"""Personagem do editor Universal LPC (web/lpc).

Guarda a configuração (tipo de corpo + peças escolhidas), não uma imagem. Cada peça, variação e cor é
conferida contra app/lpc_permitidos.json, gerado do catálogo do LPC por web/scripts/lpc-gerar.mjs com a
regra de licença do portal (todas as imagens da peça com CC0, OGA-BY ou CC-BY, sem "compartilhar igual").
"""
import json
import re
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from psycopg.types.json import Jsonb

from .sessao import Db, Sessao

PERMITIDOS: dict = json.loads((Path(__file__).parent / "lpc_permitidos.json").read_text(encoding="utf-8"))
ITENS: dict[str, dict] = PERMITIDOS["itens"]
# "muscular" fica de fora: o corpo base dele só existe em CC-BY-SA/GPL
CORPOS = {"male", "female", "teen"}
RE_TEXTO = re.compile(r"^[\w\s().,'&+\-/]{0,100}$", re.UNICODE)


class Escolha(BaseModel):
    model_config = ConfigDict(extra="forbid")
    itemId: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=100)
    subId: int | None = Field(default=None, ge=0, le=20)
    variant: str | None = Field(default=None, max_length=60)
    recolor: str | None = Field(default=None, max_length=60)

    @field_validator("name")
    @classmethod
    def _nome(cls, v: str) -> str:
        # nome de exibição gerado pelo LPC; só texto simples
        if not RE_TEXTO.fullmatch(v):
            raise ValueError("Nome de peça inválido.")
        return v


class PersonagemLpc(BaseModel):
    model_config = ConfigDict(extra="forbid")
    v: Literal[2]
    motor: Literal["lpc"]
    bodyType: str
    selections: dict[str, Escolha] = Field(max_length=60)

    @model_validator(mode="after")
    def _no_catalogo(self) -> "PersonagemLpc":
        if self.bodyType not in CORPOS:
            raise ValueError("Tipo de corpo inválido.")
        erros: list[str] = []
        for grupo, e in self.selections.items():
            item = ITENS.get(e.itemId)
            if item is None:
                erros.append(f"{e.itemId} (peça não permitida)")
                continue
            slot = e.subId if e.subId is not None else 0
            grupos_validos = {item["t"], *(r["g"] for r in item["r"])}
            if grupo not in grupos_validos:
                erros.append(f"{grupo} (grupo)")
            # licença checada por tipo de corpo e variação (imagens realmente usadas)
            liberadas = item["b"].get(self.bodyType)
            variante = e.variant or ""
            if liberadas is None:
                erros.append(f"{e.itemId} (não liberada para este corpo)")
            elif item["v"] and variante not in liberadas:
                erros.append(f"{e.itemId}: variação {variante or '(padrão)'}")
            if e.recolor not in (None, ""):
                cores = item["r"][slot]["c"] if slot < len(item["r"]) else []
                if e.recolor not in cores:
                    erros.append(f"{e.itemId}: cor {e.recolor}")
        if erros:
            raise ValueError("Personagem com peça fora do catálogo permitido: " + ", ".join(erros[:5]))
        return self


def personagem_valido(bruto) -> dict | None:
    """Personagem salvo que deixou de valer (peça retirada numa atualização do LPC) volta como None."""
    if bruto is None:
        return None
    try:
        return PersonagemLpc.model_validate(bruto).model_dump(mode="json")
    except ValueError:
        return None


router = APIRouter(prefix="/api")


@router.put("/perfis/{perfil_id}/personagem")
def salvar_personagem(perfil_id: UUID, personagem: PersonagemLpc, s: Sessao, c: Db) -> dict:
    from .consultas import montar_perfil

    r = c.execute(
        "UPDATE perfis SET personagem = %s WHERE id = %s AND conta_id = %s RETURNING id",
        (Jsonb(personagem.model_dump(mode="json")), perfil_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)
