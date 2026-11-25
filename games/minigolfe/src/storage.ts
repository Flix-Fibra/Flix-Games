const KEY = 'flix-games:minigolfe:best';

/** Menor total de tacadas já feito neste navegador (0 = nunca terminou). O ranking oficial é do hub. */
export function loadBest(): number {
  try {
    const v = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

/** Guarda se for o menor. Devolve o melhor depois da gravação. */
export function saveBest(strokes: number): number {
  const prev = loadBest();
  const best = prev > 0 ? Math.min(prev, strokes) : strokes;
  try {
    window.localStorage.setItem(KEY, String(best));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue sem salvar */
  }
  return best;
}
