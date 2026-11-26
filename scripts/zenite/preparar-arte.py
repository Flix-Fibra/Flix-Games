"""
Recorta a arte do Zênite (folhas geradas por IA em "Vania Assets/") e grava as versões usadas pelo jogo em
games/zenite/public/img, mais games/zenite/src/art.json (tamanho dos quadros de cada folha).

Uso:  python scripts/zenite/preparar-arte.py        (precisa de Pillow e numpy)

As caixas abaixo estão em pixels da imagem original. Tudo é gravado com 2 pixels de textura por pixel do mundo
(o jogo desenha em escala 0,5), para a arte não perder detalhe.
"""
import glob
import json
import os

import numpy as np
from PIL import Image, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONTE = os.path.join(RAIZ, 'Vania Assets')
JOGO = os.path.join(RAIZ, 'games', 'zenite')
SAIDA = os.path.join(JOGO, 'public', 'img')
D = 2  # pixels de textura por pixel do mundo

_cache = {}


def folha(ident):
    if ident not in _cache:
        padrao = ident if ident.endswith('.png') else f'Gemini_Generated_Image_{ident}*.jpg'
        achados = sorted(glob.glob(os.path.join(FONTE, padrao)))
        if not achados:
            raise SystemExit(f'imagem {ident} não encontrada em {FONTE}')
        _cache[ident] = Image.open(achados[-1]).convert('RGB')
    return _cache[ident]


def sem_verde(img, limite=55):
    """Fundo verde vira transparente; a franja esverdeada das bordas perde o excesso de verde."""
    a = np.asarray(img).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sobra = g - np.maximum(r, b)
    alfa = np.where((sobra > limite) & (g > 90), 0, 255)
    franja = sobra > 12
    g2 = np.where(franja, np.maximum(r, b) + 6, g)
    return Image.fromarray(np.dstack([r, g2, b, alfa]).clip(0, 255).astype(np.uint8), 'RGBA')


def reduzir(img, fator):
    """Reduz com alfa pré-multiplicado e deixa a borda dura (pixel art)."""
    w, h = max(1, round(img.width * fator)), max(1, round(img.height * fator))
    a = np.asarray(img).astype(np.float32)
    al = a[..., 3:4] / 255
    pre = Image.fromarray(np.dstack([a[..., :3] * al, a[..., 3:4]]).astype(np.uint8), 'RGBA')
    p = np.asarray(pre.resize((w, h), Image.BOX)).astype(np.float32)
    al = p[..., 3:4]
    cor = np.where(al > 0, p[..., :3] * 255 / np.maximum(al, 1), 0)
    duro = np.where(al >= 110, 255, 0)
    return Image.fromarray(np.dstack([cor, duro]).clip(0, 255).astype(np.uint8), 'RGBA')


def aparar(img):
    caixa = img.getchannel('A').getbbox()
    return img.crop(caixa) if caixa else img


def centro_capacete(img):
    """Centro horizontal do capacete amarelo: âncora estável da heroína mesmo com a haste estendida."""
    a = np.asarray(img).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    amarelo = (al > 0) & (r > 170) & (g > 110) & (b < 90) & (r - b > 110)
    ys, xs = np.nonzero(amarelo)
    return float(np.median(xs)) if len(xs) > 8 else img.width / 2


def tira(nome, ident, caixas, fator, ancora='centro', filtro=None, meta=None, chao=None):
    """Monta uma folha de quadros iguais; em cada quadro o ponto de apoio fica no meio, embaixo."""
    quadros = []
    for n, caixa in enumerate(caixas):
        q = sem_verde(folha(ident).crop(caixa))
        if filtro:
            q = filtro(q)
        # `chao`: linha do chão de cada quadro na folha, para manter os pés no ar nos quadros de salto
        folga = 0
        if chao:
            folga = max(0, chao[n] - (caixa[1] + q.getchannel('A').getbbox()[3]))
        q = aparar(q)
        if folga:
            alto = Image.new('RGBA', (q.width, q.height + folga))
            alto.paste(q, (0, 0))
            q = alto
        ax = centro_capacete(q) if ancora == 'capacete' else q.width / 2
        q = reduzir(q, fator * D)
        quadros.append((q, round(ax * fator * D)))
    meio = max(max(ax, q.width - ax) for q, ax in quadros) + 1
    fw, fh = meio * 2, max(q.height for q, _ in quadros) + 1
    s = Image.new('RGBA', (fw * len(quadros), fh))
    for i, (q, ax) in enumerate(quadros):
        s.alpha_composite(q, (i * fw + meio - ax, fh - q.height))
    s.save(os.path.join(SAIDA, nome + '.png'), optimize=True)
    meta[nome] = {'w': fw, 'h': fh, 'n': len(quadros)}


