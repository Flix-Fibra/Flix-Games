"""Personagem do perfil (AvatarConfig v1, seção 9.3 do prompt dos minigames).

Regras: só IDs do catálogo, nada de cor livre, texto ou imagem; campo desconhecido é recusado.
O catálogo é PROVISÓRIO (app/avatar_catalogo.json) até chegar o catalog.json do packages/flix-avatar.
"""
import json
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg.types.json import Jsonb

from .consultas import montar_perfil
from .sessao import Db, Sessao

CATALOGO: dict = json.loads((Path(__file__).parent / "avatar_catalogo.json").read_text(encoding="utf-8"))


def _ids(chave: str) -> set[str]:
    return {i["id"] for i in CATALOGO[chave]}


IDS = {
    "pele": {p["id"] for p in CATALOGO["paletas"]["pele"]},
    "cor_cabelo": {p["id"] for p in CATALOGO["paletas"]["cabelo"]},
    "cor_roupa": {p["id"] for p in CATALOGO["paletas"]["roupa"]},
    **{k: _ids(k) for k in ("corpos", "olhos", "bocas", "cabelos", "camisetas", "calcas", "calcados", "chapeus", "acessorios", "skins")},
}

ESTRITO = ConfigDict(extra="forbid", strict=True)
Id = Field(min_length=1, max_length=40)


class Corpo(BaseModel):
    model_config = ESTRITO
    type: str = Id
    skinTone: str = Id


class Rosto(BaseModel):
    model_config = ESTRITO
    eyes: str = Id
    mouth: str = Id


class Cabelo(BaseModel):
    model_config = ESTRITO
    style: str = Id
    color: str = Id


class Peca(BaseModel):
    model_config = ESTRITO
    item: str = Id
    primary: str = Id
    secondary: str | None = None


class Calcado(BaseModel):
    model_config = ESTRITO
    item: str = Id
    primary: str = Id


class Chapeu(BaseModel):
    model_config = ESTRITO
    item: str = Id
    primary: str | None = None


class AvatarConfig(BaseModel):
    model_config = ESTRITO
    v: Literal[1]
    body: Corpo
    face: Rosto
    hair: Cabelo | None
    top: Peca | None
    bottom: Peca | None
    shoes: Calcado | None
    hat: Chapeu | None
    accessories: list[str] = Field(max_length=3)
    skinPreset: str | None

    @model_validator(mode="after")
    def _no_catalogo(self) -> "AvatarConfig":
        erros: list[str] = []

        def conferir(valor: str | None, grupo: str, campo: str) -> None:
            if valor is not None and valor not in IDS[grupo]:
                erros.append(campo)

        conferir(self.body.type, "corpos", "body.type")
        conferir(self.body.skinTone, "pele", "body.skinTone")
        conferir(self.face.eyes, "olhos", "face.eyes")
        conferir(self.face.mouth, "bocas", "face.mouth")
        if self.hair:
            conferir(self.hair.style, "cabelos", "hair.style")
            conferir(self.hair.color, "cor_cabelo", "hair.color")
        for nome, peca, grupo in (("top", self.top, "camisetas"), ("bottom", self.bottom, "calcas")):
            if peca:
                conferir(peca.item, grupo, f"{nome}.item")
                conferir(peca.primary, "cor_roupa", f"{nome}.primary")
                conferir(peca.secondary, "cor_roupa", f"{nome}.secondary")
        if self.shoes:
            conferir(self.shoes.item, "calcados", "shoes.item")
            conferir(self.shoes.primary, "cor_roupa", "shoes.primary")
        if self.hat:
            conferir(self.hat.item, "chapeus", "hat.item")
            conferir(self.hat.primary, "cor_roupa", "hat.primary")
        for a in self.accessories:
            conferir(a, "acessorios", "accessories")
        if len(set(self.accessories)) != len(self.accessories):
            erros.append("accessories (repetido)")
        conferir(self.skinPreset, "skins", "skinPreset")
        if erros:
            raise ValueError("Item fora do catálogo: " + ", ".join(erros))
        return self


router = APIRouter(prefix="/api")


@router.get("/avatar/catalogo")
def catalogo() -> dict:
    return CATALOGO


@router.put("/perfis/{perfil_id}/avatar")
def salvar_avatar(perfil_id: UUID, avatar: AvatarConfig, s: Sessao, c: Db) -> dict:
    r = c.execute(
        "UPDATE perfis SET avatar = %s WHERE id = %s AND conta_id = %s RETURNING id",
        (Jsonb(avatar.model_dump(mode="json")), perfil_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)


@router.delete("/perfis/{perfil_id}/avatar")
def apagar_avatar(perfil_id: UUID, s: Sessao, c: Db) -> dict:
    r = c.execute("UPDATE perfis SET avatar = NULL WHERE id = %s AND conta_id = %s RETURNING id", (perfil_id, s["conta_id"])).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)
