# Prompt de início - Mini games da plataforma Flix (versão 2.1)

> Como usar: coloque este arquivo na raiz do repositório dos jogos e passe-o ao agente de IA (por exemplo o Claude Code) como instrução inicial. Ele é escrito para o agente, mas também serve de guia para o time.
>
> Aviso: este documento organiza boas práticas de engenharia e de propriedade intelectual. Não é aconselhamento jurídico. O jurídico da Flix deve revisar cada jogo antes de publicar, e os jogos marcados com risco alto só começam depois da aprovação dele.
>
> Novidades da versão 2: sistema de personagem personalizado compartilhado entre os jogos (seção 9), catálogo com 15 jogos organizados em ondas (seção 10), contrato com o hub atualizado com a mensagem `init` (seção 6) e regras específicas para jogos clássicos muito protegidos (seção 2.2).

---

## 0. Resumo

- A Flix Fibra (ISP) vai ter, dentro do site principal, uma página de mini games para atrair clientes e aumentar o tempo no site.
- Os jogos são simples, viciantes, de sessão curta (ônibus, fila), jogáveis no celular pelo navegador.
- Ao perder, o jogador vê um anúncio e um botão de restart. Há ranking para o cliente ver sua posição.
- **No hub, cada jogador cria um personagem personalizado** (cor da pele, cor e tipo de roupa, cabelo, skins) que aparece em todos os jogos (seção 9).
- O Rafael cuida do hub (página dos jogos, editor de personagem, ranking, anúncios). Este repositório cuida dos jogos e do código compartilhado de personagem.
- O catálogo tem **15 jogos** (seção 10): runner, Flappy-like, Snake, Arkanoid-like, Frogger-like, minigolfe, plataforma com mapas, run and gun, travessia infinita, Tetris-like, arena em primeira pessoa, corrida top-down, futebol de cabeça, descida em espiral e cesta de basquete de um toque.
- Vamos nos inspirar em jogos open source e em jogos existentes, mas sem copiar código, arte, som, nome, personagem ou fase. A referência serve só para entender a mecânica e o ritmo.
- Todo jogo é recriado do zero, com identidade visual da Flix, a partir de uma ficha de gameplay escrita com palavras do time (seção 11).
- Stack padrão: Phaser 3 + TypeScript + Vite, com saída estática (seção 4).
- O primeiro jogo é um runner infinito de um botão (seção 10.1). O plano de hoje está na seção 12.

---

## 1. Contexto do projeto

**Empresa e objetivo de negócio**
- Flix Fibra, provedor de internet. O site principal é onde os clientes contratam e procuram suporte.
- A página de jogos é ideia do CEO. A intenção é atrair clientes e deixá-los mais tempo no site.
- Monetização e engajamento previstos: anúncio na tela de game over junto com o botão de restart, ranking entre os clientes e personalização do personagem.

**Público e dispositivo**
- Clientes em celulares variados, inclusive aparelhos simples e conexão móvel. Assuma o pior caso: Android de entrada, 4G instável.
- Uso típico: uma mão, em pé no ônibus ou na fila, partidas de 30 segundos a 3 minutos.

**Equipe**
- A equipe de TI da Flix não trabalha com jogos normalmente. Prefira soluções simples, bem documentadas e fáceis de manter.
- Tobias: responsável pelos jogos e pela pesquisa de referências.
- Rafael: responsável pelo hub. Ainda não começou nenhum jogo. Por isso o contrato entre jogo e hub (seção 6) e o formato do personagem (seção 9) são importantes: os dois lados precisam trabalhar em paralelo.

**Tipos de jogo desejados**
- Plataforma e metroidvania em pixel art (estilo Mario ou similar, sem copiar nenhum).
- Arcade de sessão curta.
- Clássicos recriados com identidade própria: Arkanoid, Frogger, Tetris, Snake, Flappy Bird.
- Ideia do CEO: algo parecido com Doom. Fica para a última onda (seção 10.11), por causa de peso, controle por toque e conteúdo violento.

---

## 2. Regras inegociáveis

### 2.1 Propriedade intelectual

1. **Nada de código, arte, som, música, fonte, nome, personagem, fase ou texto de terceiros** sem licença que permita uso comercial e sem registro na seção de assets (seção 8).
2. **Mecânica não é cópia, expressão é.** Pode-se se inspirar em ideias gerais (por exemplo "o personagem corre sozinho e o toque faz pular"). Não se pode reproduzir o jeito específico como um jogo as expressa: personagens, desenho dos cenários, layout das fases, interface, sons, textos, nome.
3. **Nunca use nomes ou estilos de jogos protegidos** em nomes de arquivos, commits, textos do jogo ou prompts de geração de imagem (por exemplo "estilo Metal Slug", "tipo Crossy Road", "Mario", "Tetris", "Arkanoid", "Frogger", "Flappy"). Nos documentos internos use nomes de trabalho como "Flappy-like" apenas para identificar o gênero, e troque por nomes próprios antes de qualquer commit de código ou texto visível ao jogador.
4. **Cada jogo precisa de pelo menos cinco diferenciais próprios e visíveis** (tema, personagem, cenário, regra extra, interface, sons). Liste na ficha do jogo.
5. Em caso de dúvida, não use. Pergunte ao Tobias e, se preciso, ao jurídico.

### 2.2 Jogos clássicos muito protegidos (Tetris, Arkanoid, Frogger, Flappy Bird, Snake)

Estes jogos pedem cuidado extra, porque os titulares têm histórico de defender suas marcas e sua aparência. O que a pesquisa encontrou:

- **Tetris (risco alto).** Num caso dos Estados Unidos (Tetris Holding v. Xio Interactive, tribunal de New Jersey, 2012), o clone "Mino" foi considerado infração de copyright e de trade dress. O tribunal entendeu que regras e mecânica não são protegidas, mas a forma de expressá-las, a aparência e a sensação do jogo, são. Os desenvolvedores tinham tentado licenciar o jogo e a empresa recusou. Não basta trocar o nome e as cores. Antes de começar, o jurídico precisa aprovar o conceito.
- **Flappy Bird (risco médio).** A discussão de desenvolvedores indica que copiar a mecânica é discutível, mas elementos artísticos que identificam o original (desenho do pássaro, esquema de cores, fonte, canos verdes) podem ser protegidos. Regra prática: se uma pessoa comum confundiria o seu jogo com o original, você está em risco.
- **Arkanoid (risco médio).** Já houve disputa histórica entre a dona do Breakout e o Arkanoid. O nome Arkanoid é marca. Evite o nome, o desenho da raquete, as cápsulas de poder, as fases e as músicas.
- **Frogger (risco médio).** Os titulares dos direitos (possivelmente Konami e Sega, a confirmar) devem ser tratados como donos do nome e do personagem. Não usar sapo nem o nome. O personagem do nosso jogo será o personagem personalizado do jogador.
- **Snake (risco baixo).** Conceito antigo e genérico, mas evite reproduzir a aparência de uma versão específica (por exemplo o visual de tela de celular antigo).
- **Helix Jump, Dunk Shot e Head Ball (risco médio, adicionados na versão 2.1).** São jogos comerciais de estúdios de mobile (Helix Jump é da Voodoo, Dunk Shot é da Ketchapp/Estoty, e o Head Ball tem versões comerciais). Os repositórios que o time achou são clones de aprendizado, sem licença confirmada. Valem só como referência do gênero. Não usar nomes, ícones, paletas, bolas, aros, torres, personagens ou sons dos originais.

Medidas para todos eles:
1. Mudanças reais de regra, de tema e de apresentação, não só de cor ou de nome.
2. Nada de elementos distintivos conhecidos (formas, cores, sons, efeitos, telas, tipografia do original).
3. Nome, personagem, cenário e interface próprios da Flix.
4. Revisão do jurídico antes de publicar. Para o Tetris-like, aprovação antes de escrever o primeiro código.

### 2.3 Licenças

- Aceitas para código: MIT, BSD, Apache 2.0, Unlicense, CC0.
- Aceitas para assets: CC0, ou licenças que permitam uso comercial e exijam apenas atribuição (CC-BY), desde que a atribuição seja cumprida na página de créditos.
- **Não aceitas sem aprovação do jurídico:** GPL e AGPL (podem obrigar a disponibilizar o código), CC-BY-SA, qualquer licença "NC" (não comercial), "sem licença", "uso educacional", "uso justo".
- Anúncio no game over caracteriza uso comercial.
- Mantenha o arquivo `ASSETS.md` e a pasta `LICENSES/` atualizados. Nenhum arquivo entra no jogo sem linha no `ASSETS.md`.

### 2.4 Processo de sala limpa (clean room)

