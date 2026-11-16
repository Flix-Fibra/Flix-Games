export interface V {
  x: number;
  y: number;
}

/**
 * Transforma uma linha quebrada em uma linha com cantos arredondados (curvas de Bézier),
 * para o cabo parecer um fio de verdade e não uma fila de quadrados.
 * `radius` é a distância a partir do vértice em que a curva começa.
 */
export function roundedPath(points: readonly V[], radius: number, samples = 6): V[] {
  if (points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const out: V[] = [{ x: first.x, y: first.y }];

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (l1 === 0 || l2 === 0) {
      out.push({ x: p1.x, y: p1.y });
      continue;
    }
    const d = Math.min(radius, l1 / 2, l2 / 2);
    const a = { x: p1.x + ((p0.x - p1.x) / l1) * d, y: p1.y + ((p0.y - p1.y) / l1) * d };
    const b = { x: p1.x + ((p2.x - p1.x) / l2) * d, y: p1.y + ((p2.y - p1.y) / l2) * d };
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * p1.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * p1.y + t * t * b.y,
      });
    }
  }

  out.push({ x: last.x, y: last.y });
  return out;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Comprimento total de uma linha quebrada. */
export function pathLength(pts: readonly V[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return total;
}

/**
 * Divide a linha no comprimento `at` (medido a partir do começo).
 * `head` vai do começo até o corte e `rest` do corte até o fim; os dois incluem o ponto do corte.
 */
export function splitPath(pts: readonly V[], at: number): { head: V[]; rest: V[] } {
  if (pts.length === 0) return { head: [], rest: [] };
  if (at <= 0) return { head: [{ ...pts[0]! }], rest: pts.map((p) => ({ ...p })) };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= at) {
      const t = seg === 0 ? 0 : (at - acc) / seg;
      const cut = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      return {
        head: [...pts.slice(0, i).map((p) => ({ ...p })), cut],
        rest: [{ ...cut }, ...pts.slice(i).map((p) => ({ ...p }))],
      };
    }
    acc += seg;
  }
  const last = pts[pts.length - 1]!;
  return { head: pts.map((p) => ({ ...p })), rest: [{ ...last }] };
}

/** Pontos igualmente espaçados (a cada `step`) ao longo da linha, incluindo o primeiro e o último. */
export function resample(pts: readonly V[], step: number): V[] {
  if (pts.length === 0) return [];
  const out: V[] = [{ ...pts[0]! }];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
      d += step;
    }
    carry = seg - (d - step);
  }
  const last = pts[pts.length - 1]!;
  const prev = out[out.length - 1]!;
  if (Math.hypot(last.x - prev.x, last.y - prev.y) > 0.01) out.push({ ...last });
  return out;
}

/** Mistura duas cores 0xRRGGBB. `t` = 0 devolve `a`; `t` = 1 devolve `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Direção unitária de uma ponta da linha, apontando para fora (da linha para a ponta).
 * `atEnd` = true usa a última ponta; false, a primeira. Devolve null se a linha for curta demais.
 */
export function endDirection(pts: readonly V[], atEnd: boolean): V | null {
  if (pts.length < 2) return null;
  const tip = atEnd ? pts[pts.length - 1]! : pts[0]!;
  for (let k = 1; k < pts.length; k++) {
    const other = atEnd ? pts[pts.length - 1 - k]! : pts[k]!;
    const d = Math.hypot(tip.x - other.x, tip.y - other.y);
    if (d > 0.5) return { x: (tip.x - other.x) / d, y: (tip.y - other.y) / d };
  }
  return null;
}
