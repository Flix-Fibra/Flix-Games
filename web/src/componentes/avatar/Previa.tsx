import { useId, type ReactNode } from 'react';
import { palettes, sanitizeAvatar } from '@flix/avatar';
import type { AvatarConfig, CatalogoAvatar } from '../../dados/tipos';

/**
 * Personagem CHIBI ilustrado (vetor), corpo inteiro: cabeça grande, olhos grandes com brilho,
 * cabelo volumoso, contorno escuro e sombra suave. Bases masculina (b01) e feminina (b02).
 * As cores e as peças vêm do catálogo único (packages/flix-avatar).
 */

export function avatarPadrao(cat: CatalogoAvatar): AvatarConfig {
  return JSON.parse(JSON.stringify(cat.padrao)) as AvatarConfig;
}

// ---------- cores ----------
type Paleta = Record<string, { base: string; shade: string }>;
const cor = (grupo: Paleta, id: string | undefined | null, padrao: string) => (id && grupo[id]?.base) || padrao;
function tom(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
const LINHA = '#2A1A1F';

// ---------- mechas onduladas (cabelo cacheado e longo) ----------
/** Mecha em forma de gota ondulada, de (x, y) para baixo. */
function mecha(x: number, y: number, comp: number, larg: number, fase: number, incl: number, ondas = 2.5): string {
  const esq: string[] = [], dir: string[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = x + Math.sin(t * Math.PI * ondas + fase) * larg * 0.45 + incl * t * comp;
    const cy = y + t * comp;
    const w = larg * 0.5 * (1 - t * 0.8) + 0.4;
    esq.push(`${(cx - w).toFixed(1)} ${cy.toFixed(1)}`);
    dir.unshift(`${(cx + w).toFixed(1)} ${cy.toFixed(1)}`);
  }
  return `M${esq.join(' L')} L${dir.join(' L')} Z`;
}

function Cabelo({ estilo, c, camada, fem, id }: { estilo: string; c: string; camada: 'atras' | 'frente'; fem: boolean; id: string }) {
  const sombra = tom(c, -0.3), luz = tom(c, 0.35), contorno = tom(c, -0.6);
  const p = { fill: `url(#cab${id})`, stroke: contorno, strokeWidth: 1.2, strokeLinejoin: 'round' as const };
  const brilho = (d: string) => <path d={d} stroke={luz} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />;
  const grad = (
    <defs>
      <linearGradient id={`cab${id}`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor={tom(c, 0.12)} /><stop offset="1" stopColor={sombra} />
      </linearGradient>
    </defs>
  );

  if (estilo === 'h04_curly') {
    // Um cacho: círculo com contorno, espiral por dentro e brilho em cima à esquerda
    const cacho = (cx: number, cy: number, r: number, k: string | number) => (
      <g key={k}>
        {/* cacho em mola: oval alongado com as voltas da espiral marcadas */}
        <ellipse cx={cx} cy={cy} rx={r * 0.78} ry={r * 1.22} fill={`url(#cab${id})`} stroke={contorno} strokeWidth="1.1" />
        <path d={`M${cx - r * 0.7} ${cy - r * 0.35}q${r * 0.7} ${r * 0.45} ${r * 1.4} 0M${cx - r * 0.72} ${cy + r * 0.35}q${r * 0.72} ${r * 0.45} ${r * 1.44} 0`} stroke={sombra} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d={`M${cx - r * 0.35} ${cy - r * 0.95}q-${r * 0.3} ${r * 0.5} -${r * 0.1} ${r * 1.0}`} stroke={luz} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity=".85" />
      </g>
    );
    if (camada === 'atras') {
      // massa de cachos atrás da cabeça, descendo pelas costas (de cima para baixo)
      const cachos: ReactNode[] = [];
      let n = 0;
      for (let y = 22; y <= 108; y += 8) {
        const linha = Math.round((y - 22) / 8);
        for (let x = 12 + (linha % 2) * 3.5; x <= 88; x += 7) {
          if (((x - 50) / 39) ** 2 + ((y - 60) / 50) ** 2 > 1) continue;
          cachos.push(cacho(x, y, 6.6 - Math.max(0, y - 80) * 0.05, n++));
        }
      }
      return <g>{grad}{cachos}</g>;
    }
    // frente: topo liso, franja de cachos e cachos emoldurando o rosto
    const lados: [number, number][] = [[24, 45], [20.5, 54], [23, 63], [19.5, 72], [22, 81], [19, 90]];
    return (
      <g>
        {grad}
        <path d="M24 46C22 26 36 16 50 16C64 16 78 26 76 46C72 38 64 33 50 32C36 33 28 38 24 46Z" {...p} />
        {brilho('M34 23q8-6 17-6')}
        {[[31, 34, 5.2], [39, 31, 5.4], [50, 30.5, 5.6], [61, 31, 5.4], [69, 34, 5.2]].map(([x, y, r], i) => cacho(x!, y!, r!, 'f' + i))}
        {lados.map(([x, y], i) => cacho(x, y, 5.6, 'e' + i))}
        {lados.map(([x, y], i) => cacho(100 - x, y, 5.6, 'd' + i))}
      </g>
    );
  }

  if (estilo === 'h02_long') {
    if (camada === 'atras') return <g>{grad}<path d="M22 46C20 20 80 20 78 46L81 104C68 111 32 111 19 104Z" {...p} />{brilho('M27 60q-2 20 0 38')}{brilho('M73 60q2 20 0 38')}</g>;
    return (
      <g>
        {grad}
        <path d="M24 52C21 27 36 16 50 16C65 16 79 27 76 54C73 44 69 38 63 34C56 42 43 45 31 40C28 44 26 48 24 52Z" {...p} />
        <path d={mecha(26, 44, 40, 7, 0.5, -0.04, 1.2)} {...p} /><path d={mecha(74, 44, 40, 7, 2.5, 0.04, 1.2)} {...p} />
        {brilho('M34 24q8-6 18-6')}{brilho('M58 38q6-2 10-6')}
      </g>
    );
  }

  if (camada === 'atras') return null;

  if (estilo === 'h03_spiky') {
    return (
      <g>
        {grad}
        <path d="M24 50C22 40 23 33 26 28L22 22L31 22L30 14L39 18L42 9L49 15L55 8L59 16L67 12L67 20L77 19L73 27C77 33 78 41 76 50C73 42 69 37 63 34C58 38 48 39 41 36C35 39 29 43 24 50Z" {...p} />
        {brilho('M35 21q6-4 13-4')}
      </g>
    );
  }

  // h01_short (curto)
  return (
    <g>
      {grad}
      <path d={fem
        ? 'M24 54C20 28 35 16 50 16C65 16 80 28 76 54C74 44 70 38 64 34C58 40 47 41 38 37C32 40 27 46 24 54Z'
        : 'M24 50C21 29 35 17 50 17C65 17 79 29 76 50C74 42 70 37 65 34C60 39 51 40 43 36C37 39 29 43 24 50Z'} {...p} />
      <path d="M43 36l-4 7M52 38l-2 6M60 37l1 5" stroke={contorno} strokeWidth="1" fill="none" strokeLinecap="round" />
      {brilho('M34 24q8-6 18-6')}
    </g>
  );
}

function Olho({ cx, lado, tipo, fem, id }: { cx: number; lado: 1 | -1; tipo: string; fem: boolean; id: string }) {
  if (tipo === 'e02') {
    return <path d={`M${cx - 5.5} 55Q${cx} 47.5 ${cx + 5.5} 55`} stroke={LINHA} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
  }
  const ix = cx + 0.6 * lado;
  const fora = cx - 6.6 * lado; // canto de fora do olho
  return (
    <g>
      <ellipse cx={cx} cy="53.5" rx="6.1" ry="7" fill="#FFFFFF" />
      <ellipse cx={ix} cy="54.4" rx="4.5" ry="5.8" fill={`url(#iris${id})`} />
      <ellipse cx={ix} cy="55" rx="2.1" ry="2.9" fill="#1A0F0A" />
      <circle cx={ix - 1.7} cy="51.4" r="1.9" fill="#FFFFFF" />
      <circle cx={ix + 1.9} cy="57.4" r=".9" fill="#FFFFFF" />
      {/* cílio de cima grosso e linha de baixo */}
      <path d={`M${cx - 6.6} 53.2Q${cx} 43.6 ${cx + 6.6} 53.2`} stroke={LINHA} strokeWidth={fem ? 2.8 : 2.3} fill="none" strokeLinecap="round" />
      <path d={`M${cx - 4.5} 60.8Q${cx} 62.4 ${cx + 4.5} 60.8`} stroke={LINHA} strokeWidth=".9" fill="none" strokeLinecap="round" opacity=".6" />
      {fem && <path d={`M${fora} 52.6l${-2.4 * lado} -1.8M${fora + 1 * lado} 50.4l${-1.8 * lado} -2.4`} stroke={LINHA} strokeWidth="1.5" strokeLinecap="round" />}
    </g>
  );
}

export function Previa({ avatar: bruto, tamanho = 160, rosto = false }: { avatar: AvatarConfig; cat?: CatalogoAvatar; tamanho?: number; rosto?: boolean }) {
  const id = useId().replace(/:/g, '');
  const av = sanitizeAvatar(bruto);
  const pal = palettes as unknown as { skin: Paleta; hair: Paleta; cloth: Paleta };
  const fem = av.body.type === 'b02';
  const pele = cor(pal.skin, av.body.skinTone, '#D9A577');
  const peleS = tom(pele, -0.18);
  const tech = av.skinPreset === 'flix_tech';
  const camisa = tech ? '#D4142C' : cor(pal.cloth, av.top?.primary, '#2B2B33');
  const calca = cor(pal.cloth, av.bottom?.primary, '#2B2B33');
  const tenis = cor(pal.cloth, av.shoes?.primary, '#F5F5F7');
  const cabelo = av.hair ? cor(pal.hair, av.hair.color, '#3B2A20') : null;
  const estilo = av.hair?.style ?? '';
  const bone = tech ? '#D4142C' : av.hat ? cor(pal.cloth, av.hat.primary, '#2F6FDE') : null;
  const moletom = !tech && av.top?.item === 't02_hoodie';
  const sobr = cabelo ? tom(cabelo, -0.45) : tom(pele, -0.5);
  const contornoPele = tom(pele, -0.62);
  const traco = { stroke: LINHA, strokeWidth: 1.3, strokeLinejoin: 'round' as const };

  // corpo: masculino com ombros largos e cintura reta; feminino com cintura marcada
  const tronco = fem
    ? 'M35 80C38 76 43 75 45 75H55C57 75 62 76 65 80L68 93C66 95 64 95.5 62.5 95.5L61.5 103C61 107 60 110 59 112H41C40 110 39 107 38.5 103L37.5 95.5C36 95.5 34 95 32 93Z'
    : 'M32 80C35 76 42 75 45 75H55C58 75 65 76 68 80L71 94C69 96 66.5 96.5 65 96.5L63 112H37L35 96.5C33.5 96.5 31 96 29 94Z';
  const bracoE = fem ? 'M33 93C31 99 30 104 30.5 108' : 'M30 94C28 100 27.5 104 28 108';
  const bracoD = fem ? 'M67 93C69 99 70 104 69.5 108' : 'M70 94C72 100 72.5 104 72 108';
  const maoE = fem ? 30.5 : 28, maoD = fem ? 69.5 : 72;

  return (
    <svg viewBox={rosto ? '17 12 66 66' : '8 4 84 156'} width={tamanho} height={tamanho} style={{ width: tamanho, height: tamanho }}
      role="img" aria-label="Personagem" className="gx-av-previa">
      <defs>
        <radialGradient id={`pele${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor={tom(pele, 0.12)} /><stop offset="1" stopColor={peleS} />
        </radialGradient>
        <linearGradient id={`iris${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A1F12" /><stop offset=".55" stopColor="#7A4A2A" /><stop offset="1" stopColor="#C88A4E" />
        </linearGradient>
        <linearGradient id={`roupa${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tom(camisa, 0.15)} /><stop offset=".6" stopColor={camisa} /><stop offset="1" stopColor={tom(camisa, -0.3)} />
        </linearGradient>
      </defs>

      {/* sombra no chão */}
      {!rosto && <ellipse cx="50" cy="154" rx="22" ry="3.2" fill="rgba(0,0,0,.25)" />}

      {/* cabelo de trás */}
      {cabelo && !tech && <Cabelo estilo={estilo} c={cabelo} camada="atras" fem={fem} id={id} />}

      {/* pernas, calça e tênis */}
      <path d={fem ? 'M39 110H61L62 146H52L50.5 122H49.5L48 146H38Z' : 'M37 110H63L63.5 146H52.5L50.8 121H49.2L47.5 146H36.5Z'} fill={calca} {...traco} />
      <path d="M50 113V121" stroke={tom(calca, 0.25)} strokeWidth=".8" />
      {[[36, 1], [64, -1]].map(([x, l]) => (
        <g key={x}>
          <path d={`M${x} 145H${x! + 12 * l!}C${x! + 13 * l!} 146 ${x! + 14 * l!} 149 ${x! + 14 * l!} 152H${x! - 3 * l!}C${x! - 3 * l!} 148 ${x! - 1 * l!} 145.5 ${x} 145Z`} fill={tenis} {...traco} />
          <path d={`M${x! - 3 * l!} 150.3H${x! + 14 * l!}`} stroke={tom(tenis, -0.35)} strokeWidth="1.6" />
        </g>
      ))}

      {/* braços (pele) e mãos */}
      {[bracoE, bracoD].map((d) => <path key={'l' + d} d={d} stroke={LINHA} strokeWidth={(fem ? 5.6 : 6.6) + 2.6} fill="none" strokeLinecap="round" />)}
      {[bracoE, bracoD].map((d) => <path key={d} d={d} stroke={moletom ? camisa : pele} strokeWidth={fem ? 5.6 : 6.6} fill="none" strokeLinecap="round" />)}
      <circle cx={maoE} cy="110" r="3.6" fill={pele} {...traco} />
      <circle cx={maoD} cy="110" r="3.6" fill={pele} {...traco} />

      {/* tronco e roupa */}
      {moletom && <path d="M38 79C38 72 62 72 62 79C58 77 42 77 38 79Z" fill={tom(camisa, -0.25)} {...traco} />}
      <path d={tronco} fill={`url(#roupa${id})`} {...traco} />
      {moletom && <><path d="M42 98H58L57 106H43Z" fill={tom(camisa, -0.12)} {...traco} /><path d="M46 79v8M54 79v8" stroke={tom(camisa, 0.5)} strokeWidth="1" strokeLinecap="round" /></>}
      {tech && <><rect x="52" y="85" width="11" height="5.5" rx="1.5" fill="#FFFFFF" /><text x="57.5" y="89.2" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#D4142C" fontFamily="system-ui,sans-serif">FLIX</text></>}
      {/* pescoço e gola */}
      <path d="M45 66H55V77C53 78.5 47 78.5 45 77Z" fill={peleS} />
      {!moletom && <path d="M44 76.5Q50 81 56 76.5" stroke={LINHA} strokeWidth="1.2" fill="none" />}

      {/* orelhas e cabeça */}
      <ellipse cx="25.6" cy="53" rx="3.3" ry="5" fill={pele} stroke={contornoPele} strokeWidth="1.1" />
      <ellipse cx="74.4" cy="53" rx="3.3" ry="5" fill={pele} stroke={contornoPele} strokeWidth="1.1" />
      <path d={fem ? 'M25 47C25 29 36 21 50 21C64 21 75 29 75 47C75 62 64 72 50 72C36 72 25 62 25 47Z' : 'M25 47C25 29 36 21 50 21C64 21 75 29 75 47C75 61 66 71.5 50 71.5C34 71.5 25 61 25 47Z'}
        fill={`url(#pele${id})`} stroke={contornoPele} strokeWidth="1.3" />

      {/* rosto */}
      <ellipse cx="35.5" cy="62" rx="3.8" ry="1.9" fill="#F0707E" opacity=".33" />
      <ellipse cx="64.5" cy="62" rx="3.8" ry="1.9" fill="#F0707E" opacity=".33" />
      <Olho cx={39} lado={1} tipo={av.face.eyes} fem={fem} id={id} />
      <Olho cx={61} lado={-1} tipo={av.face.eyes} fem={fem} id={id} />
      <path d={fem ? 'M33.5 41Q38.5 37.6 43.5 39.4M56.5 39.4Q61.5 37.6 66.5 41' : 'M32.5 41Q38 38 44 39.2M56 39.2Q62 38 67.5 41'}
        stroke={sobr} strokeWidth={fem ? 1.6 : 2.6} fill="none" strokeLinecap="round" />
      <path d="M50.2 59.5q1.4 1.6 0 2.3" stroke={tom(pele, -0.35)} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {av.face.mouth === 'm02' ? (
        <g>
          <path d="M44.5 64Q50 71.5 55.5 64Z" fill="#6A1E26" stroke={LINHA} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M45.6 64.4H54.4Q54 66 50 66Q46 66 45.6 64.4Z" fill="#FFFFFF" />
          <ellipse cx="50" cy="68.3" rx="2.6" ry="1.3" fill="#E7727C" />
        </g>
      ) : (
        <path d="M45.5 64Q50 68.2 54.5 64" stroke={fem ? '#9A3A46' : LINHA} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}

      {/* cabelo da frente e boné */}
      {cabelo && !tech && <Cabelo estilo={estilo} c={cabelo} camada="frente" fem={fem} id={id} />}
      {bone && (
        <g {...traco}>
          <path d="M24 38C24 23 36 15 50 15C64 15 76 23 76 38Z" fill={bone} />
          <path d="M50 15V38" fill="none" stroke={tom(bone, -0.3)} strokeWidth="1" />
          <path d="M24 38H78C86 38 90 40 90 42.5H24Z" fill={tom(bone, -0.2)} />
          {tech && <text x="40" y="33" textAnchor="middle" fontSize="5" fontWeight="900" fill="#FFFFFF" stroke="none" fontFamily="system-ui,sans-serif">FLIX</text>}
        </g>
      )}
    </svg>
  );
}
