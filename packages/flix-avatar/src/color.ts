/** Mistura a cor `a` (texto #RRGGBB) com a cor `b` (número 0xRRGGBB). Com t = 0 devolve `a`; com t = 1 devolve `b`. */
export function mixColor(a: string, b: number, t: number): string {
  const ar = parseInt(a.slice(1), 16);
  const ch = (shift: number) => Math.round(((ar >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}
