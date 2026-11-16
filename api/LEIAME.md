# api/ — backend (ainda não criado)

Stack decidida (Q46): **Python + FastAPI + Uvicorn**, banco **PostgreSQL**.

Responsabilidades previstas:
- Receber o cliente vindo do App Flix/site pela API de integração do sistema do App Flix (Q02) e criar a sessão do aparelho (Q09: sem prazo, "sair" só deste aparelho).
- Perfis (até 2 por conta, Q23), favoritos, progresso, conquistas e partidas.
- Receber resultados de partida e montar os rankings por jogo (Q18/Q19), com limite de pontuação plausível e prevenção de reenvio (Q29).
- Painel da equipe de TI (Q35/Q36).

A interface já chama o backend por um único ponto: `web/src/dados/servico.ts` (`ServicoGames`). Cada função dali vira um endpoint.

Regras de servidor já registradas no `andamento.md` (Q46): API publicada só em `127.0.0.1`; Postgres sem porta publicada; HTTPS no nginx que já existe no servidor; backup por `pg_dump`.
