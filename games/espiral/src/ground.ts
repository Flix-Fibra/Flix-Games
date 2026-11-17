import * as THREE from 'three';
import { toon } from './toon';
import { rng } from './logic';
import type { Palette } from './theme';

/**
 * Bairro lá embaixo, visto do alto da torre: chão, ruas, casinhas com telhado colorido e árvores, em 3D liso (mesmo
 * estilo das placas). Um "mar" de nuvens fica entre a torre e o chão.
 *
 * O bairro acompanha a câmera na altura (sempre lá embaixo, porque a torre não tem fim) e gira só um pouco com a torre.
 * Casas e árvores usam InstancedMesh: centenas de objetos em poucas chamadas de desenho, leve no celular.
 */

const GROUND_SPIN = 0.1; // o bairro gira só 10% do giro da torre: profundidade sem a vista ficar rodando
const DROP = 80; // quanto o chão fica abaixo da câmera (bem lá embaixo: vista do alto da torre)
const RADIUS = 170; // raio do bairro (casas e ruas)
const GRASS_R = 320; // o gramado vai além e some no horizonte
const ROADS = 6; // ruas saindo do centro
const RING_ROAD = 48; // raio da avenida circular
const CLOUD_LAYER = 30; // altura das nuvens acima do chão (meio do caminho até a câmera)

const ROOF_COLORS = [0xc8442f, 0xd9653b, 0x9b3a2e, 0x3f6fa8, 0x5a6b7d, 0xb8732f];
const WALL_COLORS = [0xf4efe6, 0xefe2c8, 0xe7eef3, 0xf3d9c4, 0xdfe7d3];

