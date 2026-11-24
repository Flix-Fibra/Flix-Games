# Conferência dos circuitos 09-16

| Pista | PNG em pixels | Volta fechada | Separação centro a centro | Margem da linha central | Passo dos pontos | Prova |
|---|---:|---:|---:|---:|---:|---|
| 09-barcelona | 4.000 × 2.500 | 9.313,19 px | ≥ 259,62 px | 246,75 px | 25,83–25,96 px | [PNG](PROVAS/09-barcelona-prova.png) |
| 10-spielberg | 4.000 × 2.500 | 9.758,38 px | ≥ 257,91 px | 306,26 px | 25,83–25,96 px | [PNG](PROVAS/10-spielberg-prova.png) |
| 11-silverstone | 4.000 × 2.500 | 9.420,25 px | ≥ 258,05 px | 373,19 px | 25,83–25,96 px | [PNG](PROVAS/11-silverstone-prova.png) |
| 12-spa | 4.000 × 2.500 | 9.547,00 px | ≥ 259,14 px | 351,94 px | 25,28–25,95 px | [PNG](PROVAS/12-spa-prova.png) |
| 13-hungaroring | 4.000 × 2.500 | 6.740,98 px | ≥ 258,18 px | 219,56 px | 25,71–25,95 px | [PNG](PROVAS/13-hungaroring-prova.png) |
| 14-zandvoort | 4.000 × 2.500 | 9.284,27 px | ≥ 259,43 px | 272,46 px | 24,80–25,95 px | [PNG](PROVAS/14-zandvoort-prova.png) |
| 15-monza | 4.000 × 2.500 | 9.087,35 px | ≥ 283,06 px | 236,85 px | 25,91–25,97 px | [PNG](PROVAS/15-monza-prova.png) |
| 16-madrid | 4.000 × 2.500 | 9.004,44 px | ≥ 261,29 px | 210,63 px | 25,85–25,96 px | [PNG](PROVAS/16-madrid-prova.png) |

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
