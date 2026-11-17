# Assets (arte, som, fontes e trechos de código de terceiros)

Todo arquivo de terceiros entra aqui com: caminho, autor, origem (URL), licença e data.

| Caminho | Autor | Origem | Licença | Data |
|---|---|---|---|---|
| `games/snake/public/img/cobra_*.png` | Gestor da Flix (modelos “Network Snake”) | pasta “Network Snake” enviada em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/casa.png`, `globo.png`, `logo.png` | idem | idem | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/item_*.png` (antena, CPE, caixa de fibra, roteador, switch) | idem | idem | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/muro.png` | idem | “Cerca de Madeira com Flores”, colocada na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/ceu.jpg` | idem | arquivo “DE2D51E8-27BD-44F6-ACC9-83735A93D788” (céu), colocado na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/cidade.png` | idem | arquivo “2B72D523-A291-4B21-B6C2-70D71D066A62” (cidade), colocado na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/rodape.png` | idem | arquivo “287A7E47-F86E-47EA-B5EA-3FE01654C110”, colocado na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/runner/public/img/cidade_a.jpg`, `cidade_b.jpg` | Gestor da Flix | “Gemini_Generated_Image_2jcvsy2jcvsy2jcv.jpg” (cidade Flix) e “Gemini_Generated_Image_xniyroxniyroxniy.jpg” (cidade com ponte e rio), 3904x1088 reduzidas para 1938x540; pasta “Endless Runner Assets” em 17/11/2026 | [D] a confirmar (arte gerada por IA; traz marca FLIX) | 17/11/2026 |
| `games/runner/public/img/personagem/*.png` (`run_0`, `run_1`, `jump`, `fall`, `fly_0`, `fly_1`) | Gestor da Flix | “Gemini_Generated_Image_gudbekgudbekgudb.jpg” (folha com 6 poses do personagem de lado, com xadrez de transparência falso no JPG), fundo removido por código e cada pose separada, escala 0,38; pasta “Endless Runner Assets” em 17/11/2026 | [D] a confirmar (arte gerada por IA) | 17/11/2026 |
| `games/runner/public/img/personagem/run_2.png`, `run_3.png`, `duck.png` | derivados dos sprites do gestor (`run_0`, `run_1`) | `run_2` e `run_3` são o `run_0` e o `run_1` com as pernas invertidas; `duck` é o `run_1` com o tronco inclinado e as pernas achatadas (gerados por código em 17/11/2026) | [D] a confirmar; trocar por arte desenhada à mão quando houver | 17/11/2026 |
| `games/runner/public/img/ponte.png` | Gestor da Flix | “Gemini_Generated_Image_gq2dj8gq2dj8gq2d.jpg” (ponte vermelha, com xadrez de transparência falso), fundo removido e treliça superior cortada; só o tabuleiro e os pilares, 1360x382 | [D] a confirmar (arte gerada por IA) | 17/11/2026 |
| `games/runner/public/img/personagem/gun.png`, `itens/arma.png` | Gestor da Flix | “Gemini_Generated_Image_avm3apavm3apavm3.jpg” (arma de wifi e personagem armada, com xadrez de transparência falso); fundo e brilho removidos por código. A terceira figura da folha (corrida sem arma) não foi usada | [D] a confirmar (arte gerada por IA) | 17/11/2026 |
| `games/runner/public/img/itens/bateria.png`, `itens/virus.png` | Gestor da Flix | “Gemini_Generated_Image_uttsfvuttsfvutts.jpg” (sinal de energia e vírus), fundo e brilho removidos por código | [D] a confirmar (arte gerada por IA) | 17/11/2026 |
| `games/runner/public/img/personagem/duck_0.png`, `duck_1.png` | Gestor da Flix | “Gemini_Generated_Image_g2a9dzg2a9dzg2a9.jpg” (duas poses abaixadas, xadrez de transparência falso removido por código; a mesma imagem traz um poste caído, ainda não usado) | [D] a confirmar (arte gerada por IA) | 17/11/2026 |
| `games/runner/public/img/torre.png` | Gestor da Flix | “Gemini_Generated_Image_joqa4cjoqa4cjoqa.jpg” (torre 5G), com o fundo de céu removido por código e reduzida para 321x800 | [D] a confirmar (arte gerada por IA; traz marca FLIX) | 17/11/2026 |
| _(removido)_ `cenario.jpg` | idem | “Painel Flix com Grade Urbana Neon”, usado de 16/11 a 16/11/2026 e retirado do jogo a pedido do solicitante | — | 16/11/2026 |

## Situação em 16/11/2026
- [F] **O G03 usa agora as ilustrações enviadas pelo gestor** (estilo Network Snake, sem pixel art), recortadas e reduzidas por `games/snake/tools/preparar-assets.cjs`. Os originais (cerca de 13 MB) ficam fora do Git (`Network Snake/` no `.gitignore`); no repositório vão só as versões otimizadas (cerca de 300 KB).
- [D] **Origem e licença a confirmar com o gestor e o jurídico.** O nome de um dos arquivos (“Imagem do ChatGPT …”) indica que parte da arte foi gerada por IA. O prompt dos minigames (seção 2.5) pede confirmação do jurídico antes de usar arte gerada por IA em produção. As imagens também trazem o logo e a marca FLIX; o repositório ainda é público (Q44 pede privado).
- [F] Sem som nem fonte de terceiros: os sons são sintetizados por código (`games/snake/src/audio.ts`) e o texto usa fontes do sistema.
- [F] O retrato do personagem no HUD e na tela de fim ainda vem de `packages/flix-avatar` (desenhado por código, pixelado); a equipe do portal está trocando essa parte.
- Dependências de código (Phaser, Vite etc.) estão em `LICENSES/README.md`.