O objetivo é que o jogo final não seja uma obra derivada de nenhum jogo de referência.

1. **Observador** (Tobias ou Rafael, uma pessoa): joga a referência no celular e no computador, anota e preenche a **Ficha de gameplay** (seção 11), em palavras próprias e sem copiar textos, nomes ou números exatos que sejam expressão do jogo.
2. **Implementador** (o agente de IA e quem revisa): trabalha **somente a partir da ficha**. Não recebe o código-fonte da referência, os sprites, os sons, os prints nem os vídeos.
3. A ficha é revisada por uma segunda pessoa antes de ser entregue ao agente, para tirar qualquer detalhe que seja expressão específica.

### 2.5 Como usar IA sem criar obra derivada

- **Não cole o código de um jogo de referência no agente** pedindo para "reescrever" ou "refazer parecido". Isso gera uma obra derivada, mesmo com variáveis renomeadas.
- Não envie prints, sprites ou vídeos da referência para ferramentas de geração de imagem ou de código.
- Pixel art gerada por IA serve no máximo como conceito ou placeholder interno. A arte final deve ser feita pelo designer da Flix ou vir de pacotes CC0 com origem conhecida. Confirme com o jurídico antes de usar arte gerada por IA em produção.
- Código escrito pelo agente deve ser revisado por uma pessoa do time antes de entrar no branch principal.

### 2.6 Privacidade (LGPD)

- O ranking usa **apelido livre**, sem vínculo com o cadastro do cliente, sem CPF, e-mail, telefone ou endereço. Se o hub ligar o perfil à conta do cliente, o Rafael e o jurídico decidem o tratamento dos dados.
- A configuração do personagem (seção 9) é guardada pelo hub e entregue ao jogo. O jogo não guarda nem envia essa configuração para lugar nenhum.
- O jogo não coleta dado pessoal. Quem envia pontuação e quem exibe anúncio é o hub.
- Sem bibliotecas de analytics, anúncios ou rastreamento dentro dos jogos. Isso é responsabilidade do hub.
- Sem requisições do jogo para domínios externos (fontes, CDNs, APIs). Tudo empacotado no build.

---

## 3. Referências e classificação

Estas são as referências levantadas até agora. Os status vêm da pesquisa de licenças feita em 16/11/2026. "Não verificado" quer dizer que não foi possível confirmar, e a regra é tratar como proibido até confirmar.

### 3.1 Pode servir de base se a verificação for confirmada

| Referência | Licença conhecida | Observação |
|---|---|---|
| GDevelop - 2D Endless Runner (exemplo oficial) https://gdevelop.io/game-example/free/starting-endless-runner | Exemplos oficiais do GDevelop são MIT, salvo indicação contrária | Suporta teclado e toque para pular. Confirme o arquivo license na pasta do exemplo. |
| GDevelop - 2D Platformer Shooter (exemplo oficial) https://gdevelop.io/game-example/free/starting-2d-platformer-shooter | Idem | Suporta teclado e controles mobile para mover e atirar. |
| The Duck Game https://goodgis.itch.io/duck-game-asset-pack | CC0 | Plataforma em pixel art com projeto GDevelop para download. |
| Advanced Platformer Template (GDevelop) https://ayitzmatt.itch.io/advanced-platformer-template-gdevelop | Código Unlicense, assets CC0 | Só teclado. |
| 2D Platformer Demo (GDevelop) https://duncanscott.itch.io/2d-platformer-demo-gdevelop | Código MIT, assets CC0 | Teclado e controle de Xbox. |
| expo-crossy-road https://github.com/evanbacon/expo-crossy-road | Código MIT | **Só o código técnico.** O autor diz que é projeto educacional, sem relação com a Hipster Whale, e que usa o conceito sob uso justo. Isso não protege a Flix. Personagens, cenários e nome não podem ser reaproveitados. É 3D voxel (MagicaVoxel), não pixel art. |

Se um destes for usado diretamente como base, o fluxo é: copiar o projeto para uma pasta própria, registrar a licença em `LICENSES/`, trocar todos os assets pelos da Flix e adaptar ao contrato do hub. Mesmo assim, a stack padrão deste repositório é Phaser (seção 4). Usar GDevelop é exceção e precisa ser combinada com o Rafael.

### 3.2 Somente referência de gameplay (não usar código nem assets)

| Referência | Motivo | O que observar |
|---|---|---|
| metal-slug-js https://github.com/FernandoBade/metal-slug-js | Sem arquivo de licença. Usa sprites e sons extraídos do jogo original, e o próprio texto reconhece a SNK Playmore como dona. | Ritmo do shooter, escalada de dificuldade (inimigos mais rápidos e mais encontros). |
| Pixel Mini Golf https://www.bubbleshooter.net/game/pixel-mini-golf/ | Jogo de terceiros (autor Jopi), hospedado em site de games. A página não diz que é open source e só oferece iframe. | Mecânica de arrastar para mirar e soltar para tacar, progressão de fases, pontuação por tacadas. |
| GDevelop 2D Shooter Platformer Example (Wishforge) https://wishforge.itch.io/gdevelop-2d-shooter-platformer-example | O autor respondeu num comentário que tudo é gratuito, inclusive os assets, mas não há licença escrita. | Separar o corpo do personagem da arma, controle de tiro. Peça confirmação escrita do autor antes de usar qualquer coisa. |
| Not-A-Vania Redux https://silver-streak.itch.io/not-a-vania-redux | Licença não esclarecida. Os assets são de terceiros, cada um com licença própria. Estilo de Castlevania 1 e 3. | Máquina de estados do jogador, combate corpo a corpo, ritmo de fase. É a referência de metroidvania mais próxima. |
| Pixel Wheels https://github.com/agateau/pixelwheels | **Código: a lógica do jogo é GPL 3 ou posterior, o resto é Apache 2.0. Arte e música: CC BY-SA 4.0.** GPL e CC BY-SA são licenças que exigem abrir o código ou compartilhar igual, então não entram na Flix sem o jurídico. Java com libGDX, sem versão web. | Corrida top-down com várias pistas, veículos, bônus e armas. Observar a sensação de direção, o tamanho das pistas e como os bônus mudam a corrida. |
| Head-Ball-Game https://github.com/rezaul-code/Head-Ball-Game | Sem arquivo LICENSE visível. É um app Android em Java com motor de física próprio. O README diz que foi inspirado em Head Ball 2 e que a arte dos avatares é usada "para fins educacionais/demonstração". Não usar nada. | Futebol 1 contra 1 com cabeçadas e chutes alto e baixo, adversário de IA, controles de esquerda, direita, pulo e chute. |
| Helix-Jump (Rizwanhu) https://github.com/Rizwanhu/Helix-Jump | O README cita MIT, mas não deu para confirmar o arquivo LICENSE. Origem dos assets desconhecida. É Unity com C#, 3D, integrado a Firebase e AdMob, sem build mobile no repositório. Clone do Helix Jump da Voodoo. | Bola que cai em um tubo girando plataformas e desviando de obstáculos, com rotação por arrasto, pontuação, skins e rastros. |
| Dunkshot (nassimassb) https://github.com/nassimassb/Dunkshot | Sem licença visível. A descrição diz que é um clone feito só para aprender Unity e "não pretendido para o mercado". Assets de origem desconhecida. Não usar nada. | Arremesso de bola de aro em aro, tocando e arrastando para mirar. |

### 3.3 Verificar antes de qualquer decisão

| Referência | Pendência |
|---|---|
| ufocoder/fps https://github.com/ufocoder/fps | Confirmar o arquivo LICENSE e a origem dos assets. É um FPS estilo Wolfenstein, single player, em TypeScript, renderizado na CPU com raycasting (tem limites de desempenho). O repositório tem cerca de 15 MB. |
| Endless_Runner_Game https://github.com/faizankhan1428/Endless_Runner_Game | Não foi possível abrir a página na pesquisa. Confirmar licença, assets e como os mapas são definidos. |

### 3.4 Clássicos novos (Arkanoid, Frogger, Tetris, Snake, Flappy Bird)

Não há referência de código aprovada para estes cinco, nem para os quatro jogos da seção 3.2 adicionados na versão 2.1. Todos são recriados do zero a partir de fichas de gameplay (seção 11), seguindo as regras da seção 2.2. Se alguém encontrar um clone open source, ele entra aqui apenas como referência de gameplay e passa pela verificação de licença antes de qualquer outra coisa.

### 3.5 Descartado

- Qualquer jogo que reaproveite sprites, sons ou fases de jogos comerciais.
- O pacote "GDevelop Examples" do usuário GameTemplates no itch.io: a página diz que imagens, fontes e sons são só para demonstração, sem uso comercial.

