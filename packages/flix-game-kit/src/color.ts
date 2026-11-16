export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Mistura duas cores 0xRRGGBB. `t` = 0 devolve `a`; `t` = 1 devolve `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
