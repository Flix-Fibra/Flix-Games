"""Página do jogo: avaliação por estrelas, comentários e denúncias.

- O perfil vem SEMPRE da sessão (SessaoComPerfil); o cliente só manda o jogo, a nota ou o texto.
- Comentário é publicado na hora, depois do filtro (moderacao.py). Com DENUNCIAS_PARA_OCULTAR denúncias de perfis
  diferentes, ele some até a equipe revisar (coluna `oculto`, que a equipe também pode marcar à mão).
- Perfil oculto no ranking (Q24) aparece como "Jogador Flix" para os outros; o dono continua se vendo.
- Limites contra spam: COMENTARIOS_POR_MINUTO e COMENTARIOS_POR_DIA por perfil.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Response
from pydantic import BaseModel, Field, field_validator

from .moderacao import limpar_comentario
from .sessao import Db, SessaoComPerfil

router = APIRouter(prefix="/api")

COMENTARIOS_POR_MINUTO = 3
COMENTARIOS_POR_DIA = 20
DENUNCIAS_PARA_OCULTAR = 3
COMENTARIOS_NA_PAGINA = 50
NOME_OCULTO = "Jogador Flix"

JogoId = Annotated[str, Path(pattern=r"^g[0-9]{2}$")]


class Nota(BaseModel):
    nota: int = Field(ge=1, le=5)


class NovoComentario(BaseModel):
    texto: str = Field(max_length=2000)  # o limite real (500) é conferido depois da limpeza

    @field_validator("texto")
    @classmethod
    def _texto(cls, v: str) -> str:
        return limpar_comentario(v)


def _jogo_publicado(c, jogo_id: str) -> None:
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado", (jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo não encontrado.")


def _resumo_notas(c, jogo_id: str, perfil_id) -> dict:
    r = c.execute(
        """SELECT round(avg(nota)::numeric, 1) AS media, count(*) AS total,
                  max(nota) FILTER (WHERE perfil_id = %(eu)s) AS minha
             FROM avaliacoes WHERE jogo_id = %(jogo)s""",
        {"jogo": jogo_id, "eu": perfil_id},
    ).fetchone()
    return {"media": float(r["media"]) if r["media"] is not None else None, "total": r["total"], "minha": r["minha"]}


def _comentario(l, eu) -> dict:
    meu = l["perfil_id"] == eu
    escondido = l["perfil_oculto"] and not meu
    return {
        "id": str(l["id"]),
        "apelido": NOME_OCULTO if escondido else l["apelido"],
        "cor": "#8E8E93" if escondido else l["cor"],
        "texto": l["texto"],
        "criadoEm": l["criado_em"].isoformat(),
        "meu": meu,
    }


@router.get("/jogos/{jogo_id}/detalhes")
def detalhes(jogo_id: JogoId, s: SessaoComPerfil, c: Db) -> dict:
    _jogo_publicado(c, jogo_id)
    linhas = c.execute(
        """SELECT cm.id, cm.perfil_id, cm.texto, cm.criado_em, pf.apelido, pf.cor, pf.oculto AS perfil_oculto
             FROM comentarios cm JOIN perfis pf ON pf.id = cm.perfil_id
            WHERE cm.jogo_id = %s AND NOT cm.oculto
            ORDER BY cm.criado_em DESC LIMIT %s""",
        (jogo_id, COMENTARIOS_NA_PAGINA),
    ).fetchall()
    return {"avaliacao": _resumo_notas(c, jogo_id, s["perfil_id"]), "comentarios": [_comentario(l, s["perfil_id"]) for l in linhas]}


@router.put("/jogos/{jogo_id}/avaliacao")
def avaliar(jogo_id: JogoId, corpo: Nota, s: SessaoComPerfil, c: Db) -> dict:
    _jogo_publicado(c, jogo_id)
    c.execute(
        """INSERT INTO avaliacoes (perfil_id, jogo_id, nota) VALUES (%s, %s, %s)
           ON CONFLICT (perfil_id, jogo_id) DO UPDATE SET nota = EXCLUDED.nota, atualizada_em = now()""",
        (s["perfil_id"], jogo_id, corpo.nota),
    )
    return _resumo_notas(c, jogo_id, s["perfil_id"])


@router.post("/jogos/{jogo_id}/comentarios", status_code=201)
def comentar(jogo_id: JogoId, corpo: NovoComentario, s: SessaoComPerfil, c: Db) -> dict:
    _jogo_publicado(c, jogo_id)
    # Trava por perfil: dois envios ao mesmo tempo não furam o limite
    c.execute("SELECT 1 FROM perfis WHERE id = %s FOR UPDATE", (s["perfil_id"],))
    n = c.execute(
        """SELECT count(*) FILTER (WHERE criado_em > now() - interval '1 minute') AS minuto,
                  count(*) FILTER (WHERE criado_em > now() - interval '1 day') AS dia
             FROM comentarios WHERE perfil_id = %s AND criado_em > now() - interval '1 day'""",
        (s["perfil_id"],),
    ).fetchone()
    if n["minuto"] >= COMENTARIOS_POR_MINUTO:
        raise HTTPException(429, "Muitos comentários em pouco tempo. Aguarde um minuto.")
    if n["dia"] >= COMENTARIOS_POR_DIA:
        raise HTTPException(429, "Você chegou ao limite de comentários de hoje.")
    l = c.execute(
        """WITH novo AS (
             INSERT INTO comentarios (perfil_id, jogo_id, texto) VALUES (%s, %s, %s)
             RETURNING id, perfil_id, texto, criado_em)
           SELECT novo.*, pf.apelido, pf.cor, pf.oculto AS perfil_oculto FROM novo JOIN perfis pf ON pf.id = novo.perfil_id""",
        (s["perfil_id"], jogo_id, corpo.texto),
    ).fetchone()
    return _comentario(l, s["perfil_id"])


@router.delete("/comentarios/{comentario_id}", status_code=204)
def apagar(comentario_id: UUID, s: SessaoComPerfil, c: Db) -> Response:
    # Só apaga o próprio: a condição de dono está na mesma consulta (sem checar e depois apagar)
    r = c.execute("DELETE FROM comentarios WHERE id = %s AND perfil_id = %s", (comentario_id, s["perfil_id"]))
    if r.rowcount == 0:
        raise HTTPException(404, "Comentário não encontrado.")
    return Response(status_code=204)


@router.post("/comentarios/{comentario_id}/denuncia", status_code=204)
def denunciar(comentario_id: UUID, s: SessaoComPerfil, c: Db) -> Response:
    cm = c.execute("SELECT perfil_id FROM comentarios WHERE id = %s AND NOT oculto", (comentario_id,)).fetchone()
    if not cm:
        raise HTTPException(404, "Comentário não encontrado.")
    if cm["perfil_id"] == s["perfil_id"]:
        raise HTTPException(400, "Você não pode denunciar o seu próprio comentário.")
    nova = c.execute(
        "INSERT INTO denuncias_comentario (comentario_id, perfil_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (comentario_id, s["perfil_id"]),
    ).rowcount
    if nova:  # a mesma pessoa denunciando de novo não conta duas vezes
        c.execute(
            """UPDATE comentarios SET denuncias = denuncias + 1, oculto = oculto OR denuncias + 1 >= %s
                WHERE id = %s""",
            (DENUNCIAS_PARA_OCULTAR, comentario_id),
        )
    return Response(status_code=204)
