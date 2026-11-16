# G10 — Estoque Flix

Itens de estoque caem um por vez pela prateleira; junte 3 ou mais iguais para guardá-los e liberar espaço, em 2 minutos; grupos maiores que 3 valem muito mais. **Não publicar antes do parecer do jurídico (Q47).** Contrato com o hub em `docs/HUB_CONTRACT.md`.

```bash
npm run dev:estoque     # abra /dev-host.html para simular o hub
npm run build:estoque
npm test
```

| O que mudar | Onde |
|---|---|
| Cores, tamanhos, posições, cor do cartão de cada item | `src/theme.ts` |
| Desenho vetorial dos 5 itens (roteador, cabo, monitor, furadeira, antena) | `src/art.ts` (`drawRouter`, `drawCable`, ...) |
| Peças, pontos, velocidade de queda, duração | `src/logic.ts` (`SHAPES`, `fallInterval`, `BASE_POINTS`, `ROUND_MS`) |
| Sons | `src/audio.ts` (WebAudio, sem arquivos) |
| Telas, animações, controles | `src/scenes/` |

Os itens são desenhados por código (formas vetoriais lisas), inspirados em fotos de referência de produtos genéricos. Nenhum arquivo de terceiros; nada a registrar em `ASSETS.md`. Quando o designer entregar arte, trocar `buildItemTextures` por `load.image`.
