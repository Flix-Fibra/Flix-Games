# G12 — Corrida Flix (em desenvolvimento)

Corrida top-down em pixel art. Esta primeira entrega tem o **modelo do carro** (sprite stacking) e **2 pistas** , com um carro dirigível para conferir o visual e o tamanho. Há 10 adversários com IA (azul, amarelo, verde, laranja, roxo, ciano, rosa, branco, cinza e marrom) e classificação em tempo real. Ainda não há tela de menu nem envio de tempo ao hub; o jogo não está no catálogo (`game.json` sem `"catalogo"`).

```bash
npm run dev:corrida     # abra http://localhost:5173/ (porta que o Vite mostrar)
npm run build:corrida
npm test
```

Teclas: ←/→ ou A/D viram (a aceleração é automática), ↓/S freiam, **espaço** ativa o turbo guardado, **N** e **P** trocam de pista só com `?livre` na URL (para testes), **R** reinicia, **M** mostra o carro em 8 ângulos ampliado, **V** alterna a perspectiva. Toque: arrastar para os lados. `?pista=N` põe a pista N como a primeira do campeonato (teste). A corrida tem **10 voltas**: ao fim aparece a tela com posição, tempo total e melhor volta (ENTER ou toque continua).

## Como funciona

| O quê | Onde |
|---|---|
| Tela interna com o **tamanho real da janela em pixels do aparelho** (considera telas de alta densidade; `main.ts`), sem ampliação do navegador, e zoom do mundo **inteiro** conforme a janela (`recalcular`, `ALTURA_ARTE` e `LARGURA_ARTE` em `theme.ts`): cada pixel da arte vira N x N pixels da tela, pixelado porém nítido. Os textos da interface (`fixar`) escalam com a altura e ficam sem zoom. O carro tem 120 quadros de rotação (3°). A cada volta completada o zoom diminui 10% (`ZOOM_POR_VOLTA`), numa transição suave de 1 s (`ZOOM_TRANSICAO_MS`). | `src/main.ts`, `src/theme.ts` |
| Carro: fatias (da base ao topo) como retângulos coloridos; cada fatia gira pelo mesmo ângulo e fica 1 px acima da anterior; sombra no chão e contorno escuro por fatia | `src/carro.ts` (`FATIAS`, `desenharQuadro`) |
| O empilhamento é feito **uma vez no carregamento**: 72 quadros (a cada 5°). No jogo o carro é uma `Image` comum, em pixels inteiros, ordenada pelo `y` do ponto de contato com o chão. Um único pipeline de desenho | `criarTexturaCarro`, `PlayScene.update` |
| Pista = só uma linha central fechada (pontos de controle). Dela saem a pintura (grama, areia, zebra vermelha e branca, asfalto, faixa, largada, árvores ou pneus), reduzida a uma paleta fixa, e o mapa de superfície que a física usa | `src/pistas.ts` |
| Adversários: `controlarIA` mira num ponto à frente na linha central (cada um na sua faixa) e freia antes de curva fechada; são um pouco mais lentos que o jogador (97%, 94%, 91% do teto); `separar` afasta carros que batem; `Progresso` dá a classificação | `src/logic.ts`, `src/scenes/PlayScene.ts` |
| Batidas: cada carro é uma cápsula (2 círculos); **regra: quem bate por trás é quem rodopia e desliza até quase parar** (fechamento acima de 40 px/s); quem foi atingido só é empurrado; quem roda fica 1,5 s imune e, enquanto rodopia, fica sem colisão (os outros passam por ele). Os rivais desviam uns dos outros (`evitar`), mas não do jogador. Rivais atrás do jogador líder ganham até +22% de teto (`reforcoRival`). Golpe aleatório: um rival atrás do jogador (até 360 px) o mira de propósito e o faz rodar (única exceção à regra); no mínimo 15 s entre duas vezes em que o jogador é atingido | `src/logic.ts` (`batida`, `rodar`), `src/scenes/PlayScene.ts` |
| Itens e obstáculos (todos stacks de pixels, mesma base do carro): **poças** (derrapa e dá voltas; aparecem em lugares aleatórios), **vaca** que atravessa a pista (coice: o carro é jogado para fora e rodopia), **meteoro** (a sombra cresce à frente do jogador; no impacto joga os carros próximos para fora e eles reaparecem na pista 2 s depois), **turbo** (o jogador guarda ao pegar e ativa com ESPAÇO ou toque rápido: +30% por 4 s, chama azul na traseira; o texto "APERTE ESPAÇO: TURBO!" fica na tela enquanto houver turbo guardado), **arco-íris** (6 s, o carro muda de cor em degradê e não colide com carros) e **roleta** (gira por 2 s com o carro piscando e sob controle do jogador, mostrando números trocando na tela; depois leva o jogador à posição sorteada e mostra "ROLETA: X LUGAR!" por 2 s; só ele usa). Poças e bônus surgem em lugares e faixas aleatórios, um de cada vez a cada 9 a 16 s (no máximo 3 na pista, de 600 a 1.500 px à frente do jogador; somem ao ficar para trás); vaca a cada 20 a 42 s e meteoro a cada 33 a 53 s. Os bônus giram no chão e somem ao serem pegos; rivais também pegam turbo e arco-íris | `src/itens.ts`, `src/itensArte.ts` |
| Rivais: cada um anda numa faixa (±24 px do centro) com **desvio aleatório de até ±10 px** que muda a cada 1 a 2,5 s, então dá para ultrapassar pelo meio de dois carros | `PlayScene.ts` (`DESVIO_MAX`, `FAIXA`) |
| Física (aceleração automática, giro que depende da velocidade, derrapagem lateral por superfície, limite de velocidade por superfície) e contagem de voltas | `src/logic.ts` (`FISICA`, `andarCarro`, `Voltas`) |

