# Ficha de gameplay — Network Snake (G03)

Observador: a definir      Revisor: a definir      Data: 16/11/2026
Observação: rascunho feito a partir do conceito genérico do gênero (seção 10.3 do prompt). Falta o observador jogar uma referência no celular e a segunda pessoa revisar.

## 1. Loop principal
O jogador guia um cabo de rede, com conector RJ45 nas duas pontas, por uma grade. O cabo anda sozinho; o jogador só escolhe a direção. Itens de rede (casa, antena, CPE, caixa de fibra, roteador e switch) aparecem um de cada vez, em ordem aleatória: ao conectar cada um o jogador pontua e o cabo cresce. De vez em quando aparece um globo digital: ao pegá-lo, liga o modo de ponto extra. A partida dura 2 minutos ou até o cabo bater.

## 2. Controles
Deslizar o dedo em qualquer lugar da tela muda a direção. Deslizes seguidos sem soltar o dedo funcionam. Teclado (setas ou WASD) como bônus. Uma curva por vez, no máximo duas guardadas, e não é possível virar para trás.

## 3. Regras e condições de fim
Perde ao bater em uma cerca de madeira (o muro) ou no próprio cabo. A parede do campo é uma passagem: o cabo sai por um lado da tela e surge do lado oposto. Ao acabar os 2 minutos, a partida termina e vale a pontuação feita. Pontos por item = 10 x nível; todos os itens valem o mesmo. O globo de ponto extra (22% de chance depois de cada item, some em 9 s) dobra os pontos por 6 s e troca a cobra para a versão vermelha; não faz o cabo crescer.

## 4. Progressão e dificuldade
O nível sobe a cada 3 itens conectados (até 10). A velocidade aumenta com o nível (de 200 ms para 92 ms por passo). O mapa de cercas é sorteado entre 3 layouts a cada partida.

## 5. Ritmo e duração
Partida de até 2 minutos. Recomeçar leva menos de 1 segundo depois do `restart` do hub, com uma contagem curta “PRONTO? / VAI!” de 0,8 s.

## 6. Feedback ao jogador
Sons curtos ao conectar item, bater e ao fim do tempo. Pontos que sobem ao conectar e uma onda vermelha que se espalha pela tela. “LEVEL UP!” com o novo nível a cada subida. O retrato do personagem no HUD reage (feliz ao pontuar, triste ao perder). A tela treme ao bater. O tempo fica vermelho nos últimos 10 s.

## 7. O que NÃO vamos fazer igual
(Seção reservada ao observador; não é entregue ao agente.) Evitar o visual de tela de celular antigo, cobra, comida e a aparência de qualquer versão específica.

## 8. Nossos diferenciais
1. Tema de rede da Flix: um cabo ethernet com RJ45 nas duas pontas (cabeça com olho) conecta equipamentos e casas; não há cobra nem comida.
2. Itens de pontuação variados, vindos dos modelos do gestor, sorteados um a um, e um globo raro que liga o ponto extra e deixa a cobra vermelha.
3. Cenário da cidade com a identidade Flix (painel do gestor) e logo próprio.
4. Efeitos próprios: onda vermelha a cada item conectado e “LEVEL UP!” ao subir de nível; parede que atravessa para o lado oposto.
5. Retrato do personagem no HUD que reage à partida e modo cronometrado de 2 minutos.

## 9. Pontos de melhoria que queremos
Controle por deslize contínuo sem soltar o dedo; sem botões na tela; partidas justas por tempo igual.

## 10. Métrica de ranking proposta
`score` da partida de 2 minutos. Empate: vence quem conectou mais itens (`meta.items`) e, persistindo, quem chegou primeiro à pontuação (decisão do hub).

## 11. Uso do personagem
Nível B. Visão `portrait` (expressões `neutral`, `happy`, `sad`) no quadro do avatar do HUD e na tela de fim.
