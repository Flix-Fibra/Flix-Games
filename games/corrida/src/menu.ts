import { renderHudText } from '@flix/game-kit/src/hudFont';
import type { PistaDef } from './pistas';

/**
 * Menu do Flix Grid (pedido do solicitante, 25/11/2026): ao abrir, o jogador escolhe Campeonato (as 24 pistas em ordem
 * sorteada) ou Corrida livre (escolhe a pista vendo o traçado). É uma camada HTML por cima do jogo: a lista rola com o
 * dedo no celular e, no computador, anda com as setas, Tab e Enter. As letras são a fonte pixel da plataforma.
 */

export type Escolha = { modo: 'campeonato' } | { modo: 'livre' | 'treino'; pista: number };

const CSS = `
.fg-menu{position:fixed;inset:0;z-index:10;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;
  background:rgba(8,9,12,.88);color:#F5F5F7;font:14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  padding:max(20px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));box-sizing:border-box;-webkit-user-select:none;user-select:none}
.fg-menu *{box-sizing:border-box}
.fg-wrap{max-width:1080px;margin:0 auto;display:grid;gap:18px}
.fg-px{display:block;max-width:100%;image-rendering:pixelated;image-rendering:crisp-edges}
.fg-topo{display:grid;justify-items:center;gap:6px;margin-top:8px}
.fg-sub{color:#A3A8B2;margin:0;text-align:center}
.fg-modos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.fg-btn{appearance:none;border:2px solid rgba(255,255,255,.12);background:rgba(16,18,23,.95);color:inherit;cursor:pointer;
  border-radius:0;clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px);
  padding:14px 16px;text-align:left;display:grid;gap:8px;min-height:44px;font:inherit}
.fg-btn:hover,.fg-btn:focus-visible{border-color:#FFC83D;outline:none;background:rgba(28,30,36,.98)}
.fg-btn[aria-pressed="true"]{border-color:#FFC83D}
.fg-modo{border-left:6px solid #D4142C}
.fg-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.fg-pista{justify-items:center;text-align:center;padding:10px}
.fg-pista canvas.fg-tracado{width:100%;height:auto;aspect-ratio:8/5}
.fg-num{color:#A3A8B2;font-size:12px}
.fg-menu.abertura{background:linear-gradient(rgba(8,9,12,.15),rgba(8,9,12,.35) 45%,rgba(8,9,12,.8))} /* a pista aparece ao fundo */
.fg-abertura{min-height:100%;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;gap:12px;text-align:center}
.fg-abertura .fg-voltar{justify-self:start}
.fg-abertura-meio{display:grid;place-content:center;justify-items:center;gap:14px}
.fg-jogar{appearance:none;border:0;cursor:pointer;background:#FFC83D;padding:16px 56px;min-height:56px;
  clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px);
  box-shadow:0 6px 0 #B8860B;transition:transform .1s}
.fg-jogar:hover,.fg-jogar:focus-visible{outline:none;filter:brightness(1.08)}
.fg-jogar:active{transform:translateY(3px)}
.fg-dica{color:#C9CDD4;margin:0;text-shadow:0 1px 2px #000}
.fg-voltar{justify-self:start;padding:8px 14px;grid-auto-flow:column;align-items:center}
.fg-girar{position:fixed;inset:0;z-index:11;display:grid;place-content:center;justify-items:center;gap:14px;background:rgba(8,9,12,.94);color:#A3A8B2;text-align:center;padding:24px}
.fg-acoes{position:fixed;left:50%;top:76%;transform:translateX(-50%);z-index:10;display:flex;gap:12px} /* abaixo do resultado, acima da barra de teclas */
.fg-acoes .fg-btn{padding:12px 22px;justify-items:center;min-width:120px}
[hidden]{display:none!important}
`;