Tamanhos: carro de 41 x 19 px (10 fatias), asfalto de 94 px (2,3 comprimentos de carro), mundo de 2800 x 1750 px, pista de ~4.400 a ~4.700 px, teto de velocidade no asfalto de 146 px/s na largada subindo em linha reta até 210 px/s aos 3 s de corrida (`VEL_INICIAL`, `VEL_FINAL`, `RAMPA_MS` em `logic.ts`), mais 30 px/s a cada volta completada pelo jogador, para todos os carros (`ACRESCIMO_POR_VOLTA`), voltas de ~30 a 40 s (testado em `logic.test.ts`).

## Arte: o que falta

Tudo é desenhado por código (nenhum arquivo de terceiros; nada a registrar em `ASSETS.md`). Para trocar por arte do designer do carro: uma **folha de fatias** (uma linha de quadros 41 x 19, da base ao topo, fundo transparente, frente do carro para a direita) substitui `FATIAS`; a partir das 4 vistas (topo, lado, frente, trás) o designer fatia o carro por altura: cada fatia é o que se vê de cima em cada degrau de altura (rodas e chassi nas de baixo, carroceria no meio, piloto e aerofólio nas de cima). 10 fatias bastam para esse tamanho.

## Próximos passos [H]

**Lembrar o solicitante:** rampas com manobras do carro (os itens já estão), terceira pista (tema obra de fibra), adversários com IA, bônus (turbo, escudo), menu, contagem de largada, tempo de volta enviado ao hub (`rankingMetric: lap_time`), piloto com o personagem do perfil, som, teste em celular e parecer do jurídico.

## Pistas

24 pistas com o formato dos circuitos do pôster da temporada 2026 (Melbourne, Xangai, Suzuka, Sakhir, Jeddah, Miami, Montreal, Mônaco, Barcelona, Spielberg, Silverstone, Spa, Budapeste, Zandvoort, Monza, Madri, Baku, Singapura, Austin, Cidade do México, São Paulo, Las Vegas, Lusail e Abu Dhabi). Os traçados são **aproximações** desenhadas a partir do formato geral (a imagem do pôster é pequena demais para decalcar): cada um é uma lista de pontos numa caixa de 1000 x 625, ampliada 2,8x no jogo, com a largura do asfalto fixa em 94 px. Voltas de ~4.500 a ~7.800 px. Suzuka cruza com ela mesma (oito), as outras não (um teste confere a distância entre trechos). Temas de cenário: gramado, pneus, obra (cones, carretéis e terra), cidade (prédios vistos de cima) e lago. [D] Os nomes dos circuitos e das cidades vêm do pôster; conferir com o jurídico antes de publicar. [D] Mônaco, Madri e outros têm traçado muito simplificado.

## Perspectiva (teste)

Desativada por padrão (a visão padrão é fixa, de cima; a tecla **V** liga esta). Nela o carro fica **parado na tela, apontando para cima**, na parte de baixo, e a câmera gira com ele: a pista muda de direção conforme o jogador vira (`girar` e `VISTA_A_FRENTE_PX` em `PlayScene.ts`). Tecla **V** volta à visão fixa de cima. Detalhes: a rotação da câmera é `-90° - ângulo do carro`; os objetos empilhados (carros, bônus, vaca, pedra do meteoro, triângulo) são contra-rotacionados e usam o quadro do ângulo relativo, então a pilha de fatias sempre aponta para cima na tela; poças e sombras giram com o mundo; o texto da interface desfaz a rotação e o zoom. Na vista girando não há limite de câmera (pode aparecer fora da pista no canto do mundo).

## Campeonato

No começo do jogo a **ordem das 24 pistas é sorteada**. O jogador só passa para a próxima pista se terminar a corrida **entre os 6 primeiros** (`LIMITE_CLASSIFICACAO`); fora disso, repete a mesma pista. Depois da 24ª, o campeonato recomeça com nova ordem. O HUD mostra "pista X/24". Lógica pura em `logic.ts` (`embaralhar`, `classificou`, `proximaEtapa`), testada. [H] Enquanto não houver integração com o hub, a ordem e o progresso valem só na sessão (recarregar a página sorteia de novo e volta à pista 1).
