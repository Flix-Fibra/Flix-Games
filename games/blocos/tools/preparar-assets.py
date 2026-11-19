"""
Prepara a arte do G04 a partir de `Space Ping Assets/` (originais fora do Git) para `public/img/`.

Uso (na raiz do repositório):
    python games/blocos/tools/preparar-assets.py "Space Ping Assets" games/blocos/public/img

- jogadora_0..3.png: folha 2x2 (1024x1024) da personagem com a raquete, fundo branco removido pelo
  contorno (o branco de dentro da figura fica). Os 4 quadros usam o mesmo recorte, para não "pular".
- prancha_0..N.png: GIF da prancha (640x360, fundo branco). O fundo é "desmisturado" do branco
  (alfa pelo quanto a cor se afasta do branco), assim o brilho e as chamas ficam translúcidos.
- bola.png e bola_rapida.png: dois quadros da folha da bola de raios (fundo preto, desmisturado do preto),
  recortados longe da marca d'água do meio da folha. O centro da bola fica a `BALL_CX` px da direita.
Imprime as medidas usadas no código (âncoras e escalas).
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

CHAR_SCALE = 0.52  # personagem com ~220 px de altura no jogo
BOARD_SCALE = 0.6
BALL_SCALE = 0.62  # bola (círculo de ~48 px na folha) com ~30 px no jogo


def save(arr, name):
    Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, name), optimize=True)


def resize(arr, s):
    im = Image.fromarray(arr, 'RGBA')
    w, h = im.size
    # pré-multiplica para a borda não ganhar halo ao reduzir
    a = arr[:, :, 3:4].astype(np.float32) / 255
    pm = np.dstack([(arr[:, :, :3] * a).astype(np.uint8), arr[:, :, 3]])
    im = Image.fromarray(pm, 'RGBA').resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = np.array(im).astype(np.float32)
    al = out[:, :, 3:4] / 255
    rgb = np.where(al > 0, out[:, :, :3] / np.maximum(al, 1e-6), 0)
    return np.dstack([np.clip(rgb, 0, 255), out[:, :, 3]]).astype(np.uint8)


# ---- personagem -------------------------------------------------------------------------------------------------------

def char_frames():
    src = np.array(Image.open(os.path.join(SRC, 'openart-thumbnail_57e73b60_1795098399823.png')).convert('RGB'))
    H, W, _ = src.shape
    q = H // 2
    frames = []
    for i in range(4):
        y0, x0 = (i // 2) * q, (i % 2) * q
        a = src[y0:y0 + q, x0:x0 + q]
        light = a.min(axis=2) >= 225
        lab, _ = ndimage.label(light)
        edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
        edge.discard(0)
        bg = np.isin(lab, list(edge))
        fg = ~bg
        # tira pontinhos soltos (riscos de movimento ficam se forem grandes)
        flab, n = ndimage.label(fg)
        sizes = ndimage.sum(fg, flab, range(1, n + 1))
        fg = np.isin(flab, [k + 1 for k, s in enumerate(sizes) if s >= 40])
        # borda clarinha que sobrou do fundo
        ring = fg & ~ndimage.binary_erosion(fg)
        fg &= ~(ring & (a.min(axis=2) >= 200))
        frames.append(np.dstack([a, np.where(fg, 255, 0).astype(np.uint8)]))
    ys, xs = np.where(np.any(np.stack([f[:, :, 3] > 0 for f in frames]), axis=0))
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = []
    for i, f in enumerate(frames):
        c = f[y0:y1, x0:x1]
        r = resize(c, CHAR_SCALE)
        save(r, f'jogadora_{i}.png')
        out.append(r)
    # âncora: pés (fundo da figura) e centro da cabeça da raquete (azul claro e brilhante) no quadro 0
    f0 = frames[0][y0:y1, x0:x1].astype(int)
    racket = (f0[:, :, 2] > 200) & (f0[:, :, 1] > 180) & (f0[:, :, 0] < 150) & (f0[:, :, 3] > 0)
    ry, rx = np.where(racket)
    fy, fx = np.where(f0[:, :, 3] > 0)
    feet_y = fy.max()
    feet_x = fx[fy > feet_y - 40].mean()
    s = CHAR_SCALE
    print(f'jogadora: {out[0].shape[1]}x{out[0].shape[0]} px')
    print(f'  raquete (quadro 0) em x={rx.mean() * s:.0f}, y={ry.mean() * s:.0f}; pés em x={feet_x * s:.0f}, y={feet_y * s:.0f}')


# ---- prancha ----------------------------------------------------------------------------------------------------------

def unblend(rgb, bg):
    """Separa a figura de um fundo liso (branco ou preto): alfa = quanto se afasta do fundo."""
    c = rgb.astype(np.float32)
    if bg == 'white':
        d = (255 - c).max(axis=2)
    else:
        d = c.max(axis=2)
    a = np.clip((d - 6) / (255 - 6), 0, 1)
    a = np.clip(a * 1.6, 0, 1)  # brilho mais encorpado
    if bg == 'white':
        col = 255 - (255 - c) / np.maximum(a[..., None], 1e-3)
    else:
        col = c / np.maximum(a[..., None], 1e-3)
    col = np.clip(col, 0, 255)
    return np.dstack([col, a * 255]).astype(np.uint8)


def board_frames():
    im = Image.open(os.path.join(SRC, 'Gemini_Generated_Gif_ui7s3mui7s3mui7s.gif'))
    frames = []
    for i in range(im.n_frames):
        im.seek(i)
        frames.append(unblend(np.array(im.convert('RGB')), 'white'))
    alpha = np.stack([f[:, :, 3] > 20 for f in frames]).any(axis=0)
    ys, xs = np.where(alpha)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # deck: primeira linha com a prancha (bem escura) no quadro 0
    f0 = frames[0]
    dark = (f0[:, :, :3].max(axis=2) < 120) & (f0[:, :, 3] > 200)
    dy, dx = np.where(dark)
    for i, f in enumerate(frames):
        save(resize(f[y0:y1, x0:x1], BOARD_SCALE), f'prancha_{i}.png')
    s = BOARD_SCALE
    print(f'prancha: {len(frames)} quadros, {round((x1 - x0) * s)}x{round((y1 - y0) * s)} px; '
          f'topo do deck em y={(dy.min() - y0) * s:.0f}, deck de x={(dx.min() - x0) * s:.0f} a {(dx.max() - x0) * s:.0f}; '
          f'{im.info.get("duration")} ms por quadro')


# ---- bola -------------------------------------------------------------------------------------------------------------

def ball():
    src = np.array(Image.open(os.path.join(SRC, 'openart-thumbnail_06617026_1795098700907.png')).convert('RGB'))
    # (nome, centro aproximado da bola na folha 1024x1024); recorte só da faixa da bola, longe da marca d'água
    for name, gx, gy in [('bola', 278, 388), ('bola_rapida', 790, 900)]:
        cx0 = 0 if gx < 512 else 512
        cell = src[:, cx0 + 6:cx0 + 506]
        gx -= cx0 + 6
        # acerta o centro pelo raio branco dentro da bola
        win = cell[gy - 30:gy + 30, gx - 30:gx + 30]
        wy, wx = np.where(win.min(axis=2) > 200)
        by, bx = gy - 30 + int(wy.mean()), gx - 30 + int(wx.mean())
        band = cell[by - 40:by + 40, :bx + 40]
        rgba = unblend(band, 'black')
        xs = np.where((rgba[:, :, 3] > 10).any(axis=0))[0]
        rgba = rgba[:, xs.min():]
        r = resize(rgba, BALL_SCALE)
        save(r, f'{name}.png')
        print(f'{name}: {r.shape[1]}x{r.shape[0]} px; centro da bola a {(40) * BALL_SCALE:.0f} px da direita, y={40 * BALL_SCALE:.0f}')


char_frames()
board_frames()
ball()
