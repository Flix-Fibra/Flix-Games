/**
 * Prepara as imagens do estilo “Network Snake” enviadas pelo gestor: recorta a cobra-cabo em cabeça, corpo e cauda,
 * apara as bordas transparentes e reduz o tamanho (o jogo roda em celular; meta de carregamento pequena).
 *
 * Uso (precisa do `sharp`, que NÃO é dependência do projeto; instale só para rodar):
 *   npm install --no-save sharp
 *   node games/snake/tools/preparar-assets.cjs "<pasta Network Snake>"
 *
 * As imagens originais ficam fora do Git (ver .gitignore); o resultado vai para `games/snake/public/img/`.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const origem = process.argv[2];
if (!origem) {
  console.error('Informe a pasta “Network Snake”.');
  process.exit(1);
}
const destino = path.join(__dirname, '..', 'public', 'img');
fs.mkdirSync(destino, { recursive: true });

const achar = (trecho) => {
  const f = fs.readdirSync(origem).find((x) => x.normalize('NFC').includes(trecho));
  if (!f) throw new Error('Arquivo não encontrado: ' + trecho);
  return path.join(origem, f);
};
const png = { compressionLevel: 9, palette: true, quality: 88, effort: 10 };

/** Reduz para `largura` px de largura, depois de aparar a transparência. */
async function aparar(arquivo, saida, largura) {
  const buf = await sharp(arquivo).trim({ threshold: 2 }).resize({ width: largura, withoutEnlargement: true }).png(png).toBuffer();
  fs.writeFileSync(path.join(destino, saida), buf);
  const m = await sharp(buf).metadata();
  console.log(saida.padEnd(26), m.width + 'x' + m.height, Math.round(buf.length / 1024) + ' KB');
}

/** Corta uma faixa da cobra e reduz pela razão `k`. */
async function recortar(arquivo, saida, x0, x1, y0, y1, k) {
  const buf = await sharp(arquivo)
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .resize({ width: Math.round((x1 - x0) * k) })
    .png(png)
    .toBuffer();
  fs.writeFileSync(path.join(destino, saida), buf);
  const m = await sharp(buf).metadata();
  console.log(saida.padEnd(26), m.width + 'x' + m.height, Math.round(buf.length / 1024) + ' KB');
}

/** Recorta a imagem pela caixa do conteúdo sólido (ignora o brilho semitransparente em volta) e reduz a `largura`. */
async function recortarConteudo(arquivo, saida, largura, limiar = 200) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = 0, y0 = info.height, y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] >= limiar) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  const buf = await sharp(arquivo)
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: largura })
    .png(png)
    .toBuffer();
  fs.writeFileSync(path.join(destino, saida), buf);
  const m = await sharp(buf).metadata();
  console.log(saida.padEnd(26), m.width + 'x' + m.height, Math.round(buf.length / 1024) + ' KB');
}

(async () => {
  // Cobra: emendas medidas em x (cabeça | 6 segmentos | cauda), conteúdo em y 219..520
  const K = 0.25;
  const cobras = [
    ['Cobra-Cabo', 'azul'],
    ['Imagem do ChatGPT', 'metal'],
  ];
  for (const [trecho, nome] of cobras) {
    const f = achar(trecho);
    await recortar(f, `cobra_${nome}_cabeca.png`, 55, 560, 215, 525, K);
    await recortar(f, `cobra_${nome}_corpo.png`, 930, 1122, 275, 500, K);
    await recortar(f, `cobra_${nome}_cauda.png`, 1673, 2121, 215, 525, K);
  }
  await aparar(achar('Casa com Telhado'), 'casa.png', 192);
  await aparar(achar('Globo digital'), 'globo.png', 256);
  await aparar(achar('Logo FLIX Network Snake'), 'logo.png', 720);
  // rodapé: calçada, arbustos, carretel, van da Flix e cones (faixa larga e baixa; recortada pelo conteúdo sólido)
  await recortarConteudo(achar('287A7E47'), 'rodape.png', 1000, 60);
  // topo: o céu (fundo, cortado na proporção da faixa de cima, 540x148) e a cidade (por cima do céu)
  const ceu = await sharp(achar('DE2D51E8')).resize(1080, 296, { fit: 'cover', position: 'north' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  fs.writeFileSync(path.join(destino, 'ceu.jpg'), ceu);
  console.log('ceu.jpg'.padEnd(26), '1080x296', Math.round(ceu.length / 1024) + ' KB');
  await recortarConteudo(achar('2B72D523'), 'cidade.png', 1080, 60);
  await recortarConteudo(achar('Cerca de Madeira'), 'muro.png', 140); // muro: cerca vertical (girada nos trechos horizontais)
  await aparar(achar('Antena parabo'), 'item_antena.png', 160);
  await aparar(achar('CPE Wireless'), 'item_cpe.png', 120);
  await aparar(achar('Caixa de Fibra'), 'item_caixa.png', 160);
  await aparar(achar('Roteador Gamer'), 'item_roteador.png', 200);
  await aparar(achar('Switch_Flix'), 'item_switch.png', 220);
})();