---

## 4. Decisões de stack (padrão, ajustável com o Rafael)

| Item | Decisão | Motivo |
|---|---|---|
| Engine | **Phaser 3** (confirmar licença MIT no repositório antes de fixar a versão) | Framework open source para jogos 2D no navegador, com suporte a mobile, tilemaps e input por toque. Muito documentado, bom para trabalhar com IA. |
| Linguagem | TypeScript | Menos erros em manutenção por quem não é da área de jogos. Se o time preferir, JavaScript puro é aceitável. |
| Build | Vite | Saída em arquivos estáticos, fácil de hospedar em subcaminho. |
| Mapas | Tiled (arquivos JSON) | Permite criar mapas novos sem programar. Phaser lê o formato direto. |
| Pixel art | Aseprite ou Piskel | Spritesheets PNG com JSON. |
| Personagem | Compositor em Canvas 2D, sem dependência de engine (seção 9) | O hub (que pode não usar Phaser) e os jogos usam o mesmo código e mostram o mesmo personagem. |
| Hospedagem | Arquivos estáticos em `/games/<id>/`, embutidos no hub por iframe | Isola CSS e JS do jogo do resto do site. |
| Dependências | Fixar versões, sem CDN externo | Sem rastreamento e sem depender de rede externa. |

Alternativa permitida: GDevelop para jogos que partam de um exemplo oficial MIT. Mantém os mesmos requisitos de contrato, desempenho, personagem e licenças.

Registre qualquer decisão diferente destas em `docs/DECISIONS.md`.

---

## 5. Estrutura do repositório

```
flix-games/
  README.md
  PROMPT_INICIO.md                 (este arquivo)
  ASSETS.md                        (todo arquivo de arte/som/fonte com origem e licença)
  LICENSES/                        (textos de licença de cada dependência e asset)
  docs/
    DECISIONS.md                   (decisões técnicas e motivos)
    HUB_CONTRACT.md                (contrato com o hub, seção 6)
    AVATAR_SPEC.md                 (especificação do personagem, seção 9)
    ADDING_LEVELS.md               (como criar mapas novos, seção 10.7)
    GAMEPLAY_SHEETS/               (fichas de gameplay, seção 11)
    TEST_REPORTS/                  (relatórios de teste por jogo)
  packages/
    flix-game-sdk/                 (ponte de mensagens com o hub, controles de toque, utilidades)
    flix-avatar/                   (tipos, catálogo, compositor e animações do personagem)
  shared/
    avatar/v1/                     (atlas de partes do personagem, servido em /games/_shared/avatar/v1/)
  games/
    runner/                        (G01, jogo piloto)
    flappy-like/                   (G02)
    snake/                         (G03)
    ...                            (um diretório por jogo do catálogo, seção 10)
```

Regras:
- Os pacotes `flix-game-sdk` e `flix-avatar` são compartilhados entre os jogos, para não repetir a ponte com o hub, os controles de toque e o código do personagem.
- Cada jogo é independente e gera seu próprio build em `games/<id>/dist`.
- Cada jogo tem um `game.json` com `id`, `name`, `avatarTier` ("A" ou "B"), `avatarViews`, `rankingMetric` e `sdkVersion`.
- Commits pequenos, mensagens claras, uma mudança por commit.

---

## 6. Contrato com o hub (Rafael)

O jogo roda dentro de um iframe do hub. Eles conversam por `postMessage`. O jogo **não** envia pontuação para nenhuma API, não mostra anúncio, não guarda chaves e não guarda o personagem. Quem faz isso é o hub.

### 6.1 Mensagens do jogo para o hub

```ts
type GameToHub =
  | {
      source: 'flix-game'; v: 2; type: 'ready'; gameId: string;
      capabilities: { sdkVersion: string; avatarTier: 'A' | 'B'; avatarViews: ('side' | 'top' | 'portrait' | 'fp_hands')[] };
    }
  | { source: 'flix-game'; v: 2; type: 'started'; gameId: string; runId: string }
  | {
      source: 'flix-game'; v: 2; type: 'gameover'; gameId: string; runId: string;
      score: number;        // pontuação final, inteiro >= 0
      durationMs: number;   // duração da partida
      meta?: Record<string, number | string>; // dados extras simples (ex.: moedas)
    };
```

### 6.2 Mensagens do hub para o jogo

```ts
type HubToGame =
  | {
      source: 'flix-hub'; v: 2; type: 'init';
      avatar: AvatarConfig | null;  // seção 9.3. null = usar o personagem padrão
      muted: boolean;
      locale?: string;              // por exemplo 'pt-BR'
    }
  | { source: 'flix-hub'; v: 2; type: 'restart' }   // depois do anúncio
  | { source: 'flix-hub'; v: 2; type: 'pause' }
  | { source: 'flix-hub'; v: 2; type: 'resume' }
  | { source: 'flix-hub'; v: 2; type: 'mute'; muted: boolean };
```

### 6.3 Fluxo

1. O jogo carrega e envia `ready`.
2. O hub responde com `init` (personagem, som, idioma). Se o `init` não chegar em até 1,5 segundo, o jogo segue com o personagem padrão. O jogo nunca fica travado esperando o personagem.
3. O jogador toca e começa. O jogo envia `started` com um `runId` único (UUID).
4. Ao perder, o jogo congela, mostra a tela de fim sem anúncio, envia `gameover` e **espera**.
5. O hub mostra o anúncio, depois envia `restart`. O jogo reinicia com novo `runId`.
6. Se o hub não responder em modo de desenvolvimento (sem iframe), o jogo mostra um botão de restart próprio. Em produção o botão de restart pertence ao hub.

### 6.4 Segurança

- O jogo valida `event.origin` contra uma lista configurável (`?hubOrigin=` ou variável de build). Nunca usa `'*'` em produção como `targetOrigin`.
- Ignora mensagens sem `source` e `v` esperados.
- O jogo valida o `AvatarConfig` recebido contra o catálogo (seção 9.6). Valor desconhecido vira o item padrão.
- O hub deve tratar a pontuação como não confiável: limite de requisições por IP e por sessão, validação de faixa plausível por jogo e por `durationMs`, e rejeição de `runId` repetido. Isso reduz trapaça, mas não elimina (o jogo roda no navegador do jogador).

### 6.5 O que o agente deve entregar

- `packages/flix-game-sdk` com as funções `sendReady`, `sendStarted`, `sendGameOver` e `onHubMessage`, com testes.
- `docs/HUB_CONTRACT.md` com este contrato, para o Rafael implementar o lado do hub.
- Uma página `dev-host.html` que simula o hub localmente (envia `init` com um personagem de teste, mostra um "anúncio" falso e envia `restart`), para o Rafael e o Tobias testarem sem depender um do outro.

---

## 7. Requisitos de jogo mobile e desempenho

- **Mobile primeiro.** Toque é o controle principal. Teclado só como bônus.
- **Resolução lógica fixa**, com escala "fit" e `image-rendering: pixelated`. Padrão: 480x270 (paisagem). Se for retrato, 270x480. Decidir por jogo e registrar.
- **Pixel art sem borrar:** filtro "nearest", escala inteira quando possível.
- **60 FPS** em aparelho de entrada. Se não for possível, caia para 30 de forma estável em vez de oscilar.
- **Peso:** meta inicial de até 3 MB no carregamento do primeiro jogo (código, arte e áudio), com carregamento rápido em 4G. O atlas compartilhado do personagem conta nesse orçamento na primeira vez e vem do cache nos jogos seguintes. Meça e registre o tamanho real em cada relatório de teste.
- **Tela de carregamento** com barra de progresso.
- **Áudio:** liberar só depois do primeiro toque (restrição dos navegadores) e respeitar a mensagem `mute` do hub.
- **Ciclo de vida:** pausar sozinho quando a aba perde foco (`visibilitychange`), e retomar com `resume`.
- **Navegador do celular:** impedir rolagem, zoom por duplo toque e menu de contexto durante o jogo. Respeitar áreas seguras (notch).
- **Acessibilidade mínima:** contraste alto no HUD, textos legíveis, opção de silenciar, e controle de um dedo sempre que o jogo permitir.
- **Sem dependência de rede** depois do carregamento.
- **Sem conteúdo gráfico violento ou ofensivo:** o público inclui famílias e menores. Evite sangue e armas realistas.

---

## 8. Assets e identidade da Flix

### 8.1 Fase de placeholders (hoje)

