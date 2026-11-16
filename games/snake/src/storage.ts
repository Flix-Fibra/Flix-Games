const KEY = 'flix-games:snake:best';

/** Melhor resultado local, só como conveniência. O ranking oficial é do hub. */
export function loadBest(): number {
  try {
    const v = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): number {
  const best = Math.max(loadBest(), score);
  try {
    window.localStorage.setItem(KEY, String(best));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue sem salvar */
  }
  return best;
}
