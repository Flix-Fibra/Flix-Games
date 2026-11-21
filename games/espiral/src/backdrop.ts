import * as THREE from 'three';
import type { Palette } from './theme';

/**
 * Fundo preso à câmera e bem longe: a arte da equipe de cada fase (fase sem arte: céu em degradê). Na troca de cenário, o novo
 * aparece por cima do antigo aos poucos.
 */

const DIST = 350; // bem atrás da torre e dos andares de baixo, para nunca tampá-los
const FADE_S = 1.2;
/**
 * Movimento da arte de fundo (ela é uma imagem parada; quem dá vida é este movimento):
 *  - giro: o fundo acompanha o giro da torre, contínuo e mais devagar que ela (10% de um giro de verdade, como o bairro
 *    em 3D fazia), sem voltar sozinho. A arte se repete espelhada dos lados, então nunca aparece emenda nem borda;
 *  - descida: conforme a bola desce os andares da fase, o fundo sobe e aproxima devagar (chegando perto do bairro).
 * O plano cobre a tela exatamente; quem anda é a imagem dentro dele (deslocamento da textura).
 */
const GIRO_POR_RAD = 0.08; // fração da largura da arte por radiano da torre (~meia arte por volta)
const DESCE_SOBE = 0.05; // quanto o fundo sobe na fase inteira (fração da altura da arte)
const DESCE_ZOOM = 0.06; // quanto aproxima na fase inteira

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
  /** proporção (largura/altura) da arte de fundo, ou null quando é o degradê */
  arte: number | null;
  /** quanto da fase já desceu, suavizado (0 → 1) */
  desce: number;
}

const artes = new Map<string, THREE.Texture>();
/** Arte de fundo carregada uma vez só (a mesma fase volta a cada volta pelos cenários). */
function arteDeFundo(url: string, pronta: () => void): THREE.Texture {
  let t = artes.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url, pronta);
    t.colorSpace = THREE.SRGBColorSpace;
    artes.set(url, t);
  }
  return t;
}

export class Backdrop {
  private skies: [Sky, Sky];
  private fade = 1;
  private rotacao = 0; // giro atual da torre (radianos)
  private progresso = 0; // alvo do "desce" (andares da fase / total)

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
    return { canvas, tex, mesh, arte: null, desce: 0 };
  }

  setPalette(p: Palette, instant: boolean): void {
    this.skies = [this.skies[1], this.skies[0]]; // a camada de baixo vira a nova, de cima
    const [next, prev] = this.skies;
    if (p.fundo) {
      const proporcao = (t: THREE.Texture) => {
        const img = t.image as HTMLImageElement | undefined;
        return img?.width ? img.width / img.height : 1721 / 914; // antes de carregar: medida da arte atual
      };
      const t = arteDeFundo(p.fundo, () => {
        next.arte = proporcao(t);
        this.resize();
      });
      t.wrapS = THREE.MirroredRepeatWrapping; // repete espelhada nos lados: o giro nunca mostra borda
      next.mesh.material.map = t;
      next.arte = proporcao(t);
    } else {
      paintSky(next.canvas, p);
      next.tex.needsUpdate = true;
      next.mesh.material.map = next.tex;
      next.arte = null;
    }
    next.mesh.material.needsUpdate = true;
    next.desce = 0; // fase nova começa de cima; a antiga fica parada enquanto some
    this.resize();
    next.mesh.renderOrder = -1;
    prev.mesh.renderOrder = -2;
    next.mesh.material.opacity = instant ? 1 : 0;
    prev.mesh.material.opacity = 1;
    this.fade = instant ? 1 : 0;
  }

  /** Cobre a tela inteira (chamar depois de mudar o aspecto da câmera). */
  resize(): void {
    const { w, h } = this.tela();
    for (const s of this.skies) {
      if (s.arte) this.mover(s);
      else {
        s.mesh.scale.set(h * Math.max(this.camera.aspect, 1) * 1.2, h, 1);
        s.mesh.position.set(0, 0, -DIST);
      }
    }
  }

  /** Andares descidos na fase atual (0 a 1): o fundo sobe e aproxima aos poucos. */
  setProgresso(k: number): void {
    this.progresso = Math.min(1, Math.max(0, k));
  }

  /** Tamanho da tela no plano do fundo (unidades do mundo). */
  private tela(): { w: number; h: number } {
    const h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.05;
    return { w: h * this.camera.aspect, h };
  }

  /** Arte cobrindo a tela sem distorcer (no celular em pé, o meio dela), deslocada pelo giro e pela descida. */
  private mover(s: Sky): void {
    const t = s.mesh.material.map;
    if (!s.arte || !t) return;
    const { w, h } = this.tela();
    s.mesh.scale.set(w, h, 1);
    s.mesh.position.set(0, 0, -DIST);
    const altura = Math.max(w / s.arte, h) * (1 + s.desce * DESCE_ZOOM); // altura da arte na tela
    const rx = w / (altura * s.arte);
    const ry = h / altura;
    t.repeat.set(rx, ry);
    t.offset.set((1 - rx) / 2 - this.rotacao * GIRO_POR_RAD, Math.max(0, (1 - ry) / 2 - s.desce * DESCE_SOBE));
  }

  update(dt: number, rotacao: number): void {
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / FADE_S);
      this.skies[0].mesh.material.opacity = this.fade;
    }
    this.rotacao = rotacao;
    // só a camada da fase atual desce; a anterior fica como estava enquanto some
    const atual = this.skies[0];
    atual.desce += (this.progresso - atual.desce) * Math.min(1, dt * 2);
    for (const s of this.skies) this.mover(s);
  }
}
