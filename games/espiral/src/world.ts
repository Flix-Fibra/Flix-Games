import * as THREE from 'three';
import { liso } from './liso';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BALL_R, BALL_WORLD_ANGLE, FLOOR_GAP, FLOOR_THICK, SEG_ANGLE, SEGMENTS, floorY, type Tower } from './logic';
import { Backdrop } from './backdrop';
import { BALL_HEX, DANGER, PLATE, SIGNAL, STEEL, paletteFor } from './theme';

const BALL_COLOR = new THREE.Color(BALL_HEX);

/** Desenho 3D da torre e da bola. Não tem regra de jogo: só mostra o estado que `logic.ts` calcula. */

const R_IN = 0.95; // raio do poste
const R_OUT = 3.0; // borda externa das placas
const BALL_ORBIT = (R_IN + R_OUT) / 2; // distância da bola até o eixo
const AHEAD = 12; // andares montados abaixo da bola
const CAM_ALTURA = 3; // câmera acima da bola
const CAM_MIRA = 6; // ponto de mira abaixo da bola (quanto maior, mais andares à frente aparecem)
const BEHIND = 2; // andares mantidos acima
const TRAIL = 10;

interface FloorView {
  group: THREE.Group;
  /** Arcos contínuos do andar; `mid` é o ângulo do meio (para os destroços voarem para fora). */
  arcs: { mesh: THREE.Mesh; mid: number }[];
  icons: Map<number, THREE.Object3D>;
}

interface Debris {
  obj: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

// Espessura visual da placa: ~25% mais fina que a da física (FLOOR_THICK). O TOPO continua em y = FLOOR_THICK, que é
// onde a bola bate; só a parte de baixo sobe. Chanfro pequeno nas bordas para pegar uma linha fina de luz.
const PLATE_VISUAL = FLOOR_THICK * 0.75;
const BEVEL = 0.035;

/**
 * Arco de anel (placa) deitado entre os ângulos a0 e a1 da torre, com topo em y = FLOOR_THICK. Fatias vizinhas do
 * mesmo tipo viram um arco só: o jogador vê um anel contínuo e mira no vão, não em "quadrados".
 * Grupos de material: 0 = topo e fundo, 1 = laterais e chanfro (cores diferentes para ler a forma do anel).
 */
function arcGeometry(a0: number, a1: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(R_OUT * Math.cos(a0), R_OUT * Math.sin(a0));
  s.absarc(0, 0, R_OUT, a0, a1, false);
  s.lineTo(R_IN * Math.cos(a1), R_IN * Math.sin(a1));
  s.absarc(0, 0, R_IN, a1, a0, true);
  s.closePath();
  const depth = PLATE_VISUAL - 2 * BEVEL;
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL, // o chanfro entra na placa: o contorno (e o vão) fica exatamente onde era
    bevelSegments: 1,
    curveSegments: Math.max(4, Math.round(((a1 - a0) / SEG_ANGLE) * 6)),
  });
  // A forma está no plano XY; deitar faz o ângulo t virar o ponto (cos t, -sin t) em XZ e a espessura virar +y.
  g.rotateX(-Math.PI / 2);
  // Extrusão vai de -BEVEL a depth + BEVEL; sobe para o topo ficar em FLOOR_THICK.
  g.translate(0, FLOOR_THICK - depth - BEVEL, 0);
  return g;
}

/**
 * Alta tensão: listras diagonais grandes em vermelho (#F04450) e vermelho escuro (#9F1829). Aplicada no topo da placa,
 * cuja UV é a própria posição em unidades do mundo: listras largas, visíveis mesmo girando.
 */
function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = DANGER.red;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = DANGER.stripe;
  for (let i = -64; i < 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 16, 64);
    g.lineTo(i + 80, 0);
    g.lineTo(i + 64, 0);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(1 / 0.9, 1 / 0.9); // um par de listras a cada 0,9 unidade (cada listra ~0,45: lê girando)
  return t;
}

/** Sombra suave da bola (mancha redonda que some na borda). */
function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Ícone de sinal (três arcos e um ponto), usado no bônus e no escudo. */
function signalIcon(): THREE.Group {
  const mat = liso({ color: SIGNAL, emissive: SIGNAL, emissiveIntensity: 0.9 });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14 + i * 0.12, 0.035, 6, 16, Math.PI / 2), mat);
    arc.rotation.z = Math.PI / 4;
    g.add(arc);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
  g.add(dot);
  return g;
}

