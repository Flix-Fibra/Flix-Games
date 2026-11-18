import sys, os
from PIL import Image
import numpy as np
from collections import deque
from scipy import ndimage

SRC = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
TW = 720  # largura lógica do jogo


def flood_bg(passable, seeds):
    """Fundo = pixels 'passáveis' conectados (4-viz.) a alguma semente."""
    lab, _ = ndimage.label(passable)
    ids = {lab[y, x] for (y, x) in seeds if passable[y, x]}
    ids.discard(0)
    return np.isin(lab, list(ids))


def edge_seeds(H, W, step=2):
    s = []
    for x in range(0, W, step): s += [(0, x), (H - 1, x)]
    for y in range(0, H, step): s += [(y, 0), (y, W - 1)]
    return s


def white_pass(a, t=228):
    return a.min(axis=2) >= t


def checker_pass(a, lo=170, sat=22):
    a16 = a.astype(int)
    mx = a16.max(axis=2); mn = a16.min(axis=2)
    return (mn >= lo) & (mx - mn <= sat)


def to_rgba(a, bg):
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([a, alpha]), 'RGBA')


def load(name):
    return np.array(Image.open(os.path.join(SRC, name)).convert('RGB'))


def keep_big(fg, minsize):
    lab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    good = [i + 1 for i, s in enumerate(sizes) if s >= minsize]
    return np.isin(lab, good)


def clean_fringe(im, passes=3, light=170, sat=40):
    """Apaga pixels claros e pouco saturados na borda da figura (restos do fundo branco ou do xadrez)."""
    arr = np.array(im).copy()
    for _ in range(passes):
        alpha = arr[:, :, 3] > 0
        rgb = arr[:, :, :3].astype(int)
        whitish = (rgb.min(axis=2) >= light) & (rgb.max(axis=2) - rgb.min(axis=2) <= sat)
        # vizinho transparente (borda)
        edge = ~ndimage.binary_erosion(alpha, structure=np.ones((3, 3)), border_value=0)
        kill = alpha & whitish & edge
        if not kill.any():
            break
        arr[kill, 3] = 0
    # semitransparentes muito claros (meio-tom com o fundo) também saem
    rgb = arr[:, :, :3].astype(int)
    semi = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 200) & (rgb.min(axis=2) >= light)
    arr[semi, 3] = 0
    # quase transparentes (resto da redução) e fragmentos soltos
    arr[arr[:, :, 3] < 40, 3] = 0
    alpha = arr[:, :, 3] > 0
    lab, n = ndimage.label(alpha, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(alpha, lab, range(1, n + 1))
        small = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v < 60])
        arr[small, 3] = 0
    return Image.fromarray(arr, 'RGBA')


CLEAN = {'tronco.png', 'orelha.png', 'galho.png', 'ninho.png'}


def save_scaled(rgba, name, w=None, h=None, scale=None):
    if scale is None:
        scale = (w / rgba.width) if w else (h / rgba.height)
    nw, nh = round(rgba.width * scale), round(rgba.height * scale)
    im = rgba.resize((nw, nh), Image.LANCZOS)
    if name in CLEAN:
        im = clean_fringe(im)
    im.save(os.path.join(OUT, name), optimize=True)
    return scale, im


# ---- tronco base (eolsm) ----
a = load('Gemini_Generated_Image_eolsmneolsmneols.jpg')
H, W = a.shape[:2]
bg = flood_bg(white_pass(a), edge_seeds(H, W) + [(600, 448)])
fg = keep_big(~bg, 8)
xs = np.arange(W)[None, :].repeat(H, 0)
left_mask = fg & (xs < W / 2); right_mask = fg & (xs >= W / 2)
s = TW / W  # (v1 desenhava a imagem inteira; v2 usa só as peças soltas abaixo)
print('tile scale', s, 'tile h', round(H * s))
for name, m, xr, yr in (('esq', left_mask, (240, 345), (200, 500)), ('dir', right_mask, (545, 650), (700, 1000))):
    pts = []
    for x in range(*xr):
        ys = np.nonzero(m[yr[0]:yr[1], x])[0]
        if len(ys): pts.append((x, ys[0] + yr[0]))
    xsP = [p[0] for p in pts]; ysP = [p[1] for p in pts]
    print('shelf', name, 'x', min(xsP), max(xsP), 'top y min/median', min(ysP), int(np.median(ysP)),
          'scaled center', round(np.mean(xsP) * s), round(np.median(ysP) * s))
    # extensão horizontal da orelha na altura do topo + 15
    yy = int(np.median(ysP)) + 15
    row = np.nonzero(m[yy])[0]
    print('   row', yy, 'fg x ranges sample', row.min(), row.max())

