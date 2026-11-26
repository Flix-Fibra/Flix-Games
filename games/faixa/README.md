# G09 — Faixa a Faixa

Travessia infinita em grade, tema obra de fibra ótica na rua. O técnico avança faixa a faixa (9 colunas), desviando de carros e caminhões, pulando em paletes e troncos no rio ou em vitórias-régias, e atravessando trilhos antes do trem (o sinal vermelho avisa pelo menos 1 s antes). A base da tela sobe sozinha, cada vez mais rápido: quem demora é alcançado. Pontuação = faixas atravessadas. Teclado: setas ou WASD. Toque: tocar avança, deslizar muda de lado ou volta. **Nome de catálogo; validar com o marketing antes de publicar.** Contrato com o hub em `docs/HUB_CONTRACT.md`.

```bash
npm run dev:faixa       # porta 5173; abra /dev-host.html para simular o hub
npm run build:faixa
npm test
```

## Mapa procedural (`src/logic.ts`, sem Phaser)

Faixas (`grass`, `road`, `river`, `rail`) são geradas sob demanda, de baixo para cima, por `World.ensure`, e descartadas por `World.prune` quando saem da tela. Mesma semente, mesma fase.

Como evita bloqueio impossível:
1. Cada faixa guarda `reach`: colunas seguras e alcançáveis.
2. A faixa nova é obrigada a ter uma coluna **alinhada** com o `reach` da anterior (sem obstáculo na grama; com vitória-régia no rio). Se o sorteio não deixou, o gerador abre uma. Isso vale por indução, inclusive para duas faixas de vitória-régia seguidas.
3. Perigos em movimento são periódicos, com vão mínimo proporcional à velocidade; a margem depois de rio de troncos nunca tem obstáculo; no máximo 4 faixas perigosas seguidas.
4. Curva de dificuldade: as 5 primeiras faixas são grama segura; rio entra na faixa 8 e trilho na 12; `difficulty()` sobe suavemente e aumenta densidade, velocidade e pressão do tempo.

| O que mudar | Onde |
|---|---|
| Pesos dos tipos de faixa, velocidades, densidades, curva | `src/logic.ts` (`pickKind`, `gen*`, `difficulty`, `creepSpeed`) |
| Cores, tamanhos, tema | `src/theme.ts` |
| Desenho de obstáculos, veículos, troncos, jogador, tapume | `src/art.ts` |
| Fundo e objetos de cada tipo de faixa (novo tema visual) | `src/laneView.ts` |
| Sons | `src/audio.ts` (WebAudio, sem arquivos) |

Tudo é desenhado por código; nenhum arquivo de terceiros, nada a registrar em `ASSETS.md`.
