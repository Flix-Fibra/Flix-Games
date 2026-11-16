# Decisões técnicas

Registro das decisões de engenharia dos jogos. Decisões de produto ficam em `andamento.md` (perguntas Q01–Q49).

## 16/11/2026 — Começo do G03 (Fibra Conecta, tipo Snake)

| Decisão | Motivo | Status |
|---|---|---|
| [C] Primeiro jogo a ser codificado: **G03**, e não o G01 | Pedido do solicitante em 16/11 | Confirmado |
| [H] Jogo em **retrato 270x480** (grade 18x27, células de 15 px) | Snake é vertical e de uma mão; a tela escala com `Phaser.Scale.FIT` | Padrão adotado; mudar se o App abrir o jogo de outra forma |
| [H] Stack: **Phaser 3.90.0 + TypeScript + Vite**, versões fixas | Padrão do prompt dos minigames. Phaser 4 já existe, mas o prompt pede Phaser 3 | Aguardando confirmação do Rafael/Tobias |
| [H] Repositório único (monorepo npm workspaces): `games/`, `packages/` | Estrutura proposta no `visao-projeto.md` §9 e no prompt §5 | Padrão adotado |
| [H] Testes com **Vitest** nas regras puras (`logic.ts`) e no SDK | Regras separadas do Phaser ficam testáveis sem navegador | Adotado |
| [H] **Sem arquivos de arte ou som**: tudo desenhado e sintetizado por código | Evita licenças de terceiros; facilita trocar as cores em um arquivo só (`theme.ts`) | Adotado até o designer entregar o kit |
| [H] Nome de trabalho **"Fibra Conecta"** | Prompt manda usar nome próprio, não "Snake" | Validar com o marketing |
| [C] Sem anúncio: o hub envia `restart` direto | Decisão de 16/11 (Q34) | Confirmado |

### 16/11/2026 — Movimento fluido do cabo

[C] Pedido do solicitante: o cabo não deve se mover no estilo clássico de 8 bits, casa por casa. [H] Solução adotada: a lógica continua na grade (colisões e regras iguais, testadas), mas o desenho interpola entre um passo e o seguinte: a cabeça desliza, a ponta recua e o cabo é uma linha contínua com curvas arredondadas (`src/cablePath.ts`). Custo: o desenho fica um passo atrás da lógica, o que não é perceptível nas velocidades do jogo. Ajustar espessura em `CABLE_W` e arredondamento em `drawCable` (`PlayScene.ts`).

### 16/11/2026 — Onda vermelha e "LEVEL UP"

[C] Pedido do solicitante, com imagem de referência. [H] Interpretação adotada: a **onda vermelha em pixels** (anel de blocos de 6 px que se expande a partir da casa, 0,7 s) aparece a cada casa conectada; o texto **"LEVEL UP" com seta verde** e o "NÍVEL n" logo abaixo aparecem depois da onda (0,38 s) **quando o nível sobe** (a cada 3 casas), com um som curto. A fonte pixel art 5x7 com degradê amarelo→laranja→vermelho, contorno escuro e seta é desenhada por código (`src/pixelFont.ts`), sem arquivo de fonte ou imagem. Ajustes: `WAVE_*` e `LEVEL_TEXT_DELAY_MS` em `PlayScene.ts`; cores em `pixelFont.ts`. Se a intenção era mostrar o texto a cada casa, e não só ao subir de nível, é uma linha em `handleEvent`. Abrir o jogo com `?debug` expõe `window.__flixGame` para testar os efeitos.

### 16/11/2026 — Cabo no estilo de cabo de rede RJ45

[C] Pedido do solicitante, com foto de referência (cabo azul com conector RJ45). [F] Implementado em `PlayScene.ts` (`drawCable` e `drawPlug`), por código, sem imagens: tubo com contorno, sombra, cor, brilho e reflexo; **cauda mais fina** (a ponta chega a 62% da espessura do corpo, afinando nos últimos 70 px; `TAIL_END_RATIO` e `TAIL_TAPER_PX`); cabeça com conector RJ45 (capa de borracha com frisos, corpo, trava e ponta transparente com pinos dourados). A cor do cabo continua vindo da roupa do personagem (vermelho Flix no padrão), e não azul como na foto. Nova ajuda em `cablePath.ts` (comprimento, corte, reamostragem e mistura de cores, com testes).

