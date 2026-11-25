"""Consultas compartilhadas: ranking e montagem do perfil."""
from typing import Any
from uuid import UUID

from psycopg import Connection

from .avatar import avatar_valido
from .personagem import personagem_valido

# Temporada = mês do calendário ("AAAA-MM") no fuso de Brasília. Um filtro só, usado pelo ranking de cada jogo e pelo
# geral, para os dois sempre falarem do mesmo período. Com %(temporada)s nulo, vale tudo (recorde de todos os tempos).
FUSO = "America/Sao_Paulo"
FILTRO_TEMPORADA = f"""(%(temporada)s::text IS NULL OR (
           p.finalizada_em >= ((%(temporada)s::text || '-01')::timestamp) AT TIME ZONE '{FUSO}'
       AND p.finalizada_em <  ((%(temporada)s::text || '-01')::timestamp + interval '1 month') AT TIME ZONE '{FUSO}'))"""

# Melhor resultado de cada perfil em cada jogo e a posição no ranking daquele jogo (de todos os tempos ou da temporada).
# - 'maior' vence maior pontuação; 'menor' vence menor (tacadas, tempo).
# - Partida de 0 pontos conta como partida jogada, mas não entra no ranking (decisão do solicitante, 25/11/2026).
# - Perfis ocultos (Q24) somem para os outros, mas o próprio dono continua se vendo.
# - Contas sem elegibilidade não aparecem.
# - Empate: mesma posição (RANK). [D] Regra de desempate por jogo pendente (Q19).
SQL_POSICOES = f"""
WITH melhores AS (
    SELECT p.jogo_id, p.perfil_id,
           CASE WHEN j.ordem = 'maior' THEN max(p.pontos) ELSE min(p.pontos) END AS melhor
      FROM partidas p
      JOIN jogos j ON j.id = p.jogo_id AND j.tem_ranking
     WHERE p.status = 'finalizada' AND p.pontos > 0 AND {FILTRO_TEMPORADA}  -- partida de 0 pontos não entra no ranking
     GROUP BY p.jogo_id, p.perfil_id, j.ordem
), visiveis AS (
    SELECT m.*, pf.apelido, pf.cor, pf.nome, pf.sobrenome, pf.mostrar_nome
      FROM melhores m
      JOIN perfis pf ON pf.id = m.perfil_id
      JOIN contas ct ON ct.id = pf.conta_id AND ct.ativo
     WHERE NOT pf.oculto OR pf.id = %(eu)s
)
SELECT v.jogo_id, v.perfil_id, v.apelido, v.cor, v.melhor, v.nome, v.sobrenome, v.mostrar_nome,
       RANK() OVER (PARTITION BY v.jogo_id
                    ORDER BY CASE WHEN j.ordem = 'maior' THEN -v.melhor ELSE v.melhor END) AS posicao
  FROM visiveis v
  JOIN jogos j ON j.id = v.jogo_id
"""

CONQUISTAS = [
    ("Primeira partida", "Termine uma partida"),
    ("Top 5", "Entre no top 5 de um jogo"),
    ("Colecionador", "Jogue 5 jogos diferentes"),
    ("Maratonista", "Termine 50 partidas"),
    ("Lenda", "Seja 1º em um ranking"),
]


def nome_publico(l: dict[str, Any]) -> str | None:
    """Nome verdadeiro para os outros jogadores: só quando o dono habilitou; senão, None (a API nem envia o nome)."""
    if not l["mostrar_nome"] or not l["nome"]:
        return None
    return f"{l['nome']} {l['sobrenome'] or ''}".strip()


def ranking_do_jogo(c: Connection, jogo_id: str, eu: UUID, limite: int = 10, temporada: str | None = None) -> list[dict[str, Any]]:
    """Ranking de um jogo: de todos os tempos (`temporada` None) ou de um mês ("AAAA-MM")."""
    linhas = c.execute(
        f"SELECT * FROM ({SQL_POSICOES}) r WHERE jogo_id = %(jogo)s ORDER BY posicao, apelido",
        {"eu": eu, "jogo": jogo_id, "temporada": temporada},
    ).fetchall()
    topo = linhas[:limite]
    minha = next((l for l in linhas if l["perfil_id"] == eu), None)
    if minha and minha not in topo:
        topo.append(minha)
    return [
        {"posicao": l["posicao"], "apelido": l["apelido"], "nome": nome_publico(l), "cor": l["cor"], "pontos": l["melhor"],
         "eu": l["perfil_id"] == eu}
        for l in topo
    ]


