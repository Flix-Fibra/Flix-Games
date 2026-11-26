/** Efeitos curtos sintetizados na hora (sem arquivos de áudio). O navegador só libera o som depois de um toque ou tecla. */
type Nome = 'pulo' | 'pouso' | 'golpe' | 'pulso' | 'acerto' | 'bloqueado' | 'dano' | 'morte' | 'item' | 'salva' | 'sala'
  | 'inimigo-morto' | 'chefe-pouso' | 'chefe-morto' | 'fim' | 'gancho' | 'alavanca' | 'fase';

/** [frequência inicial, final, duração em s, onda, volume] de cada nota, tocadas em sequência */
type Nota = [number, number, number, OscillatorType, number];
const SONS: Record<Nome, Nota[]> = {
  pulo: [[240, 420, 0.09, 'square', 0.05]],
  pouso: [[130, 70, 0.06, 'triangle', 0.08]],
  golpe: [[700, 260, 0.08, 'sawtooth', 0.05]],
  pulso: [[300, 900, 0.14, 'square', 0.05]],
  acerto: [[520, 180, 0.08, 'square', 0.08]],
  bloqueado: [[180, 160, 0.05, 'triangle', 0.08]],
  dano: [[300, 80, 0.22, 'sawtooth', 0.09]],
  morte: [[330, 60, 0.6, 'sawtooth', 0.1]],
  item: [[660, 660, 0.06, 'square', 0.05], [990, 990, 0.1, 'square', 0.05]],
  salva: [[440, 440, 0.09, 'triangle', 0.1], [660, 660, 0.09, 'triangle', 0.1], [880, 880, 0.18, 'triangle', 0.1]],
  sala: [[160, 220, 0.08, 'triangle', 0.05]],
  'inimigo-morto': [[420, 90, 0.18, 'square', 0.07]],
  'chefe-pouso': [[110, 40, 0.3, 'sawtooth', 0.14]],
  'chefe-morto': [[300, 40, 0.9, 'sawtooth', 0.14]],
  gancho: [[900, 500, 0.07, 'square', 0.06]],
  alavanca: [[200, 120, 0.1, 'square', 0.08], [300, 600, 0.18, 'triangle', 0.1]],
  fase: [[392, 392, 0.1, 'triangle', 0.09], [523, 523, 0.22, 'triangle', 0.09]],
  fim: [[523, 523, 0.12, 'square', 0.07], [659, 659, 0.12, 'square', 0.07], [784, 784, 0.12, 'square', 0.07], [1047, 1047, 0.35, 'square', 0.07]],
};

let ctx: AudioContext | null = null;

export const som = {
  mudo: false,
  /** chamar dentro de um toque ou tecla */
  liberar(): void {
    try {
      ctx ??= new AudioContext();
      void ctx.resume();
    } catch {
      /* sem áudio */
    }
  },
  tocar(nome: Nome): void {
    if (this.mudo || !ctx || ctx.state !== 'running') return;
    let t = ctx.currentTime;
    for (const [de, ate, dur, onda, vol] of SONS[nome]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = onda;
      o.frequency.setValueAtTime(de, t);
      o.frequency.exponentialRampToValueAtTime(ate, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur;
    }
  },
};