# ---- galho (shjln): tronco esquerdo + galho ----
b = load('Gemini_Generated_Image_shjln3shjln3shjl.jpg')
bgb = flood_bg(white_pass(b), edge_seeds(H, W) + [(700, 450), (150, 600)])
fgb = keep_big(~bgb, 8)
lab, n = ndimage.label(fgb)
keep = np.zeros_like(fgb)
for i in range(1, n + 1):
    ys, xs_ = np.nonzero(lab == i)
    mx, my = xs_.mean(), ys.mean()
    if xs_.min() > 860:  # tronco da direita cortado
        continue
    if mx > 700 and my > 800:  # orelha da direita cortada
        continue
    keep |= lab == i
galho_mask = keep.copy()
pts = []
for x in range(200, 800, 25):
    ys = np.nonzero(keep[150:700, x])[0]
    if len(ys): pts.append((round(x * s), round((ys[0] + 150) * s)))
print('branch top (scaled)', pts)

# ---- ninho (v2): "Captura de tela 2026-11-18 134908.png", fundo branco ----
nst = np.array(Image.open(os.path.join(SRC, 'Captura de tela 2026-11-18 134908.png')).convert('RGB'))
bgn = flood_bg(white_pass(nst, 235), edge_seeds(*nst.shape[:2]))
keep = keep_big(~bgn, 30)
ys, xs_ = np.nonzero(keep)
im = to_rgba(nst, ~keep).crop((xs_.min(), ys.min(), xs_.max() + 1, ys.max() + 1))
sn, imn = save_scaled(im, 'ninho.png', w=150)
print('nest', im.size, '->', imn.size)
al = np.array(imn)[:, :, 3] > 128
lefts = [(y, int(np.nonzero(r)[0][0]), int(np.nonzero(r)[0][-1])) for y, r in enumerate(al) if r.any()]
tipL = min(lefts, key=lambda t: t[1]); tipR = max(lefts, key=lambda t: t[2])
print('nest h', imn.height, 'rim tip left (y,x)', tipL[0], tipL[1], 'right', tipR[0], tipR[2])
print('rows every 8 (y, left, right):', lefts[::8])

# ---- sapo (4 quadros, xadrez pintado) ----
f = load('Gemini_Generated_Image_kprt8gkprt8gkprt.jpg')
Hf, Wf = f.shape[:2]
bgf = flood_bg(checker_pass(f), edge_seeds(Hf, Wf))
keep = keep_big(~bgf, 6)
cuts = [0, 572, 1060, 1537, Wf]
ys, _ = np.nonzero(keep)
y0, y1 = ys.min(), ys.max()
lab, nlab = ndimage.label(keep)
cents = ndimage.center_of_mass(keep, lab, range(1, nlab + 1))
owner = np.zeros(nlab + 1, int)
for i, (cy, cx) in enumerate(cents, start=1):
    owner[i] = sum(cx >= c for c in cuts[1:4])
