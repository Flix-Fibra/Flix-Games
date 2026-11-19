#!/usr/bin/env node
/**
 * O JOGO é a fonte do próprio nome e capa; a plataforma lê do catálogo (tabela `jogos`).
 * Este script lê games/<pasta>/game.json de cada jogo que declara "catalogo" (id no catálogo, ex.: "g03")
 * e gera o SQL que atualiza nome, capa e pasta desse jogo. Roda na entrega do jogo (e à mão em desenvolvimento).
 *
 * Uso (desenvolvimento):
 *   node scripts/sincronizar-catalogo.mjs | docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U flixgames -d flixgames
 * Só confere, sem gravar:
 *   node scripts/sincronizar-catalogo.mjs --conferir
 *
 * Campos do game.json usados:
 *   "catalogo": "g03"            id do jogo no catálogo (obrigatório para sincronizar)
 *   "name":     "Network Snake"  nome mostrado na plataforma
 *   "capa":     "img/logo.png"   imagem dentro da pasta do jogo (em public/ ou na raiz), quadrada de preferência
 *   "cores":    ["#5B12D6", "#1C037C"]  opcional: cor do card (degradê de cima para baixo), em #rrggbb
 *   "previa":   "img/previa.webp"  opcional: animação curta (WebP ou GIF, sem som) atrás do topo da página "Ver"
 * Não é publicado aqui: publicar continua sendo decisão do catálogo (ex.: G10 depende do jurídico).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const JOGOS = join(RAIZ, 'games');
const conferir = process.argv.includes('--conferir');

// Mesmas regras das colunas do banco (migrações 003 e 006): nada que saia da pasta do jogo.
const RE_ID = /^g\d{2}$/;
const RE_PASTA = /^[a-z0-9_-]{1,40}$/;
const RE_CAPA = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(png|jpg|jpeg|webp)$/;
const RE_PREVIA = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(webp|gif)$/;
const RE_COR = /^#[0-9a-fA-F]{6}$/; // só cor hexadecimal: vai para o CSS do portal

/** Texto SQL entre aspas simples (aspas internas dobradas; o banco usa standard_conforming_strings). */
const texto = (s) => `'${String(s).replace(/'/g, "''")}'`;

const erros = [];
const linhas = [];
const vistos = new Map();

for (const pasta of readdirSync(JOGOS).sort()) {
  const arq = join(JOGOS, pasta, 'game.json');
  if (pasta.startsWith('_') || !existsSync(arq)) continue; // _teste-hub e afins ficam de fora
  let g;
  try {
    g = JSON.parse(readFileSync(arq, 'utf8'));
  } catch (e) {
    erros.push(`${pasta}/game.json: JSON inválido (${e.message})`);
    continue;
  }
  if (!g.catalogo) continue; // jogo ainda não ligado ao catálogo

  const problema = (m) => erros.push(`${pasta}/game.json: ${m}`);
  if (!RE_ID.test(g.catalogo)) { problema(`"catalogo" deve ser g01..g99 (veio ${JSON.stringify(g.catalogo)})`); continue; }
  if (!RE_PASTA.test(pasta)) { problema('nome da pasta fora do padrão [a-z0-9_-]'); continue; }
  if (vistos.has(g.catalogo)) { problema(`"catalogo" ${g.catalogo} repetido (também em ${vistos.get(g.catalogo)})`); continue; }
  vistos.set(g.catalogo, pasta);

  const nome = typeof g.name === 'string' ? g.name.trim() : '';
  if (nome.length < 2 || nome.length > 40 || /[\u0000-\u001f<>]/.test(nome)) { problema('"name" precisa ter de 2 a 40 caracteres, sem < > ou controle'); continue; }

  let capa = null;
  if (g.capa != null) {
    if (typeof g.capa !== 'string' || !RE_CAPA.test(g.capa) || g.capa.length > 80) { problema(`"capa" inválida: ${JSON.stringify(g.capa)}`); continue; }
    const achou = [join(JOGOS, pasta, 'public', g.capa), join(JOGOS, pasta, g.capa)].some((p) => existsSync(p));
    if (!achou) { problema(`"capa" não encontrada: ${g.capa} (procurei em public/ e na raiz do jogo)`); continue; }
    capa = g.capa;
  }

  let previa = null;
  if (g.previa != null) {
    if (typeof g.previa !== 'string' || !RE_PREVIA.test(g.previa) || g.previa.length > 80) { problema(`"previa" inválida: ${JSON.stringify(g.previa)}`); continue; }
    const achou = [join(JOGOS, pasta, 'public', g.previa), join(JOGOS, pasta, g.previa)].some((p) => existsSync(p));
    if (!achou) { problema(`"previa" não encontrada: ${g.previa} (procurei em public/ e na raiz do jogo)`); continue; }
    previa = g.previa;
  }

  let cores = '';
  if (g.cores != null) {
    if (!Array.isArray(g.cores) || g.cores.length !== 2 || !g.cores.every((c) => typeof c === 'string' && RE_COR.test(c))) {
      problema(`"cores" deve ser ["#rrggbb", "#rrggbb"] (veio ${JSON.stringify(g.cores)})`);
      continue;
    }
    cores = `, cor1 = ${texto(g.cores[0])}, cor2 = ${texto(g.cores[1])}`;
  }

  linhas.push(
    `UPDATE jogos SET nome = ${texto(nome)}, capa = ${capa ? texto(capa) : 'NULL'}, pasta = ${texto(pasta)}, previa = ${previa ? texto(previa) : 'NULL'}${cores} WHERE id = ${texto(g.catalogo)};`,
  );
  console.error(`ok  ${g.catalogo}  ${pasta}  "${nome}"  capa=${capa ?? '-'}  previa=${previa ?? '-'}${cores ? `  cores=${g.cores.join('/')}` : ''}`);
}

if (erros.length) {
  for (const e of erros) console.error('ERRO ' + e);
  process.exit(1);
}
if (!conferir) {
  // Tudo ou nada: um erro no banco desfaz o lote inteiro.
  process.stdout.write(['BEGIN;', ...linhas, 'COMMIT;', ''].join('\n'));
}