/** Texto na fonte pixel, como imagem nítida (cada pixel da letra = `escala` pixels de CSS). Maiúsculas, como no placar. */
function letras(texto: string, escala: number, cor = '#F5F5F7', contorno = '#101217'): HTMLCanvasElement {
  const c = renderHudText(texto.toUpperCase(), cor, contorno);
  c.className = 'fg-px';
  c.style.width = `${c.width * escala}px`;
  c.style.height = 'auto'; // com max-width:100%, nome comprido (Spa-Francorchamps) encolhe para caber no cartão
  c.setAttribute('aria-hidden', 'true');
  return c;
}

/** Desenho do traçado (linha central) para o cartão da pista. */
function tracado(def: PistaDef): HTMLCanvasElement {
  const W = 320, H = 200, m = 16;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.className = 'fg-tracado';
  c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d')!;
  const xs = def.pontos.map((p) => p[0]), ys = def.pontos.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const e = Math.min((W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m) / Math.max(1, y1 - y0));
  const ox = (W - (x1 - x0) * e) / 2 - x0 * e, oy = (H - (y1 - y0) * e) / 2 - y0 * e;
  const linha = (larg: number, cor: string) => {
    g.beginPath();
    def.pontos.forEach((p, i) => (i ? g.lineTo(ox + p[0] * e, oy + p[1] * e) : g.moveTo(ox + p[0] * e, oy + p[1] * e)));
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = larg;
    g.strokeStyle = cor;
    g.stroke();
  };
  linha(11, '#000000');
  linha(6, '#D8DCE4');
  const p0 = def.pontos[0]!;
  g.fillStyle = '#D4142C';
  g.fillRect(ox + p0[0] * e - 5, oy + p0[1] * e - 5, 10, 10); // largada
  return c;
}

function botao(classe: string, rotulo: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `fg-btn ${classe}`;
  b.setAttribute('aria-label', rotulo);
  return b;
}

/**
 * Celular: tela cheia e tela deitada. Funciona no Android (Chrome); o iPhone não deixa uma página entrar em tela cheia
 * nem girar a tela, e aí o jogo só pede para deitar o aparelho (avisoGirar). Erros são ignorados de propósito.
 */
function telaCheiaDeitada(): void {
  if (!matchMedia('(pointer: coarse)').matches) return; // computador: sem tela cheia automática
  const el = document.documentElement;
  const pedir = !document.fullscreenElement && el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.resolve();
  void pedir
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}

export class MenuCorrida {
  private readonly raiz: HTMLDivElement;
  private readonly acoes: HTMLDivElement;
  private readonly grade: HTMLDivElement;
  private readonly btnLivre: HTMLButtonElement;
  private readonly btnTreino: HTMLButtonElement;
  /** Modo que abriu a grade de pistas (corrida livre ou treino). */
  private modoGrade: 'livre' | 'treino' = 'livre';
  private aoEscolher: ((e: Escolha) => void) | null = null;
  private readonly girar: HTMLDivElement;
  /** Duas telas: a abertura (título + JOGAR, com a pista ao fundo) e a escolha do modo. */
  private readonly telaAbertura: HTMLDivElement;
  private readonly telaModos: HTMLDivElement;

  /** `aoSair`: volta ao hub (o jogo é imersivo: a barra do hub some, este é o único jeito de sair). */
  constructor(pistas: readonly PistaDef[], aoSair: () => void) {
    if (!document.getElementById('fg-menu-css')) {
      const st = document.createElement('style');
      st.id = 'fg-menu-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const escala = window.innerWidth < 500 ? 2 : 3;
    // abertura: título e JOGAR crescem com a altura da tela (no computador ficavam pequenos)
    const grande = Math.max(escala + 1, Math.round(window.innerHeight / 140));
    this.raiz = document.createElement('div');
    this.raiz.className = 'fg-menu';
    this.raiz.setAttribute('role', 'dialog');
    this.raiz.setAttribute('aria-label', 'Flix Grid: escolha o modo de jogo');
    this.raiz.hidden = true;
    const wrap = document.createElement('div');
    wrap.className = 'fg-wrap';

    const voltar = botao('fg-voltar', 'Voltar ao hub');
    voltar.append(letras('VOLTAR AO HUB', 2));
    voltar.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      aoSair();
    });