- Use pacotes **CC0** do Kenney (por exemplo o "Pixel Platformer") como placeholders. A licença permite uso comercial sem atribuição obrigatória: https://kenney-assets.itch.io/pixel-platformer
- Todo arquivo entra no `ASSETS.md` com: caminho, autor, origem (URL), licença, data de download.
- Acesse os assets sempre por um **manifesto** (`assets.manifest.json`) e por chaves lógicas (`player`, `obstacle_small`), nunca pelo nome do arquivo no código. Assim a troca pelos assets da Flix é só substituir arquivos.
- O personagem do jogador também passa por uma chave lógica (`player`), que na prática vem do compositor de personagem (seção 9). No começo, o compositor devolve um personagem padrão feito com o placeholder.

### 8.2 Assets personalizados da Flix (pedir ao designer, quanto antes)

Entregar ao designer um briefing curto com:
- **Prioridade 1: o kit do personagem** (seção 9.7), porque todos os jogos dependem dele.
- **Grade:** 16x16 para itens e tiles. O personagem usa quadro de 32x32 (seção 9.2).
- **Paleta:** definida a partir da marca da Flix (o time deve fornecer as cores oficiais). Limite sugerido de 16 a 24 cores por cena.
- **Cenários:** parallax em 3 camadas (céu, prédios, chão) e tileset do chão, para cada jogo.
- **Obstáculos e coletáveis:** itens com tema de fibra e internet (caixa de emenda, cone, cabo solto, pássaro, "pacote de dados").
- **Interface:** botões de toque, ícones de pontuação e de som.
- **Formato:** PNG com fundo transparente, spritesheets com JSON (Aseprite exporta), nomes em minúsculas com sublinhado.
- **Sons:** efeitos curtos (pulo, ponto, derrota) e uma música em loop curta. Podem ser gerados em ferramentas livres (por exemplo sfxr/jsfxr) ou licenciados com licença comercial.
- **Logo da Flix:** pode aparecer na tela inicial e no fim de partida, em tamanho discreto, seguindo o manual de marca.

### 8.3 Regra de origem

Todo asset final tem origem conhecida e licença registrada: feito pelo designer, CC0 com URL, ou comprado com nota. Sem exceção.

---

## 9. Sistema de personagem personalizado (avatar)

### 9.1 Objetivo e princípios

- O jogador monta seu personagem no hub: **cor da pele, cor do personagem, roupas (camiseta, calça, calçado), cabelo, acessórios e skins**. O mesmo personagem aparece em **todos os jogos**.
- O editor fica no hub (Rafael). O código que desenha o personagem é **um só**, compartilhado em `packages/flix-avatar`, usado pelo editor e por todos os jogos. O que o jogador vê no editor é o que ele joga.
- **Só estética.** O personagem nunca muda a jogabilidade. A área de colisão (hitbox) é definida por jogo, e não pela arte do personagem. Nada de "pagar para vencer".
- **Sem texto livre e sem upload de imagem.** O jogador só escolhe entre itens do catálogo (lista permitida). Isso evita conteúdo impróprio e problemas de direitos.
- **O jogo sempre funciona sem personagem.** Se o hub não enviar um, o jogo usa o personagem padrão.

### 9.2 Padrão técnico do personagem (rig v1)

Todo item do catálogo segue o mesmo padrão, para as camadas combinarem quadro a quadro.

- **Quadro:** 32x32 pixels. Âncora no centro da base (entre os pés), coordenada (16, 31).
- **Visões (views):**
  - `side` (visão lateral): usada por runner, Flappy-like, plataforma, run and gun, minigolfe. Fase 1.
  - `portrait` (busto, 32x32): usada no HUD e na tela de fim (Snake, Arkanoid-like, Tetris-like e todos os outros). Fase 1.
  - `top` (visão de cima, 4 direções): Frogger-like e travessia infinita. Antes dessas ondas.
  - `fp_hands` (mãos e antebraços em primeira pessoa, com cor da pele e da manga): arena em primeira pessoa. Antes dessa onda.
- **Animações da visão `side`** (mesmas para todas as camadas, em `animations.json`): `idle` (4 quadros), `run` (6), `jump_up` (1), `jump_apex` (1), `fall` (1), `hurt` (2), `win` (4), `shoot` (2), `swing` (4, para minigolfe) e `fly` (4, para o Flappy-like).
- **Retrato (`portrait`):** 3 expressões (`neutral`, `happy`, `sad`).
- **Camadas, de trás para frente:** `accessory_back`, `hair_back`, `body`, `shoes`, `bottom`, `top`, `face`, `hair_front`, `accessory_face`, `hat`, `overlay` (skin completa).
- **Partes pintáveis:** o designer desenha as peças em **tons de cinza** (para guardar o sombreado) e marca em qual "espaço de cor" cada uma é pintada: `primary`, `secondary` ou nenhum (partes fixas, como olhos e detalhes).
- **Contorno:** o compositor adiciona um contorno escuro de 1 pixel em volta do personagem, para ele se destacar em qualquer fundo.

### 9.3 Modelo de dados

O hub guarda e envia este objeto (versão 1). Ele é pequeno (menos de 1 KB) e só contém IDs do catálogo.

```ts
interface AvatarConfig {
  v: 1;
  body: { type: string; skinTone: string };        // type: id do tipo de corpo; skinTone: id da paleta de pele
  face: { eyes: string; mouth: string };
  hair: { style: string; color: string } | null;
  top: { item: string; primary: string; secondary?: string } | null;
  bottom: { item: string; primary: string; secondary?: string } | null;
  shoes: { item: string; primary: string } | null;
  hat: { item: string; primary?: string } | null;
  accessories: string[];                            // até 3 ids
  skinPreset: string | null;                        // skin completa (por exemplo o uniforme de técnico da Flix); quando definida, substitui top, bottom e hat
}
```

Regras:
- Todo valor é um ID do catálogo (`packages/flix-avatar/catalog.json`). **Nada de cor livre (hex) nem texto.**
- ID desconhecido vira o item padrão, e a versão (`v`) permite evoluir o formato sem quebrar jogos antigos.
- O hub valida o objeto no servidor contra o catálogo antes de salvar.

### 9.4 Paletas e catálogo (fase 1, valores propostos)

- **Pele:** 12 tons realistas, de claros a escuros, e 4 cores fantasia (por exemplo azul e verde), para o "cor do personagem" ser livre sem ser aleatório. Cada tom é uma rampa de 4 sombras definida em `palettes.json`, para a arte não ficar lavada.
- **Roupas:** 16 cores. **Cabelo:** 10 cores.
- **Corpos:** 2 tipos. **Cabelos:** 8 estilos (incluindo opções variadas de textura e comprimento e a opção sem cabelo). **Camisetas:** 6. **Calças ou bermudas:** 4. **Calçados:** 4. **Chapéus e acessórios:** 6. **Skins completas:** 3 (uniforme de técnico da Flix e dois temas originais).
- Esses números são propostas para a fase 1, para o designer estimar o trabalho. Ajuste com o Rafael e o design.
- **Desbloqueios (opcional):** cada item tem um campo `unlock` (`default`, `achievement` ou `event`). O hub decide as regras (por exemplo ganhar skin por posição no ranking semanal). Sem compra com dinheiro real.
- **Skins nunca usam personagens, marcas ou roupas de times de terceiros.** Só temas originais ou da Flix.

### 9.5 Como o personagem é desenhado (compositor)

- `packages/flix-avatar` expõe `composeAvatar(config, view, catalog, atlas)`, em **Canvas 2D puro**, que devolve uma imagem de spritesheet com todas as animações da visão pedida.
- A pintura das peças cinza usa mistura "multiply" e preserva a transparência, sempre com `imageSmoothingEnabled = false`.
- O resultado é guardado em cache pela "impressão digital" (hash) da configuração.
- **No jogo:** o SDK recebe o `init`, chama o compositor, registra o spritesheet como textura do Phaser com a chave `player` e cria as animações a partir de `animations.json`. O restante do jogo só usa a chave `player`.
- **No hub:** o editor usa a mesma função para mostrar a prévia ao vivo.
- **Atlas compartilhado:** as partes ficam em `shared/avatar/v1/` e são servidas em `/games/_shared/avatar/v1/`, na mesma origem de todos os jogos, para o navegador guardar em cache. Meta inicial: atlas da fase 1 com até 300 KB (valor proposto, a medir). Itens carregam sob demanda.

### 9.6 Como cada jogo usa o personagem

| Nível | Uso | Jogos |
|---|---|---|
| A | O personagem é o protagonista em jogo (visões `side` ou `top`) | Runner, Flappy-like, Frogger-like, travessia infinita, plataforma, run and gun, minigolfe, futebol de cabeça, cesta de um toque |
| B | O personagem aparece no HUD, na tela de fim e em detalhes do jogo (visão `portrait`; mãos em primeira pessoa no FPS) | Snake, Arkanoid-like, Tetris-like, arena em primeira pessoa, corrida top-down, descida em espiral |