### 16/11/2026 — Emblema RJ45 na tela de fim

[C] Pedido do solicitante: logo sem texto, com o cabo RJ45 em pixel art mais detalhado, como um close. [C] Referência enviada depois pelo solicitante: logo de jogo de "cobra" online (esfera brilhante com o bicho enrolado por cima, fundo escuro de hexágonos). [H] A arte da Flix é original, só adota a composição (não copia o desenho nem o texto da referência). [F] Implementado em `src/logoArt.ts`: ladrilho 96x96 de cantos arredondados com hexágonos, esfera azul com luz e brilho, cabo RJ45 azul enrolado por cima com sombra sobre a esfera e cauda mais fina, e o conector em close (capa de borracha em anéis, corpo com trava, ponta transparente com 8 fios na ordem T568B e 8 contatos dourados). Mostrado em escala 2x, com entrada animada e leve flutuação; sem texto. A tela de fim foi reorganizada para caber o emblema.

[C] **Cabo azul**: pedido do solicitante, "como um RJ45 padrão". O cabo do jogo, do menu e do emblema usam `CABLE_BLUE` (`theme.ts`), e não mais a cor da roupa do personagem. O personagem continua só no HUD, menu e tela de fim.

### 16/11/2026 — Conector RJ45 novo (visto de cima)

[C] O solicitante achou o conector de lado estranho e enviou um desenho de referência (ícone de conector RJ45 visto de cima). [F] O conector foi refeito em pixel art a partir dele e substitui o anterior nos dois lugares: no emblema do fim de partida (versão grande, 8 contatos) e na cabeça do cabo no jogo (versão pequena, 4 contatos). Elementos: contatos dourados em moldura escura, corpo transparente, capa azul com meia-lua escura da trava, plaquinha com linhas e frisos brancos nas laterais. Código em `src/plugArt.ts` (gerador com número de contatos e detalhes ajustável, com testes); no jogo é um sprite que gira em passos de 90° conforme a direção. O corpo do cabo não mudou. Ajustes: `PLUG_BIG` e `PLUG_MINI` em `plugArt.ts` e `PLUG_TIP_PX` em `PlayScene.ts`. [D] Interpretei "a lateral do cabo" como o conector visto de lado; se era outra parte, avisar.

### 16/11/2026 — Esfera do emblema vira planeta

[C] Pedido do solicitante: aproveitar a bola azul para fazer um planeta com continentes. [F] Em `logoArt.ts`, cada pixel da esfera é convertido em longitude/latitude, então os continentes curvam junto com a esfera. Terreno por manchas (continentes) mais ruído para recortar a costa: oceano azul, praia, floresta verde, montanhas marrons e calotas de gelo nos polos, todos com o mesmo sombreado de luz (cima/esquerda). Determinístico (sem sorteio): o emblema é sempre igual. Ajustar a posição e o tamanho dos continentes na lista `CONTINENTS`, e as cores em `LAND`, `HIGHLAND`, `SAND` e `ICE`.

### 16/11/2026 — Personagem inicial careca

[C] Pedido do solicitante: o boneco inicial precisa ser careca, com um brilho na cabeça. [F] `DEFAULT_AVATAR` agora tem `hair: null`, e um avatar enviado pelo hub sem o campo `hair` também fica careca. O retrato (`packages/flix-avatar/src/compose.ts`) arredonda o topo da cabeça e desenha o brilho; vale para `neutral`, `happy` e `sad`. Quem tiver cabelo escolhido no hub continua com cabelo.

### 16/11/2026 — Ícone do sinal (globo) e parede que atravessa

[C] Pedido do solicitante: trocar o ícone do sinal por um globo (imagem de referência) e fazer o cabo surgir do lado oposto ao atingir a parede, em vez de fim de jogo. [F] O globo é pixel art por código (`src/globeArt.ts`, 15x15: contorno, equador, meridianos e faixas do ciano ao azul escuro) e substitui o losango. A parede agora é passagem em `logic.ts` (`step`): a causa de derrota `wall` deixou de existir; só restam `obstacle`, `self` e `timeout`. No desenho, o cabo é "desenrolado" e repetido do lado oposto, recortado por uma máscara do campo, então aparece saindo por um lado e entrando pelo outro ao mesmo tempo (o conector também). [H] Consequência de jogo: sem paredes mortais, o cabo só perde ao bater em obra ou em si mesmo, e as obras passam a ser o único perigo de borda; avaliar se a dificuldade continua boa e se convém aumentar o número de obras.

