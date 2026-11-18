import * as THREE from 'three';

/**
 * Visual "3D liso" (estilo Helix Jump): luz em degradê suave com leve brilho, sem contorno.
 * Material padrão do three (PBR): usa a rugosidade e o metal de cada peça.
 */
export function liso(p: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, ...p });
}
