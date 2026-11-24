# Ficha de gameplay — Faixa a Faixa (G09)

Observador: a definir      Revisor: a definir      Data: 24/11/2026
Observação: rascunho de projeto feito a partir do jogo já jogável (`games/faixa`). Gênero: travessia infinita em grade. Não usar nome, personagens ou visual de nenhum jogo existente. Nome de catálogo: validar com marketing e jurídico antes de publicar.

## 1. Loop principal
O técnico da Flix está numa obra de fibra ótica, numa rua que não termina. A cada passo ele avança uma faixa (9 colunas de largura): grama com obstáculos, estrada com carros e caminhões, rio com paletes, troncos ou vitórias-régias, e trilho de trem. A câmera acompanha o avanço e só sobe; o mapa é gerado enquanto se joga.

## 2. Controles
Teclado: setas ou WASD (espaço também avança); um passo por toque na tecla. Toque: tocar avança; deslizar para os lados ou para baixo muda de lado ou volta, disparando assim que o dedo passa do limite. Sem botões na tela.

## 3. Regras e condições de fim
Pontos: 1 por faixa nova alcançada; voltar não tira ponto. Fim da partida: atropelado, atingido pelo trem, caiu no rio (sem tronco ou vitória-régia embaixo), arrastado pelo tronco para fora da tela, ou alcançado pela base da tela (demorou demais). Obstáculos da grama e as barreiras laterais bloqueiam o passo. As 5 primeiras faixas são sempre seguras.

## 4. Progressão e dificuldade
Contínua, sem níveis: `difficulty()` sobe suavemente com a distância (cerca de 0,6 na faixa 75 e 0,9 na 150). Aumentam a densidade de obstáculos, a velocidade de carros e troncos, a proporção de caminhões, e diminuem as faixas de descanso. Rio entra na faixa 8 e trilho na 12. A base da tela sobe de 0,7 para 1,2 faixas por segundo.

## 5. Ritmo e duração
Partida curta e sem limite fixo: quem avança sem parar vai longe. "VAI!" de 0,6 s no começo. Recomeçar leva menos de 1 s (botão do jogo ou `restart` do hub).

## 6. Feedback ao jogador
Sons curtos (passo, passo de lado, bloqueio, marco a cada 10 faixas, bipe do sinal, buzina do trem, batida, mergulho, fim por tempo). Passo com "pulo" e giro do técnico; respingos na água; tremor e achatamento ao ser atropelado; sinal vermelho piscando e tom avermelhado no trilho antes do trem; faixa vermelha no rodapé quando a base da tela está perto. Retrato no HUD reage (feliz com 10 faixas ou mais, triste antes disso).

## 7. O que NÃO vamos fazer igual
Personagens, modelos 3D de blocos, animais, cenários e o nome de jogos existentes. G05 (travessia clássica) é tela fixa com metas de chegada; aqui a tela anda e não há chegada.

## 8. Nossos diferenciais
1. Mapa infinito gerado por código com garantia de que sempre há passagem (alcance por faixa, coluna alinhada obrigatória, vitórias-régias alinhadas em faixas seguidas).
2. Pressão do tempo em vez de cronômetro: a base da tela sobe sozinha e acelera, então não dá para ficar parado.
3. Trem com aviso mínimo de 1 s (sinal e bipe), nunca injusto.
4. Tema de obra de fibra ótica: caminhão da Flix, carreta de bobina de cabo, cones, tapume amarelo e preto nas laterais.
5. Rio com paletes e troncos que levam o jogador, e vitórias-régias fixas que exigem planejar a rota.
6. Câmera só avança e pontuação por faixa: o risco é de quem volta ou espera.

## 9. Pontos de melhoria que queremos
Toque fluido sem botões, passos instantâneos (sem fila), leitura clara de perigo nas telas pequenas.

## 10. Métrica de ranking proposta
Faixas atravessadas (`score`, maior melhor). Metas: `cause`. No `game.json`: `lanes_crossed`.

## 11. Uso do personagem
Nível B. Visão `portrait` (`neutral`, `happy`, `sad`) no HUD, no menu e na tela de fim. A visão `top` ainda não existe no kit; em jogo, o técnico é desenhado por código.
