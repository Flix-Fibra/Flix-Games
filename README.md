# Flix-Games-
Jogos da Flix fibra para clientes

Portal de jogos para clientes FLIX, com entrada pelo App Flix e pelo site, navegação inspirada em consoles, até 2 perfis por conta e rankings por jogo. Em desenvolvimento: interface e API funcionam localmente com **login simulado e dados fictícios**; a integração com o login do App Flix (Q02) ainda não existe.

## Por onde continuar

1. Leia [docs/andamento.md](docs/andamento.md): estado atual, próxima fase, bloqueios e perguntas.
2. Leia [docs/visao-projeto.md](docs/visao-projeto.md): contexto confirmado, propostas de arquitetura e opções de login.
3. Siga [docs/como-manter-andamento.md](docs/como-manter-andamento.md): regras de criação e manutenção do painel.

Qualquer pessoa ou IA pode continuar a próxima fase. Não há responsáveis fixos por área. Atualize o andamento no mesmo commit de qualquer mudança que altere o estado do projeto.

## Estrutura

| Pasta | O que é | Situação |
|---|---|---|
| `docs/` | Andamento, visão, manutenção do painel e prompt dos minigames | Fonte do estado do projeto |
| `web/` | Interface: React + TypeScript + Vite | Ligada à API (`web/src/dados/servico.ts`); catálogo G01–G15 vem do banco |
| `api/` | Backend: Python + FastAPI + Uvicorn + PostgreSQL | Funciona localmente com login simulado e 19 testes (ver `api/LEIAME.md`) |
| `tarefas/` | Processo separado: revalidar clientes no CRM | Ainda não criado (ver `tarefas/LEIAME.md`) |
| `prototipo/` | Protótipo estático original (HTML/CSS/JS) | Referência; será removido quando a versão React for aprovada |

## Rodar a interface localmente

Requer Node 20 ou mais novo e a API rodando (`docker compose up -d`, ver `api/LEIAME.md`): o Vite repassa `/api` para `127.0.0.1:8000`. Em desenvolvimento, sem sessão, a interface entra sozinha na conta de teste `DEV-0001`.

```bash
cd web
npm ci            # instala as versões exatas do package-lock.json
npm run dev       # http://127.0.0.1:5173 (só nesta máquina)
npm run verificar # checagem de tipos (TypeScript)
npm run build     # gera web/dist para publicação
```

Links diretos: `#perfis` (escolher perfil), `#inicio`, `#ranking`, `#perfil`.

Não publique senhas, tokens, dados reais de clientes ou respostas confidenciais do fornecedor neste repositório.
