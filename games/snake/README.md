# G03 — Network Snake

Jogo de um dedo: guiar um cabo de rede com conector RJ45 nas duas pontas para conectar casas, em 2 minutos. Estilo visual dos modelos enviados pelo gestor (ilustrações, não pixel art). Contrato com o hub em `docs/HUB_CONTRACT.md`.

## Rodar
```bash
npm install                # na raiz do repositório
npm run dev:snake          # servidor local; abra /dev-host.html para simular o hub
npm run build:snake        # gera games/snake/dist (estático, funciona em subcaminho)
npm test                   # regras do jogo, SDK e pacotes
```
Para testar no celular, use o endereço de rede que o Vite mostra (o servidor já usa `--host`).

## Onde ficam os visuais (para trocar ou ajustar)
O jogo é desenhado em 540x960 (mesma proporção do cenário do gestor) e escala para a tela. As imagens estão em `public/img/` e são listadas em `src/theme.ts` (`IMAGES`).

| O que mudar | Onde |
|---|---|
| Fundo (painel escuro com grade na tela inteira) e tamanho do campo | `PANEL`, `CELL`, `FIELD_Y`, `FIELD_ROWS`, `src/theme.ts`; `buildScenery` em `src/scenes/PlayScene.ts` |
| Topo: céu e cidade (o menu fica por cima) | `public/img/ceu.jpg` e `public/img/cidade.png`; montagem em `buildScenery` |
| Rodapé (calçada, arbustos, carretel, van da Flix e cones) | `public/img/rodape.png` |
| Menu superior (avatar, SCORE, TEMPO com relógio, NÍVEL com barras verdes) | `buildHud` em `src/scenes/PlayScene.ts`; posições e tamanhos em `HUD`, `src/theme.ts` |
| Cobra: cabeça, segmentos do corpo e cauda (azul normal; `cobra_metal_*` é a vermelha do ponto extra) | `public/img/cobra_azul_*` e `cobra_metal_*`; tamanho em `BODY_H`, `HEAD_FRONT`, `TAIL_BACK` (`theme.ts`); montagem em `updateSnake` (`PlayScene.ts`) |
| Itens de pontuação (casa, antena, CPE, caixa de fibra, roteador, switch) | `public/img/` e a lista `FOOD_ITEMS` (`theme.ts`), que também define o tamanho de cada um |
| Globo digital (bônus de ponto extra): imagem, tamanho, chance e duração | `SIGNAL_ITEM` (`theme.ts`); `SIGNAL_CHANCE`, `SIGNAL_LIFETIME_MS`, `BOOST_MS` (`src/logic.ts`); cores da cobra vermelha em `TUBE` |
| Muro (cerca de madeira com flores) | `public/img/muro.png`; desenho em `buildObstacles` (`src/scenes/PlayScene.ts`); layouts em `MAP_BARS` (`src/logic.ts`) |
| Logo (menu e tela de fim) | `public/img/logo.png` |
| Cores do painel, textos e fontes | `src/theme.ts` |
| Onda vermelha, LEVEL UP, HUD | `src/scenes/PlayScene.ts` |
| Menu e tela de fim; botão e fundo | `src/scenes/MenuScene.ts`, `GameOverScene.ts`, `src/ui.ts` |
| Sons | `src/audio.ts` (notas geradas por WebAudio) |
| Regras, pontos, velocidade, duração, tempo extra por item (`ITEM_BONUS_MS`), tamanho do campo | `src/logic.ts` |

## Trocar ou atualizar as imagens
As originais do gestor ficam fora do Git. Para refazer os arquivos otimizados a partir da pasta “Network Snake”:
```bash
npm install --no-save sharp
node games/snake/tools/preparar-assets.cjs "<pasta Network Snake>"
```
O script recorta a cobra em cabeça, corpo e cauda nas emendas dos segmentos, apara as bordas transparentes e reduz o tamanho. Se um novo modelo da cobra tiver outras proporções, ajuste as coordenadas de recorte no script.
