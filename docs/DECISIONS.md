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

### Pendências e riscos

- Compositor do personagem (`packages/flix-avatar/src/compose.ts`) é **placeholder** procedural, só da visão `portrait`. Substituir pelo atlas do designer mantendo a assinatura.
- O bundle tem cerca de 1,2 MB (327 KB gzip), quase todo o Phaser. Está dentro da meta de 3 MB.
- Teste em celular real ainda não feito (ver `docs/TEST_REPORTS/snake-01.md`).
- O Phaser pausa o jogo quando a janela do iframe perde o foco. Dentro do hub, clicar fora do jogo pausa a partida. Se não for desejado, ajustar na integração com o hub.