Exemplos de uso no nível B (propostas): no Snake, o retrato fica no HUD e a cor principal do personagem pinta o cabo; no Arkanoid-like, o personagem aparece ao lado da raquete reagindo (`happy` e `sad`); no Tetris-like, o retrato reage a linhas completas; no FPS, as mãos e mangas usam as cores do jogador.

Cada jogo declara no `game.json` o seu nível e as visões que usa, e informa isso ao hub em `ready.capabilities`.

### 9.7 Briefing para o designer (kit do personagem)

Entregar, nesta ordem:
1. Um arquivo modelo do Aseprite com o rig v1 (quadro 32x32, âncora, camadas e animações da seção 9.2).
2. Corpos, cabelos, camisetas, calças, calçados, chapéus e acessórios da fase 1, em tons de cinza com os espaços de cor marcados.
3. O catálogo `catalog.json` e as rampas de cor `palettes.json`, preenchidos com o designer.
4. As skins completas da fase 1.
5. Visões `top` e `fp_hands`, quando chegarem as ondas que dependem delas.

### 9.8 Segurança, privacidade e moderação

- Lista permitida de itens, sem texto livre, sem upload.
- O personagem é dado de perfil do jogador. Se estiver ligado a uma conta de cliente, o Rafael e o jurídico decidem o tratamento (LGPD).
- O jogo não grava nem transmite o personagem. Só desenha.

### 9.9 O que o agente entrega para o personagem

1. **Hoje:** `docs/AVATAR_SPEC.md` (resumo desta seção), o tipo `AvatarConfig`, o esquema do catálogo e um personagem padrão feito com placeholder CC0, já ligado ao runner pela chave `player`.
2. **Próximos dias:** o compositor em Canvas, os testes (mesma configuração gera a mesma imagem, ID desconhecido cai no padrão), a integração no SDK e uma página de teste do editor (`avatar-playground.html`) com seletores, para o Rafael testar sem o hub.

---

## 10. Catálogo de jogos e ordem de trabalho

### 10.0 Visão geral

As **8 referências já citadas** pelo Tobias e pelo time entram assim: Endless_Runner_Game (G01), Not-A-Vania Redux (G07), Wishforge 2D Shooter Platformer e metal-slug-js (G08), expo-crossy-road (G09), Pixel Mini Golf (G06), ufocoder/fps e a ideia do CEO de algo parecido com Doom (G11). Os **5 clássicos novos** são G02, G03, G04, G05 e G10. Na versão 2.1 entraram mais 4 referências do time: Pixel Wheels (G12), Head-Ball-Game (G13), Helix-Jump (G14) e Dunkshot (G15). Nenhuma das 4 tem licença que permita reaproveitar código ou arte, então todas são só referência de gameplay.

Os níveis de risco abaixo são uma estimativa interna do time, e não parecer jurídico.

| ID | Jogo (nome de trabalho) | Gênero | Referência de gameplay | Risco | Personagem | Métrica de ranking | Onda |
|---|---|---|---|---|---|---|---|
| G01 | Runner infinito de um botão | Runner | Endless_Runner_Game e exemplo de runner do GDevelop | Baixo | A (side) | Pontuação (distância mais coletáveis) | 1 |
| G02 | Flappy-like (voo com um toque) | Arcade | Flappy Bird (só como gênero) | Médio | A (side, `fly`) | Portões ultrapassados | 1 |
| G03 | Snake | Arcade | Snake (conceito genérico) | Baixo | B (portrait) | Pontos por comida com multiplicador de velocidade | 1 |
| G04 | Arkanoid-like (quebra-blocos) | Arcade | Arkanoid e Breakout (só como gênero) | Médio | B (portrait) | Pontos de blocos mais bônus, com vidas limitadas | 2 |
| G05 | Frogger-like (travessia clássica) | Arcade | Frogger (só como gênero) | Médio | A (top) | Pontos por avanço e por chegada, mais tempo restante | 2 |
| G06 | Minigolfe em pixel art | Esporte | Pixel Mini Golf | Baixo | A (side, `swing`) | Menor número de tacadas no conjunto de fases | 2 |
| G07 | Plataforma com mapas (metroidvania-lite depois) | Plataforma | Not-A-Vania Redux e plataformas laterais em geral | Baixo a médio | A (side) | Menor tempo para completar a fase, desempate por coletáveis | 3 |
| G08 | Plataforma com tiro (run and gun curto) | Ação | metal-slug-js e Wishforge (só gameplay) | Médio | A (side, `shoot`) | Pontos por inimigo com multiplicador de sequência | 3 |
| G09 | Travessia infinita em grade | Arcade | expo-crossy-road (só gameplay) | Médio | A (top) | Faixas atravessadas | 3 |
| G10 | Tetris-like (blocos que encaixam) | Puzzle | Tetris (só como gênero) | **Alto** | B (portrait) | Pontos em modo cronometrado de 2 minutos | 3, depois do jurídico |
| G11 | Arena em primeira pessoa (ideia do CEO) | Tiro | ufocoder/fps e ideia tipo Doom | Médio a alto | B (fp_hands) | Inimigos eliminados por tempo de sobrevivência | 4 |
| G12 | Corrida top-down em pixel art | Corrida | Pixel Wheels (só gameplay, licenças GPL e CC BY-SA) | Baixo a médio | B (portrait, piloto) | Melhor tempo de volta por pista | 3 |
| G13 | Futebol de cabeça 1 contra 1 | Esporte | Head-Ball-Game e Head Ball (só gênero) | Médio | A (side, cabeça grande do personagem) | Gols em 2 minutos contra a IA, ou vitórias seguidas | 2 |
| G14 | Descida em espiral (queda em torre giratória) | Arcade | Helix-Jump e Helix Jump (só gênero) | Médio | B (portrait e rastro na cor do personagem) | Andares descidos | 2 |
| G15 | Cesta de um toque (de aro em aro) | Arcade | Dunkshot e Dunk Shot (só gênero) | Médio | A (side, o personagem pula de aro em aro) | Pontos por cesta com bônus de sequência | 1 |

**Por que esta ordem:**
- **Onda 1** valida o pipeline inteiro (SDK, contrato com o hub, personagem, relatório de teste) com jogos pequenos. G01 é o piloto de hoje. G02 reaproveita o toque e a física do runner. G03 é o mais simples de todos. G15 também é de um toque só e tem física simples.
- **Onda 2** traz clássicos que dependem de mais arte e de mais regras, e já usa a visão `top` do personagem (G05). G13 aproveita bem o personagem, com a cabeça grande. G14 é um jogo curto e simples de fazer.
- **Onda 3** traz os jogos com mapas e combate, o Tetris-like, que só começa com aprovação do jurídico, e a corrida top-down (G12), que dá mais trabalho de pistas e de arte.
- **Onda 4** é a ideia do CEO. É a mais pesada e a mais delicada.

**Modos cronometrados:** sempre que possível, ofereça um modo de 2 a 3 minutos. Ranking de partidas com duração parecida é mais justo e combina com sessões curtas.

### 10.1 G01 - Runner infinito de um botão (começa hoje)

**Inspirações gerais** (somente como ideia do gênero): runners de um botão, o jogo do dinossauro do navegador, os exemplos oficiais de runner do GDevelop.

**Nome de trabalho:** "Flix Run" (validar com o marketing).

**Mecânica (escrever na ficha com palavras próprias):**
- O personagem corre sozinho da esquerda para a direita. O cenário rola.
- Um toque faz pular. Segurar um pouco mais pula mais alto (pulo variável), com limite.
- Obstáculos surgem com intervalos. Bater em um obstáculo termina a partida.
- A velocidade aumenta aos poucos até um limite.
- Coletáveis dão pontos extras.
- Pontuação = distância percorrida + coletáveis.

**Regras de justiça (importante para o jogo ser viciante e não frustrante):**
- Nunca gerar um obstáculo impossível de pular. Calcule a distância mínima entre obstáculos como `velocidade x tempo de voo do pulo x margem`.
- Os primeiros 10 segundos são fáceis, para o jogador aprender sem instrução.
- Reiniciar em menos de 1 segundo depois que o hub mandar `restart`.

**Valores iniciais para ajustar jogando** (física arcade do Phaser, resolução 480x270):
- gravidade 1400, velocidade do pulo -520, velocidade inicial 160, velocidade máxima 320, aceleração 4 por segundo.
- Ajuste até o pulo curto passar um obstáculo baixo e o pulo longo passar um obstáculo largo.

