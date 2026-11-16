import { lerp, mixColor } from '@flix/game-kit';

export { lerp, mixColor };
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

/** Linha com comprimentos acumulados, para posicionar peças em uma distância ao longo dela. */
export interface Track {
  pts: V[];
  /** cum[i] = comprimento do começo até o ponto i. */
  cum: number[];
  total: number;
}

export function buildTrack(pts: readonly V[]): Track {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  return { pts: pts.map((p) => ({ x: p.x, y: p.y })), cum, total: cum[cum.length - 1] ?? 0 };
}

/** Ponto e ângulo (radianos) da linha a `s` de distância do começo. `s` fora do intervalo é limitado às pontas. */
export function sampleTrack(t: Track, s: number): { x: number; y: number; angle: number } {
  const n = t.pts.length;
  if (n === 0) return { x: 0, y: 0, angle: 0 };
  if (n === 1) return { x: t.pts[0]!.x, y: t.pts[0]!.y, angle: 0 };
  const d = Math.min(Math.max(s, 0), t.total);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  // procura um trecho com comprimento para dar a direção (ignora pontos repetidos)
  let a = lo;
  let b = lo + 1;
  while (b < n - 1 && t.cum[b]! - t.cum[a]! < 1e-6) b++;
  while (a > 0 && t.cum[b]! - t.cum[a]! < 1e-6) a--;
  const pa = t.pts[a]!;
  const pb = t.pts[b]!;
  const seg = t.cum[b]! - t.cum[a]!;
  const f = seg < 1e-6 ? 0 : Math.min(1, Math.max(0, (d - t.cum[a]!) / seg));
  return { x: lerp(pa.x, pb.x, f), y: lerp(pa.y, pb.y, f), angle: Math.atan2(pb.y - pa.y, pb.x - pa.x) };
}