def peca(nome, ident, caixa, largura=None, altura=None, limite=55, apara=True):
    """Uma figura só, ajustada a um tamanho em pixels do mundo."""
    q = sem_verde(folha(ident).crop(caixa), limite)
    if apara:
        q = aparar(q)
    if largura and altura:
        q = q.resize((largura * D, altura * D), Image.BOX)
    elif largura:
        q = reduzir(q, largura * D / q.width)
    else:
        q = reduzir(q, altura * D / q.height)
    q.save(os.path.join(SAIDA, nome + '.png'), optimize=True)


def sem_trilhos(img):
    """Tira os trilhos da escada desenhados junto da heroína (o jogo desenha a própria escada)."""
    a = np.array(img)
    r, g, b = (a[..., i].astype(np.int16) for i in range(3))
    cx = centro_capacete(img)
    xs = np.arange(a.shape[1])[None, :].repeat(a.shape[0], 0)
    ys = np.arange(a.shape[0])[:, None].repeat(a.shape[1], 1)
    cinza = (abs(r - g) < 28) & (abs(g - b) < 34) & (g > 55)
    contorno = (np.maximum(np.maximum(r, g), b) < 60)
    h = a.shape[0]
    lateral = (abs(xs - cx) > 24) & (abs(xs - cx) < 46)
    fora_corpo = (ys < h * 0.17) | (ys > h * 0.86)
    apagar = (lateral & (cinza | (contorno & fora_corpo))) | (fora_corpo & (abs(xs - cx) > 20))
    # os pés ficam: marrom não é cinza
    marrom = (r > b + 25) & (r > 70)
    a[..., 3] = np.where(apagar & ~marrom, 0, a[..., 3])
    # sobram riscos finos do contorno dos trilhos: some tudo que for mais estreito que 7 pixels
    cheio = Image.fromarray(a[..., 3]).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    a[..., 3] = np.minimum(a[..., 3], np.asarray(cheio))
    return Image.fromarray(a, 'RGBA')


def caixas(y0, y1, faixas):
    return [(x0, y0, x1, y1) for x0, x1 in faixas]


def heroina(meta):
    # cada fileira das folhas veio numa escala; o fator iguala o tamanho do capacete (altura em pé = 34 px)
    A2, A3 = 'bkelas', '3t7qf1'
    tira('iara-parada', A2, caixas(28, 205, [(256, 465), (712, 924), (944, 1152)]), 34 / 168, 'capacete', meta=meta)
    # corrida: folha própria, 4 x 2 quadros
    tira('iara-corrida', 'Sprite de Corrida em Pixel Art.png',
         caixas(30, 430, [(85, 335), (500, 795), (935, 1285), (1400, 1715)])
         + caixas(470, 872, [(85, 340), (555, 795), (925, 1240), (1415, 1665)]),
         34 / 460, 'capacete', meta=meta, chao=[418] * 4 + [860] * 4)
    tira('iara-pulo', A2, caixas(366, 519, [(90, 205), (300, 410), (440, 535), (860, 950), (1015, 1115)]),
         34 / 146, 'capacete', meta=meta)
    tira('iara-escada', A2, caixas(541, 741, [(40, 235), (261, 462), (487, 692), (718, 922)]), 34 / 165, 'capacete',
         filtro=sem_trilhos, meta=meta)
    # golpe: preparo, avanço, extensão (com brilho), extensão, recolhe
    tira('iara-golpe', A3, caixas(20, 208, [(20, 168), (255, 405), (458, 738), (778, 1006), (1015, 1182)]),
         34 / 176, 'capacete', meta=meta)
    tira('iara-golpe-ar', A3, caixas(222, 395, [(20, 140), (188, 342), (545, 662)]), 34 / 176, 'capacete', meta=meta)
    tira('iara-pulso', A3, caixas(438, 581, [(750, 834), (855, 962), (975, 1114)]), 34 / 150, 'capacete', meta=meta)
    tira('iara-dano', A3, caixas(596, 750, [(28, 198), (220, 390), (412, 582), (604, 774), (796, 966), (987, 1156),
                                            (1179, 1348)]), 34 / 160, 'capacete', meta=meta)


