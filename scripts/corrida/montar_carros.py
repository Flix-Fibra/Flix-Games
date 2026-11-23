#!/usr/bin/env python3
"""
Prepara os carros da Corrida Flix (G12) a partir da arte da equipe (assets/jogos/corrida/carros/, vista de cima,
frente para a direita). Nada é redesenhado: cada carro é recortado e reduzido para o tamanho do carro no jogo
(FATIA_W x FATIA_H de games/corrida/src/carro.ts), cada bloco da arte vira 1 pixel (mediana do bloco, sem misturar
cores de pixels vizinhos).

O 01 (vermelho FLIX, com patrocínio) é o carro do jogador; os outros são os rivais.

Uso: python3 scripts/corrida/montar_carros.py   (Pillow + NumPy)
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "assets" / "jogos" / "corrida" / "carros"
SAIDA = RAIZ / "games" / "corrida" / "public" / "img" / "carros"
W, H = 41, 19  # igual a FATIA_W x FATIA_H em games/corrida/src/carro.ts
HD = 8  # versão detalhada: W*HD x H*HD, desenhada no jogo do mesmo tamanho (41 x 19) com suavização (nomes e números aparecem)


def reduzir(arq: Path) -> Image.Image:
    im = Image.open(arq).convert("RGBA")
    im = im.crop(im.getbbox())
    a = np.array(im).astype(int)
    ah, aw = a.shape[:2]
    o = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            x0, x1 = int(i * aw / W), int((i + 1) * aw / W)
            y0, y1 = int(j * ah / H), int((j + 1) * ah / H)
            c = a[y0:y1, x0:x1].reshape(-1, 4)
            if (c[:, 3] > 128).mean() < 0.5:
                continue
            c = c[c[:, 3] > 128]
            o[j, i, :3] = np.median(c[:, :3], 0)
            o[j, i, 3] = 255
    return Image.fromarray(o)


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    arqs = sorted(FONTE.glob("*.png"))
    if not arqs:
        raise SystemExit(f"Nenhum carro em {FONTE}")
    for arq in arqs:
        nome = arq.stem.split("-", 1)[1]  # "01-vermelho-flix" -> "vermelho-flix"
        reduzir(arq).save(SAIDA / f"{nome}.png", optimize=True)
        im = Image.open(arq).convert("RGBA")
        (SAIDA / "hd").mkdir(exist_ok=True)
        im.crop(im.getbbox()).resize((W * HD, H * HD), Image.LANCZOS).save(SAIDA / "hd" / f"{nome}.png", optimize=True)
        print(f"ok  {nome}")


if __name__ == "__main__":
    main()
