import { useEffect, useRef } from 'react';

/**
 * Fundo do topo no tema escuro, estilo PS5: um "plasma" discreto desenhado na placa de vídeo (WebGL). Só luz e
 * mistura de cor: ondas grandes e lentas misturam a cor principal (--c1) e a secundária (--c2) do card selecionado,
 * com intensidade baixa, forte no alto e sumindo para o meio da tela. Sem textura nem faixas de brilho.
 *
 * Cuidados de desempenho: desenha em meia resolução; pausa com a aba em segundo plano, com o topo fora da tela,
 * com um jogo aberto (`pausado`) e no tema claro; respeita "reduzir movimento" (um quadro parado). Sem WebGL,
 * o CSS mantém as manchas animadas (classe "plasma" só entra quando o WebGL funciona).
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 res; uniform float t; uniform vec3 c1; uniform vec3 c2;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int k = 0; k < 4; k++){ v += a * n(p); p = r * p * 1.9 + 7.3; a *= 0.48; } // menos detalhe fino: ondas sedosas
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;            // 0 embaixo, 1 em cima
  vec2 p = vec2(uv.x * res.x / res.y, uv.y) * 0.6; // ondas bem grandes
  // Deformação leve e lenta: só o suficiente para as cores se misturarem, sem textura de "fumaça"
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.045)), fbm(p + vec2(5.2, -t * 0.04)));
  float f = fbm(p + 1.8 * q + vec2(-t * 0.02, t * 0.015));
  // Mistura suave: a cor principal (vermelho) prevalece; a secundária (roxo) é só um toque discreto à esquerda,
  // mais escura e puxada para a principal.
  float lado = smoothstep(0.0, 1.0, uv.x);
  float m = smoothstep(0.0, 0.7, f + 0.45 * (lado - 0.5) + 0.22);
  vec3 toque = mix(c2, c1, 0.3) * 0.8;
  vec3 cor = mix(toque, c1, m);
  // Mais sóbrio: as cores são puxadas para o grafite do fundo (menos "neon")
  cor = mix(cor, vec3(0.19, 0.20, 0.22), 0.2);
  // Só iluminação: intensidade baixa e quase constante, forte no alto e sumindo para o meio da tela
  float topo = smoothstep(0.0, 1.0, uv.y);
  topo = pow(topo, 1.6);                     // esmaecimento longo e gradual
  float a = topo * (0.2 + 0.1 * f);
  gl_FragColor = vec4(cor * a, a);           // alfa pré-multiplicado
}`;

function corDe(v: string): [number, number, number] | null {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const x = parseInt(m[1]!, 16);
    return [((x >> 16) & 255) / 255, ((x >> 8) & 255) / 255, (x & 255) / 255];
  }
  m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  return m ? [+m[1]! / 255, +m[2]! / 255, +m[3]! / 255] : null;
}

export function FundoPlasma({ pausado }: { pausado: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const pausa = useRef(pausado);
  pausa.current = pausado;

  useEffect(() => {
    const div = caixa.current;
    if (!div) return;
    // Canvas novo a cada montagem (e removido na desmontagem): um contexto WebGL descartado não volta a funcionar
    const canvas = document.createElement('canvas');
    canvas.className = 'gx-plasma';
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return; // sem WebGL: fica o fallback em CSS

    const shader = (tipo: number, src: string) => {
      const s = gl.createShader(tipo)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // um triângulo cobre a tela
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'res');
    const uT = gl.getUniformLocation(prog, 't');
    const uC1 = gl.getUniformLocation(prog, 'c1');
    const uC2 = gl.getUniformLocation(prog, 'c2');
    div.appendChild(canvas);
    div.classList.add('plasma');

    const ESCALA = 0.5; // meia resolução: o desfoque natural do plasma esconde, e pesa 4× menos
    const ajustar = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * ESCALA));
      const hgt = Math.max(1, Math.round(canvas.clientHeight * ESCALA));
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
    };

    // Cores: lê --c1/--c2 do CSS de tempos em tempos e se aproxima delas a cada quadro (fusão suave ao trocar de card)
    const atual = { c1: [0.82, 0.14, 0.16], c2: [0.48, 0.18, 0.97] };
    const alvo = { c1: atual.c1.slice(), c2: atual.c2.slice() };
    const lerCores = () => {
      const cs = getComputedStyle(document.documentElement);
      const a = corDe(cs.getPropertyValue('--c1'));
      const b = corDe(cs.getPropertyValue('--c2'));
      if (a) alvo.c1 = a;
      if (b) alvo.c2 = b;
    };
    lerCores();
    atual.c1 = alvo.c1.slice();
    atual.c2 = alvo.c2.slice();

    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quadro = 0;
    let ultimo = performance.now();
    let tempo = 7; // começa já "misturado"
    let proximaLeitura = 0;
    const desenhar = (agora: number) => {
      quadro = requestAnimationFrame(desenhar);
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      const escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      const visivel = div.getBoundingClientRect().bottom > 0;
      if (pausa.current || document.hidden || !escuro || !visivel) return;
      if (agora > proximaLeitura) { lerCores(); proximaLeitura = agora + 150; }
      const k = Math.min(1, dt * 2.5);
      for (const c of ['c1', 'c2'] as const) for (let i = 0; i < 3; i++) atual[c][i]! += (alvo[c][i]! - atual[c][i]!) * k;
      if (!reduzir) tempo += dt;
      ajustar();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, tempo);
      gl.uniform3fv(uC1, atual.c1);
      gl.uniform3fv(uC2, atual.c2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(quadro);
      div.classList.remove('plasma');
      gl.getExtension('WEBGL_lose_context')?.loseContext(); // libera a placa de vídeo
      canvas.remove();
    };
  }, []);

  return (
    <div ref={caixa} className="gx-fundo" aria-hidden="true" />
  );
}
