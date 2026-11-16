/**
 * Efeitos sonoros gerados por código (WebAudio), sem nenhum arquivo de áudio de terceiros.
 * O áudio só é liberado depois do primeiro toque, por restrição dos navegadores, e respeita a mensagem `mute` do hub.
 */
type SfxName = 'house' | 'signal' | 'crash' | 'turn' | 'end' | 'level';

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
    case 'house':
      tone(660, 0, 0.07, 'square');
      tone(990, 0.07, 0.1, 'square');
      break;
    case 'signal':
      tone(440, 0, 0.06, 'triangle');
      tone(660, 0.06, 0.06, 'triangle');
      tone(880, 0.12, 0.12, 'triangle');
      break;
    case 'crash':
      tone(220, 0, 0.3, 'sawtooth', 0.09, 60);
      break;
    case 'end':
      tone(523, 0, 0.12, 'square');
      tone(392, 0.12, 0.12, 'square');
      tone(262, 0.24, 0.22, 'square');
      break;
    case 'level':
      tone(523, 0.12, 0.08, 'square');
      tone(659, 0.2, 0.08, 'square');
      tone(784, 0.28, 0.08, 'square');
      tone(1047, 0.36, 0.2, 'square');
      break;
    case 'turn':
      tone(300, 0, 0.025, 'square', 0.025);
      break;
  }
}
