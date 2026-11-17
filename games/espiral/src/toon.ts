import * as THREE from 'three';

/**
 * Visual "cartoon chapado": em vez de luz em degradê com brilho, cada superfície tem só 3 tons (sombra, meio e luz).
 * Aceita os mesmos parâmetros do MeshStandardMaterial e ignora os que não fazem sentido aqui (rugosidade e metal).
 */
const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export function toon(p: THREE.MeshStandardMaterialParameters = {}): THREE.MeshToonMaterial {
  const { roughness: _r, metalness: _m, ...rest } = p;
  return new THREE.MeshToonMaterial({ ...rest, gradientMap: GRADIENT });
}

/** Contorno escuro das bordas (cara de desenho). */
export const OUTLINE = new THREE.LineBasicMaterial({ color: 0x1b1d2a });
