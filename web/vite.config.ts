import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { defineConfig, searchForWorkspaceRoot, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PASTA_JOGOS = resolve(__dirname, '../games');
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

/**
 * Só em desenvolvimento/preview: serve /games/<pasta>/... a partir de ../games/<pasta>/dist (build do jogo)
 * ou ../games/<pasta>/ (jogo sem build, como o de teste). Em produção quem faz isso é o nginx.
 * - Recusa caminho que saia da pasta do jogo (path traversal).
 * - Access-Control-Allow-Origin: * porque o jogo roda em iframe isolado (origem "null") e precisa
 *   carregar os próprios arquivos. São arquivos públicos, sem cookie.
 */
function servirJogos(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const m = /^\/games\/([a-z0-9_-]{1,40})(\/.*)?$/.exec(url.pathname);
    if (!m) return next();
    const pasta = m[1]!;
    let resto: string;
    try { resto = decodeURIComponent(m[2] ?? '/'); } catch { res.statusCode = 400; res.end(); return; }
    if (resto.endsWith('/')) resto += 'index.html';
    const base = existsSync(join(PASTA_JOGOS, pasta, 'dist')) ? join(PASTA_JOGOS, pasta, 'dist') : join(PASTA_JOGOS, pasta);
    const arquivo = normalize(join(base, resto));
    if (!arquivo.startsWith(base + sep) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
      res.statusCode = 404;
      res.end('Não encontrado');
      return;
    }
    res.setHeader('Content-Type', TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(arquivo).pipe(res);
  };
  return {
    name: 'servir-jogos',
    configureServer: (s) => { s.middlewares.use(middleware); },
    configurePreviewServer: (s) => { s.middlewares.use(middleware); },
  };
}

/**
 * Universal LPC (submódulo web/lpc, GPL-3.0): o código do LPC importa `../<nome>-metadata.js`;
 * esses módulos são gerados pelo gerador original (scripts/lpc-gerar.mjs) em web/lpc-gerado/.
 * Os sprites são servidos em /spritesheets/ (desenvolvimento) e copiados para dist/ no build.
 */
const LPC = resolve(__dirname, 'lpc');
const LPC_GERADO = resolve(__dirname, 'lpc-gerado');
const METADADOS_LPC = ['index-metadata.js', 'palette-metadata.js', 'item-metadata.js', 'credits-metadata.js', 'layers-metadata.js'];

function spritesLpc(): Plugin {
  const pasta = join(LPC, 'spritesheets');
  const servir: Connect.NextHandleFunction = (req, res, next) => {
    const caminho = new URL(req.url ?? '/', 'http://x').pathname;
    if (caminho === '/lpc/CREDITS.csv' || caminho === '/lpc/LICENSE') {
      res.setHeader('Content-Type', caminho.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8');
      createReadStream(join(LPC, caminho.slice('/lpc/'.length))).pipe(res);
      return;
    }
    if (!caminho.startsWith('/spritesheets/')) return next();
    let rel: string;
    try { rel = decodeURIComponent(caminho.slice('/spritesheets/'.length)); } catch { res.statusCode = 400; res.end(); return; }
    const arquivo = normalize(join(pasta, rel));
    if (!arquivo.startsWith(pasta + sep) || !arquivo.endsWith('.png') || !existsSync(arquivo)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(arquivo).pipe(res);
  };
  return {
    name: 'sprites-lpc',
    configureServer: (s) => { s.middlewares.use(servir); },
    configurePreviewServer: (s) => { s.middlewares.use(servir); },
    closeBundle() {
      // build: copia os sprites (e os avisos de licença/créditos do LPC) junto do site
      const dist = resolve(__dirname, 'dist');
      if (!existsSync(dist)) return;
      cpSync(pasta, join(dist, 'spritesheets'), { recursive: true });
      for (const f of ['LICENSE', 'CREDITS.csv']) cpSync(join(LPC, f), join(dist, 'lpc', f));
    },
  };
}

export default defineConfig({
  plugins: [react(), servirJogos(), spritesLpc()],
  // Pacote do personagem (o mesmo dos jogos): compositor e catálogo vêm de packages/flix-avatar
  resolve: {
    alias: [
      { find: '@flix/avatar', replacement: resolve(__dirname, '../packages/flix-avatar/src/index.ts') },
      // núcleo do Universal LPC usado pelo portal (tipos em src/lpc/lpc.d.ts)
      ...Object.entries({
        catalog: 'state/catalog.ts', state: 'state/state.ts', filters: 'state/filters.ts', renderer: 'canvas/renderer.ts',
        'install-item-metadata': 'install-item-metadata.ts', 'performance-profiler': 'performance-profiler.ts',
        'category-tree': 'models/category-tree.ts', 'credits-utils': 'utils/credits.ts',
      }).map(([nome, arq]) => ({ find: `@lpc/${nome}`, replacement: join(LPC, 'sources', arq) })),
      // módulos de catálogo que o código do LPC importa (gerados por scripts/lpc-gerar.mjs)
      ...METADADOS_LPC.map((nome) => ({ find: new RegExp(`^(.+[\\/])?${nome.replace('.', '\\.')}$`), replacement: join(LPC_GERADO, nome) })),
    ],
  },
  // Só na máquina local: o servidor de desenvolvimento não fica visível na rede.
  // /api vai para a API local (docker compose). Mesma origem: o cookie de sessão funciona sem CORS.
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000' },
    // libera só a pasta do pacote do personagem, além do próprio web/
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), resolve(__dirname, '../packages/flix-avatar'), LPC, LPC_GERADO] },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    // Celulares simples (Q14): JS compatível com navegadores mais antigos.
    target: 'es2019',
    sourcemap: false,
  },
});
