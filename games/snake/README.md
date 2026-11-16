# G03 — Fibra Conecta

Jogo de um dedo: guiar um cabo de fibra por uma grade para conectar casas, em 2 minutos. Contrato com o hub em `docs/HUB_CONTRACT.md`.

## Rodar
```bash
npm install                # na raiz do repositório
npm run dev:snake          # servidor local; abra /dev-host.html para simular o hub
npm run build:snake        # gera games/snake/dist (estático, funciona em subcaminho)
npm test                   # regras do jogo, SDK e personagem
```
Para testar no celular, use o endereço de rede que o Vite mostra (o servidor já usa `--host`).

## Onde ficam os visuais (para deixar com a cara da Flix)
Não há arquivos de imagem nem de som. Tudo é feito por código:

| O que mudar | Onde |
|---|---|
| Cores, tamanho da grade, altura do HUD, fonte | `src/theme.ts` |
| Desenho do cabo, casas, cones (obras), sinal | `src/scenes/PlayScene.ts` (funções `drawCable`, `drawHouse`, `drawCone`, `drawSignal`) |
| Menu e tela de fim (textos, cabo decorativo) | `src/scenes/MenuScene.ts` e `src/scenes/GameOverScene.ts` |
| Sons | `src/audio.ts` (notas geradas por WebAudio) |
| Personagem (cores, retrato) | `packages/flix-avatar/src/palettes.json`, `catalog.json` e `compose.ts` |
| Mapas de obras (layouts) | `src/logic.ts` (`MAPS`) |
| Regras, pontos, velocidade, duração | `src/logic.ts` (`ROUND_MS`, `tickMs`, `levelFor`, `BASE_POINTS`) |
| Nome do jogo | `game.json` e `index.html` |

Quando o designer entregar arte em PNG, a troca recomendada é carregar as imagens na cena (Phaser `load.image`) e substituir os blocos de `Graphics` por `add.image`/`add.sprite`, listando cada arquivo em `ASSETS.md`.
