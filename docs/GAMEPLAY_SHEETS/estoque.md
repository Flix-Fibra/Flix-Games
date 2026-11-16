# Ficha de gameplay — Estoque Flix (G10)

Observador: a definir      Revisor: a definir      Data: 16/11/2026
Observação: rascunho de projeto. Risco jurídico alto (gênero de peças que caem): apresentar o jogo pronto ao jurídico antes de publicar (Q47). Não usar o nome do jogo original em lugar nenhum. Direção definida pelo solicitante em 16/11: mistura de peças que caem com combinação de itens iguais, tema de estoque, gráfico liso (não pixelado).

## 1. Loop principal
Um item de estoque por vez cai pela prateleira (7 x 11). O jogador escolhe a coluna. Quando 3 ou mais itens IGUAIS ficam ligados (lado a lado, em cima ou embaixo), eles são guardados: voam para a caixa de estoque e liberam espaço. O que estava em cima desce e pode formar novos grupos em cadeia.

## 2. Controles
Teclado: setas esquerda/direita escolhem a coluna, seta para baixo acelera, espaço ou seta para cima derrubam. Toque: arrastar para os lados move, tocar derruba, segurar o dedo abaixo acelera, deslizar para baixo derruba. Sombra mostra onde a peça vai parar.

## 3. Regras e condições de fim
Fim da partida: o próximo item não tem lugar para entrar (estoque lotado) ou o tempo (2 min) acaba. Pontos por grupo: 10 x tamanho x (tamanho - 2), vezes o número da cadeia: 3 itens = 30, 4 = 80, 5 = 150, 6 = 240, 7 = 350. A estratégia é montar um grupo grande antes de fechar a ligação, em vez de guardar de 3 em 3.

## 4. Progressão e dificuldade
A queda começa em 0,55 s por linha e fica 8 ms mais rápida a cada item guardado, até 0,15 s. Nível sobe a cada 12 itens guardados (até 10). Começa com 4 tipos de item; a partir do nível 3 entra o quinto, e os grupos ficam mais difíceis de formar.

## 5. Ritmo e duração
Partida de até 2 minutos, com "PRONTO? / VAI!" de 0,8 s. Recomeçar leva menos de 1 s após o `restart` do hub.

## 6. Feedback ao jogador
Sons curtos (mover, pousar, guardar com tom mais agudo a cada cadeia, nível). Itens que "incham", voam até a caixa de estoque com faíscas; texto de pontos, "CADEIA xN" e "NÍVEL N"; tremor ao perder; topo da prateleira pulsa em vermelho no perigo. Retrato do personagem reage (feliz ao guardar, triste ao perder).

## 7. O que NÃO vamos fazer igual
Poço de 10 x 20, as sete peças clássicas de 4 blocos, limpeza por linha completa, peças de 4 blocos e a aparência do original. (Seção do observador; não é entregue ao agente.)

## 8. Nossos diferenciais
1. Limpeza por grupos de 3 ou mais itens iguais ligados, não por linhas completas; grupos grandes valem muito mais, então vale esperar para juntar mais de 3 de uma vez.
2. Um item por vez: o jogador decide só a coluna, e o desafio é planejar os grupos.
3. Reação em cadeia: o que está em cima desce e pode combinar de novo, com pontos multiplicados.
4. Tema de estoque da Flix: roteador, cabo de rede, monitor, furadeira e antena, em gráfico vetorial liso; itens guardados voam para a caixa de estoque.
5. Dificuldade progressiva contínua (velocidade por item guardado e novo tipo de item no nível 3).
6. Retrato do personagem reage no HUD; modo cronometrado de 2 minutos.

## 9. Pontos de melhoria que queremos
Controle de toque fluido, sombra de aterrissagem, sem botões na tela.

## 10. Métrica de ranking proposta
`score` da partida de 2 minutos. Metas: `stored`, `level`, `bestChain`, `cause`.

## 11. Uso do personagem
Nível B. Visão `portrait` (`neutral`, `happy`, `sad`) no HUD, no menu e na tela de fim.
