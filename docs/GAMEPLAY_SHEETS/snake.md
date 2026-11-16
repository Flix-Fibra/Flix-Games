# Ficha de gameplay — Fibra Conecta (G03)

Observador: a definir      Revisor: a definir      Data: 16/11/2026
Observação: rascunho feito a partir do conceito genérico do gênero (seção 10.3 do prompt). Falta o observador jogar uma referência no celular e a segunda pessoa revisar.

## 1. Loop principal
O jogador guia um cabo de fibra por uma grade. O cabo anda sozinho; o jogador só escolhe a direção. Ele conecta "casas" para ganhar pontos, e cada conexão deixa o cabo maior. A partida dura 2 minutos ou até o cabo bater.

## 2. Controles
Deslizar o dedo em qualquer lugar da tela muda a direção. Deslizes seguidos sem soltar o dedo funcionam. Teclado (setas ou WASD) como bônus. Uma curva por vez, no máximo duas guardadas, e não é possível virar para trás.

## 3. Regras e condições de fim
Perde ao bater em uma obra (cones) ou no próprio cabo. A parede é uma passagem: o cabo sai por um lado da tela e surge do lado oposto. Ao acabar os 2 minutos, a partida termina e vale a pontuação feita. Pontos por casa = 10 x nível. Pegar o "sinal" dobra os pontos por 25 passos.

## 4. Progressão e dificuldade
O nível sobe a cada 3 casas conectadas (até 10). A velocidade aumenta com o nível (de 170 ms para 70 ms por passo). O mapa de obras é sorteado entre 3 layouts a cada partida.

## 5. Ritmo e duração
Partida de até 2 minutos. Recomeçar leva menos de 1 segundo depois do `restart` do hub, com uma contagem curta "PRONTO? / VAI!" de 0,8 s.

## 6. Feedback ao jogador
Sons curtos ao conectar casa, pegar sinal, bater e ao fim do tempo. Pontos que sobem ao conectar. O retrato do personagem no HUD reage (feliz ao pontuar, triste ao perder). A tela treme ao bater. O tempo fica vermelho nos últimos 10 s.

## 7. O que NÃO vamos fazer igual
(Seção reservada ao observador; não é entregue ao agente.) Evitar o visual de tela de celular antigo, cobra, comida e a aparência de qualquer versão específica.

## 8. Nossos diferenciais
1. Tema de cabo de fibra que conecta casas (cobra e comida não existem).
2. Retrato do personagem do jogador no HUD que reage à partida; a cor do cabo é a cor da roupa dele.
3. Poder temporário "sinal" que dobra os pontos.
4. Mapas com obras (cones) e três layouts originais.
5. Paleta, sons e interface próprios da Flix; modo cronometrado de 2 minutos.

## 9. Pontos de melhoria que queremos
Controle por deslize contínuo sem soltar o dedo; sem botões na tela; partidas justas por tempo igual.

## 10. Métrica de ranking proposta
`score` da partida de 2 minutos. Empate: vence quem fez mais casas conectadas (`meta.houses`) e, persistindo, quem chegou primeiro à pontuação (decisão do hub).

## 11. Uso do personagem
Nível B. Visão `portrait` (expressões `neutral`, `happy`, `sad`) no HUD, no menu e na tela de fim; cor principal da roupa pinta o cabo.