### 16/11/2026 — Cabo dando a volta ao mundo no emblema

[C] Pedido do solicitante, com foto de referência (cabo de rede aberto, com a capa azul, a espuma de alumínio e os pares trançados saindo). [F] No emblema do fim de partida (`logoArt.ts`), o cabo agora é uma espiral que dá a volta no planeta: a parte de trás passa atrás dele e a da frente por cima, com sombra. As duas pontas ficam na frente: o conector RJ45 numa e, na outra, o cabo cortado, com a espuma de alumínio e os quatro pares trançados (laranja, verde, azul e marrom, cada par com um fio liso e um listrado de branco, torcendo) mais o fio de dreno prateado. Parâmetros da órbita em `orbit` e o raio do cabo em `R0`. [C] Ajuste pedido depois: fios internos menores e a parte branca mais fina. Agora cada fio colorido tem 1 pixel de espessura e cerca de 10 a 12 pixels de comprimento, e a listra branca é um fio ainda mais fino, com só alguns pixels que trocam de lado (torção). O fio de dreno também ficou menor. Ajustar em `logoArt.ts` (comprimento `len` e a condição `j % 3 === 0` da listra branca).

### 16/11/2026 — Emblema sem fundo e cabo igual dos dois lados

[C] Pedidos do solicitante: (1) tirar o fundo de hexágonos do game over; (2) no jogo, o cabo com a mesma espessura nos dois lados e o conector ethernet nas duas pontas, "como se fosse um cabo real". [F] (1) O emblema agora é só o planeta com o cabo, sobre o fundo escuro da própria tela (sem o ladrilho de hexágonos). (2) Substitui a decisão anterior de afinar a cauda: o cabo tem espessura uniforme e há um conector RJ45 na cabeça e outro na cauda, cada um virado para fora do cabo (`endDirection` em `cablePath.ts`, `plugsHead` e `plugsTail` em `PlayScene.ts`). Cada conector tem cópias para a travessia da borda. [D] Esta última mudança foi verificada só por tipos e testes; ainda falta ver o jogo rodando.

### 16/11/2026 — Visual novo do G03: modelos do gestor, sem pixel art

[C] O gestor enviou a pasta “Network Snake” com os modelos do estilo que ele quer; o solicitante pediu para substituir o visual do G03 por eles e que **não será mais pixelado**. [F] Isso **substitui as decisões visuais anteriores em pixel art** (cabo, plug, planeta, globo, onda, LEVEL UP, emblema e personagem do emblema), que ficam no histórico do Git. O que mudou:
- **Resolução e arte:** o jogo agora é desenhado em 540x960 (antes 270x480), com suavização ligada e ilustrações em PNG (`games/snake/public/img/`, cerca de 300 KB; geradas por `games/snake/tools/preparar-assets.cjs` a partir da pasta do gestor, que fica fora do Git).
- **Cobra:** é montada com os modelos: cabeça RJ45 com o olho bravo, segmentos do corpo que seguem a curva do caminho e conector RJ45 na cauda (RJ45 nas duas pontas e espessura uniforme, como já pedido). O cabo começa com 5 segmentos, porque as peças do modelo precisam de mais corpo. Com o sinal ligado, a cobra troca para a versão cinza com luz vermelha (decisão minha, a partir do modelo cinza enviado; trocar em `PlayScene.ts`).
- **Casa, globo e obstáculos:** a casa do modelo é o que o cabo conecta; o globo é o sinal; os equipamentos (caixa de fibra, roteador, antena, CPE e switch) são os obstáculos, no lugar dos cones. [H] Interpretei assim os modelos de equipamento; se o gestor os queria em outro papel (por exemplo só na tela inicial), é só mudar `OBSTACLE_KEYS`.
- **Telas:** menu e game over usam o logo do gestor (“FLIX Network Snake”); o fundo é um degradê azul e o campo é um gramado com grade, como no logo. O nome do jogo passa a ser **Network Snake** (antes “Fibra Conecta”).
- **Efeitos:** a onda vermelha agora são anéis de luz suaves, e o “LEVEL UP!” é texto em negrito com contorno e seta verde (não mais fonte pixel). A fonte pixel e o conector em pixel art continuam em `packages/flix-game-kit`, sem uso no G03.
- **Frases de game over:** “O cabo bateu no equipamento” (antes “na obra”), “O cabo se enrolou” e “Tempo esgotado!”.
- [D] **Origem e licença das imagens a confirmar:** o nome de um dos arquivos indica geração por IA; o jurídico precisa confirmar o uso (ver `ASSETS.md`). O retrato do personagem no HUD segue pixelado, vindo de `packages/flix-avatar`, que a equipe do portal está trocando.

