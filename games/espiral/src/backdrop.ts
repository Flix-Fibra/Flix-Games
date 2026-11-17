import * as THREE from 'three';
import type { Palette } from './theme';

/**
 * Céu em degradê, preso à câmera e bem longe (atrás do bairro lá embaixo). Na troca de cenário, o céu novo
 * aparece por cima do antigo aos poucos. Desenhado por código (sem imagens de terceiros).
 */

const DIST = 350; // mais longe que qualquer parte do chão (ground.ts), para nunca tampá-lo
const FADE_S = 1.2;

function paintSky(canvas: HTMLCanvasElement, p: Palette): void {
  const g = canvas.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, p.top);
  grad.addColorStop(1, p.horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, canvas.width, canvas.height);
}

interface Sky {
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}

export class Backdrop {
  private skies: [Sky, Sky];
  private fade = 1;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.skies = [this.makeSky(), this.makeSky()];
  }

  private makeSky(): Sky {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
    );
    mesh.position.z = -DIST;
    this.camera.add(mesh);
    return { canvas, tex, mesh };
  }

  setPalette(p: Palette, instant: boolean): void {
    this.skies = [this.skies[1], this.skies[0]]; // a camada de baixo vira a nova, de cima
    const [next, prev] = this.skies;
    paintSky(next.canvas, p);
    next.tex.needsUpdate = true;
    next.mesh.renderOrder = -1;
    prev.mesh.renderOrder = -2;
    next.mesh.material.opacity = instant ? 1 : 0;
    prev.mesh.material.opacity = 1;
    this.fade = instant ? 1 : 0;
  }

  /** Cobre a tela inteira (chamar depois de mudar o aspecto da câmera). */
  resize(): void {
    const h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.05;
    for (const s of this.skies) s.mesh.scale.set(h * Math.max(this.camera.aspect, 1) * 1.2, h, 1);
  }

  update(dt: number): void {
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / FADE_S);
      this.skies[0].mesh.material.opacity = this.fade;
    }
  }
}
