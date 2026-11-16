"""Personagem do perfil (AvatarConfig v1, seção 9.3 do prompt dos minigames).

Fonte ÚNICA do catálogo: packages/flix-avatar/src/catalog.json e palettes.json, os mesmos
arquivos que os jogos usam. Regras: só IDs do catálogo, nada de cor livre, texto ou imagem;
campo desconhecido é recusado.
"""
import json
import os
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from psycopg.types.json import Jsonb

from .sessao import Db, Sessao


def _pasta_catalogo() -> Path:
    """Na imagem Docker fica em /app/avatar; rodando direto do repositório, em packages/flix-avatar/src."""
    for p in (os.environ.get("AVATAR_DIR"), Path(__file__).resolve().parent.parent / "avatar",
              Path(__file__).resolve().parents[2] / "packages" / "flix-avatar" / "src"):
        if p and (Path(p) / "catalog.json").exists():
            return Path(p)
    raise RuntimeError("Catálogo do personagem não encontrado (packages/flix-avatar/src/catalog.json)")


_PASTA = _pasta_catalogo()
CATALOGO: dict[str, Any] = json.loads((_PASTA / "catalog.json").read_text(encoding="utf-8"))
PALETAS: dict[str, Any] = json.loads((_PASTA / "palettes.json").read_text(encoding="utf-8"))

IDS: dict[str, set[str]] = {
    "pele": set(PALETAS["skin"]), "cor_cabelo": set(PALETAS["hair"]), "cor_roupa": set(PALETAS["cloth"]),
    **{k: set(CATALOGO.get(k, [])) for k in ("bodies", "eyes", "mouths", "hairStyles", "tops", "bottoms", "shoes", "hats", "accessories", "skinPresets")},
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

        conferir(self.body.type, "bodies", "body.type")
        conferir(self.body.skinTone, "pele", "body.skinTone")
        conferir(self.face.eyes, "eyes", "face.eyes")
        conferir(self.face.mouth, "mouths", "face.mouth")
        if self.hair:
            conferir(self.hair.style, "hairStyles", "hair.style")
            conferir(self.hair.color, "cor_cabelo", "hair.color")
        for nome, peca, grupo in (("top", self.top, "tops"), ("bottom", self.bottom, "bottoms")):
            if peca:
                conferir(peca.item, grupo, f"{nome}.item")
                conferir(peca.primary, "cor_roupa", f"{nome}.primary")
                conferir(peca.secondary, "cor_roupa", f"{nome}.secondary")
        if self.shoes:
            conferir(self.shoes.item, "shoes", "shoes.item")
            conferir(self.shoes.primary, "cor_roupa", "shoes.primary")
        if self.hat:
            conferir(self.hat.item, "hats", "hat.item")
            conferir(self.hat.primary, "cor_roupa", "hat.primary")
        for a in self.accessories:
            conferir(a, "accessories", "accessories")
        if len(set(self.accessories)) != len(self.accessories):
            erros.append("accessories (repetido)")
        conferir(self.skinPreset, "skinPresets", "skinPreset")
        if erros:
            raise ValueError("Item fora do catálogo: " + ", ".join(erros))
        return self


def avatar_valido(bruto: Any) -> dict[str, Any] | None:
    """Personagem salvo que não vale mais no catálogo atual (peça retirada) volta como None = padrão."""
    if bruto is None:
        return None
    try:
        return AvatarConfig.model_validate(bruto).model_dump(mode="json")
    except ValidationError:
        return None


def _catalogo_para_o_editor() -> dict[str, Any]:
    """Catálogo no formato do editor do portal, com nomes em português (campo `labels` do catalog.json)."""
    nomes: dict[str, str] = CATALOGO.get("labels", {})
    itens = lambda chave: [{"id": i, "nome": nomes.get(i, i)} for i in CATALOGO.get(chave, [])]  # noqa: E731
    cores = lambda grupo: [{"id": i, "hex": c["base"], "tipo": "fantasia" if "_f" in i else "realista"} for i, c in PALETAS[grupo].items()]  # noqa: E731
    d = CATALOGO["defaults"]
    return {
        "versao": CATALOGO.get("version", 1),
        "provisorio": True,  # placeholder até a arte do designer (docs/briefing-personagem.md)
        "paletas": {"pele": cores("skin"), "cabelo": cores("hair"), "roupa": cores("cloth")},
        "corpos": itens("bodies"), "olhos": itens("eyes"), "bocas": itens("mouths"), "cabelos": itens("hairStyles"),
        "camisetas": itens("tops"), "calcas": itens("bottoms"), "calcados": itens("shoes"), "chapeus": itens("hats"),
        "acessorios": itens("accessories"), "skins": itens("skinPresets"),
        # Mesmo personagem padrão do packages/flix-avatar (DEFAULT_AVATAR)
        "padrao": {
            "v": 1, "body": {"type": d["body"], "skinTone": d["skinTone"]}, "face": {"eyes": d["eyes"], "mouth": d["mouth"]},
            "hair": None, "top": {"item": d["top"], "primary": d["clothColor"]}, "bottom": {"item": d["bottom"], "primary": "c02"},
            "shoes": {"item": d["shoes"], "primary": "c06"}, "hat": None, "accessories": [], "skinPreset": None,
        },
    }


EDITOR = _catalogo_para_o_editor()
router = APIRouter(prefix="/api")


@router.get("/avatar/catalogo")
def catalogo() -> dict:
    return EDITOR


@router.put("/perfis/{perfil_id}/avatar")
def salvar_avatar(perfil_id: UUID, avatar: AvatarConfig, s: Sessao, c: Db) -> dict:
    from .consultas import montar_perfil  # evita import circular (consultas usa avatar_valido)

    r = c.execute(
        "UPDATE perfis SET avatar = %s WHERE id = %s AND conta_id = %s RETURNING id",
        (Jsonb(avatar.model_dump(mode="json")), perfil_id, s["conta_id"]),
    ).fetchone()
    if not r:
        raise HTTPException(404, "Perfil não encontrado.")
    return montar_perfil(c, perfil_id)
