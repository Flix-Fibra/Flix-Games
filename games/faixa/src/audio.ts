/**
 * Efeitos sonoros gerados por código (WebAudio), sem nenhum arquivo de áudio de terceiros.
 * O áudio só é liberado depois do primeiro toque, por restrição dos navegadores, e respeita a mensagem `mute` do hub.
 */
type SfxName = 'hop' | 'side' | 'blocked' | 'milestone' | 'warn' | 'train' | 'crash' | 'splash' | 'time';

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

export function sfx(name: SfxName): void {
  if (muted || !ctx) return;
  switch (name) {
    case 'hop':
      tone(300, 0, 0.07, 'square', 0.035, 520);
      break;
    case 'side':
      tone(380, 0, 0.05, 'square', 0.025, 440);
      break;
    case 'blocked':
      tone(140, 0, 0.06, 'triangle', 0.06);
      break;
    case 'milestone':
      tone(660, 0, 0.08, 'triangle', 0.07);
      tone(880, 0.08, 0.14, 'triangle', 0.07);
      break;
    case 'warn':
      tone(1100, 0, 0.09, 'square', 0.035);
      break;
    case 'train':
      tone(196, 0, 0.5, 'sawtooth', 0.05);
      tone(147, 0, 0.5, 'sawtooth', 0.05);
      break;
    case 'crash':
      tone(220, 0, 0.18, 'sawtooth', 0.09, 60);
      tone(90, 0, 0.25, 'square', 0.08, 40);
      break;
    case 'splash':
      tone(600, 0, 0.2, 'triangle', 0.07, 150);
      tone(300, 0.04, 0.2, 'sine', 0.06, 100);
      break;
    case 'time':
      tone(330, 0, 0.14, 'square');
      tone(247, 0.14, 0.14, 'square');
      tone(165, 0.28, 0.3, 'sawtooth', 0.08, 80);
      break;
  }
}
