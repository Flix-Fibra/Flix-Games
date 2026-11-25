# Conferência dos circuitos 17-24

| Pista | PNG em pixels | Volta fechada | Separação centro a centro | Margem da linha central | Passo dos pontos | Prova |
|---|---:|---:|---:|---:|---:|---|
| 17-baku | 4.000 × 2.500 | 7.297,95 px | ≥ 261,05 px | 274,92 px | 25,83–25,98 px | [PNG](PROVAS/17-baku-prova.png) |
| 18-marina-bay | 4.000 × 2.500 | 9.217,25 px | ≥ 261,25 px | 350,05 px | 25,85–25,98 px | [PNG](PROVAS/18-marina-bay-prova.png) |
| 19-austin | 4.000 × 2.500 | 9.429,10 px | ≥ 258,07 px | 293,94 px | 25,67–26,00 px | [PNG](PROVAS/19-austin-prova.png) |
| 20-cidade-do-mexico | 4.000 × 2.500 | 7.812,33 px | ≥ 258,47 px | 231,20 px | 25,84–25,96 px | [PNG](PROVAS/20-cidade-do-mexico-prova.png) |
| 21-interlagos | 4.000 × 2.500 | 9.172,71 px | ≥ 259,73 px | 399,88 px | 25,90–26,00 px | [PNG](PROVAS/21-interlagos-prova.png) |
| 22-las-vegas | 4.000 × 2.500 | 9.649,55 px | ≥ 257,52 px | 302,03 px | 25,50–25,95 px | [PNG](PROVAS/22-las-vegas-prova.png) |
| 23-lusail | 4.000 × 2.500 | 8.203,73 px | ≥ 257,99 px | 257,55 px | 25,87–25,98 px | [PNG](PROVAS/23-lusail-prova.png) |
| 24-yas-marina | 4.000 × 2.500 | 9.055,84 px | ≥ 259,13 px | 453,76 px | 25,85–25,96 px | [PNG](PROVAS/24-yas-marina-prova.png) |

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