    // abertura: título grande, JOGAR e a pista de verdade passando ao fundo (o jogo desenha atrás desta camada)
    this.telaAbertura = document.createElement('div');
    this.telaAbertura.className = 'fg-abertura';
    const meio = document.createElement('div');
    meio.className = 'fg-abertura-meio';
    const jogar = document.createElement('button');
    jogar.type = 'button';
    jogar.className = 'fg-jogar';
    jogar.setAttribute('aria-label', 'Jogar');
    jogar.append(letras('JOGAR', grande, '#1A1206', '#FFC83D')); // contorno da cor do botão: letra escura limpa
    jogar.addEventListener('click', () => {
      telaCheiaDeitada(); // no toque do jogador: o navegador só deixa assim
      this.mostrar('modos');
    });
    const dica = document.createElement('p');
    dica.className = 'fg-dica';
    dica.textContent = 'Campeonato, corrida livre ou treino.';
    meio.append(letras('FLIX GRID', grande + 3), jogar, dica);
    this.telaAbertura.append(voltar, meio, document.createElement('span'));

    const voltarAbertura = botao('fg-voltar', 'Voltar para a abertura');
    voltarAbertura.append(letras('VOLTAR', 2));
    voltarAbertura.addEventListener('click', () => this.mostrar('abertura'));

    const topo = document.createElement('div');
    topo.className = 'fg-topo';
    topo.append(letras('ESCOLHA O MODO', escala + 1));

    const modos = document.createElement('div');
    modos.className = 'fg-modos';
    const camp = botao('fg-modo', 'Campeonato: as 24 pistas em ordem sorteada');
    camp.append(letras('CAMPEONATO', escala, '#FFC83D'));
    const t1 = document.createElement('span');
    t1.className = 'fg-sub';
    t1.style.textAlign = 'left';
    t1.textContent = `As ${pistas.length} pistas em ordem sorteada. Fique entre os 6 primeiros para avançar.`;
    camp.append(t1);
    camp.addEventListener('click', () => this.escolher({ modo: 'campeonato' }));
    this.btnLivre = botao('fg-modo', 'Corrida livre: escolha a pista');
    this.btnLivre.append(letras('CORRIDA LIVRE', escala, '#FFC83D'));
    const t2 = document.createElement('span');
    t2.className = 'fg-sub';
    t2.style.textAlign = 'left';
    t2.textContent = 'Escolha a pista e corra quantas vezes quiser.';
    this.btnLivre.append(t2);
    this.btnLivre.addEventListener('click', () => this.alternarGrade('livre'));
    this.btnTreino = botao('fg-modo', 'Treino: só você na pista, mais rápido');
    this.btnTreino.append(letras('TREINO', escala, '#FFC83D'));
    const t3 = document.createElement('span');
    t3.className = 'fg-sub';
    t3.style.textAlign = 'left';
    t3.textContent = 'Só você na pista, mais rápido e sem limite de voltas. Para decorar as curvas.';
    this.btnTreino.append(t3);
    this.btnTreino.addEventListener('click', () => this.alternarGrade('treino'));
    modos.append(camp, this.btnLivre, this.btnTreino);

    this.grade = document.createElement('div');
    this.grade.className = 'fg-grade';
    this.grade.hidden = true;
    this.grade.setAttribute('role', 'list');
    pistas.forEach((def, i) => {
      const b = botao('fg-pista', `Pista ${i + 1}: ${def.nome}`);
      b.setAttribute('role', 'listitem');
      b.append(tracado(def), letras(def.nome, 2));
      const n = document.createElement('span');
      n.className = 'fg-num';
      n.textContent = `Pista ${i + 1}`;
      b.append(n);
      b.addEventListener('click', () => this.escolher({ modo: this.modoGrade, pista: i }));
      this.grade.append(b);
    });
    this.grade.addEventListener('keydown', (e) => this.navegar(e));

    wrap.append(voltarAbertura, topo, modos, this.grade);
    this.telaModos = wrap;
    this.raiz.append(this.telaAbertura, wrap);
    document.body.append(this.raiz);