**Diferenciais próprios (mínimo cinco, sugestões a validar com marketing e design):**
1. Personagem: o personagem personalizado do jogador (padrão: técnico de campo da Flix).
2. Cenário: cidade com postes, fios e fibra passando pelo céu.
3. Obstáculos temáticos: caixa de emenda, cone, cabo solto, pássaro.
4. Coletável: "pacote de dados". Juntar 10 enche uma barra de "sinal" que dá um breve escudo.
5. Fases do dia que mudam o cenário a cada marco de distância (manhã, tarde, noite).
6. Interface e sons próprios.

### 10.2 G02 - Flappy-like (voo com um toque)

**Inspiração geral (gênero):** jogos de manter um personagem no ar passando por aberturas.

**Mecânica:**
- O personagem personalizado voa com uma mochila a jato. **Segurar** o toque dá impulso para cima, **soltar** deixa cair (controle contínuo, e não um toque por batida de asa). Isso já afasta o jogo do original.
- Obstáculos: torres de antena e cabos com aberturas variadas, algumas móveis.
- Pontuação = portões ultrapassados. Bater termina a partida.

**Diferenciais (mínimo cinco):** voo contínuo em vez de toques; personagem do jogador em vez de pássaro; obstáculos de antenas e cabos em vez de canos; cenário de céu da cidade com "ondas de sinal" como coletáveis; paleta, fonte, sons e interface próprios; abertura que se move em alguns portões.

**Riscos:** não usar pássaro, canos verdes, a fonte, a paleta ou o som do original (seção 2.2).

### 10.3 G03 - Snake

**Inspiração geral (gênero):** guiar uma linha que cresce ao coletar itens, sem bater em si mesma nem nas paredes.

**Mecânica:**
- Grade em pixel art. O jogador desliza o dedo para mudar de direção (sem botões na tela).
- A "cobra" é um **cabo de fibra** que cresce ao conectar "casas" (pontos). A cor principal do cabo vem do personagem (seção 9.6).
- Perde ao bater em si mesmo, no obstáculo ou na parede.
- Modo cronometrado de 2 minutos para ranking.

**Diferenciais (mínimo cinco):** tema de cabo de fibra e casas conectadas; retrato do personagem no HUD que reage ao ganhar e ao perder; poderes temporários (por exemplo "modem turbo" que dá velocidade, "roteador" que atravessa uma parede); mapas com obstáculos de obra; paleta, sons e interface próprios; sem visual de tela de celular antigo.

### 10.4 G04 - Arkanoid-like (quebra-blocos)

**Inspiração geral (gênero):** rebater uma bola com uma raquete para destruir blocos.

**Mecânica:**
- Arrastar o dedo move a raquete. A bola ricocheteia e quebra blocos. Vidas limitadas.
- A raquete é um **roteador ou antena**. Os blocos são "blocos de dados". A bola é um "pacote".
- Bônus caindo dos blocos (por exemplo raquete maior, bola dupla) com ícones próprios.
- Modo cronometrado ou fases curtas (cada fase dura cerca de 1 minuto).
- O personagem personalizado aparece no HUD, reagindo (`happy` e `sad`).

**Diferenciais (mínimo cinco):** raquete de roteador com ondas; blocos com "latência" (alguns precisam de duas batidas e piscam); layouts de fase originais; bônus com ícones e efeitos próprios; modelo próprio de ângulo de rebatida; música e interface próprias; personagem reagindo.

**Riscos:** evitar o nome, o desenho da raquete, as cápsulas de poder, os layouts de fase e as músicas do original (seção 2.2).

### 10.5 G05 - Frogger-like (travessia clássica)

**Inspiração geral (gênero):** atravessar pistas de tráfego e faixas móveis para chegar a metas na outra ponta.

**Mecânica:**
- Visão de cima, tela fixa em grade. Um toque ou um deslize avança uma casa na direção escolhida.
- **O personagem é o personagem personalizado do jogador** (visão `top`), e não um sapo.
- Cenário de obra de fibra em uma rua: carros, vans de manutenção, valas com cabos que se movem como plataformas, conduítes e pontes.
- Metas: 5 "casas" para entregar o cabo. Chegar em todas completa a fase e acelera a próxima.
- Pontuação por avanço, por casa conectada e por tempo restante.

**Diferenciais (mínimo cinco):** personagem do jogador; tema de obra de fibra; objetivos de "conectar casas"; coletável opcional que dá tempo extra; obstáculos e plataformas com desenho próprio; interface, sons e música próprios.

**Riscos:** não usar sapo, o nome, a disposição de pistas e o desenho dos objetos do original (seção 2.2).

### 10.6 G06 - Minigolfe em pixel art

**Inspiração geral (gênero):** minigolfe de arrastar e soltar.

**Mecânica:**
- Arrastar para trás para mirar e definir força, soltar para tacar. Fases curtas com obstáculos.
- O personagem personalizado (visão `side`, animação `swing`) fica ao lado da bola.
- Tema próprio, por exemplo campos temáticos de cidade, com cabos e postes como obstáculos.
- **Ranking:** menor número de tacadas no conjunto de fases.

**Diferenciais (mínimo cinco):** personagem do jogador; campos temáticos originais; obstáculos com física (rampas, ímãs, portais de sinal); fases de 9 buracos de 30 a 60 segundos cada; interface e sons próprios.

### 10.7 G07 - Plataforma com mapas (metroidvania-lite depois)

**Inspirações gerais:** jogos de plataforma lateral com tiro ou combate corpo a corpo, e a estrutura de mapas conectados dos metroidvanias.

**Mecânica:**
- Mover, pular e atacar. Controles de toque: botões esquerda e direita, botão de pulo e botão de ação. Opção de joystick virtual.
- Fases curtas (1 a 3 minutos), com checkpoint, inimigos simples, coletáveis e cronômetro.
- **Mapas criados no Tiled**, em JSON, carregados pelo Phaser. O agente deve criar `docs/ADDING_LEVELS.md` explicando passo a passo como adicionar um mapa novo: camadas obrigatórias, nomes dos objetos (spawn, checkpoint, chegada, inimigos), tamanho do tile e como registrar a fase na lista de fases.
- Entregar 3 fases iniciais e um carregador que aceite fases novas sem mexer no código do jogo.
- Personagem personalizado em visão `side`.

**Etapa seguinte (opcional, "metroidvania-lite"):** um mapa pequeno com salas conectadas, uma habilidade que destrava passagens (pulo duplo, por exemplo) e um minimapa simples.

**Diferenciais (mínimo cinco):** personagem do jogador; mundo de cidade e infraestrutura; inimigos temáticos; habilidade de destravar passagens com um tema próprio; mapas, sons e interface próprios.

### 10.8 G08 - Plataforma com tiro (run and gun curto)

**Inspirações gerais:** jogos de tiro lateral com ondas de inimigos que ficam mais rápidos e mais frequentes ao longo do tempo.

- Sessão de 2 a 3 minutos, controles de toque com tiro automático ou botão de tiro.
- Inimigos temáticos e não violentos (por exemplo "bugs de lentidão", sem sangue).
- Dificuldade crescente por ondas. Personagem personalizado (visão `side`, animação `shoot`).
- Diferenciais: no mínimo cinco, escritos na ficha, sem reproduzir o visual de nenhum jogo existente.

### 10.9 G09 - Travessia infinita em grade

**Inspiração geral (gênero):** jogos de atravessar pistas e rios em passos curtos, com toque, em um mundo que não termina.

- Grade, um toque avança, deslizar muda de lado. Obstáculos em faixas com movimento contínuo. Perde ao ser atingido ou ao demorar demais.
- Personagem personalizado (visão `top`). Tema próprio (por exemplo uma obra de fibra ótica na rua), com arte pixel art em 2D.
- Não usar modelos, personagens ou o nome de nenhum jogo existente. Atenção: G05 e G09 são parecidos. Diferencie bem (G05 é tela fixa com metas, G09 é infinito com câmera que avança).
- Diferenciais: no mínimo cinco, escritos na ficha.

### 10.10 G10 - Tetris-like (blocos que encaixam) - risco alto

**Só começa com aprovação do jurídico (seção 2.2).**

**Inspiração geral (gênero):** encaixar peças feitas de blocos para completar linhas.

- O conceito, as regras e a aparência precisam diferir **de verdade** do jogo original, e não só em cores e nome. Opções de partida para discutir com o jurídico: formato e tamanho do tabuleiro diferentes, conjunto de peças diferente, outra regra de queda ou de limpeza, interface e animações próprias.
- Alternativa de gênero: um quebra-cabeça de encaixar peças em um tabuleiro, escolhendo as peças em vez de caírem sozinhas.
- Modo cronometrado de 2 minutos para ranking. Retrato do personagem reagindo no HUD (nível B).
- Não usar o nome "Tetris" em lugar nenhum.