def inimigos(meta):
    F = 'dq3x5c'  # faísca: a linha do chão desenhada na folha fica fora da caixa
    f = 18 / 105
    tira('faisca-anda', F, caixas(40, 172, [(30, 185), (250, 392), (465, 605), (660, 800), (850, 985), (1045, 1180)]),
         f, meta=meta)
    tira('faisca-aviso', F, caixas(222, 371, [(30, 185), (248, 405), (462, 622)]), f, meta=meta)
    tira('faisca-morre', F, caixas(425, 563, [(30, 190), (250, 425), (480, 645), (750, 905), (985, 1150)]), f, meta=meta)
    R = 'hxwqb5'  # drone: só o corpo (sem as pernas que vieram no desenho), para ele voar
    d = 20 / 108
    tira('drone-voa', R, [(345, 56, 456, 122), (542, 56, 680, 122), (740, 56, 878, 122), (938, 56, 1076, 122)], d,
         meta=meta)
    tira('drone-morre', R, caixas(515, 697, [(325, 472), (570, 718), (778, 940)]), d, meta=meta)
    B = '64fduz'
    b = 52 / 100
    tira('chefe-parado', B, [(88, 68, 182, 173)], b, meta=meta)
    tira('chefe-salto', B, [(388, 52, 492, 170), (652, 42, 762, 170)], b, meta=meta)
    tira('chefe-aviso', B, [(928, 40, 1078, 172)], b, meta=meta)
    tira('chefe-caindo', B, [(183, 208, 322, 300)], b, meta=meta)
    tira('chefe-aberto', B, [(642, 262, 778, 343)], b, meta=meta)
    tira('chefe-dano', B, [(928, 232, 1042, 343)], b, meta=meta)
    tira('chefe-furia', B, [(128, 395, 268, 526), (935, 395, 1085, 526)], b, meta=meta)
    tira('chefe-morto', B, [(600, 438, 790, 527)], b, meta=meta)
    tira('chao-faisca', B, [(550, 655, 800, 712)], 40 / 250, meta=meta)


def objetos():
    C = 'dpxn41'
    # a folha usada é a versão sem "(1)" (a última em ordem alfabética)
    for nome, caixa, alt in [('porta-fechada', (28, 18, 138, 162), 34), ('porta-aberta', (348, 18, 458, 162), 34),
                             ('save-off', (505, 52, 612, 161), 28), ('save-on', (805, 52, 898, 161), 28),
                             ('rachada', (864, 396, 1013, 545), 16)]:
        peca(nome, C, caixa, altura=alt)
    I = 'vbm44dv'
    peca('item-lampada', I, (14, 42, 80, 120), altura=14)
    peca('item-cura', I, (401, 55, 461, 111), altura=12, limite=14)
    peca('item-nucleo', I, (718, 40, 794, 124), altura=15)
    peca('item-pulso', I, (1092, 298, 1168, 366), altura=13)


