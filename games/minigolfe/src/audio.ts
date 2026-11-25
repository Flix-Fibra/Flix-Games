/**
 * Efeitos sonoros gerados por código (WebAudio), sem nenhum arquivo de áudio de terceiros.
 * O áudio só é liberado depois do primeiro toque, por restrição dos navegadores, e respeita a mensagem `mute` do hub.
 */
export type SfxName = 'hit' | 'bounce' | 'bumper' | 'portal' | 'splash' | 'sink' | 'good' | 'giveup' | 'end' | 'cannon' | 'jump' | 'burn';

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

/** `arg` (0 a 1): força da tacada ou do impacto. */
export function sfx(name: SfxName, arg = 0.5): void {
  if (muted || !ctx) return;
  switch (name) {
    case 'hit':
      tone(180 + arg * 120, 0, 0.07, 'triangle', 0.1, 90);
      tone(900 + arg * 500, 0, 0.03, 'square', 0.03);
      break;
    case 'bounce':
      tone(260 + arg * 160, 0, 0.05, 'triangle', 0.05 + arg * 0.05, 140);
      break;
    case 'bumper':
      tone(520, 0, 0.06, 'square', 0.05, 900);
      tone(780, 0.04, 0.08, 'triangle', 0.05);
      break;
    case 'portal':
      tone(300, 0, 0.14, 'sine', 0.06, 1100);
      tone(1100, 0.12, 0.12, 'sine', 0.05, 400);
      break;
    case 'splash':
      tone(600, 0, 0.2, 'triangle', 0.07, 150);
      tone(300, 0.04, 0.2, 'sine', 0.06, 100);
      break;
    case 'sink':
      tone(300, 0, 0.1, 'triangle', 0.08, 120);
      tone(120, 0.08, 0.12, 'sine', 0.08, 80);
      break;
    case 'cannon':
      tone(120, 0, 0.14, 'sawtooth', 0.08, 55);
      tone(520, 0.05, 0.1, 'square', 0.04, 200);
      break;
    case 'jump':
      tone(300, 0, 0.2, 'triangle', 0.07, 950);
      break;
    case 'burn':
      tone(900, 0, 0.18, 'sawtooth', 0.06, 180);
      tone(240, 0.05, 0.2, 'triangle', 0.05, 90);
      break;
    case 'good':
      tone(523, 0.12, 0.08, 'square', 0.05);
      tone(659, 0.2, 0.08, 'square', 0.05);
      tone(784, 0.28, 0.16, 'square', 0.05);
      break;
    case 'giveup':
      tone(220, 0, 0.18, 'sawtooth', 0.06, 110);
      break;
    case 'end':
      tone(523, 0, 0.12, 'square');
      tone(659, 0.12, 0.12, 'square');
      tone(784, 0.24, 0.12, 'square');
      tone(1047, 0.36, 0.26, 'square');
      break;
  }
}