FW = 480
FS = 0.2
for k in range(4):
    mk = np.isin(lab, [i for i in range(1, nlab + 1) if owner[i] == k])
    body = mk[1350:y1 + 1]
    bys, bxs = np.nonzero(body)
    bx = int(np.median(bxs))
    fr = to_rgba(f, ~mk).crop((bx - FW // 2 + 40, y0, bx + FW // 2 + 40, y1 + 1))
    fr.resize((round(fr.width * FS), round(fr.height * FS)), Image.LANCZOS).save(os.path.join(OUT, f'sapo_{k}.png'), optimize=True)
    print('frog', k, 'body center x', bx)
print('frog frame size', round(FW * FS), round((y1 - y0 + 1) * FS), 'y0', y0, 'y1', y1)

# ---- musgo (xadrez pintado) ----
m = load('Gemini_Generated_Image_t9wt6xt9wt6xt9wt.jpg')
Hm, Wm = m.shape[:2]
bgm = checker_pass(m, 145, 16)  # o musgo não tem cinza: tira o xadrez também nos buracos
keep = keep_big(~bgm, 12)
ys, xs_ = np.nonzero(keep)
im = to_rgba(m, ~keep).crop((xs_.min(), ys.min(), xs_.max() + 1, ys.max() + 1))
_, imm = save_scaled(im, 'musgo.png', w=300)
print('moss', imm.size)

# ---- macaco (GIF, já transparente) ----
g = Image.open(os.path.join(SRC, 'Macaco pixelado disparando estilingue (0.25x).gif'))
frs = []
for i in range(g.n_frames):
    g.seek(i); frs.append(g.convert('RGBA'))
bb = None
for x in frs:
    b_ = x.getbbox()
    bb = b_ if bb is None else (min(bb[0], b_[0]), min(bb[1], b_[1]), max(bb[2], b_[2]), max(bb[3], b_[3]))
print('monkey bbox', bb)
MH = 120
for i, x in enumerate(frs):
    c = x.crop(bb)
    sc = MH / c.height
    c.resize((round(c.width * sc), MH), Image.LANCZOS).save(os.path.join(OUT, f'macaco_{i}.png'), optimize=True)
print('monkey size', round((bb[2] - bb[0]) * MH / (bb[3] - bb[1])), MH)

# ---- fundo estático (fica parado enquanto o macaco sobe) ----
FUNDO = os.path.join(SRC, 'Gemini_Generated_Image_zby95lzby95lzby9.jpg')
if os.path.exists(FUNDO):  # o original saiu da pasta depois de gerado; mantém o fundo.jpg existente
    bgimg = Image.open(FUNDO).convert('RGB')
    GW, GH = 720, 1280
    sc = max(GW / bgimg.width, GH / bgimg.height)
    bgimg = bgimg.resize((round(bgimg.width * sc), round(bgimg.height * sc)), Image.LANCZOS)
    ox, oy = (bgimg.width - GW) // 2, (bgimg.height - GH) // 2
    bgimg.crop((ox, oy, ox + GW, oy + GH)).save(os.path.join(OUT, 'fundo.jpg'), quality=84, optimize=True)
    print('fundo', GW, GH)
else:
    print('fundo: original ausente, mantido o fundo.jpg atual')

# ---- pássaro (GIF de 7 quadros, fundo azul sólido) ----
gb = Image.open(os.path.join(SRC, '30gA1S.gif'))
frs = []
for i in range(gb.n_frames):
    gb.seek(i)
    a_ = np.array(gb.convert('RGB')).astype(int)
    key = a_[2, 2]
    bgm_ = np.abs(a_ - key).sum(axis=2) <= 30
    frs.append(to_rgba(a_.astype(np.uint8), bgm_))
bb = None
for x in frs:
    b_ = x.getbbox()
    bb = b_ if bb is None else (min(bb[0], b_[0]), min(bb[1], b_[1]), max(bb[2], b_[2]), max(bb[3], b_[3]))
BW = 120
for i, x in enumerate(frs):
    c = x.crop(bb)
    sc = BW / c.width
    c.resize((BW, round(c.height * sc)), Image.LANCZOS).save(os.path.join(OUT, f'passaro_{i}.png'), optimize=True)
print('bird bbox', bb, 'size', BW, round((bb[3] - bb[1]) * BW / (bb[2] - bb[0])))

# ---- peças soltas (v2): troncos lisos, orelha de pau e galho, para montar a árvore em qualquer altura ----
S2 = TW / W * 0.75  # mesma escala em que os troncos eram desenhados (0,8036 x 0,75)
def crop_mask(arr, mask, box):
    x0, y0, x1, y1 = box
    return to_rgba(arr[y0:y1, x0:x1], ~mask[y0:y1, x0:x1])


# orelha de pau (a da direita da imagem), cortada no tronco
SH = (535, 785, 745, 1115)
shelf = crop_mask(a, right_mask, SH)
bbS = shelf.getbbox(); shelf = shelf.crop((bbS[0], bbS[1], shelf.width, bbS[3]))
_, imS = save_scaled(shelf, 'orelha.png', scale=S2)
alS = np.array(imS)[:, :, 3] > 128
tops = [(x, int(np.nonzero(alS[:, x])[0][0])) for x in range(imS.width) if alS[:, x].any()]
print('orelha', imS.size, 'top contour (x,y) every 8:', tops[::8])

# galho solto (do tronco com galho), cortado perto do tronco
GB = (170, 180, 890, 680)
branch = crop_mask(b, galho_mask, GB)
bbG = branch.getbbox(); branch = branch.crop((0, bbG[1], bbG[2], bbG[3]))
_, imG = save_scaled(branch, 'galho.png', scale=S2)
alG = np.array(imG)[:, :, 3] > 128
topsG = [(x, int(np.nonzero(alG[:, x])[0][0])) for x in range(0, imG.width, 12) if alG[:, x].any()]
print('galho', imG.size, 'top contour', topsG)

# ---- tronco (v3): "Gemini_Generated_Image_qhft43qhft43qhft.jpg", xadrez falso e rabiscos claros no fundo ----
tr = load('Gemini_Generated_Image_qhft43qhft43qhft.jpg')
t16 = tr.astype(int)
mx_, mn_ = t16.max(axis=2), t16.min(axis=2)
fg_t = ((mx_ - mn_ > 45) & (mn_ < 190)) | (mx_ < 150)  # marrons e contornos escuros; o xadrez e os rabiscos são claros
lab_t, n_t = ndimage.label(fg_t)
sizes_t = ndimage.sum(fg_t, lab_t, range(1, n_t + 1))
main_t = 1 + int(np.argmax(sizes_t))
keep_t = ndimage.binary_fill_holes(lab_t == main_t)
keep_t &= ~((mn_ >= 165) & (mx_ - mn_ <= 45))  # sem restos claros do xadrez entre os galhinhos
keep_t &= ~((mn_ >= 110) & (mx_ - mn_ <= 22))  # nem o cinza escuro do xadrez (a casca é marrom, mais saturada)
keep_t = keep_big(keep_t, 400)  # sem fragmentos soltos
keep_t[1280:, :] = False  # a base alarga: fica de fora, para repetir sem degrau
TRH = 1280
rows = keep_t[200:1100]
lefts = [np.nonzero(r)[0][0] for r in rows if r.any()]
rights = [np.nonzero(r)[0][-1] for r in rows if r.any()]
# corpo: mediana das bordas nas linhas sem galhinho
bl, br = int(np.median(lefts)), int(np.median(rights))
ST = 150 / (br - bl)
cols = np.nonzero(keep_t[:TRH].any(axis=0))[0]
x0t, x1t = int(cols[0]), int(cols[-1]) + 1
trunk_img = to_rgba(tr[:TRH, x0t:x1t], ~keep_t[:TRH, x0t:x1t])
_, imT = save_scaled(trunk_img, 'tronco.png', scale=ST)
print('tronco', imT.size, 'corpo x', round((bl - x0t) * ST), round((br - x0t) * ST))

# ---- morcego (GIF de 48 quadros com rótulos de texto no topo; usa voo 0-17, atingido 18-23 e queda 24-32) ----
gbat = Image.open(os.path.join(SRC, 'morcego.gif'))
frs = []
for i in range(33):
    gbat.seek(i)
    a_ = np.array(gbat.convert('RGB')).astype(int)[82:, :]  # corta o rótulo (linhas 37 a 73)
    key = np.array([100, 86, 96])
    bgm_ = np.abs(a_ - key).sum(axis=2) <= 24
    frs.append(to_rgba(a_.astype(np.uint8), bgm_))
bb = None
for x in frs:
    b_ = x.getbbox()
    bb = b_ if bb is None else (min(bb[0], b_[0]), min(bb[1], b_[1]), max(bb[2], b_[2]), max(bb[3], b_[3]))
BTW = 130
for i, x in enumerate(frs):
    c = x.crop(bb)
    sc = BTW / c.width
    c.resize((BTW, round(c.height * sc)), Image.NEAREST).save(os.path.join(OUT, f'morcego_{i}.png'), optimize=True)
print('morcego bbox', bb, 'size', BTW, round((bb[3] - bb[1]) * BTW / (bb[2] - bb[0])))
