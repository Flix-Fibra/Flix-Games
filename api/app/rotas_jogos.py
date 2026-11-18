"""Catálogo, ranking e partidas.

Partidas seguem o contrato do hub (docs/prompt-inicio-minigames-flix.md, seção 6):
o jogo avisa o hub por postMessage; o HUB chama estes endpoints. A pontuação vem do
navegador, então é tratada como não confiável (seção 6.4): runId único, faixa plausível
por jogo, duração mínima e duração nunca maior que o tempo real desde o início.
"""
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from .consultas import ranking_do_jogo
from .sessao import Db, SessaoComPerfil

router = APIRouter(prefix="/api")

LIMITE_POR_MINUTO = 20          # partidas iniciadas por perfil por minuto
FOLGA_MS = 2000                 # atraso de rede tolerado entre "started" e "gameover"
PARTIDA_EXPIRA = "6 hours"      # partida aberta há mais que isso não vale


class Inicio(BaseModel):
    jogo_id: str = Field(alias="jogoId", pattern=r"^g[0-9]{2}$")
    run_id: UUID = Field(alias="runId")


class Fim(BaseModel):
    run_id: UUID = Field(alias="runId")
    pontos: int = Field(ge=0, le=2_000_000_000)
    duracao_ms: int = Field(alias="duracaoMs", ge=0, le=24 * 3600 * 1000)


@router.get("/jogos")
def listar_jogos(c: Db) -> list[dict]:
    linhas = c.execute(
        """SELECT id, nome, genero, descricao, cor1, cor2, metrica, unidade, ordem, tem_ranking, pasta, capa, previa
             FROM jogos WHERE publicado ORDER BY vitrine, id"""
    ).fetchall()
    return [
        {"id": l["id"], "nome": l["nome"], "genero": l["genero"], "descricao": l["descricao"], "cor1": l["cor1"], "cor2": l["cor2"],
         "metrica": l["metrica"], "unidade": l["unidade"], "ordem": l["ordem"], "ranking": l["tem_ranking"], "pasta": l["pasta"], "capa": l["capa"], "previa": l["previa"]}
        for l in linhas
    ]


@router.get("/ranking/{jogo_id}")
def ranking(jogo_id: str, s: SessaoComPerfil, c: Db) -> list[dict]:
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado AND tem_ranking", (jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo sem ranking.")
    return ranking_do_jogo(c, jogo_id, s["perfil_id"])


@router.post("/partidas/inicio", status_code=201)
def iniciar_partida(dados: Inicio, s: SessaoComPerfil, c: Db) -> dict:
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado", (dados.jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo não encontrado.")
    recentes = c.execute(
        "SELECT count(*) AS n FROM partidas WHERE perfil_id = %s AND iniciada_em > now() - interval '1 minute'",
        (s["perfil_id"],),
    ).fetchone()
    if recentes and recentes["n"] >= LIMITE_POR_MINUTO:
        raise HTTPException(429, "Muitas partidas em pouco tempo. Aguarde um minuto.")
    try:
        with c.transaction():
            c.execute(
                "INSERT INTO partidas (run_id, perfil_id, jogo_id) VALUES (%s, %s, %s)",
                (dados.run_id, s["perfil_id"], dados.jogo_id),
            )
    except UniqueViolation:
        raise HTTPException(409, "Partida já registrada.") from None
    return {"runId": str(dados.run_id)}


@router.post("/partidas/fim")
def finalizar_partida(dados: Fim, s: SessaoComPerfil, c: Db) -> dict:
    p = c.execute(
        """SELECT p.id, p.status, p.jogo_id, j.pontos_min, j.pontos_max, j.duracao_min_ms,
                  (EXTRACT(EPOCH FROM (now() - p.iniciada_em)) * 1000)::bigint AS decorrido_ms,
                  p.iniciada_em < now() - %s::interval AS expirada
             FROM partidas p JOIN jogos j ON j.id = p.jogo_id
            WHERE p.run_id = %s AND p.perfil_id = %s
            FOR UPDATE OF p""",
        (PARTIDA_EXPIRA, dados.run_id, s["perfil_id"]),
    ).fetchone()
    if not p:
        raise HTTPException(404, "Partida não encontrada.")
    if p["status"] != "iniciada":
        raise HTTPException(409, "Partida já encerrada.")

    motivo = None
    if p["expirada"]:
        motivo = "partida aberta há tempo demais"
    elif not (p["pontos_min"] <= dados.pontos <= p["pontos_max"]):
        motivo = "pontuação fora da faixa do jogo"
    elif dados.duracao_ms < p["duracao_min_ms"]:
        motivo = "partida curta demais"
    elif dados.duracao_ms > p["decorrido_ms"] + FOLGA_MS:
        motivo = "duração maior que o tempo real da partida"

    c.execute(
        "UPDATE partidas SET status = %s, finalizada_em = now(), pontos = %s, duracao_ms = %s, motivo = %s WHERE id = %s",
        ("rejeitada" if motivo else "finalizada", dados.pontos, dados.duracao_ms, motivo, p["id"]),
    )
    if motivo:
        return {"aceita": False, "motivo": motivo}
    minha = next((l for l in ranking_do_jogo(c, p["jogo_id"], s["perfil_id"]) if l["eu"]), None)
    return {"aceita": True, "melhor": minha["pontos"] if minha else None, "posicao": minha["posicao"] if minha else None}