### 16/11/2026 — Itens de pontuação, cenário do gestor e cobra contínua

[C] Pedidos do solicitante: (1) **todos os assets enviados são pontuação**: um item aparece por vez, sorteado, no lugar da “comida” da cobra; (2) o **muro** vai ser um asset novo do gestor, ainda não enviado; (3) o meio da cobra ficava vago e quebrado; (4) o gestor enviou o **cenário** (arquivo “Painel Flix com Grade Urbana Neon”), que o solicitante colocou na pasta de assets. O gestor vai enviar ainda o muro, a peça de curva da cobra e outros assets. [F] Feito:
- **Itens:** casa, globo, antena, CPE, caixa de fibra, roteador e switch são os itens de pontuação. Um aparece por vez e o tipo é sorteado a cada item, sem repetir o anterior (`foodKind` em `logic.ts`; lista e tamanhos em `FOOD_ITEMS`, `theme.ts`). Todos valem 10 x nível. O “sinal” como bônus separado (dobrar pontos, troca para a cobra cinza) foi **removido**, porque o globo agora é só mais um item; a versão cinza da cobra continua em `public/img`, sem uso.
- **Cenário:** o painel em tela cheia (941x1672, mesma proporção do jogo) é o fundo (`cenario.jpg`, 220 KB). O avatar vai no quadro vermelho, os valores nas caixas SCORE, PONTOS e NÍVEL, e o tempo numa pílula na faixa do céu. A área quadriculada do cenário tem 11 colunas largas e linhas que afunilam; por isso o campo foi **ajustado**: 11 x 16 casas de 41 px (antes 18 x 27 de 30 px), com um painel escuro e a grade próprios desenhados sobre a área, para a grade ficar alinhada ao jogo (`PANEL` e `HUD` em `theme.ts`). O cabo começa com 6 segmentos e a velocidade foi recalibrada (200 ms por passo no nível 1).
- **Muro provisório:** tijolos cinza desenhados por código, até o asset do gestor chegar (`buildObstacles`, `PlayScene.ts`). A parede do campo continua sendo passagem. [D] Não sei se o “muro” do gestor é o obstáculo interno ou a borda do campo; confirmar quando enviar.
- **Cobra sem vãos:** o corpo agora é um tubo azul contínuo, com os segmentos do modelo sobrepostos por cima (`updateSnake`); não fica mais vago nem quebrado nas curvas. Quando o gestor enviar a peça de curva, ela entra nessa montagem.
- **Textos:** “itens conectados” (antes “casas”), e “O cabo bateu no muro”. O hub recebe `meta.items` em vez de `meta.houses`.
- [D] **HUD:** o cenário tem as caixas “SCORE” e “PONTOS”; assumi SCORE = pontuação e PONTOS = itens conectados. Confirmar com o gestor o que cada uma deve mostrar (Q55).

### 16/11/2026 — Cerca de madeira como muro e globo como ponto extra

