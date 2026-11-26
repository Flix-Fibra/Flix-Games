# G06 — Minigolfe Flix

Minigolfe de arrastar e soltar, visto de cima: arrastar para trás mira e define a força, soltar dá a tacada. Percurso de vários buracos; a pontuação é o **total de tacadas** (menos é melhor). Água e fora do campo custam 1 tacada e a bola volta ao ponto da tacada; no limite de 8 tacadas o buraco acaba. Mecânicas: paredes e diagonais, postes que chutam, areia, gelo, esteiras, ímãs que atraem ou repelem, portais de sinal, **bombas** (prendem a bola e miram sozinhas: o jogador só escolhe a força), **moinho**, **blocos móveis**, **rampas de salto**, **pistões** e **lava** que acende e apaga. A bola só cai se chegar devagar; rápida demais, passa por cima. **Fases e nome a validar (marketing).** Contrato com o hub em `docs/HUB_CONTRACT.md`.

```bash
npm run dev:minigolfe     # abra /dev-host.html para simular o hub
npm run build:minigolfe
npm test
SOLVE=1 npx vitest run games/minigolfe/tools   # robô joga as 16 fases e prova que dá para encaçapar
```

**Para adicionar fases, veja `docs/ADDING_LEVELS.md`** (fases são texto em grade em `src/levels.ts`). O percurso tem **16 fases** (as 7 primeiras recriam os campos desenhados pelo gestor); o conceito de cada uma está em `docs/MINIGOLFE_FASES.md`.

| O que mudar | Onde |
|---|---|
| Fases | `src/levels.ts` |
| Física, pisos, limites, regras de pontuação | `src/logic.ts` (sem Phaser, com testes em `src/logic.test.ts`) |
| Cores e tamanhos | `src/theme.ts` |
| Desenho do campo (pisos, postes, ímãs, portais, buraco) e dos engenhos que se mexem | `src/course.ts` |
| Mira, bola, fluxo dos buracos | `src/scenes/PlayScene.ts` |
| Sons | `src/audio.ts` (WebAudio, sem arquivos) |

Tudo é desenhado por código; nenhum arquivo de terceiros, nada a registrar em `ASSETS.md`.
