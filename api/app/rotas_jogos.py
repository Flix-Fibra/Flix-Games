"""Catálogo, ranking e partidas.

Partidas seguem o contrato do hub (docs/prompt-inicio-minigames-flix.md, seção 6):
o jogo avisa o hub por postMessage; o HUB chama estes endpoints. A pontuação vem do
navegador, então é tratada como não confiável (seção 6.4): runId único, faixa plausível
por jogo, duração mínima e duração nunca maior que o tempo real desde o início.
"""
from uuid import UUID

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from .consultas import ranking_do_jogo, ranking_geral, temporada_atual, temporadas
from .sessao import Db, SessaoComPerfil

router = APIRouter(prefix="/api")

# Temporada do ranking: um mês, "AAAA-MM" (ver consultas.FILTRO_TEMPORADA)
Temporada = Annotated[str | None, Query(pattern=r"^20[0-9]{2}-(0[1-9]|1[0-2])$")]

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
    # Avaliação (média de 1 a 5 e total) junto do catálogo: os cartões dos jogos mostram as estrelas sem uma
    # consulta por jogo. Mesmo arredondamento da página do jogo (1 casa). `partidas` = partidas terminadas de todos
    # os jogadores (filtro "Mais jogados" da aba Jogos).
    linhas = c.execute(
        """SELECT j.id, j.nome, j.genero, j.descricao, j.cor1, j.cor2, j.metrica, j.unidade, j.ordem, j.tem_ranking,
                  j.pasta, j.capa, j.previa, j.imagens, a.media, coalesce(a.total, 0) AS total, coalesce(p.partidas, 0) AS partidas
             FROM jogos j
             LEFT JOIN (SELECT jogo_id, round(avg(nota)::numeric, 1) AS media, count(*) AS total
                          FROM avaliacoes GROUP BY jogo_id) a ON a.jogo_id = j.id
             LEFT JOIN (SELECT jogo_id, count(*) AS partidas
                          FROM partidas WHERE status = 'finalizada' GROUP BY jogo_id) p ON p.jogo_id = j.id
            WHERE j.publicado ORDER BY j.vitrine, j.id"""
    ).fetchall()
    return [
        {"id": l["id"], "nome": l["nome"], "genero": l["genero"], "descricao": l["descricao"], "cor1": l["cor1"], "cor2": l["cor2"],
         "metrica": l["metrica"], "unidade": l["unidade"], "ordem": l["ordem"], "ranking": l["tem_ranking"], "pasta": l["pasta"], "capa": l["capa"], "previa": l["previa"],
         "imagens": l["imagens"],
         "avaliacao": {"media": float(l["media"]) if l["media"] is not None else None, "total": l["total"]},
         "partidas": l["partidas"]}
        for l in linhas
    ]


# Antes de /ranking/{jogo_id}: "geral" não é id de jogo (ids são g01..g99), mas a ordem deixa isso explícito.
@router.get("/ranking/geral")
def ranking_geral_da_temporada(
    s: SessaoComPerfil, c: Db,
    temporada: Temporada = None,
) -> dict:
    """Ranking geral por Pontos Flix (ver consultas.SQL_PONTOS_FLIX). Sem `temporada`, o mês corrente."""
    atual = temporada_atual(c)
    escolhida = temporada or atual
    return {
        "temporada": escolhida,
        "atual": atual,
        "linhas": ranking_geral(c, s["perfil_id"], escolhida) if escolhida <= atual else [],
    }


@router.get("/ranking/temporadas")
def temporadas_do_ranking(s: SessaoComPerfil, c: Db) -> dict:
    """Temporadas que a página Ranking oferece (a atual e as anteriores com partidas), no Geral e no Por jogo."""
    atual = temporada_atual(c)
    return {"atual": atual, "temporadas": temporadas(c, atual)}


@router.get("/ranking/{jogo_id}")
def ranking(jogo_id: str, s: SessaoComPerfil, c: Db, temporada: Temporada = None) -> list[dict]:
    """Ranking do jogo: recorde de todos os tempos ou, com `temporada`, só as partidas daquele mês."""
    if not c.execute("SELECT 1 FROM jogos WHERE id = %s AND publicado AND tem_ranking", (jogo_id,)).fetchone():
        raise HTTPException(404, "Jogo sem ranking.")
    return ranking_do_jogo(c, jogo_id, s["perfil_id"], temporada=temporada)


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
