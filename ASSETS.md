# Assets (arte, som, fontes e trechos de código de terceiros)

Todo arquivo de terceiros entra aqui com: caminho, autor, origem (URL), licença e data.

| Caminho | Autor | Origem | Licença | Data |
|---|---|---|---|---|
| `games/snake/public/img/cobra_*.png` | Gestor da Flix (modelos “Network Snake”) | pasta “Network Snake” enviada em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/casa.png`, `globo.png`, `logo.png` | idem | idem | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/item_*.png` (antena, CPE, caixa de fibra, roteador, switch) | idem | idem | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/muro.png` | idem | “Cerca de Madeira com Flores”, colocada na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |
| `games/snake/public/img/cenario.jpg` | idem | “Painel Flix com Grade Urbana Neon”, colocado na pasta de assets em 16/11/2026 | [D] a confirmar | 16/11/2026 |

## Situação em 16/11/2026
- [F] **O G03 usa agora as ilustrações enviadas pelo gestor** (estilo Network Snake, sem pixel art), recortadas e reduzidas por `games/snake/tools/preparar-assets.cjs`. Os originais (cerca de 13 MB) ficam fora do Git (`Network Snake/` no `.gitignore`); no repositório vão só as versões otimizadas (cerca de 300 KB).
- [D] **Origem e licença a confirmar com o gestor e o jurídico.** O nome de um dos arquivos (“Imagem do ChatGPT …”) indica que parte da arte foi gerada por IA. O prompt dos minigames (seção 2.5) pede confirmação do jurídico antes de usar arte gerada por IA em produção. As imagens também trazem o logo e a marca FLIX; o repositório ainda é público (Q44 pede privado).
- [F] Sem som nem fonte de terceiros: os sons são sintetizados por código (`games/snake/src/audio.ts`) e o texto usa fontes do sistema.
- [F] O retrato do personagem no HUD e na tela de fim ainda vem de `packages/flix-avatar` (desenhado por código, pixelado); a equipe do portal está trocando essa parte.
- Dependências de código (Phaser, Vite etc.) estão em `LICENSES/README.md`.
