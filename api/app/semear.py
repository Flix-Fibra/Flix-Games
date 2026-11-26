"""Dados FICTÍCIOS para desenvolvimento local. Recusa rodar em produção.

Uso: docker compose exec api python -m app.semear
Cria a conta DEV-0001 (RafaPlayer e Ana_Gamer), outros jogadores de exemplo com partidas,
e publica todos os jogos.
"""
import random
import uuid

import psycopg

from .config import config

OUTROS = ["NightOwl", "Guh_77", "LariGamer", "Toddy", "Bruxinha", "Ze Turbo", "Pixel", "Mih", "Kaique", "DonaCida", "Lobo", "Fefe"]


def semear() -> None:
    if not config.desenvolvimento:
        raise SystemExit("Recusado: semear só roda com MODO=desenvolvimento.")
    rnd = random.Random(42)  # sempre os mesmos números
    with psycopg.connect(config.database_url) as c:
        # Jogo de teste do hub (games/_teste-hub) no lugar dos três primeiros, até chegarem os jogos reais
        c.execute("UPDATE jogos SET pasta = '_teste-hub' WHERE id IN ('g01', 'g02', 'g15') AND pasta IS NULL")
        # Jogos reais (pasta, nome e capa) vêm do game.json de cada jogo: npm run catalogo (scripts/sincronizar-catalogo.mjs).
        if c.execute("SELECT 1 FROM contas WHERE cliente_ref = 'DEV-0001'").fetchone():
            c.commit()
            print("Já semeado (pastas de teste conferidas).")
            return
        c.execute("UPDATE jogos SET publicado = TRUE")
        jogos = c.execute("SELECT id, ordem, pontos_min, pontos_max, duracao_min_ms FROM jogos WHERE publicado AND tem_ranking").fetchall()

        def jogador(ref: str, apelidos: list[tuple[str, str]], partidas: int) -> list[uuid.UUID]:
            (conta,) = c.execute("INSERT INTO contas (cliente_ref) VALUES (%s) RETURNING id", (ref,)).fetchone()
            ids = []
            for apelido, cor in apelidos:
                (pid,) = c.execute("INSERT INTO perfis (conta_id, apelido, cor) VALUES (%s, %s, %s) RETURNING id", (conta, apelido, cor)).fetchone()
                ids.append(pid)
                for jogo_id, ordem, pmin, pmax, dmin in rnd.sample(jogos, k=min(partidas, len(jogos))):
                    teto = pmin + max(10, (pmax - pmin) // 200)  # valores realistas, longe do máximo absurdo
                    pontos = rnd.randint(pmin, teto)
                    c.execute(
                        """INSERT INTO partidas (run_id, perfil_id, jogo_id, status, iniciada_em, finalizada_em, pontos, duracao_ms)
                           VALUES (%s, %s, %s, 'finalizada', now() - interval '1 day', now() - interval '1 day', %s, %s)""",
                        (uuid.uuid4(), pid, jogo_id, pontos, dmin + rnd.randint(1000, 90000)),
                    )
            return ids

        jogador("DEV-0001", [("RafaPlayer", "#D2232A"), ("Ana_Gamer", "#2773D2")], partidas=8)
        for i, nome in enumerate(OUTROS):
            jogador(f"DEV-{i + 100:04d}", [(nome, "#7654C4")], partidas=rnd.randint(4, 12))
        print("Dados de exemplo criados: conta DEV-0001 e", len(OUTROS), "jogadores fictícios.")


if __name__ == "__main__":
    semear()