### 10.11 G11 - Arena em primeira pessoa (ideia do CEO, última onda)

**Inspiração geral:** FPS clássico em raycasting.

- Fica depois dos outros jogos, por: peso do jogo, desempenho em celular simples, controle por toque mais difícil e conteúdo violento.
- Se for feito: jogo **original**, com mapa pequeno, resolução interna baixa (por exemplo 320x180) ampliada, controle por toque com joystick à esquerda, arrastar para olhar à direita e tiro automático, sessão de 2 minutos em ondas, **sem sangue**, com inimigos temáticos. As mãos do jogador usam a cor da pele e da manga do personagem (visão `fp_hands`).
- **Não usar assets do Doom nem o nome.** O projeto Freedoom (licença BSD) permite uso comercial com cópia da licença junto da distribuição e crédito ao projeto. Mesmo assim, para a marca da Flix, assets próprios são preferíveis.
- Motores do Doom em WebAssembly são GPL: ao distribuí-los é preciso disponibilizar o código-fonte do motor. Só com aprovação do jurídico.

### 10.12 G12 - Corrida top-down em pixel art

**Inspiração geral (gênero):** corridas retrô de visão de cima, com pistas curtas, bônus e armas leves. A referência (Pixel Wheels) tem código GPL e arte CC BY-SA, então **nada dela é reaproveitado**.

- Controle por toque: arrastar para esquerda e direita para virar, aceleração automática, um botão para o bônus.
- 3 pistas curtas de 40 a 60 segundos cada, com tema de cidade e de obra de fibra. Adversários simples controlados por IA.
- Bônus sem violência (por exemplo turbo e escudo), em vez de armas.
- O piloto usa o personagem personalizado (retrato no HUD, cabeça aparecendo no carro). A cor principal do personagem pinta o carro.
- **Ranking:** melhor tempo de volta por pista.
- Diferenciais (mínimo cinco): pistas e carros próprios, bônus de fibra e sinal, piloto personalizado, interface e sons próprios, regras próprias de derrapagem e turbo.

### 10.13 G13 - Futebol de cabeça 1 contra 1

**Inspiração geral (gênero):** partida curta de 1 contra 1 em que personagens de cabeça grande empurram a bola com a cabeça e com o chute. As referências são o Head-Ball-Game (sem licença) e o gênero Head Ball (jogos comerciais).

- Controles de toque: botões de esquerda e direita, pulo e chute. Adversário controlado por IA, com níveis de dificuldade.
- **O jogador é o personagem personalizado, com a cabeça em destaque.** Isso torna o personalizar do hub muito visível neste jogo.
- Partida de 2 minutos, com placar. Estádio e bola próprios, tema de campo de bairro ou de cidade.
- **Ranking:** gols em 2 minutos contra a IA, ou vitórias seguidas, a decidir com o time.
- Diferenciais (mínimo cinco): personagem do jogador com cabeça grande, modos de partida curtos, poderes temporários de sinal (por exemplo "turbo de fibra"), estádio e interface próprios, regras de gol e de chute próprias.
- **Riscos:** não usar nomes, avatares, arenas, bolas, interface ou sons dos Head Ball existentes (seção 2.2).

### 10.14 G14 - Descida em espiral

**Inspiração geral (gênero):** uma bola que cai por uma torre girando, passando por brechas e desviando de áreas perigosas. A referência (Helix-Jump) é um clone 3D em Unity, e o jogo original é da Voodoo.

- Visual em pixel art 2D, com a torre desenhada em pseudo-3D de camadas, e não em 3D. Isso é mais leve no celular.
- Controle de um dedo: arrastar para girar a torre. Fases curtas, com velocidade que sobe.
- A bola deixa um rastro na cor do personagem, e o retrato do personagem reage à vitória e à derrota.
- **Ranking:** andares descidos em uma partida só.
- Diferenciais (mínimo cinco): torre de cabos e antenas em vez da torre colorida do original, áreas perigosas com desenho próprio, bônus de sinal que dá escudo, cenário que muda a cada marco, interface, sons e paleta próprios.
- **Riscos:** não usar bola, cores das plataformas, torre, nome e sons do original (seção 2.2).

### 10.15 G15 - Cesta de um toque (de aro em aro)

**Inspiração geral (gênero):** uma bola que salta de aro em aro, com toque e arrasto para mirar. As referências são o Dunkshot (clone de aprendizado, sem licença) e o Dunk Shot (jogo comercial da Ketchapp/Estoty).

- **O personagem personalizado é quem salta de aro em aro**, em vez de uma bola (visão `side`, animação `fly`). Isso afasta o jogo do original e usa o personagem do hub.
- Controle de um dedo: segurar e arrastar para mirar, soltar para lançar. Arcos curtos, paredes que quicam, aros que se movem em níveis mais altos.
- Perde ao cair fora da tela. Sessão de 1 a 3 minutos.
- **Ranking:** pontos por cesta com bônus de sequência de lançamentos perfeitos.
- Diferenciais (mínimo cinco): personagem do jogador, aros em forma de roteador ou antena, bônus de sinal, cenário de cidade, interface, sons e regras de pontuação próprios.
- **Riscos:** não usar bola laranja, aro, rede, ícones, paleta, nome e sons do original (seção 2.2).

---

## 11. Ficha de gameplay (template)

Uma ficha por jogo, preenchida pelo observador, em `docs/GAMEPLAY_SHEETS/<jogo>.md`. Escrever com palavras próprias. **Não copiar** nomes de personagens, textos do jogo, números exatos que sejam parte da expressão do jogo, nem anexar prints ou sprites.

```
# Ficha de gameplay - <nome interno do nosso jogo>

Referência observada: <nome, URL>          (esta linha não é entregue ao agente)
Observador: <nome>      Revisor: <nome>      Data: <data>
Dispositivos usados na observação: <celular/computador>

## 1. Loop principal
Descrever em 3 a 5 frases o que o jogador faz do começo ao fim de uma partida.

## 2. Controles
O que cada toque, gesto ou botão faz. O que parece bom e o que parece ruim no celular.

## 3. Regras e condições de fim
Como se perde, como se ganha, o que dá pontos.

## 4. Progressão e dificuldade
Como a dificuldade muda ao longo da partida. Quanto tempo leva até ficar difícil.

## 5. Ritmo e duração
Duração típica de uma partida. Quanto tempo leva para recomeçar.

## 6. Feedback ao jogador (em termos genéricos)
Que tipos de resposta o jogo dá (som, tremor de tela, pontos subindo) e como isso torna o jogo mais viciante.

## 7. O que NÃO vamos fazer igual
Lista dos elementos específicos da referência que vamos evitar (personagens, cenários, interface, sons, nomes).

## 8. Nossos diferenciais (mínimo cinco)
1.
2.
3.
4.
5.

## 9. Pontos de melhoria que queremos
Onde acreditamos que dá para ficar melhor que a referência.

## 10. Métrica de ranking proposta
O que será medido e como decidir empates.

## 11. Uso do personagem
Nível (A ou B), visões usadas (side, top, portrait, fp_hands) e animações necessárias.
```

O agente deve receber a ficha **sem** a linha "Referência observada" e sem a seção 7, que contém detalhes da referência.

---

## 12. Plano de hoje (jogo G01 e base do personagem)

Siga na ordem. Em cada passo, termine com algo que roda e pode ser testado. Em caso de dúvida que não impeça o avanço, escolha o padrão deste documento, registre em `docs/DECISIONS.md` e siga.