const TRUSS_HALF = 0.6; // meia largura da seção quadrada da torre (cabe dentro do furo das placas)

/** Barra reta de `a` até `b` (caixa fina), para montar a treliça. */
function beam(a: THREE.Vector3, b: THREE.Vector3, thick: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(thick, dir.length(), thick);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/**
 * Treliça de seção quadrada, como torre de telecom: 4 pernas, X em cada face e travessas. Vai de y = 0 até
 * `height`, com meia largura `hBot` embaixo e `hTop` em cima (afunila no topo). Tudo vira uma geometria só.
 */
function trussGeometry(height: number, hBot: number, hTop: number, sections: number): THREE.BufferGeometry {
  const corners = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ] as const;
  const at = (c: number, y: number) => {
    const h = hBot + (hTop - hBot) * (y / height);
    const k = corners[c % 4]!;
    return new THREE.Vector3(k[0] * h, y, k[1] * h);
  };
  const parts: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 4; c++) parts.push(beam(at(c, 0), at(c, height), 0.075));
  for (let s = 0; s < sections; s++) {
    const y0 = (s / sections) * height;
    const y1 = ((s + 1) / sections) * height;
    for (let c = 0; c < 4; c++) {
      parts.push(beam(at(c, y0), at(c + 1, y1), 0.04));
      parts.push(beam(at(c + 1, y0), at(c, y1), 0.04));
      parts.push(beam(at(c, y1), at(c + 1, y1), 0.045));
    }
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Posição local (referencial da torre) do ponto no ângulo `a` e raio `r`. */
function polar(a: number, r: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r);
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private readonly towerGroup = new THREE.Group();
  private readonly floors = new Map<number, FloorView>();
  private readonly debris: Debris[] = [];

  /** Trecho de treliça de um andar (do topo da placa até o andar de baixo). */
  private readonly trussGeo = trussGeometry(FLOOR_GAP, TRUSS_HALF, TRUSS_HALF, 2).translate(0, FLOOR_THICK - FLOOR_GAP, 0);
  private readonly splatGeo = new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2);

  // Placas: metal fosco, topo grafite médio e laterais grafite escuro (o topo mais claro mostra a forma do anel)
  private readonly plateTopMat = liso({ color: PLATE.top, roughness: 0.85, metalness: 0 });
  private readonly plateSideMat = liso({ color: PLATE.side, roughness: 0.6, metalness: 0 });
  private readonly plateMats = [this.plateTopMat, this.plateSideMat];
  // Torre: aço pintado (faces retas, brilho discreto); vermelho mais escuro que a bola para não confundir
  private readonly poleMat = liso({ color: 0x9aa1ab, roughness: 0.5, metalness: 0.45 });
  private readonly bandMat = liso({ color: STEEL.red, roughness: 0.55, metalness: 0.25 });
  private readonly bandWhiteMat = liso({ color: STEEL.white, roughness: 0.55, metalness: 0.2 });
  private readonly panelGeo = new THREE.BoxGeometry(0.34, 0.95, 0.1);
  private readonly panelMat = liso({ color: STEEL.antenna, roughness: 0.6, metalness: 0.1 });
  private readonly bracketGeo = new THREE.BoxGeometry(0.06, 0.06, 0.2);
  private readonly dishGeo = new THREE.CylinderGeometry(0.34, 0.3, 0.2, 20).rotateX(Math.PI / 2);
  private readonly dishFaceGeo = new THREE.CircleGeometry(0.3, 20).translate(0, 0, 0.101);
  private readonly dishMat = liso({ color: STEEL.antenna, roughness: 0.55, metalness: 0.1 });
  private readonly dishFaceMat = liso({ color: STEEL.antenna, roughness: 0.85 });
  private readonly sharedGeos = new Set<THREE.BufferGeometry>([
    this.trussGeo,
    this.dishGeo,
    this.dishFaceGeo,
    this.splatGeo,
    this.panelGeo,
    this.bracketGeo,
  ]);
  private topLight: THREE.MeshStandardMaterial | null = null;
  /** Alta tensão: topo com listras diagonais vermelhas, laterais vermelho escuro (mesma regra e extensão de antes). */
  private readonly dangerTopMat = liso({ map: stripeTexture(), roughness: 0.85, metalness: 0 });
  private readonly dangerSideMat = liso({ color: DANGER.stripe, roughness: 0.6, metalness: 0 });
  private readonly dangerMats = [this.dangerTopMat, this.dangerSideMat];
  private readonly splatMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 });
  /** Sombra da bola sobre a placa de baixo (só onde há placa). */
  private readonly shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(BALL_R * 2.6, BALL_R * 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0, fog: false }),
  );

  private readonly ball: THREE.Mesh;
  // Bola acetinada: reflexo pequeno e suave, lado claro e lado escuro (sem ponto branco estourado)
  private readonly ballMat = liso({ color: BALL_COLOR, roughness: 0.42, metalness: 0 });
  private readonly shieldMesh: THREE.Mesh;
  private readonly trail: THREE.Mesh[] = [];
  private readonly trailMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 });
  private readonly trailYs: number[] = [];

  // Luz: ambiente fria e fraca (volume no lado da sombra) + sol quente no alto à esquerda (pôr do sol)
  private readonly hemi = new THREE.HemisphereLight(0xa9bbdd, 0x2a2f3a, 1.15);
  private readonly fog = new THREE.Fog(0x000000, 30, 90);
  private camY = 0;
  private camDist = 12;
  /**
   * Resolução do desenho 3D. O custo da GPU cresce com o quadrado dela: 1,5x custa quase metade de 2x e, na tela do
   * celular, a diferença quase não aparece (o placar é HTML e continua nítido). Celular fraco: baixa até 1x (ver medirQuadro).
   */
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  private amostra = { t: 0, n: 0 };
  private squash = 0;
  /** Morte na alta tensão (animação da equipe): amassa, vira cubinhos e dois anéis se abrem na placa. */
  private morte = 0; // segundos desde o choque (0 = sem morte em andamento)
  private morteY = 0; // topo da placa onde a bola caiu
  private corDaBola: THREE.Color | null = null; // cor normal, guardada enquanto ela fica laranja na morte
  private readonly cubos: { obj: THREE.Mesh; vel: THREE.Vector3; giro: THREE.Vector3 }[] = [];
  private readonly aneis: THREE.Mesh[] = [];
  private readonly tracos: THREE.Mesh[] = [];
  private shieldPop!: THREE.Mesh; // bolha do escudo estourando (escudo usado)
  private pop = 0;
  private rocketOn = false;
  private readonly fire: { obj: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private fireNext = 0;
  private trailOn = false;
  private time = 0;
  private bg = new THREE.Color();
  private readonly backdrop: Backdrop;
  private bgTarget = new THREE.Color();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.fog = this.fog;
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffc89a, 2.3);
    sun.position.set(-7, 10, 6);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fa6d8, 0.35); // contraluz fria e fraca, só para não chapar o lado escuro
    fill.position.set(6, 3, -4);
    this.scene.add(fill);
    this.scene.add(this.towerGroup);
    // O fundo é filho da câmera; por isso a câmera entra na cena.
    this.backdrop = new Backdrop(this.camera);
    this.scene.add(this.camera);

    this.shadow.renderOrder = 1;
    this.shadow.position.set(0, 0, BALL_ORBIT);
    this.shadow.visible = false;
    this.scene.add(this.shadow);

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), this.ballMat);
    this.ball.position.set(0, 0, BALL_ORBIT);
    this.scene.add(this.ball);

    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.55, 20, 14),
      new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.ball.add(this.shieldMesh);

    // Escudo usado: a bolha azul do escudo cresce e some (diferente do choque, que é amarelo e elétrico).
    this.shieldPop = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.55, 20, 14),
      new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.shieldPop.visible = false;
    this.ball.add(this.shieldPop);

    // Cubinhos da bola (mesmo material: mesma cor e luz da bola), anéis azul-claros e traços brancos do impacto
    const cuboGeo = new THREE.BoxGeometry(BALL_R * 0.55, BALL_R * 0.55, BALL_R * 0.55);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(cuboGeo, this.ballMat);
      m.visible = false;
      this.scene.add(m);
      this.cubos.push({ obj: m, vel: new THREE.Vector3(), giro: new THREE.Vector3() });
    }
    for (const larg of [0.07, 0.05]) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(1 - larg, 1, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      this.aneis.push(m);
    }
    const tracoGeo = new THREE.BoxGeometry(0.035, 0.012, BALL_R * 0.45);
    const tracoMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(tracoGeo, tracoMat);
      m.visible = false;
      this.scene.add(m);
      this.tracos.push(m);
    }
    // Fogo do foguete: bolinhas laranja que sobem atrás da bola, como um meteoro (reaproveitadas).
    const fireGeo = new THREE.SphereGeometry(0.09, 8, 6);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(
        fireGeo,
        new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.visible = false;
      this.scene.add(m);
      this.fire.push({ obj: m, vel: new THREE.Vector3(), life: 0 });
    }

    const trailGeo = new THREE.SphereGeometry(BALL_R, 10, 8);
    for (let i = 0; i < TRAIL; i++) {
      const m = new THREE.Mesh(trailGeo, this.trailMat);
      m.position.set(0, 0, BALL_ORBIT);
      this.trail.push(m);
      this.scene.add(m);
    }

    this.setBallColor(BALL_HEX);
    this.setPhase(0, true);
    this.resize();
  }

  setBallColor(hex: string): void {
    this.corDaBola = null; // cor nova escolhida: vale ela, não a guardada
    this.ballMat.color.set(hex);
    this.trailMat.color.set(hex);
    this.splatMat.color.set(hex);
  }

  /** Troca o cenário. `instant` evita a transição suave (no começo da partida). */
  setPhase(phase: number, instant = false): void {
    const p = paletteFor(phase);
    // Placas, torre e luz ficam iguais em todos os cenários (o que é jogável não muda de cor); muda o céu e a cidade.
    this.bgTarget.set(p.horizon);
    if (instant) this.bg.copy(this.bgTarget);
    this.backdrop.setPalette(p, instant);
  }

  /** Andares descidos na fase atual (0 a 1): move a arte de fundo (ver backdrop.ts). */
  setProgressoFase(k: number): void {
    this.backdrop.setProgresso(k);
  }

  /** Começo de partida: apaga a torre antiga e posiciona a câmera. */
  reset(ballY: number): void {
    this.setRocket(false);
    for (const f of this.fire) f.obj.visible = false;
    this.pop = 0;
    this.shieldPop.visible = false;
    this.morte = 0;
    this.ball.visible = true;
    if (this.corDaBola) this.ballMat.color.copy(this.corDaBola);
    this.corDaBola = null;
    for (const o of [...this.cubos.map((c) => c.obj), ...this.aneis, ...this.tracos]) o.visible = false;
    for (const k of [...this.floors.keys()]) this.dropFloor(k);
    for (const d of this.debris) this.disposeDebris(d);
    this.debris.length = 0;
    this.towerGroup.rotation.y = 0;
    this.camY = ballY + 1.5;
    this.trailYs.length = 0;
    this.setPhase(0, true);
  }

  /** Monta os andares perto da bola e solta os que já ficaram para trás. */
  sync(tower: Tower, nextFloor: number): void {
    const from = Math.max(0, nextFloor - BEHIND);
    const to = nextFloor + AHEAD;
    for (const k of [...this.floors.keys()]) if (k < from) this.dropFloor(k);
    for (let i = from; i <= to; i++) if (!this.floors.has(i)) this.buildFloor(tower, i);
  }

  private buildFloor(tower: Tower, index: number): void {
    const floor = tower.get(index);
    const group = new THREE.Group();
    group.position.y = floorY(index);

    // Treliça: trechos alternados vermelho e branco, como a pintura de sinalização para aviões.
    group.add(new THREE.Mesh(this.trussGeo, index % 2 === 0 ? this.bandMat : this.bandWhiteMat));

    // Antenas setoriais: 3, a 120° uma da outra, a cada 2 andares.
    if (index % 2 === 1) {
      for (let i = 0; i < 3; i++) this.addPanel(group, (i / 3) * Math.PI * 2 + index * 0.7, TRUSS_HALF, -FLOOR_GAP / 2);
    }
    // Antena de micro-ondas (parabólica de tambor), a cada 3 andares.
    if (index % 3 === 2) this.addDish(group, index * 1.3, TRUSS_HALF, -FLOOR_GAP / 2 + 0.3);

    if (index === 0) group.add(this.antennaTop());

    const view: FloorView = { group, arcs: [], icons: new Map() };
    if (!floor.broken) {
      // Agrupa fatias vizinhas: placa (sólida ou bônus) com placa, perigo com perigo. Começa num vão para não
      // cortar um arco que dá a volta pelo índice 0.
      const kindOf = (k: number) => {
        const s = floor.segs[((k % SEGMENTS) + SEGMENTS) % SEGMENTS] ?? 'solid';
        return s === 'bonus' ? 'solid' : s;
      };
      const start = Math.max(0, floor.segs.indexOf('gap'));
      let k = 0;
      while (k < SEGMENTS) {
        const kind = kindOf(start + k);
        let len = 1;
        while (k + len < SEGMENTS && kindOf(start + k + len) === kind) len++;
        if (kind !== 'gap') {
          const a0 = (start + k) * SEG_ANGLE;
          const a1 = (start + k + len) * SEG_ANGLE;
          const m = new THREE.Mesh(arcGeometry(a0, a1), kind === 'danger' ? this.dangerMats : this.plateMats);
          group.add(m);
          view.arcs.push({ mesh: m, mid: (a0 + a1) / 2 });
        }
        k += len;
      }
      floor.segs.forEach((kind, seg) => {
        if (kind !== 'bonus') return;
        const icon = signalIcon();
        icon.position.copy(polar((seg + 0.5) * SEG_ANGLE, BALL_ORBIT, FLOOR_THICK + 0.55));
        group.add(icon);
        view.icons.set(seg, icon);
      });
    }
    this.towerGroup.add(group);
    this.floors.set(index, view);
  }

  /** Antena setorial presa à torre por um suporte, virada para fora no ângulo `a`. */
  private addPanel(group: THREE.Object3D, a: number, r: number, y: number): void {
    const panel = new THREE.Mesh(this.panelGeo, this.panelMat);
    panel.position.copy(polar(a, r + 0.2, y));
    panel.rotation.y = a + Math.PI / 2;
    const bracket = new THREE.Mesh(this.bracketGeo, this.poleMat);
    bracket.position.copy(polar(a, r + 0.08, y));
    bracket.rotation.y = a + Math.PI / 2;
    group.add(panel, bracket);
  }

  /** Antena de micro-ondas: tambor com a face branca voltada para fora. */
  private addDish(group: THREE.Object3D, a: number, r: number, y: number): void {
    const dish = new THREE.Group();
    dish.add(new THREE.Mesh(this.dishGeo, this.dishMat), new THREE.Mesh(this.dishFaceGeo, this.dishFaceMat));
    dish.position.copy(polar(a, r + 0.22, y));
    dish.rotation.y = a + Math.PI / 2;
    group.add(dish);
  }

  /** Topo da torre: treliça afunilando, plataforma, antenas, para-raios com luz piscando e ondas de sinal. */
  private antennaTop(): THREE.Group {
    const g = new THREE.Group();
    const base = FLOOR_THICK;

    const lower = new THREE.Mesh(trussGeometry(1.6, TRUSS_HALF, 0.43, 2), this.bandWhiteMat);
    lower.position.y = base;
    const upper = new THREE.Mesh(trussGeometry(1.6, 0.43, 0.22, 2), this.bandMat);
    upper.position.y = base + 1.6;

    // Plataforma de serviço no meio do topo.
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 4), this.poleMat);
    deck.rotation.y = Math.PI / 4;
    deck.position.y = base + 1.6;

    for (let i = 0; i < 3; i++) this.addPanel(g, (i / 3) * Math.PI * 2 + 0.3, 0.3, base + 2.5);
    this.addDish(g, -Math.PI / 2 + 0.6, 0.45, base + 0.9);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 2.2, 6), this.poleMat);
    rod.position.y = base + 4.3;

    this.topLight = liso({ color: 0xff2238, emissive: 0xff2238, emissiveIntensity: 1.5 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), this.topLight);
    light.position.y = base + 3.3;

    g.add(lower, upper, deck, rod, light);
    return g;
  }

  private dropFloor(index: number): void {
    const v = this.floors.get(index);
    if (!v) return;
    this.towerGroup.remove(v.group);
    // Geometrias e materiais são compartilhados; só os da mancha e do topo são exclusivos e pequenos.
    v.group.traverse((o) => {
      if ((o instanceof THREE.Mesh || o instanceof THREE.LineSegments) && !this.sharedGeos.has(o.geometry)) {
        o.geometry.dispose();
      }
    });
    this.floors.delete(index);
  }

  setRotation(rotation: number): void {
    this.towerGroup.rotation.y = rotation;
  }

  /** `falling`: a bola está atravessando andares; só aí o rastro aparece (no quique ele vira um borrão). */
  setBall(y: number, fever: boolean, shield: boolean, falling = false): void {
    this.trailOn = falling || fever;
    this.ball.position.y = y;
    this.ballMat.emissive.set(fever ? 0xff8a96 : 0x000000);
    this.ballMat.emissiveIntensity = fever ? 0.3 : 0;
    this.trailMat.opacity = fever ? 0.6 : 0.3;
    this.shieldMesh.visible = shield;
  }

  /**
   * Sombra curta da bola sobre a placa logo abaixo. `topY` = topo da placa debaixo da bola, ou null se ali for vão
   * (sem placa, sem sombra). Fica mais fraca e um pouco maior conforme a bola se afasta.
   */
  setShadow(topY: number | null, ballY: number): void {
    const mat = this.shadow.material as THREE.MeshBasicMaterial;
    if (topY === null || this.morte > 0 || !this.ball.visible) {
      this.shadow.visible = false;
      return;
    }
    const d = Math.max(0, ballY - BALL_R - topY);
    const k = Math.max(0, 1 - d / 2.2); // some em ~2,2 de altura
    this.shadow.visible = k > 0.02;
    this.shadow.position.y = topY + 0.012;
    this.shadow.scale.setScalar(0.75 + 0.35 * (1 - k));
    mat.opacity = 0.5 * k;
  }

  /** Mancha da bola na placa (gira junto com a torre) e achatamento rápido. */
  onBounce(floorIndex: number, rotation: number): void {
    this.squash = 1;
    const v = this.floors.get(floorIndex);
    if (!v) return;
    const a = BALL_WORLD_ANGLE - rotation;
    const s = new THREE.Mesh(this.splatGeo, this.splatMat);
    s.position.copy(polar(a, BALL_ORBIT, FLOOR_THICK + 0.006));
    s.rotation.y = Math.random() * Math.PI;
    s.scale.setScalar(0.8 + Math.random() * 0.4);
    v.group.add(s);
  }

  onBonusTaken(floorIndex: number, seg: number): void {
    const v = this.floors.get(floorIndex);
    const icon = v?.icons.get(seg);
    if (!v || !icon) return;
    v.group.remove(icon);
    v.icons.delete(seg);
  }

  /** Quebra o andar: as placas voam para fora e somem. */
  onBreak(floorIndex: number): void {
    const v = this.floors.get(floorIndex);
    if (!v) return;
    for (const { mesh: m, mid } of v.arcs) {
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = x.clone();
        c.transparent = true;
        return c;
      });
      m.material = mats.length === 1 ? mats[0]! : mats;
      for (const c of m.children) c.visible = false;
      this.scene.attach(m); // mantém a posição no mundo ao sair do grupo da torre
      const a = mid + this.towerGroup.rotation.y;
      const out = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(5 + Math.random() * 3);
      out.y = 3 + Math.random() * 3;
      const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8);
      this.debris.push({ obj: m, vel: out, spin, life: 0.8 });
    }
    for (const icon of v.icons.values()) v.group.remove(icon);
    v.icons.clear();
    v.arcs = [];
    // Manchas da bola sobre o andar quebrado: sem as placas, ficariam flutuando no ar.
    for (const o of [...v.group.children]) if (o instanceof THREE.Mesh && o.geometry === this.splatGeo) v.group.remove(o);
  }

  private disposeDebris(d: Debris): void {
    this.scene.remove(d.obj);
    d.obj.geometry.dispose();
    for (const c of d.obj.children) if (c instanceof THREE.LineSegments) c.geometry.dispose(); // contorno
    for (const x of Array.isArray(d.obj.material) ? d.obj.material : [d.obj.material]) x.dispose();
  }

  /** Animações e câmera. `ballY` é a posição atual da bola. */
  update(dt: number, ballY: number): void {
    this.time += dt;

    // A câmera só desce: acompanha a bola quando ela cai, e não sobe no quique.
    const target = ballY + 1.5;
    if (target < this.camY) this.camY += (target - this.camY) * Math.min(1, dt * 9);
    // Câmera de lado e mais afastada (pouco inclinada): a bola fica no alto da tela e os andares de baixo aparecem empilhados, sem um tapar o outro.
    this.camera.position.set(0, this.camY + CAM_ALTURA, this.camDist);
    this.camera.lookAt(0, this.camY - CAM_MIRA, 0);
    this.updateShock(dt);
    this.updateMorte(dt);
    this.updateFire(dt);
    this.backdrop.update(dt, this.towerGroup.rotation.y);

    // Céu: transição suave entre cenários.
    this.bg.lerp(this.bgTarget, Math.min(1, dt * 2));
    this.scene.background = this.bg;
    this.fog.color.copy(this.bg);

    // Bola achatada no quique.
    this.squash = Math.max(0, this.squash - dt * 6);
    const sq = this.squash * 0.35;
    if (this.morte <= 0) this.ball.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);

    // Rastro: posições anteriores da bola.
    this.trailYs.unshift(ballY);
    if (this.trailYs.length > TRAIL * 2) this.trailYs.length = TRAIL * 2;
    this.trail.forEach((m, i) => {
      const y = this.trailYs[(i + 1) * 2];
      m.visible = this.trailOn && y !== undefined && ballY - y < -BALL_R; // só os que ficaram acima da bola
      if (y !== undefined) m.position.y = y;
      m.scale.setScalar(1 - (i + 1) / (TRAIL + 2));
    });

    // Ícones de sinal girando.
    // Luz do topo piscando e ondas de sinal.
    if (this.topLight) this.topLight.emissiveIntensity = Math.sin(this.time * 4) > 0.2 ? 2 : 0.2;
    for (const v of this.floors.values()) for (const icon of v.icons.values()) icon.rotation.y = this.time * 2;

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      d.life -= dt;
      d.vel.y -= 25 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.z += d.spin.z * dt;
      for (const x of Array.isArray(d.obj.material) ? d.obj.material : [d.obj.material]) x.opacity = Math.max(0, d.life / 0.8);
      if (d.life <= 0) {
        this.disposeDebris(d);
        this.debris.splice(i, 1);
      }
    }
  }

  /** Foguete ligado/desligado: mergulho, rastro de fogo e tela tremendo. */
  setRocket(on: boolean): void {
    this.rocketOn = on;
  }

  private updateFire(dt: number): void {
    if (this.rocketOn) {
      this.fireNext -= dt;
      while (this.fireNext <= 0) {
        this.fireNext += 1 / 60;
        const f = this.fire.find((x) => !x.obj.visible);
        if (!f) break;
        f.obj.visible = true;
        f.life = 0.45;
        f.obj.position.set(
          this.ball.position.x + (Math.random() - 0.5) * 0.2,
          this.ball.position.y + 0.5,
          this.ball.position.z - 0.2,
        );
        f.vel.set((Math.random() - 0.5) * 1.2, 3 + Math.random() * 2, (Math.random() - 0.5) * 1.2);
      }
      const amp = 0.06;
      this.camera.position.x += (Math.random() - 0.5) * amp;
      this.camera.position.y += (Math.random() - 0.5) * amp;
    }
    for (const f of this.fire) {
      if (!f.obj.visible) continue;
      f.life -= dt;
      f.obj.position.addScaledVector(f.vel, dt);
      const k = Math.max(0, f.life / 0.45);
      f.obj.scale.setScalar(0.4 + (1 - k) * 1.4);
      const mat = f.obj.material as THREE.MeshBasicMaterial;
      mat.opacity = k * 0.9;
      mat.color.setHex(k > 0.5 ? 0xffb02e : 0xff4a1f); // amarelo → vermelho
      if (f.life <= 0) f.obj.visible = false;
    }
  }

  /** Alta tensão. `strong` (morte): animação da equipe (ver updateMorte). Fraco (escudo usado): a bolha do escudo estoura. */
  onShock(strong: boolean): void {
    if (!strong) {
      this.pop = 0.4;
      this.shieldPop.visible = true;
      return;
    }
    // Animação da equipe (~0,9 s): amassa na placa com traços de impacto, explode em cubinhos e dois anéis se abrem
    this.morte = 0.0001;
    this.morteY = this.ball.position.y - BALL_R;
    // a bola é vermelha; ao cair na alta tensão fica laranja (e os cubinhos, que usam o mesmo material, também)
    this.corDaBola ??= this.ballMat.color.clone();
    this.ballMat.color.setHex(0xf7931e);
    const b = this.ball.position;
    this.tracos.forEach((t, i) => {
      const a = Math.PI * (0.62 + i * 0.25); // leque à frente e embaixo da bola (lado da câmera)
      t.position.set(b.x + Math.cos(a) * BALL_R * 1.35, this.morteY + 0.02, b.z - Math.sin(a) * BALL_R * 1.35);
      t.rotation.set(0, a + Math.PI / 2, 0);
      t.visible = true;
    });
  }

  /** Andamento da morte: 0–0,08 s amassada; depois cubinhos e anéis até ~0,9 s. */
  private updateMorte(dt: number): void {
    if (this.morte <= 0) return;
    const antes = this.morte;
    this.morte += dt;
    const t = this.morte;
    const AMASSA = 0.08;
    const b = this.ball.position;
    if (t < AMASSA) {
      // achatada e larga, encostada na placa
      this.ball.scale.set(1.45, 0.5, 1.45);
      this.ball.position.y = this.morteY + BALL_R * 0.5;
      return;
    }
    if (antes < AMASSA) {
      // estoura: some a bola e os traços, saem os cubinhos e os anéis
      this.ball.visible = false;
      for (const tr of this.tracos) tr.visible = false;
      this.cubos.forEach((c, i) => {
        const a = (i / this.cubos.length) * Math.PI * 2 + Math.random() * 0.4;
        const out = 2.2 + Math.random() * 2.2;
        c.obj.position.set(b.x + Math.cos(a) * 0.15, this.morteY + BALL_R * 0.5, b.z - Math.sin(a) * 0.15);
        c.vel.set(Math.cos(a) * out, 1.2 + Math.random() * 1.6, -Math.sin(a) * out); // voam baixo, em volta da bola
        c.giro.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
        c.obj.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        c.obj.scale.setScalar(0.7 + Math.random() * 0.6);
        c.obj.visible = true;
      });
      for (const r of this.aneis) {
        r.position.set(b.x, this.morteY + 0.025, b.z);
        r.visible = true;
      }
    }
    const k = Math.min(1, (t - AMASSA) / 0.8); // 0 → 1 depois do estouro
    for (const c of this.cubos) {
      if (!c.obj.visible) continue;
      c.vel.y -= 12 * dt;
      c.obj.position.addScaledVector(c.vel, dt);
      c.obj.rotation.x += c.giro.x * dt;
      c.obj.rotation.y += c.giro.y * dt;
      c.obj.rotation.z += c.giro.z * dt;
      if (k > 0.55) c.obj.scale.multiplyScalar(Math.max(0, 1 - dt * 6)); // somem encolhendo
      if (k >= 1) c.obj.visible = false;
    }
    // anéis: o de fora abre mais e mais rápido; os dois somem juntos
    const abre = 1 - (1 - Math.min(1, k * 1.6)) ** 3;
    this.aneis.forEach((r, i) => {
      r.scale.setScalar(BALL_R * (i === 0 ? 1.2 + abre * 3.6 : 0.8 + abre * 1.8));
      (r.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) r.visible = false;
    });
    if (k >= 1) this.morte = 0;
  }

  private updateShock(dt: number): void {
    if (this.pop > 0) {
      this.pop = Math.max(0, this.pop - dt);
      const t = 1 - this.pop / 0.4; // 0 → 1
      this.shieldPop.scale.setScalar(1 + t * 1.6);
      (this.shieldPop.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
      this.shieldPop.visible = this.pop > 0;
    }
  }

  /**
   * Chamada a cada quadro com o tempo real dele. Se o aparelho não segura ~48 quadros/s por 2 s, baixa um degrau da
   * resolução (1,5 → 1,25 → 1). Só baixa, nunca sobe: evita ficar alternando.
   */
  medirQuadro(seg: number): void {
    if (this.pixelRatio <= 1 || seg <= 0 || seg > 0.25) return; // 0,25 s: aba em segundo plano, não conta
    this.amostra.t += seg;
    this.amostra.n++;
    if (this.amostra.t < 2) return;
    const media = this.amostra.t / this.amostra.n;
    this.amostra = { t: 0, n: 0 };
    if (media <= 1 / 48) return;
    this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Ajusta tela e distância da câmera: a torre inteira cabe na largura e, em tela larga, fica como no celular em pé. */
  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const halfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const needW = R_OUT * 1.45; // meia largura visível desejada
    // Enquadramento do celular em pé (~0,6) também em tela larga: mesma distância, mesmos andares à vista e a bola no
    // mesmo lugar; o computador só ganha cenário dos lados (antes a câmera chegava perto e a bola sumia no topo)
    const ASPECTO_CELULAR = 0.6;
    this.camDist = Math.max(10, needW / (halfV * Math.min(aspect, ASPECTO_CELULAR)));
    // Neblina só longe: some nos andares muito abaixo e suaviza a cidade lá embaixo; perto da torre, nada de névoa.
    this.fog.near = this.camDist + 30;
    this.fog.far = this.camDist + 230;
    this.backdrop.resize();
  }
}