[C] Pedidos do solicitante: (1) o asset “Cerca de Madeira com Flores” entra **no lugar do muro**; (2) **o único modelo que não é comida é o globo digital**: ele aparece esporadicamente e ativa o **modo de ponto extra** por alguns segundos, e durante esse tempo a cobra usa o asset **vermelho**. [F] Feito (isto **substitui** a decisão anterior de remover o bônus “sinal”):
- **Muro = cerca:** a cerca é uma peça vertical comprida (cerca de 4 por 1), então os muros passaram a ser **trechos retos de 3 casas** (`MAP_BARS` em `logic.ts`; 3 layouts), com uma cerca por trecho, girada nos horizontais (`buildObstacles`, `PlayScene.ts`). Os tijolos provisórios saíram. Bater na cerca termina a partida (“O cabo bateu na cerca”). O asset é recortado pelo conteúdo sólido, sem o brilho em volta (`tools/preparar-assets.cjs`, `muro.png`, 50 KB).
- **Comida:** seis modelos (casa, antena, CPE, caixa de fibra, roteador, switch), um por vez, sorteados sem repetir o anterior (`FOOD_KINDS = 6`).
- **Globo (ponto extra):** depois de conectar um item, há 22% de chance de aparecer o globo (somente se não houver outro e o modo não estiver ligado); ele some sozinho em 9 s (pisca nos últimos instantes). Ao pegar, liga o modo por **6 s** (pontos em dobro; o globo não faz o cabo crescer nem conta como item). Durante o modo, a cobra troca para a versão vermelha/cinza e aparece “PONTO EXTRA x2” sobre o campo (`SIGNAL_CHANCE`, `SIGNAL_LIFETIME_MS`, `BOOST_MS`, `logic.ts`; cores em `TUBE`, `theme.ts`). [H] Os números (22%, 9 s, 6 s, dobro) são minhas escolhas; ajustar com o solicitante e o gestor.

### 16/11/2026 — Campo mais largo e LEVEL UP menor

[C] Pedidos do solicitante: (1) ampliar a área útil na horizontal, com uma casa a mais na esquerda e uma na direita; (2) diminuir o texto de LEVEL UP, que ocupava muita área e tampava o jogo. [F] (1) O campo passou de 11 para **13 colunas**. Como a área do cenário tem largura fixa, as casas ficaram menores (41 para 36 px) e usei **18 linhas** (antes 16) para preencher a altura do painel; a cobra e os itens foram redimensionados na mesma proporção, os mapas de cercas refeitos para 13 x 18 e o cabo começa no meio (`COLS`, `ROWS`, `MAP_BARS` em `logic.ts`; `CELL`, `FIELD_X`, `FIELD_Y`, `BODY_H`, `FOOD_ITEMS` em `theme.ts`). (2) O “LEVEL UP!” agora tem cerca de um terço do tamanho anterior, aparece na parte de cima do campo e some mais rápido (`showLevelUp`, `PlayScene.ts`). (3) O botão da tela de fim ficou menor e com o texto só “JOGAR” (`GameOverScene.ts`).

### 16/11/2026 — Novo menu superior e campo de ponta a ponta

[C] Pedidos do solicitante: (1) trocar o menu superior (avatar, SCORE, PONTOS, NÍVEL) por um com **área do avatar, SCORE, TEMPO e NÍVEL**, com **ícone de relógio** no tempo e as **barras ascendentes verdes** no nível; (2) **expandir as laterais do campo até as extremidades da tela**, cobrindo as casas laterais que ficavam fora da área jogável. [F] (1) O menu agora é desenhado por código sobre o topo do cenário (placa escura com borda vermelha, quadro do avatar e três caixas); a caixa “PONTOS” (itens conectados) deixou de existir, e o tempo saiu da pílula na faixa do céu para a caixa TEMPO (`buildHud` em `PlayScene.ts`; posições em `HUD`, `theme.ts`). O relógio e as barras verdes são desenhados por código, no estilo do cenário. Isso responde a dúvida Q55 (SCORE x PONTOS). (2) O campo passou a **15 colunas x 18 linhas de 36 px = 540 px**, exatamente a largura da tela, e o painel escuro com a grade vai de uma borda à outra, cobrindo as casas, postes e tubos das laterais do cenário (`COLS` em `logic.ts`; `FIELD_X`, `PANEL` em `theme.ts`). Os layouts de cerca e a posição inicial da cobra foram refeitos para 15 colunas. A passagem pela borda agora acontece nas extremidades da própria tela. O texto “PRONTO?” foi reduzido para caber.

### 16/11/2026 — Sem cenário de fundo, rodapé do gestor e tempo extra por item

