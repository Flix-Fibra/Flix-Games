/**
 * Interface por cima do 3D (HTML + CSS): placar, faixa de baixo, avisos, barra de força, menu e fim de percurso.
 * Texto de verdade do navegador: liso e nítido em qualquer tela.
 */

const CSS = `
:root { --vermelho:#E5173F; --texto:#F5F7FF; --fraco:#9AA3C0; --vidro:rgba(13,19,36,0.72); --linha:rgba(255,255,255,0.10); }
#ui { position:absolute; inset:0; pointer-events:none; font-family:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:var(--texto); -webkit-font-smoothing:antialiased; }
#ui * { box-sizing:border-box; }
.mg-topo { position:absolute; top:10px; left:10px; right:10px; max-width:560px; margin:0 auto; display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:6px; padding:9px 12px; border-radius:16px; background:var(--vidro); border:1px solid var(--linha); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.mg-topo div { display:flex; flex-direction:column; align-items:center; }
.mg-topo div:first-child { align-items:flex-start; }
.mg-topo div:last-child { align-items:flex-end; }
.mg-rot { font-size:9px; font-weight:800; letter-spacing:1.4px; color:var(--fraco); }
.mg-val { font-size:22px; font-weight:800; line-height:1.15; font-variant-numeric:tabular-nums; }
.mg-val small { font-size:13px; color:var(--fraco); font-weight:700; }
.mg-baixo { position:absolute; left:10px; right:10px; bottom:10px; max-width:560px; margin:0 auto; padding:9px 12px; border-radius:16px; background:var(--vidro); border:1px solid var(--linha); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); text-align:center; }
.mg-nome { font-size:10px; font-weight:800; letter-spacing:1.6px; color:var(--fraco); }
.mg-dica { font-size:12px; font-weight:600; margin-top:3px; }
.mg-forca { height:6px; margin:7px auto 0; width:70%; border-radius:3px; background:rgba(255,255,255,0.1); overflow:hidden; opacity:0; transition:opacity .15s; }
.mg-forca i { display:block; height:100%; width:0; border-radius:3px; background:linear-gradient(90deg,#fff,#FF3D5E); }
.mg-aviso { position:absolute; left:0; right:0; top:42%; text-align:center; font-size:34px; font-weight:900; letter-spacing:1px; text-shadow:0 4px 18px rgba(0,0,0,.6); opacity:0; transform:scale(1.3); transition:opacity .25s, transform .25s cubic-bezier(.2,1.6,.4,1); }
.mg-aviso.on { opacity:1; transform:scale(1); }
.mg-aviso.bom { color:#FFD54A; }
.mg-aviso.ruim { color:#FF6B81; }
.mg-tela { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center; pointer-events:auto; background:linear-gradient(180deg, rgba(8,12,24,.35) 0%, rgba(8,12,24,.15) 40%, rgba(8,12,24,.85) 100%); }
.mg-tela.fim { background:rgba(8,12,24,.82); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
.mg-titulo { font-size:46px; font-weight:900; letter-spacing:2px; line-height:1; text-shadow:0 6px 24px rgba(0,0,0,.5); }
.mg-titulo b { display:block; color:#FF3D5E; letter-spacing:12px; margin-top:6px; }
.mg-sub { margin-top:12px; font-size:13px; font-weight:600; color:#C9D0E6; text-shadow:0 2px 8px rgba(0,0,0,.6); }
.mg-card { margin-top:22px; padding:14px 22px; border-radius:18px; background:var(--vidro); border:1px solid var(--linha); min-width:180px; }
.mg-card .mg-val { font-size:26px; }
.mg-botao { margin-top:22px; pointer-events:auto; border:0; cursor:pointer; padding:14px 46px; border-radius:999px; font:800 16px/1 inherit; font-family:inherit; letter-spacing:2px; color:#fff; background:linear-gradient(180deg,#FF3D5E,#D9123A); box-shadow:0 8px 24px rgba(229,23,63,.45), inset 0 1px 0 rgba(255,255,255,.35); animation:mg-pulso 1.6s ease-in-out infinite; }
.mg-botao:active { transform:scale(.96); }
@keyframes mg-pulso { 50% { transform:scale(1.05); } }
.mg-como { margin-top:auto; font-size:11px; color:var(--fraco); line-height:1.6; }
.mg-pontos { font-size:64px; font-weight:900; line-height:1; margin-top:6px; }
.mg-buracos { display:grid; grid-template-columns:repeat(8,1fr); gap:4px; margin-top:12px; }
.mg-buracos span { font-size:11px; font-weight:800; padding:5px 0; border-radius:7px; background:rgba(255,255,255,0.06); }
.mg-buracos span.abaixo { color:#7CF0A8; } .mg-buracos span.acima { color:#FF8A9C; }
.mg-selo { display:inline-block; margin-top:10px; padding:5px 12px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:1.5px; color:#FFD54A; background:rgba(255,213,74,.14); border:1px solid rgba(255,213,74,.5); }
.mg-dev { position:absolute; bottom:6px; left:0; right:0; font-size:10px; color:var(--fraco); }
`;