def cenario():
    T = '7nr8rt'
    # bloco: miolo do painel central, em 4x4 tiles (o jogo repete pela posição)
    peca('parede', T, (366, 392, 456, 462), largura=64, altura=64, apara=False)
    peca('borda', T, (250, 216, 462, 243), largura=64, altura=7, apara=False)
    peca('plataforma', T, (710, 76, 933, 116), largura=48, altura=9)
    peca('escada', T, (1004, 92, 1072, 228), largura=16, altura=32, apara=False)
    peca('fio', T, (712, 446, 933, 509), largura=48, altura=12)
    longe = folha('tmoiu2').crop((0, 40, 1376, 382))
    alt = 270 * D
    longe.resize((round(longe.width * alt / longe.height), alt), Image.BOX).save(
        os.path.join(SAIDA, 'fundo.jpg'), quality=82)
    peca('logo', 'uo7irm', (240, 90, 1170, 620), largura=300, limite=40)


def fase2(meta):
    T = '3r8uyl'
    peca('parede2', T, (236, 226, 326, 316), largura=64, altura=64, apara=False)
    peca('borda2', T, (648, 79, 840, 100), largura=64, altura=7, apara=False)
    peca('plataforma2', T, (648, 198, 840, 240), largura=48, altura=9)
    peca('escada2', T, (907, 112, 983, 262), largura=16, altura=32, apara=False)
    peca('fio2', T, (1041, 262, 1271, 347), largura=48, altura=15)
    longe = folha('n29kqn').crop((0, 28, 1376, 382))
    longe.resize((round(longe.width * 270 * D / longe.height), 270 * D), Image.BOX).save(
        os.path.join(SAIDA, 'fundo2.jpg'), quality=82)
    A = 'vfk070'  # balanço no cabo: o jogo desenha o próprio cabo
    tira('iara-gancho', A, [(34, 251, 176, 374), (343, 283, 476, 410)], 34 / 150, 'capacete', meta=meta)
    R = 'rayqqb'
    f = 26 / 165
    tira('rato-corre', R, [(450, 60, 612, 163), (635, 48, 748, 163), (822, 38, 968, 157), (1008, 33, 1162, 155),
                           (1188, 74, 1368, 163)], f, meta=meta)
    tira('rato-morre', R, caixas(466, 546, [(360, 548), (578, 762), (793, 958), (1032, 1182)]), f, meta=meta)
    B = '9hd54r'
    b = 20 / 82
    tira('bobina-parada', B, [(48, 84, 154, 167), (410, 84, 515, 167)], b, meta=meta)
    tira('bobina-aviso', B, [(36, 262, 168, 361), (238, 250, 366, 361)], b, meta=meta)
    tira('bobina-morre', B, [(250, 450, 402, 567), (438, 424, 616, 567), (628, 500, 802, 567)], b, meta=meta)
    peca('arco', B, (908, 284, 1144, 330), largura=90, altura=12)
    M = '3d0f8'
    m = 50 / 150
    tira('matriarca-parada', M, [(34, 30, 314, 184), (350, 30, 682, 184)], m, meta=meta)
    tira('matriarca-ataque', M, [(724, 24, 1012, 186)], m, meta=meta)
    tira('matriarca-dano', M, [(394, 300, 662, 474)], m, meta=meta)
    tira('matriarca-furia', M, [(728, 250, 1008, 474)], m, meta=meta)
    tira('matriarca-morta', M, [(1048, 358, 1372, 486)], m, meta=meta)
    C = 'dpxn41'
    for nome, caixa, alt in [('alavanca-off', (948, 46, 1036, 161), 18), ('alavanca-on', (1256, 60, 1342, 161), 16),
                             ('alcapao', (12, 201, 157, 256), 7), ('gancho', (936, 232, 1006, 320), 14),
                             ('gancho-aceso', (1228, 232, 1308, 320), 14)]:
        peca(nome, C, caixa, altura=alt)
    peca('item-gancho', 'vbm44dv', (6, 284, 82, 372), altura=15)


