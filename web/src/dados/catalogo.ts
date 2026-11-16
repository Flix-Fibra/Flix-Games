import type { Conquista, Jogo } from './tipos';

// Catálogo de exemplo. Nomes próprios: o catálogo real depende da Q11/Q12 (licenças).
export const JOGOS: Jogo[] = [
  { id: 'voo', nome: 'Voo Flix', genero: 'Habilidade · 1 jogador', c1: '#f59e0b', c2: '#b45309', ranking: true, unidade: 'obstáculos',
    desc: 'Toque para voar e passe pelo maior número de obstáculos sem bater. Partidas rápidas, perfeitas para o intervalo.', tamanho: '1,2 MB' },
  { id: 'labirinto', nome: 'Labirinto Sombrio', genero: 'Ação · 1 jogador', c1: '#b91c1c', c2: '#450a0a', ranking: true, unidade: 'pontos',
    desc: 'Atravesse corredores escuros, encontre as chaves e chegue à saída. Funciona com controle.', tamanho: '9,8 MB', controle: true },
  { id: 'soma', nome: 'Soma 2048', genero: 'Quebra-cabeça · 1 jogador', c1: '#eab308', c2: '#a16207', ranking: true, unidade: 'pontos',
    desc: 'Junte peças iguais até chegar ao 2048. Seu progresso fica salvo para continuar em outro aparelho.', tamanho: '0,4 MB' },
  { id: 'cobrinha', nome: 'Cobrinha', genero: 'Clássico · 1 jogador', c1: '#22c55e', c2: '#14532d', ranking: true, unidade: 'pontos',
    desc: 'Coma, cresça e não encoste no próprio rabo. O clássico que roda em qualquer celular.', tamanho: '0,3 MB', controle: true },
  { id: 'blocos', nome: 'Blocos em Queda', genero: 'Quebra-cabeça · 1 jogador', c1: '#8b5cf6', c2: '#3b0764', ranking: true, unidade: 'linhas',
    desc: 'Encaixe os blocos e complete linhas antes que a pilha chegue ao topo.', tamanho: '0,6 MB', controle: true },
  { id: 'corrida', nome: 'Corrida Infinita', genero: 'Corrida · 1 jogador', c1: '#06b6d4', c2: '#164e63', ranking: true, unidade: 'metros',
    desc: 'Desvie, pule e colete moedas pelo maior percurso que conseguir.', tamanho: '3,1 MB' },
  { id: 'paciencia', nome: 'Paciência', genero: 'Cartas · 1 jogador', c1: '#e11d48', c2: '#4c0519', ranking: false,
    desc: 'O jogo de cartas mais conhecido, sem pressa. Este jogo não tem ranking.', tamanho: '0,8 MB' },
  { id: 'memoria', nome: 'Memória', genero: 'Raciocínio · 1 jogador', c1: '#ec4899', c2: '#831843', ranking: false,
    desc: 'Vire as cartas e encontre os pares. Treine a memória em partidas curtas.', tamanho: '0,5 MB' },
];

export const CONQUISTAS: Conquista[] = [
  { nome: 'Primeira partida', desc: 'Jogue qualquer jogo' },
  { nome: 'Top 5', desc: 'Entre no top 5 de um jogo' },
  { nome: 'Voo longo', desc: '50 obstáculos no Voo Flix' },
  { nome: 'Persistente', desc: 'Jogue 7 dias seguidos' },
  { nome: 'Colecionador', desc: 'Jogue 5 jogos diferentes' },
  { nome: 'Lenda', desc: 'Seja 1º em um ranking' },
];

export const MAX_PERFIS = 2;
export const CORES_PERFIL = ['#D2232A', '#2773D2', '#7654C4', '#15803D'];