function softCloud(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  for (const [x, y, r] of [
    [70, 80, 44],
    [125, 60, 54],
    [180, 78, 42],
    [140, 92, 42],
    [95, 94, 36],
  ] as const) {
    const grad = g.createRadialGradient(x, y, r * 0.25, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Opaco no meio, sumindo na borda: o gramado se mistura ao céu em vez de terminar numa linha. */
function radialFade(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class Ground {
  readonly group = new THREE.Group();
  private readonly grassMat = toon({
    roughness: 1,
    fog: false,
    transparent: true,
    alphaMap: radialFade(),
  });
  private readonly roadMat = toon({ color: 0x55585e, roughness: 1, fog: false });
  private readonly wallMat = toon({ roughness: 0.9, fog: false });
  private readonly roofMat = toon({ roughness: 0.8, fog: false });
  private readonly treeMat = toon({ color: 0x3f7a3a, roughness: 1, fog: false });
  private readonly cloudMat = new THREE.SpriteMaterial({ map: softCloud(), transparent: true, depthWrite: false, fog: false });
  private readonly clouds: THREE.Sprite[] = [];

  constructor() {
    const rand = rng(2024);

    const grass = new THREE.Mesh(new THREE.CircleGeometry(GRASS_R, 64).rotateX(-Math.PI / 2), this.grassMat);
    this.group.add(grass);

    // Ruas: raios saindo do centro e uma avenida circular.
    const roadAngles: number[] = [];
    for (let i = 0; i < ROADS; i++) {
      const a = (i / ROADS) * Math.PI * 2 + rand() * 0.3;
      roadAngles.push(a);
      const len = RADIUS - 12;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len).rotateX(-Math.PI / 2), this.roadMat);
      road.position.set(Math.cos(a) * (len / 2 + 10), 0.02, -Math.sin(a) * (len / 2 + 10));
      road.rotation.y = a + Math.PI / 2;
      this.group.add(road);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RING_ROAD - 1.3, RING_ROAD + 1.3, 64).rotateX(-Math.PI / 2),
      this.roadMat,
    );
    ring.position.y = 0.02;
    this.group.add(ring);

    // Casas ao longo das ruas, dos dois lados, viradas para a rua.
    type Spot = { x: number; z: number; face: number };
    const spots: Spot[] = [];
    for (const a of roadAngles) {
      const dir = { x: Math.cos(a), z: -Math.sin(a) };
      const side = { x: -dir.z, z: dir.x };
      for (let d = 16; d < RADIUS - 14; d += 5 + rand() * 2) {
        for (const s of [-1, 1]) {
          if (rand() < 0.2) continue;
          const off = 5 + rand() * 1.5;
          spots.push({ x: dir.x * d + side.x * off * s, z: dir.z * d + side.z * off * s, face: a + (s > 0 ? 0 : Math.PI) });
        }
      }
    }
    for (let t = 0; t < Math.PI * 2; t += 6 / RING_ROAD) {
      for (const off of [-5.5, 5.5]) {
        if (rand() < 0.25) continue;
        const r = RING_ROAD + off;
        spots.push({ x: Math.cos(t) * r, z: -Math.sin(t) * r, face: t });
      }
    }
    // Tira casas em cima de ruas (cruzamentos).
    const onRoad = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      if (Math.abs(r - RING_ROAD) < 3.2) return true;
      const ang = Math.atan2(-z, x);
      return roadAngles.some((a) => Math.abs(Math.sin(ang - a)) * r < 3 && Math.cos(ang - a) > 0);
    };
    const houses = spots.filter((p) => !onRoad(p.x, p.z));

    const wallGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const roofGeo = new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const walls = new THREE.InstancedMesh(wallGeo, this.wallMat, houses.length);
    const roofs = new THREE.InstancedMesh(roofGeo, this.roofMat, houses.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    houses.forEach((h, i) => {
      const w = 2.6 + rand() * 1.6;
      const d = 2.4 + rand() * 1.4;
      const hh = 1.6 + rand() * (rand() < 0.15 ? 2.5 : 0.8); // às vezes um sobrado
      q.setFromAxisAngle(up, h.face);
      m.compose(new THREE.Vector3(h.x, 0, h.z), q, new THREE.Vector3(w, hh, d));
      walls.setMatrixAt(i, m);
      walls.setColorAt(i, color.setHex(WALL_COLORS[Math.floor(rand() * WALL_COLORS.length)]!));
      m.compose(new THREE.Vector3(h.x, hh, h.z), q, new THREE.Vector3(w * 1.15, 1.1 + rand() * 0.5, d * 1.15));
      roofs.setMatrixAt(i, m);
      roofs.setColorAt(i, color.setHex(ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)]!));
    });
    this.group.add(walls, roofs);

    // Árvores espalhadas onde não tem rua nem casa.
    const treeGeo = new THREE.ConeGeometry(0.9, 2.6, 7).translate(0, 1.3, 0);
    const TREES = 220;
    const trees = new THREE.InstancedMesh(treeGeo, this.treeMat, TREES);
    let placed = 0;
    for (let tries = 0; placed < TREES && tries < TREES * 6; tries++) {
      const r = 14 + rand() * (RADIUS - 20);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = -Math.sin(a) * r;
      if (onRoad(x, z) || houses.some((h) => (h.x - x) ** 2 + (h.z - z) ** 2 < 9)) continue;
      const s = 0.8 + rand() * 0.8;
      m.compose(new THREE.Vector3(x, 0, z), q.identity(), new THREE.Vector3(s, s, s));
      trees.setMatrixAt(placed, m);
      trees.setColorAt(placed, color.setHex(0x3f7a3a).multiplyScalar(0.8 + rand() * 0.4));
      placed++;
    }
    trees.count = placed;
    this.group.add(trees);

    // Nuvens entre a torre e o chão (sempre de frente para a câmera).
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(this.cloudMat);
      s.renderOrder = 1; // depois do gramado (que também é transparente), senão ele cobre as nuvens
      const r = 20 + rand() * 80;
      const a = rand() * Math.PI * 2;
      s.position.set(Math.cos(a) * r, CLOUD_LAYER + rand() * 16, -Math.sin(a) * r);
      const size = 30 + rand() * 30;
      s.scale.set(size, size / 2, 1);
      this.group.add(s);
      this.clouds.push(s);
    }
  }

  setPalette(p: Palette): void {
    const k = p.light;
    this.grassMat.color.setHex(p.grass);
    this.roadMat.color.setHex(0x55585e).multiplyScalar(k);
    this.wallMat.color.setScalar(k);
    this.roofMat.color.setScalar(k);
    this.treeMat.color.setScalar(k);
    this.cloudMat.color.setHex(p.cloud.color);
    this.cloudMat.opacity = Math.min(0.85, p.cloud.opacity);
  }

  /** O bairro fica sempre `DROP` abaixo da câmera e gira bem pouco com a torre. */
  update(dt: number, camY: number, rotation: number): void {
    this.group.position.y = camY - DROP;
    this.group.rotation.y = rotation * GROUND_SPIN;
    for (const c of this.clouds) {
      // Deriva lenta em volta da torre.
      const a = Math.atan2(-c.position.z, c.position.x) + dt * 0.01;
      const r = Math.hypot(c.position.x, c.position.z);
      c.position.x = Math.cos(a) * r;
      c.position.z = -Math.sin(a) * r;
    }
  }
}