def fase3(meta):
    T = 'ctrst1'
    peca('parede3', T, (470, 292, 540, 362), largura=64, altura=64, apara=False)
    peca('borda3', T, (250, 214, 390, 232), largura=64, altura=7, apara=False)
    peca('plataforma3', T, (706, 112, 830, 162), largura=48, altura=11, limite=16)
    peca('escada3', T, (734, 285, 782, 361), largura=16, altura=32, apara=False)
    peca('fio3', T, (876, 290, 1036, 362), largura=48, altura=15)
    longe = folha('fd6kis').crop((0, 43, 1376, 383))
    longe.resize((round(longe.width * 270 * D / longe.height), 270 * D), Image.BOX).save(
        os.path.join(SAIDA, 'fundo3.jpg'), quality=82)
    P = 'a86b4g'  # plataformas de relógio: sólida, piscando e apagada
    for letra_, y0, y1 in (('a', 28, 158), ('b', 222, 355)):
        for sufixo, x0, x1 in (('', 20, 452), ('-aviso', 488, 918), ('-off', 956, 1390)):
            peca(f'relogio-{letra_}{sufixo}', P, (x0, y0, x1, y1), largura=48, altura=12)
    A = 'vfk070'
    tira('iara-repique', A, [(768, 244, 880, 388), (925, 214, 1032, 384)], 34 / 140, 'capacete', meta=meta)
    K = 'stuye1'
    k = 18 / 96
    tira('pacote-anda', K, [(476, 54, 578, 163), (640, 58, 745, 163), (790, 54, 888, 163), (938, 54, 1012, 163)], k, meta=meta)
    tira('pacote-morre', K, [(325, 478, 495, 570), (545, 455, 665, 570), (728, 470, 895, 570)], k, meta=meta)
    C = 'bh8ao6'
    c = 30 / 125
    tira('cooler', C, [(45, 68, 158, 190), (266, 68, 388, 190), (476, 58, 604, 190)], c, meta=meta)
    F = 'r219zq'
    tira('muro', F, [(68, 10, 180, 143)], 88 / 130, meta=meta)
    tira('muro-furia', F, [(158, 408, 270, 532)], 88 / 122, meta=meta)
    peca('nucleo', F, (1128, 16, 1218, 140), altura=36)
    peca('bola', F, (136, 632, 215, 690), largura=16)
    peca('muro-caido', F, (812, 452, 1258, 534), largura=96)
    peca('item-fragmento', 'vbm44dv', (1108, 36, 1180, 128), altura=14)
    peca('item-repique', 'vbm44dv', (380, 282, 476, 374), altura=15, limite=14)


def efeitos(meta):
    """Folha de fundo preto: usada com mistura aditiva, o preto some sozinho."""
    img = folha('e4tczg')

    def ef(nome, y0, y1, xs, larg):
        quadros = [img.crop((x0, y0, x1, y1)) for x0, x1 in xs]
        fw = max(q.width for q in quadros)
        f = larg * D / fw
        w, h = round(fw * f), round((y1 - y0) * f)
        s = Image.new('RGB', (w * len(quadros), h))
        for i, q in enumerate(quadros):
            q = q.point(lambda v: 0 if v < 14 else v)
            s.paste(q.resize((round(q.width * f), h), Image.BOX), (i * w, 0))
        s.save(os.path.join(SAIDA, nome + '.png'), optimize=True)
        meta[nome] = {'w': w, 'h': h, 'n': len(quadros)}

    ef('fx-impacto', 60, 123, [(262, 364), (428, 530), (592, 694), (756, 858)], 24)
    ef('fx-estouro', 256, 319, [(262, 385), (415, 538), (578, 701), (740, 863)], 34)
    ef('fx-poeira', 328, 382, [(255, 382), (412, 539), (578, 705), (738, 865)], 26)
    ef('fx-pulso', 390, 440, [(252, 402), (432, 582), (602, 752), (758, 908)], 30)
    ef('fx-brilho', 634, 686, [(282, 336), (439, 493), (595, 649), (749, 803)], 14)


def main():
    os.makedirs(SAIDA, exist_ok=True)
    os.makedirs(os.path.join(JOGO, 'src'), exist_ok=True)
    meta = {}
    heroina(meta)
    inimigos(meta)
    objetos()
    cenario()
    fase2(meta)
    fase3(meta)
    efeitos(meta)
    with open(os.path.join(JOGO, 'src', 'art.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=1)
        f.write('\n')
    print(f'ok: {len(os.listdir(SAIDA))} arquivos em {SAIDA}')


if __name__ == '__main__':
    main()