# ---------- Ranking geral (Q20; decisão do solicitante, 24/11/2026) ----------
# Pontuações de jogos diferentes não se somam (pontos, andares, tempo de volta: unidades e sentidos diferentes). O que
# se compara entre jogos é a COLOCAÇÃO. Em cada jogo, o perfil ganha Pontos Flix pela parcela de jogadores que superou:
#
#     pontos = 1000 × (N − posição + 0,5) / N        (N = perfis com resultado naquele jogo, na temporada)
#
# - Não depende da unidade nem do sentido: a posição já vem do ranking do jogo ('maior' ou 'menor' vence).
# - Vencer onde há mais gente vale mais: 1º de 1 = 500, 1º de 10 = 950, 1º de 100 = 995. Jogo novo, com poucos
#   jogadores, não distorce o geral.
# - Conta o melhor resultado de cada jogo: jogar muito não infla o total (participação fica no nível e nas conquistas).
# O geral é a SOMA dos jogos (premia o jogador completo) e vale por TEMPORADA: o mês do calendário no fuso de Brasília.
# Os rankings de cada jogo continuam permanentes (recordes).
#
# Os pontos são calculados sobre TODOS os perfis elegíveis, ocultos inclusive: a nota de um jogador não pode mudar
# conforme quem está olhando. O perfil oculto só é tirado da lista exibida aos outros (Q24).
TEMPORADAS_NO_HISTORICO = 12
# Só contam jogos que estão de fato no hub: publicados, com a pasta do jogo entregue e que não sejam o jogo de teste
# (mesma regra da interface, em web/src/App.tsx). Jogo só cadastrado, sem código, não pode somar pontos.
JOGO_NO_HUB = "j.publicado AND j.pasta IS NOT NULL AND j.pasta <> '_teste-hub'"

SQL_PONTOS_FLIX = f"""
WITH melhores AS (
    SELECT p.jogo_id, p.perfil_id, j.ordem,
           CASE WHEN j.ordem = 'maior' THEN max(p.pontos) ELSE min(p.pontos) END AS melhor
      FROM partidas p
      JOIN jogos j   ON j.id = p.jogo_id AND j.tem_ranking AND {JOGO_NO_HUB}
      JOIN perfis pf ON pf.id = p.perfil_id
      JOIN contas ct ON ct.id = pf.conta_id AND ct.ativo
     WHERE p.status = 'finalizada' AND p.pontos > 0 AND {FILTRO_TEMPORADA}  -- partida de 0 pontos não entra no ranking
     GROUP BY p.jogo_id, p.perfil_id, j.ordem
), colocados AS (
    SELECT jogo_id, perfil_id, melhor,
           RANK()   OVER (PARTITION BY jogo_id ORDER BY CASE WHEN ordem = 'maior' THEN -melhor ELSE melhor END) AS posicao,
           count(*) OVER (PARTITION BY jogo_id) AS jogadores
      FROM melhores
)
SELECT jogo_id, perfil_id, melhor, posicao, jogadores,
       round(1000.0 * (jogadores - posicao + 0.5) / jogadores)::int AS pontos
  FROM colocados
"""

SQL_RANKING_GERAL = f"""
WITH por_jogo AS MATERIALIZED ({SQL_PONTOS_FLIX}),
totais AS (
    SELECT perfil_id, sum(pontos)::int AS total FROM por_jogo GROUP BY perfil_id
), visiveis AS (
    SELECT t.perfil_id, t.total, pf.apelido, pf.cor, pf.nome, pf.sobrenome, pf.mostrar_nome
      FROM totais t
      JOIN perfis pf ON pf.id = t.perfil_id
     WHERE NOT pf.oculto OR pf.id = %(eu)s
), ordenados AS (
    SELECT v.*,
           RANK()       OVER (ORDER BY total DESC) AS posicao,
           row_number() OVER (ORDER BY total DESC, lower(apelido)) AS ordem
      FROM visiveis v
)
SELECT o.*,
       (SELECT json_agg(json_build_object('jogoId', pj.jogo_id, 'posicao', pj.posicao, 'jogadores', pj.jogadores,
                                          'melhor', pj.melhor, 'pontos', pj.pontos) ORDER BY pj.pontos DESC, pj.jogo_id)
          FROM por_jogo pj WHERE pj.perfil_id = o.perfil_id) AS jogos
  FROM ordenados o
 WHERE o.ordem <= %(limite)s OR o.perfil_id = %(eu)s
 ORDER BY o.ordem
"""


def temporada_atual(c: Connection) -> str:
    """Mês corrente ("AAAA-MM") no fuso de Brasília: a temporada vira à meia-noite do dia 1 para todo mundo."""
    r = c.execute("SELECT to_char(now() AT TIME ZONE %s::text, 'YYYY-MM') AS t", (FUSO,)).fetchone()
    assert r is not None
    return r["t"]


