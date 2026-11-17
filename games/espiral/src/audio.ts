/**
 * Efeitos sonoros gerados por código (WebAudio), sem nenhum arquivo de áudio de terceiros.
 * O áudio só é liberado depois do primeiro toque, por restrição dos navegadores, e respeita a mensagem `mute` do hub.
 */
type SfxName = 'bounce' | 'pass' | 'break' | 'shield' | 'shieldUsed' | 'phase' | 'over' | 'shock' | 'rocket';

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
    case 'bounce':
      tone(220, 0, 0.07, 'sine', 0.09, 140);
      break;
    case 'pass':
      // Sobe o tom conforme a sequência de andares (arg).
      tone(520 + Math.min(arg, 6) * 70, 0, 0.06, 'triangle', 0.05);
      break;
    case 'break':
      tone(180, 0, 0.18, 'sawtooth', 0.07, 60);
      tone(900, 0.02, 0.12, 'square', 0.03, 300);
      break;
    case 'shield':
      tone(660, 0, 0.08, 'sine', 0.06);
      tone(990, 0.07, 0.12, 'sine', 0.06);
      break;
    case 'shieldUsed':
      tone(400, 0, 0.15, 'square', 0.05, 900);
      break;
    case 'phase':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.12, 'triangle', 0.06));
      break;
    case 'rocket':
      // Propulsão: ronco grave subindo e um chiado.
      tone(90, 0, 0.6, 'sawtooth', 0.08, 260);
      tone(600, 0, 0.4, 'square', 0.025, 1800);
      [523, 784].forEach((f, i) => tone(f, 0.05 + i * 0.07, 0.1, 'triangle', 0.05));
      break;
    case 'shock': {
      // Zumbido elétrico: estalos rápidos e um "bzzz" grave caindo.
      for (let i = 0; i < 6; i++) tone(1400 + Math.random() * 1600, i * 0.035, 0.03, 'square', 0.05);
      tone(110, 0, 0.45, 'sawtooth', 0.09, 55);
      tone(220, 0.05, 0.35, 'square', 0.04, 70);
      break;
    }
    case 'over':
      tone(330, 0, 0.18, 'sawtooth', 0.07, 110);
      tone(160, 0.16, 0.3, 'sawtooth', 0.06, 60);
      break;
  }
}
