"""Recorta a arte de `Voo Rasante Assets/` (JPG com fundo liso) para `games/voo/public/img/` e gera as caixas de colisão.

Uso: python games/voo/tools/preparar-assets.py "Voo Rasante Assets" games/voo/public/img games/voo/src/hitboxes.ts
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT, HIT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
FILES = {
    'aviao': 'Gemini_Generated_Image_ciy456ciy456ciy4.jpg',
    'predios': 'Gemini_Generated_Image_ll15bfll15bfll15.jpg',
    'guindastes': 'Gemini_Generated_Image_scmg35scmg35scmg.jpg',
    'fundo': 'Gemini_Generated_Image_w8gcncw8gcncw8gc.jpg',
}
BAND = 12  # altura (px do sprite final) de cada faixa da caixa de colisão


def load(k):
    return Image.open(os.path.join(SRC, FILES[k])).convert('RGB')


def foreground(img, tol, interior=False):
    """Tudo que não é a cor do fundo (mediana da borda), ligado ao conteúdo; buracos internos ficam sólidos."""
    a = np.array(img).astype(int)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(edge, axis=0)
    diff = np.abs(a - bg).sum(axis=2)
    bgmask = diff < tol
    lab, _ = ndimage.label(bgmask)
    ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(ids))
    if interior:
        bgmask = diff < tol  # tira também o fundo que ficou preso entre cabos e vigas
    fg = ~bgmask
    fg = ndimage.binary_opening(fg, iterations=2)
    return fg


def rgba(img, fg):
    arr = np.dstack([np.array(img), (fg * 255).astype(np.uint8)])
    return Image.fromarray(arr, 'RGBA')


def components(fg, minsize):
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
    lab = lab * fg
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None or (lab[sl] == i).sum() < minsize:
            continue
        out.append((sl, i))
    out.sort(key=lambda t: t[0][1].start)
    return out, lab


def bands(alpha):
    """Caixas [x, y, w, h] (px do sprite) por faixa horizontal."""
    h, w = alpha.shape
    rects = []
    for y in range(0, h, BAND):
        cols = np.where((alpha[y:y + BAND] > 0).any(axis=0))[0]
        if not len(cols):
            continue
        # uma caixa por trecho contínuo (vãos de mais de 16 px entre cabos ficam livres)
        start = prev = int(cols[0])
        for c in list(cols[1:]) + [None]:
            if c is None or c - prev > 16:
                rects.append([start, y, prev - start + 1, min(BAND, h - y)])
                if c is not None:
                    start = int(c)
            if c is not None:
                prev = int(c)
    return rects


hit = {}

# avião: recorte pelo contorno, 112 px de largura
img = load('aviao'); fg = foreground(img, 60)
ys, xs = np.where(fg)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
im = rgba(img, fg).crop(box)
im = im.transpose(Image.FLIP_LEFT_RIGHT)  # o desenho original olha para a esquerda; no jogo o avião voa para a direita
s = 96 / im.width
im = im.resize((96, round(im.height * s)), Image.LANCZOS)
im.save(os.path.join(OUT, 'aviao.png'))
hit['aviao'] = [im.width, im.height]

def extend(arr, min_h):
    """Repete um trecho do meio do prédio (múltiplo do período dos andares) até chegar a min_h de altura."""
    h = arr.shape[0]
    if h >= min_h:
        return arr
    rgb = arr[:, :, :3].astype(int)
    lo, hi = int(h * 0.25), int(h * 0.75)
    best, per = None, 40
    for sh in range(30, 260):
        if hi + sh >= h:
            break
        c = np.abs(rgb[lo:hi] - rgb[lo + sh:hi + sh]).mean()
        if best is None or c < best:
            best, per = c, sh
    n = -(-(min_h - h) // per)
    y1 = int(h * 0.62)
    n_rows = n * per
    return np.concatenate([arr[:y1], np.tile(arr[y1 - per:y1], (n, 1, 1)), arr[y1:]], axis=0) if n_rows else arr


# prédios e guindastes: sprites do tamanho do jogo (escala S), cada um num arquivo
S = 0.92
MIN_PREDIO_H = 820  # prédios mais baixos que isso ganham andares extras (para sempre chegar ao chão)
for key, prefix, minsize in (('predios', 'predio', 20000), ('guindastes', 'guindaste', 15000)):
    img = load(key); fg = foreground(img, 70, interior=(key == 'guindastes'))
    comps, lab = components(fg, minsize)
    print(key, len(comps), 'peças')
    for n, (sl, i) in enumerate(comps):
        part = (lab[sl] == i)
        sub = rgba(img.crop((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)), part)
        sub = sub.resize((round(sub.width * S), round(sub.height * S)), Image.LANCZOS)
        arr = np.array(sub)
        arr[:, :, 3][arr[:, :, 3] < 128] = 0
        if prefix == 'predio':
            arr = extend(arr, MIN_PREDIO_H)
        sub = Image.fromarray(arr, 'RGBA')
        a = arr[:, :, 3]
        sub.save(os.path.join(OUT, f'{prefix}_{n}.png'))
        hit[f'{prefix}_{n}'] = {'w': sub.width, 'h': sub.height, 'rects': bands(a)}

# fundo: na altura do jogo (1280), JPG
img = load('fundo'); H = 1280
img = img.resize((round(img.width * H / img.height), H), Image.LANCZOS)
img.save(os.path.join(OUT, 'fundo.jpg'), quality=82)
hit['fundo'] = [img.width, img.height]

with open(HIT, 'w', encoding='utf-8') as f:
    f.write('// Gerado por tools/preparar-assets.py. Não editar à mão.\n')
    f.write('export interface Sprite { w: number; h: number; rects: Array<[number, number, number, number]> }\n')
    f.write('export const HITBOXES: Record<string, Sprite> = ' + json.dumps({k: v for k, v in hit.items() if isinstance(v, dict)}, separators=(',', ':')) + ';\n')
    f.write('export const AVIAO_SIZE = ' + json.dumps(hit['aviao']) + ' as const;\n')
    f.write('export const FUNDO_SIZE = ' + json.dumps(hit['fundo']) + ' as const;\n')
