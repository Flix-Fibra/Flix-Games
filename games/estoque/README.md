# G10 — Estoque Flix

Peças de 4 blocos caem numa prateleira de 10 x 20 (as 7 formas clássicas: reta, quadrado, T, as duas escadinhas e os dois L, cada uma sempre com a mesma cor de cabo). Cada bloco é um pedaço de cabo de rede: bloco encostado na lateral ganha um conector RJ45 do lado de fora; a linha completa liga um roteador (esquerda) a um computador (direita), o sinal passa e a linha some; sem limite de tempo, a partida acaba quando a pilha chega ao topo. Mais linhas de uma vez valem mais (100, 300, 500, 800 vezes o nível; nível sobe a cada 5 linhas). Teclado: ← → mover (segurar repete), ↑ girar (Z gira ao contrário), ↓ descer rápido, espaço derruba. Toque: arrastar move, tocar gira, arrastar para baixo desce, deslizar rápido derruba. Contrato com o hub em `docs/HUB_CONTRACT.md`.

```bash
npm run dev:estoque     # abra /dev-host.html para simular o hub
npm run build:estoque
npm test
```

| O que mudar | Onde |
|---|---|
| Cores, tamanhos, posições, cor do cartão de cada item | `src/theme.ts` |
| Cores dos 7 cabos | `src/theme.ts` (`ITEMS`) |
| Desenho do pedaço de cabo, do conector RJ45 e dos aparelhos (roteador e computador) | `src/art.ts` (`drawCableCell`, `drawPlug`, `drawRouter`, `drawMonitor`) |
| Peças, pontos, velocidade de queda, tempo para travar | `src/logic.ts` (`SHAPES`, `fallInterval`, `LINE_POINTS`, `LOCK_DELAY_MS`) |
| Sons | `src/audio.ts` (WebAudio, sem arquivos) |
| Telas, animações, controles | `src/scenes/` |

Os itens são desenhados por código (formas vetoriais lisas), inspirados em fotos de referência de produtos genéricos. Nenhum arquivo de terceiros; nada a registrar em `ASSETS.md`. Quando o designer entregar arte, trocar `buildItemTextures` por `load.image`.
