"""Consultas compartilhadas: ranking e montagem do perfil."""
from typing import Any
from uuid import UUID

from psycopg import Connection

from .avatar import avatar_valido
from .personagem import personagem_valido

# Melhor resultado de cada perfil em cada jogo e a posição no ranking daquele jogo.
# - 'maior' vence maior pontuação; 'menor' vence menor (tacadas, tempo).
# - Perfis ocultos (Q24) somem para os outros, mas o próprio dono continua se vendo.
# - Contas sem elegibilidade não aparecem.
# - Empate: mesma posição (RANK). [D] Regra de desempate por jogo pendente (Q19).
SQL_POSICOES = """
WITH melhores AS (
    SELECT p.jogo_id, p.perfil_id,
           CASE WHEN j.ordem = 'maior' THEN max(p.pontos) ELSE min(p.pontos) END AS melhor
      FROM partidas p
      JOIN jogos j ON j.id = p.jogo_id AND j.tem_ranking
     WHERE p.status = 'finalizada'
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


def ranking_do_jogo(c: Connection, jogo_id: str, eu: UUID, limite: int = 10) -> list[dict[str, Any]]:
    linhas = c.execute(
        f"SELECT * FROM ({SQL_POSICOES}) r WHERE jogo_id = %(jogo)s ORDER BY posicao, apelido",
        {"eu": eu, "jogo": jogo_id},
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


def montar_perfil(c: Connection, perfil_id: UUID) -> dict[str, Any]:
    p = c.execute(
        "SELECT id, apelido, cor, oculto, criado_em, avatar, personagem, nome, sobrenome, mostrar_nome FROM perfis WHERE id = %s",
        (perfil_id,),
    ).fetchone()
    assert p is not None
    posicoes = c.execute(f"SELECT jogo_id, melhor, posicao FROM ({SQL_POSICOES}) r WHERE perfil_id = %(eu)s", {"eu": perfil_id}).fetchall()
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
