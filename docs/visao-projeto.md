# FLIX Games — contexto e propostas

Data: 13/11/2026. Etiquetas de evidência: [F] observado; [C] confirmado por pessoa ou teste; [REL] relato não verificado; [H] hipótese/proposta; [D] desconhecido; [X] contradição.

## 1. Origem e objetivo

- [F] O README original descrevia somente: “Jogos da Flix fibra para clientes”. A inspeção da branch `Principal`, no commit `fe898e5776c745871e71a131f99bf7f0beedfad2`, encontrou apenas esse arquivo.
- [C] O solicitante quer uma entrada Games no site/aplicativo FLIX que leve a um portal com diversos jogos exclusivos para clientes e rankings entre jogadores. Confirmação: solicitação inicial nesta conversa, em 13/11/2026.
- [C] O solicitante pediu planejamento com pelo menos duas arquiteturas e estudo da integração com a conta FLIX, sem construir a aplicação nesta etapa.
- [C] A referência visual fornecida mostra navegação do PS5: capas horizontais, item selecionado destacado, fundo relacionado e cartões. É uma referência de experiência; não confirma disponibilidade dos títulos mostrados.
- [F] O primeiro print mostra o menu do site institucional. [D] O local equivalente e o modo de abertura no aplicativo ainda não foram inspecionados.
- [REL] O sistema de clientes está em ambiente diferente do servidor previsto para Games. [D] Fornecedor, APIs, autenticação e capacidade de alteração não foram informados.
- [C] A equipe será pequena e sem donos fixos por área. Qualquer pessoa ou IA pode continuar uma fase.

As capturas foram fornecidas na conversa e não estão versionadas aqui. [D] Falta disponibilizar referências aprovadas e ativos oficiais no repositório ou em um destino acessível à equipe.

## 2. Limites do escopo

| Classificação | Conteúdo |
|---|---|
| [C] Direção solicitada | Entrada Games, portal com experiência de console e identidade FLIX, catálogo para clientes, rankings e integração de identidade entre sistemas |
| [C] Trabalho autorizado agora | Documentar contexto, alternativas, perguntas e estado do projeto; não desenvolver a aplicação |
| [D] A definir para a primeira versão | Jogos, público elegível, suporte a dispositivos, critérios de ranking, ambiente, orçamento, prazo e aceite |
| [H] Ideias a avaliar | Favoritos, continuar jogando, conquistas, XP, temporadas, desafios, perfis familiares, ranking regional, duelos, votação de jogos |
| [H] Etapas futuras possíveis | Chat, prêmios, torneios e multiplayer; somente entram no plano de execução após aprovação explícita |

Uma sugestão não constitui requisito aprovado. A conclusão do produto será definida pelo aceite do escopo da primeira versão; não há promessa de prazo, capacidade ou quantidade de jogos.

## 3. Arquitetura A — aplicação modular própria

[H] Indicada inicialmente se o catálogo for de jogos casuais de navegador, predominantemente individuais, com resultados e rankings.

| Componente proposto | Função |
|---|---|
| Portal React + TypeScript | Navegação, catálogo, perfil e apresentação de rankings |
| API FastAPI | Identidade, elegibilidade, partidas, validação, rankings e administração |
| PostgreSQL | Dados persistentes, partidas e resultados |
| Armazenamento de arquivos + CDN | Distribuição de versões dos jogos, capas e ativos |
| Worker, quando necessário | Integrações e tarefas demoradas |
| Redis, se justificado | Cache, limites ou coordenação; não é dependência obrigatória inicial |

[H] A API teria módulos de identidade/elegibilidade, catálogo, jogadores, partidas/resultados, rankings e administração. Um SDK pequeno padronizaria o diálogo dos jogos com o backend. Jogos terceiros seriam isolados do portal e receberiam apenas autorização limitada à partida.

[H] Benefício: menos componentes para operar e controle das regras do produto. Limitação: salas, reconexão e multiplayer complexo exigiriam construção adicional. A validação de resultados continua sendo específica de cada jogo.

## 4. Arquitetura B — portal com servidor especializado em games

[H] Indicada se os primeiros jogos exigirem partidas simultâneas entre clientes, presença, matchmaking e torneios frequentes.

| Componente proposto | Função |
|---|---|
| Portal FLIX Games | Catálogo, experiência visual e perfil |
| Backend de integração FLIX | Confirmação da identidade e do direito ao benefício |
| Servidor de games, candidato Nakama | Recursos de partidas, presença e rankings |
| Código de regras por jogo | Estado da partida, ações permitidas e validação do resultado |
| Banco, arquivos e operação | Persistência, distribuição, administração e monitoramento |

[H] Benefício: uma base especializada para partidas e competição. Limitação: mais componentes, novas competências e fronteiras de dados a manter. O servidor de games não substitui a integração de clientes nem implementa sozinho as regras dos jogos.

Referências técnicas para avaliar o candidato, sem homologação realizada:

- [Partidas autoritativas do Nakama](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/).
- [Rankings do Nakama](https://heroiclabs.com/docs/nakama/concepts/leaderboards/).

## 5. Comparação e decisão pendente

| Critério | A: aplicação modular | B: servidor de games |
|---|---|---|
| [H] Melhor encaixe | Jogos casuais e validação inicial | Multiplayer como parte central |
| [H] Operação inicial | Menos componentes | Mais componentes |
| [H] Integração com clientes | Backend FLIX | Backend FLIX |
| [H] Recursos competitivos | Desenvolvidos no backend próprio | Recursos da plataforma + regras próprias |
| [D] Custo, prazo e capacidade | Medir após catálogo e carga definidos | Medir após catálogo e carga definidos |

[H] Recomendação preliminar: A se os jogos forem casuais; B se houver multiplayer relevante desde o lançamento. [D] Não há arquitetura, stack ou banco aprovados. A decisão deve ser registrada com alternativas, motivo, impactos e critérios de revisão em `docs/architecture/` quando tomada. Esse diretório ainda não existe.

## 6. Identidade e elegibilidade

[H] A autenticação responde quem é o cliente. A elegibilidade responde se seu contrato/plano permite jogar neste momento. Tratar as duas separadamente.

| Alternativa proposta | Dependência externa | Como funcionaria |
|---|---|---|
| [H] SSO por OpenID Connect | Provedor oferece integração compatível | Redirecionamento ao provedor, confirmação validada e sessão própria Games |
| [H] Passagem por código temporário | Fornecedor consegue implementar integração segura | Código opaco, curto e de uso único, trocado entre servidores e vinculado à tentativa de acesso |
| [H] Conta Games vinculada | Consulta de clientes e comprovação do vínculo disponíveis | Verificação por canal cadastrado e associação a um identificador estável |

[H] Preferir fluxo padronizado Authorization Code com PKCE se suportado. Não copiar senhas de clientes, compartilhar cookies entre sistemas por conveniência ou tratar CPF/número do contrato no link como prova de login. CORS não transfere autenticação entre sistemas.

Referências: [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) e [OAuth Security BCP — RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).

[D] Precisamos confirmar reaproveitamento de sessão no navegador/app, contrato de APIs, identificadores, múltiplos contratos, cancelamento, suspensão, indisponibilidade, revogação e logout. Não presumir que o site institucional e o Minha Flix compartilham autenticação.

## 7. Jogos e rankings

[H] Cada título deverá ter ficha com origem, direito de distribuição, execução, dispositivos, controles, peso dos arquivos, persistência, pontuação e possibilidade de validação. Jogos de navegador, links externos, multiplayer e streaming de PC/console têm integrações e custos diferentes.

[H] A hipótese inicial é um catálogo pequeno, com 3 a 5 jogos de navegador. Quantidade e títulos não aprovados. Os jogos do print não são parte confirmada do catálogo.

[H] Para ranking confiável: partida identificada pelo servidor; autorização limitada; resultado validado; prevenção de reenvio; regras por versão/modo; desempate publicado; histórico e revisão auditável. Um token válido não torna verdadeira uma pontuação enviada pelo navegador. Competição de maior risco pode exigir reconstituição da partida ou regras executadas no servidor.

[H] Separar pontuação do jogo de XP da plataforma. Não somar diretamente pontuações de jogos diferentes sem uma regra de classificação comum aprovada. [D] Temporadas, prêmios, revisão e visibilidade pública dependem de decisão.

## 8. Experiência e operação propostas

[H] Tela inicial: destaque, catálogo por categorias, jogos recentes e desempenho. Adaptar a referência de console para toque, teclado, foco visível e aparelhos simples; evitar carregar todos os jogos na abertura.

[H] Separar contrato FLIX de perfil de jogador para permitir mais de uma pessoa por residência, se aprovado. Exibir apelido/avatar no ranking; manter dados contratuais privados. Classificação etária, menores e retenção de dados precisam de definição antes de habilitar esses públicos e recursos.

[H] Administração: publicação de jogos, temporadas, consulta de falhas, revisão de resultados e permissões de suporte. Operação: homologação separada, monitoramento, controle de custos e reversão.

[C] Requisito do solicitante: backup completo, datado e validado antes de alterações no sistema/servidor. [H] Ao existir banco, usar backup consistente, verificar integridade e testar restauração. Nunca incluir segredos em documentos ou versionar backups de dados de clientes.

## 9. Organização proposta do repositório

Estes caminhos são [H] propostas; não descrevem código já existente.

| Caminho proposto | Conteúdo |
|---|---|
| `apps/portal/` | Interface |
| `apps/api/` | API e integração FLIX |
| `apps/worker/` | Processamento assíncrono, se necessário |
| `games/` | Jogos próprios |
| `packages/game-sdk/` | Biblioteca de integração |
| `packages/contracts/` | Esquemas e contratos de mensagens |
| `infra/` | Ambientes e implantação |
| `docs/architecture/` | Decisões técnicas |
| `docs/integrations/` | Integrações documentadas |
| `docs/operations/` | Backup, restauração e incidentes |
| `.github/` | Fluxo de contribuição e verificações |

[H] Na alternativa B, acrescentar o código de regras do servidor de games. Definir versões e comandos somente após a decisão técnica. Proteger a branch principal e usar revisões sem criar donos fixos por área.

## 10. Fontes e limites da inspeção

- [F] Inspeção remota de README, árvore recursiva completa, branches e histórico em 13/11/2026: somente `Principal`, commit inicial `fe898e5776c745871e71a131f99bf7f0beedfad2`, README de 49 bytes.
- [F] Não existiam `CLAUDE.md`, `AGENTS.md`, código, testes, migrações, scripts ou configuração de deploy na árvore inspecionada.
- [D] Nenhum servidor, conta de cliente, API externa, aplicativo em execução ou ambiente de produção foi acessado.
- [D] A inspeção via GitHub não demonstra o `git status` de máquinas dos colaboradores nem trabalho não enviado ao repositório.
- [C] Os requisitos vieram da conversa de 13/11/2026; as propostas técnicas foram apresentadas pelo assistente e ainda dependem de decisão do projeto.

O estado atual e as respostas devem ser mantidos em [andamento.md](andamento.md). Este arquivo preserva contexto e alternativas, sem substituir o painel de execução.