[C] Pedidos do solicitante: (1) **remover a imagem de fundo (o cenário)** e substituí-la por área jogável, de modo que praticamente a tela toda seja jogável; (2) a parte de baixo da tela passa a ser um asset com árvores e o veículo utilitário da empresa (arquivo “287A7E47-F86E-47EA-B5EA-3FE01654C110”, colocado na pasta de assets); (3) **cada item conectado dá 5 segundos de tempo extra**. [F] Feito:
- **Fundo:** o cenário (`cenario.jpg`) foi removido do jogo e do script de imagens. O fundo agora é um painel escuro com a grade, na tela inteira. O campo passou a **15 colunas x 20 linhas de 36 px** (540 x 720), entre o menu superior (que continua) e o rodapé (`FIELD_Y`, `FIELD_ROWS` em `theme.ts`; `ROWS` em `logic.ts`). Os layouts de cerca e a posição inicial da cobra foram refeitos para 20 linhas.
- **Rodapé:** `rodape.png` (57 KB), recortado pelo conteúdo sólido da imagem enviada (calçada, arbustos, carretel, van da Flix e cones), encostado no fundo da tela e na largura inteira (`buildScenery`, `PlayScene.ts`).
- **Tempo extra:** +5 s por item conectado (`ITEM_BONUS_MS`, `logic.ts`); o globo de ponto extra não dá tempo. O tempo mostrado na caixa TEMPO pode passar de 2:00, e aparece “+5s” sobre a caixa a cada item. O `durationMs` enviado ao hub continua sendo o tempo real jogado, e o hub recebe também `meta.bonusMs`. [D] A duração máxima da partida agora varia com os itens; a API do portal limita o `durationMs` ao tempo real da partida, mas a faixa plausível de pontos por jogo (provisória) precisa ser revista para partidas mais longas.

### 16/11/2026 — Topo com céu e cidade

[C] Pedido do solicitante: substituir a parte superior por um asset de **céu** com a **cidade** na frente, e o **menu de cima permanece por cima de ambos**. O gestor enviou os dois arquivos (“DE2D51E8-27BD-44F6-ACC9-83735A93D788” = céu, “2B72D523-A291-4B21-B6C2-70D71D066A62” = cidade com igreja, ponte de ferro, rio e montanhas). [F] O topo agora é: céu (`ceu.jpg`, 51 KB, cortado na proporção da faixa 540x220), cidade por cima (`cidade.png`, 124 KB, encostada na base da faixa) e o menu desenhado por código acima dos dois (`buildScenery`, `PlayScene.ts`). Para a cidade aparecer, o campo começa mais abaixo: **15 colunas x 18 linhas** (antes 20), com `FIELD_Y = 220`; as cercas e a posição inicial da cobra voltaram ao desenho de 18 linhas. O menu cobre a parte de cima da cidade (as torres da igreja e os topos das montanhas ficam atrás dele); se o solicitante quiser ver mais da cidade, é possível baixar o menu ou o campo mais um pouco.

### 16/11/2026 — Menu translúcido e topo compacto

[C] Pedidos do solicitante: (1) o **menu translúcido**, com os assets (céu e cidade) ao fundo dele, mantendo visíveis tanto o fundo quanto as informações; (2) os assets **não devem ocupar tanto espaço**, só um pouco mais que o tamanho do menu. [F] (1) A placa do menu tem 50% de opacidade, e o quadro do avatar e as caixas de valor ficam mais escuros (62% e 70%) com contorno mais grosso nos rótulos, para os números seguirem legíveis sobre o céu e a cidade (`buildHud`, `PlayScene.ts`). (2) A faixa do topo passou de 220 para **148 px** (o menu ocupa de 17 a 127), com o céu recortado nessa proporção (`ceu.jpg`, 39 KB) e a cidade encostada na base. Isso **substitui** a decisão anterior de 18 linhas: o campo voltou a **15 colunas x 20 linhas**, com `FIELD_Y = 148`, e as cercas e a posição inicial da cobra voltaram ao desenho de 20 linhas.

### Pendências e riscos

- Compositor do personagem (`packages/flix-avatar/src/compose.ts`) é **placeholder** procedural, só da visão `portrait`. Substituir pelo atlas do designer mantendo a assinatura.
- O bundle tem cerca de 1,2 MB (327 KB gzip), quase todo o Phaser. Está dentro da meta de 3 MB.
- Teste em celular real ainda não feito (ver `docs/TEST_REPORTS/snake-01.md`).
- O Phaser pausa o jogo quando a janela do iframe perde o foco. Dentro do hub, clicar fora do jogo pausa a partida. Se não for desejado, ajustar na integração com o hub.