const el = (tag: string, cls: string, html = ''): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
};

export class Telas {
  readonly raiz: HTMLElement;
  private topo: HTMLElement;
  private baixo: HTMLElement;
  private v: Record<'buraco' | 'par' | 'tacadas' | 'total', HTMLElement>;
  private nome: HTMLElement;
  private dica: HTMLElement;
  private forca: HTMLElement;
  private aviso: HTMLElement;
  private avisoTimer = 0;
  private tela: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    this.raiz = el('div', '');
    this.raiz.id = 'ui';
    parent.appendChild(this.raiz);
    const col = (rot: string) => {
      const d = el('div', '', `<span class="mg-rot">${rot}</span>`);
      const val = el('span', 'mg-val', '0');
      d.appendChild(val);
      return { d, val };
    };
    this.topo = el('div', 'mg-topo');
    const b = col('BURACO');
    const p = col('PAR');
    const t = col('TACADAS');
    const tt = col('TOTAL');
    this.topo.append(b.d, p.d, t.d, tt.d);
    this.v = { buraco: b.val, par: p.val, tacadas: t.val, total: tt.val };
    this.baixo = el('div', 'mg-baixo');
    this.nome = el('div', 'mg-nome');
    this.dica = el('div', 'mg-dica', 'Arraste para trás e solte para tacar');
    this.forca = el('div', 'mg-forca', '<i></i>');
    this.baixo.append(this.nome, this.dica, this.forca);
    this.aviso = el('div', 'mg-aviso');
    this.raiz.append(this.topo, this.baixo, this.aviso);
    this.mostrarJogo(false);
  }

  /** Alturas (px) tampadas pelo placar e pela faixa de baixo, para a câmera 3D enquadrar o campo entre elas. */
  margens(): { top: number; bottom: number } {
    return { top: this.topo.offsetTop + this.topo.offsetHeight + 8, bottom: this.raiz.clientHeight - this.baixo.offsetTop + 8 };
  }

  mostrarJogo(on: boolean): void {
    this.topo.style.display = on ? '' : 'none';
    this.baixo.style.display = on ? '' : 'none';
  }

  placar(buraco: number, de: number, par: number, tacadas: number, total: number): void {
    this.v.buraco.innerHTML = `${buraco}<small>/${de}</small>`;
    this.v.par.textContent = String(par);
    this.v.tacadas.textContent = String(tacadas);
    this.v.total.textContent = String(total);
  }

  faixa(nome: string, dica: string | null): void {
    this.nome.textContent = nome.toUpperCase();
    if (dica !== null) this.dica.textContent = dica;
    this.dica.style.display = dica === '' ? 'none' : '';
  }

  barraForca(power: number | null): void {
    this.forca.style.opacity = power === null ? '0' : '1';
    (this.forca.firstChild as HTMLElement).style.width = `${Math.round((power ?? 0) * 100)}%`;
  }

  avisar(texto: string, ms: number, tom: '' | 'bom' | 'ruim' = ''): void {
    this.aviso.textContent = texto;
    this.aviso.className = `mg-aviso ${tom}`;
    void this.aviso.offsetWidth;
    this.aviso.classList.add('on');
    window.clearTimeout(this.avisoTimer);
    this.avisoTimer = window.setTimeout(() => this.aviso.classList.remove('on'), Math.max(300, ms - 250));
  }

  private trocarTela(t: HTMLElement | null): void {
    this.tela?.remove();
    this.tela = t;
    if (t) this.raiz.appendChild(t);
  }

  menu(buracos: number, melhor: number, aoJogar: () => void): void {
    this.mostrarJogo(false);
    const t = el('div', 'mg-tela');
    t.innerHTML = `
      <div style="margin-top:8vh" class="mg-titulo">MINIGOLFE<b>FLIX</b></div>
      <div class="mg-sub">${buracos} buracos · menos tacadas, melhor</div>
      <div class="mg-card"><div class="mg-rot">SEU MELHOR</div><div class="mg-val">${melhor > 0 ? `${melhor} <small>tacadas</small>` : '—'}</div></div>`;
    const b = el('button', 'mg-botao', 'JOGAR') as HTMLButtonElement;
    b.type = 'button';
    t.appendChild(b);
    t.appendChild(el('div', 'mg-como', 'Arraste para trás para mirar e solte para tacar.<br>Água, lava e fora do campo custam 1 tacada.'));
    const ir = () => {
      t.removeEventListener('pointerup', ir);
      window.removeEventListener('keydown', tecla);
      aoJogar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') ir();
    };
    t.addEventListener('pointerup', ir);
    window.addEventListener('keydown', tecla);
    this.trocarTela(t);
  }

  fim(o: { total: number; par: number; resultados: number[]; pares: number[]; melhor: number; recorde: boolean; dev: boolean }, aoJogar: () => void): void {
    this.mostrarJogo(false);
    const diff = o.total - o.par;
    const vsPar = diff === 0 ? 'No par' : diff < 0 ? `${-diff} abaixo do par` : `${diff} acima do par`;
    const t = el('div', 'mg-tela fim');
    const buracos = o.resultados
      .map((r, i) => `<span class="${r < o.pares[i]! ? 'abaixo' : r > o.pares[i]! ? 'acima' : ''}">${r}</span>`)
      .join('');
    t.innerHTML = `
      <div class="mg-rot" style="font-size:12px;letter-spacing:3px">PERCURSO COMPLETO</div>
      <div class="mg-card" style="min-width:250px">
        <div class="mg-rot">TACADAS</div>
        <div class="mg-pontos">${o.total}</div>
        <div class="mg-sub" style="margin-top:6px;text-shadow:none">Par ${o.par} · ${vsPar}</div>
        ${o.recorde ? '<div class="mg-selo">NOVO RECORDE!</div>' : `<div class="mg-sub" style="text-shadow:none;margin-top:6px">Seu melhor: ${o.melhor}</div>`}
        <div class="mg-buracos">${buracos}</div>
      </div>`;
    const b = el('button', 'mg-botao', 'JOGAR DE NOVO') as HTMLButtonElement;
    b.type = 'button';
    t.appendChild(b);
    if (o.dev) t.appendChild(el('div', 'mg-dev', 'modo de desenvolvimento (sem hub)'));
    let pronto = false;
    window.setTimeout(() => (pronto = true), 600); // o toque que encaçapou não recomeça sem querer
    const ir = () => {
      if (!pronto) return;
      t.removeEventListener('pointerup', ir);
      window.removeEventListener('keydown', tecla);
      aoJogar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') ir();
    };
    t.addEventListener('pointerup', ir);
    window.addEventListener('keydown', tecla);
    this.trocarTela(t);
  }

  fecharTela(): void {
    this.trocarTela(null);
    this.mostrarJogo(true);
  }
}
