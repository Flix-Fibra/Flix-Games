# G12 — Corrida Flix (em desenvolvimento)

Corrida top-down em pixel art. Esta primeira entrega tem o **modelo do carro** (sprite stacking) e **2 pistas** (Circuito Verde e Pista dos Pneus), com um carro dirigível para conferir o visual e o tamanho. Há 10 adversários com IA (azul, amarelo, verde, laranja, roxo, ciano, rosa, branco, cinza e marrom) e classificação em tempo real. Ainda não há bônus, tela de menu nem envio de tempo ao hub; o jogo não está no catálogo (`game.json` sem `"catalogo"`).

```bash
npm run dev:corrida     # abra http://localhost:5173/ (porta que o Vite mostrar)
npm run build:corrida
npm test
```

Teclas: ←/→ ou A/D viram (a aceleração é automática), ↓/S/espaço freiam, **1** e **2** trocam de pista, **R** reinicia, **M** mostra o carro em 8 ângulos ampliado. Toque: arrastar para os lados. `?pista=2` abre direto a segunda.

## Como funciona

| O quê | Onde |
|---|---|
| Tela interna 480 x 270, ampliada sem suavizar (`pixelArt`) | `src/main.ts`, `src/theme.ts` |
| Carro: fatias (da base ao topo) como retângulos coloridos; cada fatia gira pelo mesmo ângulo e fica 1 px acima da anterior; sombra no chão e contorno escuro por fatia | `src/carro.ts` (`FATIAS`, `desenharQuadro`) |
| O empilhamento é feito **uma vez no carregamento**: 72 quadros (a cada 5°). No jogo o carro é uma `Image` comum, em pixels inteiros, ordenada pelo `y` do ponto de contato com o chão. Um único pipeline de desenho | `criarTexturaCarro`, `PlayScene.update` |
| Pista = só uma linha central fechada (pontos de controle). Dela saem a pintura (grama, areia, zebra vermelha e branca, asfalto, faixa, largada, árvores ou pneus), reduzida a uma paleta fixa, e o mapa de superfície que a física usa | `src/pistas.ts` |
| Adversários: `controlarIA` mira num ponto à frente na linha central (cada um na sua faixa) e freia antes de curva fechada; são um pouco mais lentos que o jogador (97%, 94%, 91% do teto); `separar` afasta carros que batem; `Progresso` dá a classificação | `src/logic.ts`, `src/scenes/PlayScene.ts` |
| Batidas: cada carro é uma cápsula (2 círculos); **regra: quem bate por trás é quem rodopia e desliza até quase parar** (fechamento acima de 40 px/s); quem foi atingido só é empurrado; quem roda fica 1,5 s imune. Os rivais desviam uns dos outros (`evitar`), mas não do jogador. Rivais atrás do jogador líder ganham até +22% de teto (`reforcoRival`). Golpe aleatório: um rival atrás do jogador (até 360 px) o mira de propósito e o faz rodar (única exceção à regra); no mínimo 15 s entre duas vezes em que o jogador é atingido | `src/logic.ts` (`batida`, `rodar`), `src/scenes/PlayScene.ts` |
| Física (aceleração automática, giro que depende da velocidade, derrapagem lateral por superfície, limite de velocidade por superfície) e contagem de voltas | `src/logic.ts` (`FISICA`, `andarCarro`, `Voltas`) |

Tamanhos: carro de 33 x 15 px (8 fatias), asfalto de 62 px, pista de ~4.400 a ~4.700 px, teto de velocidade no asfalto de 146 px/s na largada subindo em linha reta até 210 px/s aos 3 s de corrida (`VEL_INICIAL`, `VEL_FINAL`, `RAMPA_MS` em `logic.ts`), voltas de ~30 a 40 s (testado em `logic.test.ts`).

## Arte: o que falta

Tudo é desenhado por código (nenhum arquivo de terceiros; nada a registrar em `ASSETS.md`). Para trocar por arte do designer do carro: uma **folha de fatias** (uma linha de quadros 33 x 15, da base ao topo, fundo transparente, frente do carro para a direita) substitui `FATIAS`; a partir das 4 vistas (topo, lado, frente, trás) o designer fatia o carro por altura: cada fatia é o que se vê de cima em cada degrau de altura (rodas e chassi nas de baixo, carroceria no meio, piloto e aerofólio nas de cima). 8 fatias bastam para esse tamanho.

## Próximos passos [H]

**Lembrar o solicitante:** itens bons e ruins na pista e rampas com manobras do carro, terceira pista (tema obra de fibra), adversários com IA, bônus (turbo, escudo), menu, contagem de largada, tempo de volta enviado ao hub (`rankingMetric: lap_time`), piloto com o personagem do perfil, som, teste em celular e parecer do jurídico.
