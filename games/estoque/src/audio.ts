/**
 * Efeitos sonoros gerados por código (WebAudio), sem nenhum arquivo de áudio de terceiros.
 * O áudio só é liberado depois do primeiro toque, por restrição dos navegadores, e respeita a mensagem `mute` do hub.
 */
type SfxName = 'move' | 'rotate' | 'land' | 'drop' | 'collect' | 'level' | 'over' | 'end';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

/** Chamar dentro de um toque do jogador. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol = 0.08, slideTo?: number): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfx(name: SfxName, arg = 1): void {
  if (muted || !ctx) return;
  switch (name) {
    case 'move':
      tone(320, 0, 0.025, 'square', 0.02);
      break;
    case 'rotate':
      tone(420, 0, 0.03, 'triangle', 0.04);
      tone(560, 0.03, 0.04, 'triangle', 0.04);
      break;
    case 'land':
      tone(150, 0, 0.08, 'triangle', 0.08, 90);
      break;
    case 'drop':
      tone(260, 0, 0.1, 'sawtooth', 0.04, 80);
      tone(120, 0.05, 0.1, 'triangle', 0.08, 70);
      break;
    case 'collect': {
      // arg = número da reação em cadeia: cada cadeia soa mais aguda
      const base = 523 * 1.12 ** Math.min(6, arg - 1);
      tone(base, 0, 0.08, 'triangle', 0.08);
      tone(base * 1.25, 0.07, 0.08, 'triangle', 0.08);
      tone(base * 1.5, 0.14, 0.16, 'triangle', 0.08);
      break;
    }
    case 'level':
      tone(523, 0.1, 0.08, 'square', 0.06);
      tone(659, 0.18, 0.08, 'square', 0.06);
      tone(784, 0.26, 0.08, 'square', 0.06);
      tone(1047, 0.34, 0.2, 'square', 0.06);
      break;
    case 'over':
      tone(330, 0, 0.14, 'square');
      tone(247, 0.14, 0.14, 'square');
      tone(165, 0.28, 0.3, 'sawtooth', 0.08, 80);
      break;
    case 'end':
      tone(523, 0, 0.12, 'square');
      tone(659, 0.12, 0.12, 'square');
      tone(784, 0.24, 0.26, 'square');
      break;
  }
}
