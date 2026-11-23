#!/usr/bin/env python3
"""
Prepara a vaca do Flix Grid (G12) a partir da arte da equipe (assets/jogos/corrida/vaca/vaca-3-angulos.png: a mesma
vaca de lado, na diagonal e de frente, em fundo branco). Nada é redesenhado: tira o fundo branco (preenchendo a partir
das bordas, o contorno escuro da vaca segura o branco do corpo), separa as 3 vacas e reduz todas na MESMA escala
(cada bloco da arte vira 1 pixel, mediana do bloco), para a vaca de lado ter LADO_W px de comprimento.

Saída: games/corrida/public/img/vaca/{lado,diagonal,frente}.png (cabeça para a direita, para baixo-direita e para baixo).
Uso: python3 scripts/corrida/montar_vaca.py   (Pillow + NumPy)
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "assets" / "jogos" / "corrida" / "vaca" / "vaca-3-angulos.png"
SAIDA = RAIZ / "games" / "corrida" / "public" / "img" / "vaca"
LADO_W = 30  # comprimento da vaca de lado no jogo (o carro tem 41)
NOMES = ["lado", "diagonal", "frente"]  # da esquerda para a direita na arte


def sem_fundo(a: np.ndarray) -> np.ndarray:
    h, w = a.shape[:2]
    claro = (a[..., :3].min(-1) > 225) | (a[..., 3] < 20)
    fundo = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    q = deque(p for p in q if claro[p])
    for p in q:
        fundo[p] = True
    while q:
        y, x = q.popleft()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h and 0 <= xx < w and not fundo[yy, xx] and claro[yy, xx]:
                fundo[yy, xx] = True
                q.append((yy, xx))
    o = a.copy()
    o[fundo, 3] = 0
    return o


def reduzir(a: np.ndarray, bloco: float) -> Image.Image:
    ah, aw = a.shape[:2]
    w, h = max(1, round(aw / bloco)), max(1, round(ah / bloco))
    o = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        for i in range(w):
            c = a[int(j * ah / h):int((j + 1) * ah / h), int(i * aw / w):int((i + 1) * aw / w)].reshape(-1, 4)
            if (c[:, 3] > 128).mean() < 0.5:
                continue
            c = c[c[:, 3] > 128]
            o[j, i, :3] = np.median(c[:, :3], 0)
            o[j, i, 3] = 255
    return Image.fromarray(o)


def main() -> None:
    a = sem_fundo(np.array(Image.open(FONTE).convert("RGBA")))
    cheio = (a[..., 3] > 0).any(0)
    # separa as 3 vacas pelas colunas vazias entre elas
    grupos, ini = [], None
    for x, c in enumerate(cheio):
        if c and ini is None:
            ini = x
        if not c and ini is not None:
            if x - ini > 40:
                grupos.append((ini, x))
            ini = None
    if len(grupos) != 3:
        raise SystemExit(f"esperava 3 vacas, achei {len(grupos)}")
    recortes = []
    for x0, x1 in grupos:
        r = a[:, x0:x1]
        ys = np.where((r[..., 3] > 0).any(1))[0]
        recortes.append(r[ys.min():ys.max() + 1])
    bloco = recortes[0].shape[1] / LADO_W  # mesma escala para as 3
    SAIDA.mkdir(parents=True, exist_ok=True)
    for nome, r in zip(NOMES, recortes):
        im = reduzir(r, bloco)
        im.save(SAIDA / f"{nome}.png", optimize=True)
        print(f"ok  {nome}  {im.size}")


if __name__ == "__main__":
    main()