1. **Preparar o repositório.** Criar a estrutura da seção 5, `README.md`, `ASSETS.md`, `LICENSES/` e `docs/DECISIONS.md`. Registrar a stack escolhida.
2. **Criar o projeto do jogo** em `games/runner` com Phaser 3, TypeScript e Vite. Configurar escala em modo fit, resolução lógica 480x270, `pixelArt: true`, fundo fixo e canvas centralizado. Verificar que roda em `npm run dev` e que `npm run build` gera arquivos estáticos que funcionam em subcaminho (base relativa). Criar o `game.json` do jogo.
3. **Criar o `packages/flix-game-sdk`** com a ponte de mensagens (seção 6, versão 2 do contrato), e a página `dev-host.html` que simula o hub com um personagem de teste, um anúncio falso e o botão de restart.
4. **Criar o esqueleto do `packages/flix-avatar`:** o tipo `AvatarConfig`, o esquema de `catalog.json` e `palettes.json`, o arquivo `animations.json` e `docs/AVATAR_SPEC.md`. Incluir um personagem padrão feito com placeholder CC0.
5. **Assets de placeholder.** Baixar o pacote CC0 do Kenney, registrar no `ASSETS.md` e `LICENSES/`, criar o `assets.manifest.json` e carregar tudo por chaves lógicas. O personagem entra pela chave `player`, vinda do pacote de personagem.
6. **Cenas do jogo:** Boot, Preload (barra de progresso), Menu (tocar para começar), Play, GameOver.
7. **Mecânica do runner** conforme a seção 10.1, incluindo o gerador de obstáculos com a regra de justiça, a rampa de dificuldade, os coletáveis e a pontuação.
8. **Integração com o hub:** enviar `ready` (com `capabilities`), receber `init`, enviar `started` e `gameover`, esperar `restart`, tratar `pause`, `resume` e `mute`, pausar no `visibilitychange`.
9. **Controles de toque:** toque em qualquer lugar da tela para pular, sem exigir zona específica. Impedir rolagem e zoom. Testar com teclado (barra de espaço) como bônus.
10. **Persistência local opcional:** guardar o melhor resultado em `localStorage` dentro de `try/catch`, só como conveniência. O ranking oficial é do hub.
11. **Testar em celular real** pela rede local (`vite --host`): toque, fluidez, tamanho do build, retomada ao voltar para a aba. Registrar em `docs/TEST_REPORTS/runner-01.md`, seguindo o padrão de relatório de testes da equipe de TI.
12. **Preparar as próximas ondas:** escrever com o Tobias as fichas de gameplay de G02 e G03 (seção 11), e abrir o briefing do designer (seção 8.2) com o **kit do personagem como prioridade 1** (seção 9.7). Enviar ao Rafael o `docs/HUB_CONTRACT.md` e o `docs/AVATAR_SPEC.md`.
13. **Fechar o dia** com um resumo em `docs/DECISIONS.md`: o que foi feito, o que ficou pendente, riscos e perguntas.

---

## 13. Critérios de aceite do jogo G01

- Roda em celular Android de entrada a pelo menos 30 FPS estáveis, sem travar na troca de aba.
- Uma pessoa que nunca viu o jogo entende como jogar sem instrução, só tocando.
- O primeiro obstáculo nunca é impossível, e nenhum obstáculo é impossível em nenhuma velocidade.
- O restart acontece em menos de 1 segundo depois da mensagem `restart`.
- O `gameover` envia `score`, `durationMs` e `runId` válidos.
- O jogo funciona com e sem o `init` do hub (com personagem recebido e com o personagem padrão).
- O build é estático, funciona em subcaminho e não faz nenhuma requisição externa.
- `ASSETS.md` e `LICENSES/` cobrem 100% dos arquivos usados.
- A ficha de gameplay do jogo existe e lista pelo menos cinco diferenciais.
- O relatório de teste foi escrito.

---

## 14. Teste e publicação (checklist por jogo)

**Antes de publicar**
- [ ] Todos os arquivos estão em `ASSETS.md` com licença válida para uso comercial.
- [ ] Nenhum nome, personagem, texto, som ou fase de terceiros.
- [ ] Os cinco diferenciais estão implementados e visíveis.
- [ ] Para G02, G03, G04, G05, G10, G13, G14 e G15: revisão específica do jurídico (seção 2.2).
- [ ] O personagem personalizado aparece corretamente no nível previsto (A ou B), com configuração recebida e com o padrão.
- [ ] Página de créditos e licenças preparada (atribuições exigidas por CC-BY, MIT e outras).
- [ ] Revisão do jurídico da Flix.
- [ ] Teste em pelo menos dois celulares reais (um simples) e em dois navegadores.
- [ ] Peso do build medido e dentro da meta.
- [ ] Contrato com o hub testado com o Rafael, de ponta a ponta.
- [ ] Ranking testado com pontuação inválida (negativa, enorme, repetida).

**Publicação**
- Gerar o build, publicar em `/games/<id>/` e embutir no hub por iframe.
- Usar versão no nome da pasta ou cabeçalhos de cache adequados para atualizar sem quebrar quem está jogando.

---

## 15. Perguntas em aberto (para Tobias e Rafael decidirem)

1. Confirmam Phaser 3 + TypeScript + Vite como padrão, ou preferem GDevelop?
2. Onde ficará o repositório (conta e organização) e quem revisa o código?
3. Quem fornece as cores, o logo e o manual de marca da Flix, e quem é o designer dos assets e do kit do personagem?
4. O runner será em paisagem (padrão) ou retrato? Depende de como o hub exibe o iframe no celular.
5. O ranking será geral, diário ou semanal? Quantas posições o cliente vê?
6. O anúncio aparece a cada game over ou a cada N partidas?
7. O jurídico da Flix precisa revisar a política de uso de apelidos, de anúncios e de dados do personagem?
8. Quem confirma a licença dos itens "não verificados" da seção 3 (e contata o Wishforge e o Silver-Streak, se for usar algo deles)?
9. **Personagem:** o perfil do jogador fica ligado à conta do cliente ou é anônimo (só apelido)? Onde o hub guarda o personagem?
10. **Personagem:** quais itens e skins desbloqueiam por conquista (por exemplo ranking semanal)? Há skins temáticas de campanhas da Flix?
11. **Personagem:** quantos corpos, cabelos e roupas entram na fase 1? Os números da seção 9.4 são só propostas.
12. **Jurídico:** quando o Tetris-like pode ser avaliado? Os outros clássicos e os jogos inspirados em apps comerciais (G02, G04, G05, G13, G14, G15) podem seguir com as medidas da seção 2.2?
13. As "8 referências citadas" da seção 10.0 estão certas? Se o time contou outras oito, ajustar o mapeamento.
14. As 4 referências novas (Pixel Wheels, Head-Ball-Game, Helix-Jump, Dunkshot) são só inspiração mesmo? O Pixel Wheels tem licença GPL e CC BY-SA, e os outros três não têm licença confirmada. Se alguém quiser aproveitar algo, o jurídico precisa avaliar antes.

---

## 16. Fontes consultadas

- GDevelop, 2D Endless Runner: https://gdevelop.io/game-example/free/starting-endless-runner
- GDevelop, 2D Platformer Shooter: https://gdevelop.io/game-example/free/starting-2d-platformer-shooter
- Repositório de exemplos do GDevelop (licença MIT salvo indicação contrária): https://github.com/badgids/gdevelop-examples
- The Duck Game (CC0): https://goodgis.itch.io/duck-game-asset-pack
- Advanced Platformer Template (Unlicense e CC0): https://ayitzmatt.itch.io/advanced-platformer-template-gdevelop
- 2D Platformer Demo (MIT e CC0): https://duncanscott.itch.io/2d-platformer-demo-gdevelop
- GDevelop 2D Shooter Platformer Example (Wishforge): https://wishforge.itch.io/gdevelop-2d-shooter-platformer-example
- Not-A-Vania Redux: https://silver-streak.itch.io/not-a-vania-redux
- expo-crossy-road: https://github.com/evanbacon/expo-crossy-road
- metal-slug-js: https://github.com/FernandoBade/metal-slug-js
- Pixel Mini Golf: https://www.bubbleshooter.net/game/pixel-mini-golf/
- ufocoder/fps: https://github.com/ufocoder/fps
- Endless_Runner_Game: https://github.com/faizankhan1428/Endless_Runner_Game
- Pixel Wheels: https://github.com/agateau/pixelwheels
- Head-Ball-Game: https://github.com/rezaul-code/Head-Ball-Game
- Helix-Jump (Rizwanhu): https://github.com/Rizwanhu/Helix-Jump
- Dunkshot (nassimassb): https://github.com/nassimassb/Dunkshot
- Kenney, assets CC0: https://kenney.nl/support
- Freedoom (licença BSD): https://freedoom.github.io/about.html
- Tetris Holding v. Xio Interactive (caso de look and feel): https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.
- Resumo do caso Tetris por escritório de advocacia: https://www.loeb.com/en/insights/publications/2012/06/tetris-holding-llc-v-xio-interactive-inc
- Discussão sobre clones e Flappy Bird (opinião de desenvolvedores): https://itch.io/post/1331643
- Clones e litígio em videogames (Breakout, Arkanoid, outros casos): https://medium.com/patents-technology-law/clones-wars-video-game-litigation-illustrated-36682abb4d68
- Discussão sobre direitos de Frogger (opinião de desenvolvedor, não oficial): https://gamedev.net/blogs/entry/2265564-intellectual-property-and-clone-games
