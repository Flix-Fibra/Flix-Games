import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  caminhoDaMira, BALL_R, BLADE_R, BUMPER_R, CANNON_CAPTURE, HOLE_R, MAGNET_R, WINDMILL_HUB, blockRect, cannonAngle, lavaHot, lavaWarning, pistonHeight,
  type HoleState, type Level,
} from './logic';
import { PORTAL_COLORS } from './theme';

/**
 * O campo em 3D (Three.js). A física continua 100% em `logic.ts`, no plano (x, y em blocos); aqui só se desenha.
 * Mapa de coordenadas: x da fase -> X do mundo; y da fase (para baixo) -> Z do mundo (para perto da câmera); Y = altura.
 * Tudo é geometria e material gerados por código (sem arquivos de arte).
 */

const WALL_H = 0.34;
/** Espessura do trilho que contorna o campo (fica do lado de fora da linha da parede, onde a bola bate). */
const RAIL = 0.22;
const SLAB = 0.45; // espessura da base do campo
const BG = 0x0b1120;

export interface Mira {
  angle: number;
  power: number;
}

/** Desenho do chão inteiro num canvas (grama em xadrez, areia, gelo, água), 64 px por bloco. */
function texturaChao(l: Level): THREE.CanvasTexture {
  const P = 64;
  const cv = document.createElement('canvas');
  cv.width = l.w * P;
  cv.height = l.h * P;
  const c = cv.getContext('2d')!;
  const rnd = (i: number) => {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      const s = l.surface[y]![x]!;
      const ch = l.rows[y]![x]!;
      const X = x * P;
      const Y = y * P;
      if (ch === '#' || s === 'void') continue;
      if (s === 'sand') {
        c.fillStyle = '#E6CB8B';
        c.fillRect(X, Y, P, P);
        c.fillStyle = 'rgba(160,120,60,0.35)';
        for (let i = 0; i < 26; i++) c.fillRect(X + rnd(x * 97 + y * 31 + i) * P, Y + rnd(x * 13 + y * 71 + i * 3) * P, 2, 2);
      } else if (s === 'ice') {
        const g = c.createLinearGradient(X, Y, X + P, Y + P);
        g.addColorStop(0, '#DDF4FF');
        g.addColorStop(1, '#A9DDF3');
        c.fillStyle = g;
        c.fillRect(X, Y, P, P);
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(X + P * 0.15, Y + P * 0.3);
        c.lineTo(X + P * 0.5, Y + P * 0.22);
        c.moveTo(X + P * 0.45, Y + P * 0.7);
        c.lineTo(X + P * 0.85, Y + P * 0.62);
        c.stroke();
      } else if (s === 'water') {
        const g = c.createLinearGradient(X, Y, X, Y + P);
        g.addColorStop(0, '#2F8FD6');
        g.addColorStop(1, '#1D5FA8');
        c.fillStyle = g;
        c.fillRect(X, Y, P, P);
      } else {
        // grama: xadrez suave com fiapos
        c.fillStyle = (x + y) % 2 === 0 ? '#4FA33F' : '#5BB14A';
        c.fillRect(X, Y, P, P);
        for (let i = 0; i < 40; i++) {
          c.fillStyle = rnd(i + x * 7 + y * 131) > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,40,0,0.08)';
          c.fillRect(X + rnd(x * 51 + y * 17 + i) * P, Y + rnd(x * 23 + y * 89 + i * 5) * P, 1.5, 4);
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Faixa de esteira (setas brancas sobre vermelho) que rola no sentido da seta. */
function texturaEsteira(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#D9473F';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const y0 of [8, 40]) {
    c.beginPath();
    c.moveTo(16, y0 + 16);
    c.lineTo(32, y0);
    c.lineTo(48, y0 + 16);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Converte ponto da fase para o mundo. */
const W = (l: Level, x: number, y: number, h = 0) => new THREE.Vector3(x - l.w / 2, h, y - l.h / 2);

export class Mundo3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private sol = new THREE.DirectionalLight(0xffffff, 2.4);
  private fase = new THREE.Group();
  private level: Level | null = null;
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private flag!: THREE.Mesh;
  private windmills: THREE.Group[] = [];
  private blocks: THREE.Mesh[] = [];
  private pistons: THREE.Mesh[] = [];
  private cannons: { g: THREE.Group; glow: THREE.Mesh }[] = [];
  private lava: { m: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  private portals: THREE.Mesh[] = [];
  private bumpers: THREE.Mesh[] = [];
  private magnets: THREE.Mesh[] = [];
  private belts: THREE.Texture[] = [];
  private aimDots!: THREE.InstancedMesh;
  private aimRing!: THREE.Mesh;
  private particles: { m: THREE.Mesh; v: THREE.Vector3; life: number; max: number }[] = [];
  private bumperPulse = new Map<number, number>();
  /** Área da tela tampada pelo placar (px) em cima e embaixo, para a câmera enquadrar o campo no que sobra. */
  margens = { top: 72, bottom: 70 };
  private alvoCam = new THREE.Vector3();
  private posCam = new THREE.Vector3();
  private orbita = 0;
  modoVitrine = false;

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.niveis()[0]!.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    parent.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 30, 70);
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2233, 1.1));
    this.sol.position.set(-6, 14, 7);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.02;
    this.scene.add(this.sol, this.sol.target);
    // chão escuro bem embaixo do campo (recebe a sombra da base)
    const fundo = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1 }));
    fundo.rotation.x = -Math.PI / 2;
    fundo.position.y = -SLAB - 0.02;
    fundo.receiveShadow = true;
    this.scene.add(fundo, this.fase);

    // mira: pontinhos no chão + anel em volta da bola
    this.aimDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 24);
    this.aimDots.count = 0;
    this.aimDots.renderOrder = 5;
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    this.aimRing.visible = false;
    this.scene.add(this.aimDots, this.aimRing);
    this.resize();
  }

  resize(): void {
    const el = this.renderer.domElement.parentElement!;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.level) this.enquadrar(true);
  }

  // ---------- montagem da fase ----------

  carregar(l: Level): void {
    this.limpar();
    this.level = l;
    const f = this.fase;
    const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

    // base do campo: um bloco por célula jogável (inclui paredes), juntos numa malha só
    const lajes: THREE.BufferGeometry[] = [];
    const paredes: THREE.BufferGeometry[] = [];
    for (let y = 0; y < l.h; y++) {
      for (let x = 0; x < l.w; x++) {
        const ch = l.rows[y]![x]!;
        if (ch === ' ' || ch === '#') continue;
        const p = W(l, x + 0.5, y + 0.5);
        lajes.push(new THREE.BoxGeometry(1, SLAB, 1).translate(p.x, -SLAB / 2, p.z));
      }
    }
    // paredes retas: um trilho fino do lado de fora de cada aresta (a face de dentro fica na linha onde a bola bate)
    const ehParede = (x: number, y: number) => l.rows[Math.floor(y)]?.[Math.floor(x)] === '#';
    for (const s of l.walls) {
      if (s.a.x !== s.b.x && s.a.y !== s.b.y) continue;
      const mx = (s.a.x + s.b.x) / 2;
      const my = (s.a.y + s.b.y) / 2;
      const horiz = s.a.y === s.b.y;
      const nx = horiz ? 0 : ehParede(mx + 0.5, my) ? 1 : -1;
      const ny = horiz ? (ehParede(mx, my + 0.5) ? 1 : -1) : 0;
      // só onde do outro lado há campo (a borda externa da grade não ganha trilho)
      const fora = l.rows[Math.floor(my - ny * 0.5)]?.[Math.floor(mx - nx * 0.5)];
      if (fora === undefined || fora === '#' || fora === ' ') continue;
      // as pontas só avançam (para fechar o canto) se do lado da parede, depois da ponta, ainda for parede
      const tx = horiz ? 1 : 0;
      const ty = horiz ? 0 : 1;
      const ext = (k: number) => (ehParede(mx + tx * k * 0.75 + nx * 0.5, my + ty * k * 0.75 + ny * 0.5) ? RAIL : 0);
      const e0 = ext(-1);
      const e1 = ext(1);
      const len = 1 + e0 + e1;
      const off = (e1 - e0) / 2;
      const c = W(l, mx + nx * (RAIL / 2) + tx * off, my + ny * (RAIL / 2) + ty * off);
      const alto = WALL_H + SLAB;
      const g = new THREE.BoxGeometry(horiz ? len : RAIL, alto, horiz ? RAIL : len).translate(c.x, alto / 2 - SLAB, c.z);
      paredes.push(g);
    }
    for (const s of l.walls) {
      if (s.a.x === s.b.x || s.a.y === s.b.y) continue; // diagonais: trilho inclinado
      const a = W(l, s.a.x, s.a.y);
      const b = W(l, s.b.x, s.b.y);
      const len = a.distanceTo(b);
      const g = new THREE.BoxGeometry(len, WALL_H, 0.16).rotateY(-Math.atan2(b.z - a.z, b.x - a.x)).translate((a.x + b.x) / 2, WALL_H / 2, (a.z + b.z) / 2);
      paredes.push(g);
    }
    if (lajes.length) {
      const m = new THREE.Mesh(mergeGeometries(lajes), std(0x3b2a1e, { roughness: 0.9 }));
      m.receiveShadow = true;
      m.castShadow = true;
      f.add(m);
    }
    if (paredes.length) {
      // topo claro e laterais escuras (cor por vértice, pela direção da face)
      const g = mergeGeometries(paredes)!;
      const n = g.getAttribute('normal');
      const cores = new Float32Array(n.count * 3);
      const topo = new THREE.Color(0xf3e3c3);
      const lado = new THREE.Color(0xb07a45);
      for (let i = 0; i < n.count; i++) (n.getY(i) > 0.5 ? topo : lado).toArray(cores, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
      const m = new THREE.Mesh(g, std(0xffffff, { vertexColors: true, roughness: 0.55 }));
      m.castShadow = true;
      m.receiveShadow = true;
      f.add(m);
    }

    // chão (uma textura para a fase inteira)
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.h), new THREE.MeshStandardMaterial({ map: texturaChao(l), roughness: 0.85, transparent: false, alphaTest: 0.5 }));
    (chao.material as THREE.MeshStandardMaterial).map!.premultiplyAlpha = false;
    chao.rotation.x = -Math.PI / 2;
    chao.position.y = 0.001;
    chao.receiveShadow = true;
    // células vazias e paredes ficam transparentes no canvas: o alphaTest some com elas
    f.add(chao);

    // água: espelho levemente brilhante por cima da textura
    for (let y = 0; y < l.h; y++) {
      for (let x = 0; x < l.w; x++) {
        if (l.surface[y]![x] !== 'water' || l.rows[y]![x] === ' ') continue;
        const p = W(l, x + 0.5, y + 0.5, -0.05);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3ba0f0, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 }));
        m.position.copy(p);
        m.position.y = 0.01;
        f.add(m);
      }
    }

    // esteiras
    const beltTex = texturaEsteira();
    for (let y = 0; y < l.h; y++) {
      for (let x = 0; x < l.w; x++) {
        const s = l.slope[y]![x];
        if (!s) continue;
        const tex = beltTex.clone();
        tex.needsUpdate = true;
        this.belts.push(tex);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
        m.rotation.x = -Math.PI / 2;
        // a textura aponta para "cima" (Z negativo); gira para a direção da esteira
        m.rotation.z = -Math.atan2(s.x, -s.y);
        m.position.copy(W(l, x + 0.5, y + 0.5, 0.004));
        m.receiveShadow = true;
        f.add(m);
      }
    }

    // rampas de salto: cunha laranja que sobe no sentido do salto
    for (const j of l.jumps) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.5, 0);
      shape.lineTo(0.5, 0);
      shape.lineTo(0.5, 0.2);
      shape.lineTo(-0.5, 0);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false }).translate(0, 0, -0.45);
      const m = new THREE.Mesh(g, std(0xf0a03a, { roughness: 0.4 }));
      m.position.copy(W(l, j.x, j.y));
      m.rotation.y = -Math.atan2(j.dir.y, j.dir.x);
      m.castShadow = m.receiveShadow = true;
      f.add(m);
      const seta = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 3).rotateZ(-Math.PI / 2), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.2 }));
      seta.position.set(0.1, 0.16, 0);
      m.add(seta);
    }

    // trilho dos blocos móveis + blocos
    for (const bk of l.blocks) {
      const x0 = Math.min(bk.from.x, bk.to.x);
      const y0 = Math.min(bk.from.y, bk.to.y);
      const x1 = Math.max(bk.from.x, bk.to.x) + bk.w;
      const y1 = Math.max(bk.from.y, bk.to.y) + bk.h;
      const trilho = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x86c765, transparent: true, opacity: 0.45, roughness: 0.8 }));
      trilho.position.copy(W(l, (x0 + x1) / 2, (y0 + y1) / 2, 0.003));
      f.add(trilho);
      const m = new THREE.Mesh(new THREE.BoxGeometry(bk.w - 0.04, 0.5, bk.h - 0.04), std(0xf4f6fb, { roughness: 0.35 }));
      m.castShadow = m.receiveShadow = true;
      const borda = new THREE.Mesh(new THREE.BoxGeometry(bk.w - 0.02, 0.08, bk.h - 0.02), std(0x3b82f6, { roughness: 0.4 }));
      borda.position.y = -0.17;
      m.add(borda);
      this.blocks.push(m);
      f.add(m);
    }

    // lava
    for (const z of l.lava) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a1f26, emissive: 0xff5a1f, emissiveIntensity: 0, roughness: 0.6 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w - 0.04, z.h - 0.04).rotateX(-Math.PI / 2), mat);
      m.position.copy(W(l, z.x + z.w / 2, z.y + z.h / 2, 0.006));
      m.receiveShadow = true;
      this.lava.push({ m, mat });
      f.add(m);
    }

    // postes de cabo (quicam com força)
    for (const b of l.bumpers) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(BUMPER_R, BUMPER_R * 1.05, 0.55, 32), std(0xf6c22e, { roughness: 0.3, metalness: 0.1, emissive: 0xf6c22e, emissiveIntensity: 0 }));
      m.position.copy(W(l, b.x, b.y, 0.275));
      m.castShadow = m.receiveShadow = true;
      const tampa = new THREE.Mesh(new THREE.CylinderGeometry(BUMPER_R * 0.75, BUMPER_R * 0.75, 0.06, 32), std(0xffffff, { roughness: 0.3 }));
      tampa.position.y = 0.3;
      m.add(tampa);
      const anel = new THREE.Mesh(new THREE.TorusGeometry(BUMPER_R * 1.02, 0.04, 8, 32).rotateX(Math.PI / 2), std(0x8a6a10));
      anel.position.y = -0.12;
      m.add(anel);
      this.bumpers.push(m);
      f.add(m);
    }

    // ímãs: disco com anel pulsante (azul atrai, vermelho repele)
    for (const mg of l.magnets) {
      const cor = mg.sign === 1 ? 0x4aa3ff : 0xff5a6a;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 32), std(cor, { emissive: cor, emissiveIntensity: 0.6, roughness: 0.3 }));
      base.position.copy(W(l, mg.x, mg.y, 0.08));
      base.castShadow = true;
      f.add(base);
      const anel = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.35 }));
      anel.position.copy(W(l, mg.x, mg.y, 0.008));
      anel.userData = { sign: mg.sign };
      this.magnets.push(anel);
      f.add(anel);
    }

    // portais: anel brilhante girando, da cor do par
    for (const p of l.portals) {
      const cor = PORTAL_COLORS[(Number(p.digit) - 1) % PORTAL_COLORS.length]!;
      const buraco = new THREE.Mesh(new THREE.CircleGeometry(0.33, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05060c }));
      buraco.position.copy(W(l, p.x, p.y, 0.005));
      f.add(buraco);
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 40), std(cor, { emissive: cor, emissiveIntensity: 1.4, roughness: 0.3 }));
      m.rotation.x = Math.PI / 2;
      m.position.copy(W(l, p.x, p.y, 0.06));
      this.portals.push(m);
      f.add(m);
    }

    // moinhos: torre (centro) e pás que giram
    for (const w of l.windmills) {
      const g = new THREE.Group();
      g.position.copy(W(l, w.x, w.y));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(WINDMILL_HUB, WINDMILL_HUB * 1.1, 0.55, 32), std(0xd4142c, { roughness: 0.35 }));
      hub.position.y = 0.275;
      hub.castShadow = true;
      g.add(hub);
      const pas = new THREE.Group();
      pas.position.y = 0.26;
      for (let i = 0; i < w.blades; i++) {
        const pa = new THREE.Mesh(new THREE.BoxGeometry(w.len, 0.26, BLADE_R * 2.6).translate(w.len / 2, 0, 0), std(0xe8cf98, { roughness: 0.55 }));
        pa.rotation.y = -(i * Math.PI * 2) / w.blades;
        pa.castShadow = true;
        pas.add(pa);
      }
      const topo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12), std(0xffffff, { roughness: 0.3 }));
      topo.position.y = 0.6;
      g.add(pas, topo);
      g.userData = { w, pas };
      this.windmills.push(g);
      f.add(g);
    }

    // pistões: anel no chão + coluna que sobe e desce
    for (const p of l.pistons) {
      const anel = new THREE.Mesh(new THREE.RingGeometry(p.r * 0.92, p.r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8e1d1d }));
      anel.position.copy(W(l, p.x, p.y, 0.007));
      f.add(anel);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.9, p.r * 0.9, 0.6, 32), std(0xe0463d, { roughness: 0.35, metalness: 0.2 }));
      m.position.copy(W(l, p.x, p.y, -0.3));
      m.castShadow = true;
      m.userData = { p };
      this.pistons.push(m);
      f.add(m);
    }

    // bombas: esfera preta com cano que gira
    for (const cn of l.cannons) {
      const g = new THREE.Group();
      g.position.copy(W(l, cn.x, cn.y));
      const corpo = new THREE.Mesh(new THREE.SphereGeometry(CANNON_CAPTURE * 0.95, 32, 16), std(0x15171d, { roughness: 0.25, metalness: 0.4 }));
      corpo.position.y = CANNON_CAPTURE * 0.7;
      corpo.castShadow = true;
      const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 20).rotateZ(-Math.PI / 2), std(0x424858, { roughness: 0.3, metalness: 0.5 }));
      cano.position.set(CANNON_CAPTURE * 0.95, CANNON_CAPTURE * 0.7, 0);
      const ponta = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), std(0xff4a2a, { emissive: 0xff4a2a, emissiveIntensity: 1.2 }));
      ponta.position.set(CANNON_CAPTURE * 1.25, CANNON_CAPTURE * 0.7, 0);
      const mira = new THREE.Group();
      mira.add(cano, ponta);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0 }));
      glow.position.y = 0.01;
      g.add(corpo, mira, glow);
      g.userData = { cn, mira };
      this.cannons.push({ g, glow });
      f.add(g);
    }

    // largada
    const tee = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    tee.position.copy(W(l, l.tee.x, l.tee.y, 0.006));
    f.add(tee);

    // buraco com bandeira
    const borda = new THREE.Mesh(new THREE.RingGeometry(HOLE_R, HOLE_R + 0.05, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    borda.position.copy(W(l, l.hole.x, l.hole.y, 0.007));
    const buraco = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x030407 }));
    buraco.position.copy(W(l, l.hole.x, l.hole.y, 0.008));
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 12), std(0xffffff, { roughness: 0.3 }));
    haste.position.copy(W(l, l.hole.x, l.hole.y, 0.65));
    haste.castShadow = true;
    const pano = new THREE.PlaneGeometry(0.55, 0.34, 12, 4).translate(0.275, 0, 0);
    this.flag = new THREE.Mesh(pano, std(0xe5173f, { side: THREE.DoubleSide, roughness: 0.6 }));
    this.flag.position.copy(W(l, l.hole.x, l.hole.y, 1.12));
    this.flag.castShadow = true;
    this.flag.userData = { base: (pano.getAttribute('position') as THREE.BufferAttribute).array.slice() };
    f.add(borda, buraco, haste, this.flag);

    // bola
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 40, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.02 }));
    this.ball.castShadow = true;
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
    f.add(this.ball, this.ballShadow);

    // sombra do sol cobrindo só o campo (mais nítida)
    const ext = Math.max(l.w, l.h) * 0.75 + 2;
    const cam = this.sol.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 1;
    cam.far = 50;
    cam.updateProjectionMatrix();
    this.enquadrar(true);
  }

  private limpar(): void {
    this.fase.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) {
        const map = (mat as THREE.MeshStandardMaterial).map;
        map?.dispose();
        mat.dispose();
      }
    });
    this.fase.clear();
    this.windmills = [];
    this.blocks = [];
    this.pistons = [];
    this.cannons = [];
    this.lava = [];
    this.portals = [];
    this.bumpers = [];
    this.magnets = [];
    this.belts = [];
    for (const p of this.particles) p.m.removeFromParent();
    this.particles = [];
  }

  /** Câmera inclinada que mostra a fase inteira no espaço livre entre o placar de cima e a faixa de baixo. */
  private enquadrar(_imediato: boolean): void {
    const l = this.level!;
    const el = this.renderer.domElement;
    const Wpx = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    const cam = this.camera;
    cam.clearViewOffset();
    const vit = this.modoVitrine;
    const topo = vit ? 1 : 1 - (2 * this.margens.top) / H;
    const baixo = vit ? -1 : -1 + (2 * this.margens.bottom) / H;
    const elev = THREE.MathUtils.degToRad(vit ? 45 : 62);
    // caixa só da parte jogável (+ trilho), não da grade inteira
    let x0 = l.w;
    let y0 = l.h;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < l.h; y++) {
      for (let x = 0; x < l.w; x++) {
        const ch = l.rows[y]![x]!;
        if (ch === '#' || ch === ' ') continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
    const cx = (x0 + x1) / 2;
    const cz = (y0 + y1) / 2;
    const cantos: THREE.Vector3[] = [];
    for (const x of [x0 - RAIL, x1 + RAIL]) for (const y of [y0 - RAIL, y1 + RAIL]) for (const h of [-SLAB, WALL_H]) cantos.push(W(l, x, y, h));
    const centro = W(l, cx, cz);
    const projetar = (d: number) => {
      cam.position.set(centro.x, Math.sin(elev) * d, centro.z + Math.cos(elev) * d);
      cam.lookAt(centro);
      cam.updateMatrixWorld();
      let minY = 9;
      let maxY = -9;
      let maxX = 0;
      for (const c of cantos) {
        const p = c.clone().project(cam);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        maxX = Math.max(maxX, Math.abs(p.x));
      }
      return { minY, maxY, maxX };
    };
    let lo = 1;
    let hi = 150;
    for (let i = 0; i < 32; i++) {
      const d = (lo + hi) / 2;
      const r = projetar(d);
      if (r.maxX <= 0.95 && r.maxY - r.minY <= (topo - baixo) * 0.97) hi = d;
      else lo = d;
    }
    const r = projetar(hi);
    this.posCam.copy(cam.position);
    this.alvoCam.copy(centro);
    // desloca a imagem para o meio do campo cair no meio do vão livre (sem mudar a perspectiva)
    const dy = (topo + baixo) / 2 - (r.minY + r.maxY) / 2;
    if (!vit) cam.setViewOffset(Wpx, H, 0, (dy * H) / 2, Wpx, H);
    this.scene.fog = new THREE.Fog(BG, hi * 1.4, hi * 3);
  }

  // ---------- a cada quadro ----------

  atualizar(h: HoleState, dt: number, mira: Mira | null, sinkT: number): void {
    const l = this.level;
    if (!l) return;
    const t = h.clock;

    // câmera: no menu gira devagar em volta do campo; no jogo fica parada enquadrando a fase
    if (this.modoVitrine) {
      if (this.camera.view?.enabled) this.camera.clearViewOffset();
      this.orbita += dt * 0.12;
      const d = this.posCam.distanceTo(this.alvoCam);
      const elev = THREE.MathUtils.degToRad(42);
      const a = this.alvoCam;
      this.camera.position.set(a.x + Math.sin(this.orbita) * Math.cos(elev) * d * 0.9, Math.sin(elev) * d * 0.9, a.z + Math.cos(this.orbita) * Math.cos(elev) * d * 0.9);
      this.camera.lookAt(a);
    } else {
      this.camera.position.copy(this.posCam);
      this.camera.lookAt(this.alvoCam);
    }

    // bola: rola (gira no eixo certo) e voa nas rampas
    const b = h.ball;
    const arc = h.air > 0 && h.airTotal > 0 ? Math.sin(Math.PI * (1 - h.air / h.airTotal)) : 0;
    const pos = W(l, b.x, b.y, BALL_R + arc * 1.2);
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.001 && h.moving) {
      this.eixo.set(b.vy, 0, -b.vx).normalize();
      this.ball.rotateOnWorldAxis(this.eixo, (sp * dt) / BALL_R);
    }
    if (h.sunk) {
      pos.y = BALL_R - sinkT * BALL_R * 2.2;
      this.ball.scale.setScalar(Math.max(0.01, 1 - sinkT * 0.6));
    } else this.ball.scale.setScalar(h.held !== null ? 0.85 : 1);
    this.ball.position.copy(pos);
    this.ball.visible = !(h.sunk && sinkT >= 1);
    // sombra de contato (a do sol some quando a bola voa alto)
    this.ballShadow.position.copy(W(l, b.x, b.y, 0.009));
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = h.sunk ? 0 : 0.35 * (1 - arc * 0.6);
    this.ballShadow.scale.setScalar(1 + arc * 0.4);

    // bandeira ondulando
    const pa = this.flag.geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = this.flag.userData.base as Float32Array;
    for (let i = 0; i < pa.count; i++) {
      const x = base[i * 3]!;
      pa.setZ(i, Math.sin(x * 9 - t * 6) * 0.05 * (x / 0.55));
    }
    pa.needsUpdate = true;

    for (const g of this.windmills) {
      const { w, pas } = g.userData as { w: { speed: number; phase: number }; pas: THREE.Group };
      pas.rotation.y = -(w.phase + w.speed * t);
    }
    l.blocks.forEach((bk, i) => {
      const r = blockRect(bk, t);
      this.blocks[i]!.position.copy(W(l, r.x + r.w / 2, r.y + r.h / 2, 0.25));
    });
    for (const m of this.pistons) {
      const k = pistonHeight(m.userData.p, t);
      m.position.y = -0.3 + k * 0.62;
    }
    this.cannons.forEach(({ g, glow }, i) => {
      const { cn, mira: mi } = g.userData;
      mi.rotation.y = -cannonAngle(cn, t);
      (glow.material as THREE.MeshBasicMaterial).opacity = h.held === i ? 0.45 + 0.3 * Math.sin(t * 10) : 0;
    });
    l.lava.forEach((z, i) => {
      const { mat } = this.lava[i]!;
      const hot = lavaHot(z, t);
      const warn = lavaWarning(z, t);
      mat.color.setHex(hot ? 0xff3d00 : 0x3a141b);
      mat.emissive.setHex(hot ? 0xff5200 : 0xff3d00);
      mat.emissiveIntensity = hot ? 2.2 + 0.6 * Math.sin(t * 9) : warn * (0.5 + 0.8 * Math.abs(Math.sin(t * 20)));
    });
    for (const p of this.portals) p.rotation.z = t * 2;
    for (const m of this.magnets) {
      const u = ((t * (m.userData.sign === 1 ? -0.8 : 0.8)) % 1 + 1) % 1;
      m.scale.setScalar(0.25 + u * (MAGNET_R * 0.32));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - u);
    }
    for (const tex of this.belts) tex.offset.y = (tex.offset.y - dt * 1.2) % 1;
    this.bumpers.forEach((m, i) => {
      const k = this.bumperPulse.get(i) ?? 0;
      if (k > 0) this.bumperPulse.set(i, Math.max(0, k - dt * 4));
      m.scale.set(1 + k * 0.25, 1, 1 + k * 0.25);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = k * 0.9;
    });

    // mira
    this.desenharMira(h, mira);

    // partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.max) {
        p.m.removeFromParent();
        (p.m.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 6;
      p.m.rotation.z += dt * 4;
      (p.m.material as THREE.MeshBasicMaterial).opacity = 1 - p.life / p.max;
    }

    this.renderer.render(this.scene, this.camera);
    this.medirDesempenho();
  }

  // ---------- desempenho: o jogo se adapta ao aparelho ----------

  private eixo = new THREE.Vector3();
  private nivel = 0;
  private somaDt = 0;
  private quadros = 0;

  /** Do mais bonito ao mais leve: resolução (densidade de pixels) e sombras. */
  private niveis(): { dpr: number; sombras: boolean }[] {
    const d = Math.min(window.devicePixelRatio || 1, 1.5);
    const lista = [{ dpr: d, sombras: true }];
    if (d > 1.25) lista.push({ dpr: 1.25, sombras: true });
    if (d > 1) lista.push({ dpr: 1, sombras: true });
    lista.push({ dpr: Math.min(d, 1), sombras: false }, { dpr: 0.75, sombras: false });
    return lista;
  }

  /** A cada ~1,5 s: se a média ficou abaixo de ~45 quadros por segundo, desce um nível de qualidade. */
  private ultimoQuadro = 0;
  private medirDesempenho(): void {
    // tempo real entre quadros (o laço do jogo limita o dt da física; aqui precisa do verdadeiro)
    const agora = performance.now();
    const dt = (agora - this.ultimoQuadro) / 1000;
    this.ultimoQuadro = agora;
    if (dt <= 0 || dt > 0.5) return; // aba voltando do fundo: não conta
    this.somaDt += dt;
    this.quadros++;
    if (this.quadros < 90) return;
    const media = this.somaDt / this.quadros;
    this.somaDt = 0;
    this.quadros = 0;
    const niveis = this.niveis();
    if (media > 1 / 45 && this.nivel < niveis.length - 1) {
      this.nivel++;
      const n = niveis[this.nivel]!;
      this.renderer.setPixelRatio(n.dpr);
      if (this.renderer.shadowMap.enabled !== n.sombras) {
        this.renderer.shadowMap.enabled = n.sombras;
        this.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) m.needsUpdate = true;
        });
      }
      this.resize();
    }
  }

  private desenharMira(h: HoleState, mira: Mira | null): void {
    const l = this.level!;
    if (!mira || h.moving || h.sunk) {
      this.aimDots.count = 0;
      this.aimRing.visible = false;
      return;
    }
    const b = h.ball;
    const cor = new THREE.Color(0xffffff).lerp(new THREE.Color(0xff3d5e), mira.power);
    const len = 0.6 + mira.power * 4.2;
    // a linha para na parede e segue na direção do rebote, como a bola vai fazer
    const pts = caminhoDaMira(l, b, mira.angle, 0.45 + len, 0.22, 0.45).slice(0, 24);
    const n = pts.length;
    const mat = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const p = W(l, pts[i]!.x, pts[i]!.y, 0.02);
      const k = 1 - (i / n) * 0.6;
      mat.makeScale(k, 1, k).setPosition(p);
      this.aimDots.setMatrixAt(i, mat);
    }
    this.aimDots.count = n;
    this.aimDots.instanceMatrix.needsUpdate = true;
    (this.aimDots.material as THREE.MeshBasicMaterial).color.copy(cor);
    this.aimRing.visible = true;
    this.aimRing.position.copy(W(l, b.x, b.y, 0.015));
    (this.aimRing.material as THREE.MeshBasicMaterial).color.copy(cor);
    this.aimRing.scale.setScalar(1 + mira.power * 0.5);
  }

  // ---------- efeitos ----------

  pulsarPoste(h: HoleState): void {
    const b = h.ball;
    let best = -1;
    let bd = 9;
    h.level.bumpers.forEach((p, i) => {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) this.bumperPulse.set(best, 1);
  }

  /** Estouro de pedacinhos coloridos na posição da bola (buraco feito, água, lava). */
  estouro(h: HoleState, cores: number[], n = 26, forca = 3): void {
    const l = this.level!;
    const c = W(l, h.ball.x, h.ball.y, BALL_R);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.02),
        new THREE.MeshBasicMaterial({ color: cores[i % cores.length]!, transparent: true, side: THREE.DoubleSide }),
      );
      m.position.copy(c);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * forca * (0.3 + Math.random()), 2 + Math.random() * forca, Math.sin(a) * forca * (0.3 + Math.random()));
      this.fase.add(m);
      this.particles.push({ m, v, life: 0, max: 0.9 + Math.random() * 0.6 });
    }
  }

  /** Ponto do chão (na altura da bola) sob a posição da tela (px CSS), em coordenadas da fase. */
  noChao(px: number, py: number): { x: number; y: number } | null {
    const l = this.level;
    if (!l) return null;
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -BALL_R), p)) return null;
    return { x: p.x + l.w / 2, y: p.z + l.h / 2 };
  }
}
