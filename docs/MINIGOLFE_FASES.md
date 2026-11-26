# Minigolfe Flix: as fases e o conceito de cada uma

Fases em `games/minigolfe/src/levels.ts` (grade de texto; ver `docs/ADDING_LEVELS.md`). As **7 primeiras recriam os campos desenhados pelo gestor** (pasta `Fases Mini Golf/`, imagens 1 a 7); da **8 em diante** combinam as mesmas mecânicas. O robô de `games/minigolfe/tools/levels.solve.test.ts` prova que todas têm solução. O par é estimativa; vale ajustar depois de jogadores reais.

## Mecânicas (inventário)

| Mecânica | Letra na grade | Regra |
|---|---|---|
| **Bomba** | `B` | A bola que encosta é puxada para dentro e fica presa. A bomba gira sozinha e **a mira não é do jogador**: ele só escolhe a **força** (arrastar, ou um toque vale 0,6). A bola sai na direção em que a bomba aponta no instante da tacada. |
| **Moinho** | `W` | Pás que giram; a bola bate nelas e a pá que encosta leva a bola junto (mesmo parada). É preciso passar na hora certa. |
| **Esteira** | `^ v < >` | Chão vermelho com setas: empurra a bola na direção apontada (desvia a tacada). |
| **Portal** | `1` a `9` | Par de portais: a bola sai do outro com a **mesma velocidade e direção**. |
| **Bloco móvel** | `blocks` na fase | Bloco branco que desliza pela trilha marcada no chão (faixa clara com engrenagem). Empurra a bola. |
| **Rampa de salto** | `U D L R` | Subir nela, no sentido da seta e com força, faz a bola **voar**: o tempo no ar cresce com a velocidade. No ar ela passa por cima de água, lava, pistão, moinho e buraco; só as paredes a seguram. |
| **Pistão** | `P` | Coluna vermelha que sobe e desce; só atrapalha quando está alta. |
| **Lava** | `X` e `Y` | Bloco que acende e apaga. Aceso, a bola que passa por cima volta ao ponto da tacada (+1). **X e Y se alternam**: quando um acende, o outro apaga. |
| (já existiam) | `# . s i ~ o m M / \` | Parede, grama, areia, gelo, água, poste, ímã que atrai e que repele, diagonais. |

## As fases

Cada fase tem um **caminho seguro** (fecha no par) e um **atalho arriscado** (chance de buraco em uma).

| # | Fase | Mecânicas | Caminho seguro | Atalho arriscado | O "eureca" |
|---|---|---|---|---|---|
| 1 | **Moinho** *(imagem 1)* | bombas, moinho, postes | Entrar numa bomba, esperar ela apontar para o corredor e dar força para atravessar o moinho | Tacada direta pelo corredor, passando pelo moinho no instante em que as pás abrem | A bomba de baixo é um "canhão" fixo para o corredor: espere o giro, não force o ângulo |
| 2 | **Esteira** *(2)* | esteira | Deixar a esteira levar a bola até o topo e tacar dali para o buraco | Quicar no teto e voltar pelo lado esquerdo em uma tacada | A esteira é um elevador grátis: o primeiro "golpe" é só soltar a bola nela |
| 3 | **Pescoço** *(3)* | bloco móvel, portais | Cruzar o corredor de cima, esperar o bloco entrar no nicho e atravessar o pescoço | Entrar no portal de cima e sair no canto de baixo, já alinhado com o buraco | O portal "dobra" o mapa: o buraco fica a uma tacada reta da saída |
| 4 | **Salto** *(4)* | rampa de salto, água, areia | Subir na rampa com força média e pousar depois da água, na areia, e tacar curto | Rampa com força exata para pousar já em cima do buraco (ele passa por cima se vier rápido) | Força demais passa do alvo: controle de intensidade vale mais que mira |
| 5 | **Pistões** *(5)* | pistões | Esperar o pistão da frente descer e passar rente à parede | Tacada diagonal passando entre dois pistões baixos | Os pistões não estão sincronizados: olhe o ciclo, não o pistão |
| 6 | **Dois Blocos** *(6)* | 2 blocos móveis | Parar entre os dois blocos (no nicho) e seguir quando o segundo recolhe | Tacada forte por todo o corredor, entre as duas aberturas | O nicho do lado é um abrigo: pare nele e espere o bloco passar |
| 7 | **Lava** *(7)* | lava (2 grupos), postes | Esperar a lava de baixo apagar e passar rápido pelas duas faixas do corredor | Quicar no poste lateral e entrar pela outra faixa quando a de cima apaga | As duas lavas do eixo apagam ao mesmo tempo: dá para passar as duas em uma tacada |
| 8 | **Contramão** | portais, esteira | Tacada forte contra a esteira até o portal de cima | Entrar no portal em diagonal: sai do outro lado já virado para o buraco | A esteira só atrapalha quem vai devagar: a força vence |
| 9 | **Correia Bomba** | esteira, bomba | Deixar a esteira levar a bola até a bomba e atirar na direção boa | Subir pela coluna da esquerda sem tocar a esteira, em uma tacada | A esteira é um "carregador" para a bomba: o jogo está em escolher quando atirar |
| 10 | **Moinho Duplo** | 2 pás gigantes em sentidos opostos, gelo | Passar a primeira pá, parar na grama do meio e passar a segunda | Uma tacada só, aproveitando o gelo para escorregar pelas duas | O gelo no meio faz a bola escorregar até as pás: cuidado com a pá oposta |
| 11 | **Voo sobre a Lava** | rampa, água, lava | Pousar logo depois da água e esperar a lava apagar para atravessar | Voar por cima de tudo: força maior, pouso direto depois da lava | Voar ignora a lava e a água: o risco é passar do buraco |
| 12 | **Portal dos Pistões** | pistões, portais | Atravessar o campo dos pistões esperando a janela de cada coluna até o portal | Tacada em diagonal por entre as colunas, sem parar | O portal está no canto oposto: a saída fica logo antes do buraco |
| 13 | **Ímãs e Moinho** | ímãs que atraem e repelem, moinho | Usar o ímã que repele para empurrar a bola por um lado e esperar o moinho abrir | Deixar o ímã de baixo curvar a tacada ao redor do moinho | Os ímãs "dobram" a trajetória: mire ao lado do alvo |
| 14 | **Pista de Gelo** | gelo, postes, bombas | Tacada curta e cuidadosa, usando os postes para frear | Tacada forte diagonal, quicando no poste, direto ao buraco | O poste é um espelho: um ângulo certo manda a bola ao buraco |
| 15 | **Cruzamento** | bloco móvel, esteira, lava, postes | Corredor central estreito, passando entre a lava dos dois lados | Quicar na parede lateral para pular a esteira | A esteira empurra para o lado: compense a mira |
| 16 | **Grande Final** | bombas, gelo, moinho, lava | Bomba de baixo, esperar a mira para o corredor, atravessar o moinho e a lava pela faixa que estiver apagada | Tacada reta pelo gelo, entre as pás e a lava | Na lava da frente há duas faixas e uma "ponte": quando uma acende, a outra apaga |

## Ideias para as próximas fases (ainda não feitas)

17. **Ping-pong de bombas**: duas bombas frente a frente; a primeira lança a bola direto para dentro da segunda, que a lança para o buraco.
18. **Relógio**: moinho grande com lava no chão onde a pá passa: dois ritmos ao mesmo tempo.
19. **Cascata de esteiras**: quatro esteiras em quadrado que giram a bola em círculo até o jogador escapar por uma diagonal.
20. **Salto duplo**: duas rampas seguidas sobre água e lava; a força do primeiro salto define onde cai e se pega a segunda rampa.

## Como o robô confere as fases

`SOLVE=1 npx vitest run games/minigolfe/tools` joga cada fase com tacadas aleatórias e escolhas gulosas (várias tentativas, com espera sorteada para pegar a janela de moinhos, blocos, pistões e lava). Todas as 16 fases foram encaçapadas, o que prova que existe caminho. Isso **não mede diversão nem dificuldade para gente**: depois de jogar, vale ajustar o par e as velocidades (`CANNON_SPEED`, `WINDMILL_SPEED`, `PISTON_PERIOD`, `LAVA_PERIOD` em `logic.ts`, ou `tune` na fase).

## Percurso de 25 buracos, do mais fácil ao mais difícil (26/11/2026)

A pedido do solicitante ("a primeira fase está muito difícil"), o percurso começa com 9 fases novas de aprender e as 16 anteriores foram reordenadas por dificuldade (ordem em `ORDEM`, no fim de `src/levels.ts`).

1. **Fases de aprender (novas):** Primeira Tacada (reta), Esquina (uma curva), Tabela (bloco no meio, pode usar a parede), Banco de Areia, Postes, Ziguezague (duas curvas, par 4), Lago (água no caminho reto, desvio pela direita) e Patinação (gelo).
2. **Uma mecânica por vez:** Esteira, Moinho Clássico (novo: só esperar a pá passar), Salto, Pistões, Dois Blocos, Lava, Pescoço e Teleporte e Esteira.
3. **Combinações:** Moinho (antiga fase 1, com bombas), Bomba na Esteira, Portal dos Pistões, Gelo e Bomba, Lava e Rampa, Ímãs e Moinho, Moinho Duplo, Cruzamento e Grande Final.

Robô (`SOLVE=1`): as 25 têm solução. O Ziguezague é o único em que o robô sofre (ele só mira o buraco, não planeja o caminho); para uma pessoa o caminho é claro, por isso o par 4.