def temporadas(c: Connection, atual: str) -> list[str]:
    """Temporadas que dá para consultar: a atual e os meses anteriores com alguma partida (até 12), do mais novo ao mais velho."""
    linhas = c.execute(
        """SELECT DISTINCT to_char(finalizada_em AT TIME ZONE %(fuso)s::text, 'YYYY-MM') AS t
             FROM partidas
            WHERE status = 'finalizada'
              AND finalizada_em >= ((%(atual)s::text || '-01')::timestamp - make_interval(months => %(n)s::int)) AT TIME ZONE %(fuso)s::text""",
        {"fuso": FUSO, "atual": atual, "n": TEMPORADAS_NO_HISTORICO - 1},
    ).fetchall()
    return sorted({atual, *(l["t"] for l in linhas if l["t"] <= atual)}, reverse=True)[:TEMPORADAS_NO_HISTORICO]


def ranking_geral(c: Connection, eu: UUID, temporada: str, limite: int = 10) -> list[dict[str, Any]]:
    """Os `limite` primeiros da temporada e, se estiver fora deles, o próprio perfil; cada um com os pontos por jogo."""
    linhas = c.execute(SQL_RANKING_GERAL, {"eu": eu, "temporada": temporada, "limite": limite}).fetchall()
    return [
        {"posicao": l["posicao"], "apelido": l["apelido"], "nome": nome_publico(l), "cor": l["cor"], "pontos": l["total"],
         "eu": l["perfil_id"] == eu, "jogos": l["jogos"]}
        for l in linhas
    ]


def montar_perfil(c: Connection, perfil_id: UUID) -> dict[str, Any]:
    p = c.execute(
        "SELECT id, apelido, cor, oculto, criado_em, avatar, personagem, nome, sobrenome, mostrar_nome FROM perfis WHERE id = %s",
        (perfil_id,),
    ).fetchone()
    assert p is not None
    posicoes = c.execute(f"SELECT jogo_id, melhor, posicao FROM ({SQL_POSICOES}) r WHERE perfil_id = %(eu)s", {"eu": perfil_id, "temporada": None}).fetchall()
    tot = c.execute(
        "SELECT count(*) AS partidas, count(DISTINCT jogo_id) AS jogos FROM partidas WHERE perfil_id = %s AND status = 'finalizada'",
        (perfil_id,),
    ).fetchone()
    assert tot is not None
    favoritos = [r["jogo_id"] for r in c.execute("SELECT jogo_id FROM favoritos WHERE perfil_id = %s ORDER BY criado_em", (perfil_id,))]
    # Jogados recentemente (fileira do Início): jogos publicados pela partida mais recente, aberta ou terminada.
    # Vêm até 10 porque a interface mostra só os que estão no hub (com pasta entregue) e fica com os 3 primeiros.
    recentes = [r["jogo_id"] for r in c.execute(
        """SELECT p.jogo_id FROM partidas p JOIN jogos j ON j.id = p.jogo_id AND j.publicado
            WHERE p.perfil_id = %s GROUP BY p.jogo_id ORDER BY max(p.iniciada_em) DESC LIMIT 10""",
        (perfil_id,),
    )]
    progresso = {r["jogo_id"]: r["percentual"] for r in c.execute("SELECT jogo_id, percentual FROM progresso WHERE perfil_id = %s", (perfil_id,))}

    jogos: dict[str, dict[str, int]] = {}
    for r in posicoes:
        jogos[r["jogo_id"]] = {"melhor": r["melhor"], "posicao": r["posicao"]}
    for jogo_id, pct in progresso.items():
        jogos.setdefault(jogo_id, {})["progresso"] = pct

    melhor_pos = min((r["posicao"] for r in posicoes), default=None)
    feitas = [
        tot["partidas"] >= 1,
        melhor_pos is not None and melhor_pos <= 5,
        tot["jogos"] >= 5,
        tot["partidas"] >= 50,
        melhor_pos == 1,
    ]
    return {
        "id": str(p["id"]),
        "apelido": p["apelido"],
        "cor": p["cor"],
        "oculto": p["oculto"],
        # Nome verdadeiro: o dono sempre vê o seu; para os outros, só via nome_publico (ranking) quando habilitado
        "nome": p["nome"],
        "sobrenome": p["sobrenome"],
        "mostrarNome": p["mostrar_nome"],
        "avatar": avatar_valido(p["avatar"]),
        "personagem": personagem_valido(p["personagem"]),  # editor Universal LPC (configuração, não imagem)  # AvatarConfig v1 ou None (padrão); peça fora do catálogo atual vira None
        "desde": p["criado_em"].strftime("%m/%Y"),
        "partidas": tot["partidas"],
        "nivel": 1 + tot["partidas"] // 25,  # [H] regra provisória (Q20)
        "conquistas": [{"nome": n, "desc": d, "feita": f} for (n, d), f in zip(CONQUISTAS, feitas)],
        "favoritos": favoritos,
        "recentes": recentes,
        "jogos": jogos,
    }
