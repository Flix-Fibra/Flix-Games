# Conferência dos circuitos 01-08

| Pista | PNG em pixels | Volta fechada | Separação centro a centro | Margem da linha central | Passo dos pontos | Prova |
|---|---:|---:|---:|---:|---:|---|
| 01-melbourne | 4.000 × 2.500 | 6.943,16 px | ≥ 298,75 px | 265,95 px | 25,81–25,92 px | [PNG](PROVAS/01-melbourne-prova.png) |
| 02-xangai | 4.000 × 2.500 | 9.092,02 px | ≥ 257,82 px | 273,17 px | 23,98–25,93 px | [PNG](PROVAS/02-xangai-prova.png) |
| 03-suzuka | 4.000 × 2.500 | 9.637,52 px | ≥ 258,57 px (fora do viaduto) | 305,40 px | 25,87–25,99 px | [PNG](PROVAS/03-suzuka-prova.png) |
| 04-sakhir | 4.000 × 2.500 | 9.402,86 px | ≥ 257,66 px | 497,76 px | 25,81–25,99 px | [PNG](PROVAS/04-sakhir-prova.png) |
| 05-jeddah | 4.000 × 2.500 | 7.823,29 px | ≥ 259,95 px | 264,71 px | 25,81–25,92 px | [PNG](PROVAS/05-jeddah-prova.png) |
| 06-miami | 4.000 × 2.500 | 9.294,02 px | ≥ 259,69 px | 559,54 px | 25,85–25,97 px | [PNG](PROVAS/06-miami-prova.png) |
| 07-montreal | 4.000 × 2.500 | 7.913,89 px | ≥ 259,46 px | 230,60 px | 25,82–25,96 px | [PNG](PROVAS/07-montreal-prova.png) |
| 08-monte-carlo | 4.000 × 2.500 | 8.455,41 px | ≥ 259,70 px | 210,00 px | 25,08–25,95 px | [PNG](PROVAS/08-monte-carlo-prova.png) |

## Medidas comuns

- Asfalto de 190 px ao longo da volta. A borda do asfalto está a 95 px do centro.
- Zebras de 5 px por lado, com blocos de 7 px em vermelho e branco. Escape de 16 px por lado depois da zebra. A borda do escape fica a 116 px do centro.
- Faixa central branca de 2 px, com 10 px de traço e 12 px de intervalo.
- Xadrez na largada com duas colunas de quadrados de 4 px. A faixa completa tem 8 px de espessura no sentido da corrida.
- Grid de 11 posições em duas colunas alternadas, a ±48 px do centro. A primeira posição fica 40 px antes da largada e as demais são escalonadas de 40 em 40 px no sentido longitudinal. Os carros de uma mesma coluna ficam a 80 px entre si.

## Método e integração

Os PNGs e as provas foram rasterizados diretamente com Python e Pillow em 4.000 × 2.500 px. A linha central em ciano nas provas vem do mesmo JSON da imagem limpa. Os checkpoints aparecem em amarelo e a largada em branco. Os polígonos e as bandas foram desenhados sem antialiasing. O degrau de pixel nas diagonais faz parte da rasterização nativa.

A margem da tabela é a menor distância da linha central ao limite da imagem. Para a separação, considere vizinhos os pontos a menos de 365 px um do outro seguindo o arco fechado. O limite inferior da tabela desconta o intervalo de amostragem, de no máximo 1,25 px. Em Suzuka, somente os pares entre as duas passagens do viaduto, dentro das janelas indicadas no JSON, foram excluídos dessa medida. O viaduto tem sombra e o tabuleiro superior cobre a passagem inferior.

A ordem dos pontos, o trecho de largada e o sentido de corrida estão ancorados no pacote original. Alguns raios e trechos próximos foram abertos ou simplificados para o novo asfalto. As marcações do grid e os checkpoints usam as coordenadas do PNG. Leia os grupos pelo respectivo `pistas.json`; os três índices podem ser combinados pela chave `id`. Estes arquivos foram conferidos em imagem e geometria. A física e as colisões ainda precisam de teste no motor do jogo.

Os traçados partem de [Tomislav Bacinger, f1-circuits](https://github.com/bacinger/f1-circuits), distribuído sob MIT. A licença original está incluída.
