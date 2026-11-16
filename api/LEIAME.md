# api/ — backend

## Rodar localmente

Precisa de Docker. Na raiz do repositório:

```bash
cp .env.exemplo .env      # e troque a senha (o .env não vai para o git)
docker compose up -d --build
docker compose exec api python -m app.semear   # dados fictícios (só em MODO=desenvolvimento)
docker compose run --rm api pytest -q          # testes, num banco separado (flixgames_teste)
```

API em http://127.0.0.1:8000 · documentação em http://127.0.0.1:8000/api/docs (só em desenvolvimento) · saúde em `/api/saude`.

- `app/rotas_conta.py`: sessão por aparelho, login simulado (`/api/dev/entrar`, só desenvolvimento), aparelhos, perfis (limite de 2), favoritos.
- `app/rotas_jogos.py`: catálogo, ranking (maior ou menor vence, por jogo) e partidas (`/api/partidas/inicio` e `/fim`).
- `migracoes/`: SQL numerado, aplicado em ordem por `python -m app.migracoes`. Nunca editar uma migração já aplicada; criar a próxima.
- Toda requisição que altera dados exige o cabeçalho `X-Flix-Games: 1` (proteção contra outro site agir em nome do cliente).

## Desenho

Stack decidida (Q46): **Python + FastAPI + Uvicorn**, banco **PostgreSQL**.

Responsabilidades previstas:
- Receber o cliente vindo do App Flix/site pela API de integração do sistema do App Flix (Q02) e criar a sessão do aparelho (Q09: sem prazo, "sair" só deste aparelho).
- Perfis (até 2 por conta, Q23), favoritos, progresso, conquistas e partidas.
- Receber resultados de partida e montar os rankings por jogo (Q18/Q19), com limite de pontuação plausível e prevenção de reenvio (Q29).
- Painel da equipe de TI (Q35/Q36).

A interface já chama o backend por um único ponto: `web/src/dados/servico.ts` (`ServicoGames`). Cada função dali vira um endpoint.

Regras de servidor já registradas no `andamento.md` (Q46): API publicada só em `127.0.0.1`; Postgres sem porta publicada; HTTPS no nginx que já existe no servidor; backup por `pg_dump`.
