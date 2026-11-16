# Flix-Games-
Jogos da Flix fibra para clientes

Portal de jogos para clientes FLIX, com entrada pelo App Flix e pelo site, navegação inspirada em consoles, até 2 perfis por conta e rankings por jogo. Em desenvolvimento: a interface roda com **dados simulados**; a API e a integração com o login do App Flix ainda não existem.

## Por onde continuar

1. Leia [docs/andamento.md](docs/andamento.md): estado atual, próxima fase, bloqueios e perguntas.
2. Leia [docs/visao-projeto.md](docs/visao-projeto.md): contexto confirmado, propostas de arquitetura e opções de login.
3. Siga [docs/como-manter-andamento.md](docs/como-manter-andamento.md): regras de criação e manutenção do painel.

Qualquer pessoa ou IA pode continuar a próxima fase. Não há responsáveis fixos por área. Atualize o andamento no mesmo commit de qualquer mudança que altere o estado do projeto.

## Estrutura

| Pasta | O que é | Situação |
|---|---|---|
| `docs/` | Andamento, visão, manutenção do painel e prompt dos minigames | Fonte do estado do projeto |
| `web/` | Interface: React + TypeScript + Vite | Funciona com dados simulados (`web/src/dados/servico.ts`) |
| `api/` | Backend: Python + FastAPI + Uvicorn + PostgreSQL | Ainda não criado (ver `api/LEIAME.md`) |
| `tarefas/` | Processo separado: revalidar clientes no CRM | Ainda não criado (ver `tarefas/LEIAME.md`) |
| `prototipo/` | Protótipo estático original (HTML/CSS/JS) | Referência; será removido quando a versão React for aprovada |

## Rodar a interface localmente

Requer Node 20 ou mais novo.

```bash
cd web
npm ci            # instala as versões exatas do package-lock.json
npm run dev       # http://127.0.0.1:5173 (só nesta máquina)
npm run verificar # checagem de tipos (TypeScript)
npm run build     # gera web/dist para publicação
```

Links diretos: `#perfis` (escolher perfil), `#inicio`, `#ranking`, `#perfil`.

Não publique senhas, tokens, dados reais de clientes ou respostas confidenciais do fornecedor neste repositório.