    // botões do fim da corrida (por cima do resultado): seguir e voltar ao menu
    this.acoes = document.createElement('div');
    this.acoes.className = 'fg-acoes';
    this.acoes.hidden = true;
    document.body.append(this.acoes);

    // celular em pé durante a corrida: pede para deitar (o iPhone não deixa a página girar a tela sozinha)
    this.girar = document.createElement('div');
    this.girar.className = 'fg-girar';
    this.girar.hidden = true;
    this.girar.setAttribute('role', 'alert');
    const t = document.createElement('p');
    t.textContent = 'Deite o celular para jogar.';
    this.girar.append(letras('GIRE O CELULAR', escala, '#FFC83D'), t);
    document.body.append(this.girar);
  }

  avisoGirar(sim: boolean): void {
    if (this.girar.hidden === !sim) return;
    this.girar.hidden = !sim;
  }

  get aberto(): boolean {
    return !this.raiz.hidden;
  }

  /** `tela`: a abertura (ao entrar no jogo) ou direto a escolha do modo (MENU no meio da corrida). */
  abrir(aoEscolher: (e: Escolha) => void, tela: 'abertura' | 'modos' = 'abertura'): void {
    this.aoEscolher = aoEscolher;
    this.fecharAcoes();
    this.raiz.hidden = false;
    this.mostrar(tela);
  }

  private mostrar(tela: 'abertura' | 'modos'): void {
    const abertura = tela === 'abertura';
    this.telaAbertura.hidden = !abertura;
    this.telaModos.hidden = abertura;
    this.raiz.classList.toggle('abertura', abertura);
    this.mostrarGrade(false);
    this.raiz.scrollTop = 0;
    (this.raiz.querySelector(abertura ? '.fg-jogar' : '.fg-modo') as HTMLButtonElement | null)?.focus();
  }

  private escolher(e: Escolha): void {
    telaCheiaDeitada(); // ainda dentro do toque do jogador (o navegador só deixa assim)
    this.raiz.hidden = true;
    const f = this.aoEscolher;
    this.aoEscolher = null;
    f?.(e);
  }

  /** Corrida livre e treino abrem a mesma grade de pistas; tocar de novo no mesmo modo fecha. */
  private alternarGrade(modo: 'livre' | 'treino'): void {
    const fechar = !this.grade.hidden && this.modoGrade === modo;
    this.modoGrade = modo;
    this.mostrarGrade(!fechar);
  }

  private mostrarGrade(sim: boolean): void {
    this.grade.hidden = !sim;
    this.btnLivre.setAttribute('aria-pressed', String(sim && this.modoGrade === 'livre'));
    this.btnTreino.setAttribute('aria-pressed', String(sim && this.modoGrade === 'treino'));
    if (sim) {
      const primeiro = this.grade.querySelector('button');
      primeiro?.focus();
      primeiro?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /** Setas andam pela grade de pistas (colunas medidas na tela). */
  private navegar(e: KeyboardEvent): void {
    const itens = [...this.grade.querySelectorAll('button')];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const topo0 = itens[0]!.offsetTop;
    const colunas = Math.max(1, itens.filter((b) => b.offsetTop === topo0).length);
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colunas, ArrowUp: -colunas }[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const alvo = itens[Math.min(itens.length - 1, Math.max(0, i + passo))]!;
    alvo.focus();
    alvo.scrollIntoView({ block: 'nearest' });
  }

  /** Botões no fim da corrida. */
  mostrarAcoes(seguir: string, aoSeguir: () => void, aoMenu: () => void): void {
    this.acoes.replaceChildren();
    const a = botao('', seguir);
    a.append(letras(`${seguir} (ENTER)`, 3, '#FFC83D'));
    a.addEventListener('click', aoSeguir);
    const m = botao('', 'Voltar ao menu');
    m.append(letras('MENU (ESC)', 3));
    m.addEventListener('click', aoMenu);
    this.acoes.append(a, m);
    this.acoes.hidden = false;
  }

  fecharAcoes(): void {
    this.acoes.hidden = true;
  }
}
