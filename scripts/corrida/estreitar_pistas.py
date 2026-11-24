"""
Estreita o asfalto das pistas da Corrida Flix refazendo a arte, sem redesenhar nada à mão.

Parte de assets/jogos/corrida/pistas-190 (asfalto de 190 px, nunca é alterada) e gera assets/jogos/corrida/pistas-<N>
com o mesmo formato (PNG + JSON + pistas.json), para o montar_pistas.py usar.

Como funciona, por pista:
  1. Fundo: o cenário original com a faixa da pista antiga (asfalto + zebra + areia) trocada por grama copiada de
     outros pontos do mesmo mapa (deslocando a imagem até achar um trecho sem pista).
  2. Pista nova: cada pixel perto da linha central pega a cor do pixel original que fica na mesma normal, só que mais
     longe do centro (asfalto esticado de N/2 para 190/2 px; zebra e areia mantêm a espessura). O resultado é o mesmo
     asfalto, a zebra e a linha pontilhada, só mais estreitos.
  3. JSON: largura nova, linha de largada e grade com o deslocamento lateral proporcional.

Uso:  python3 scripts/corrida/estreitar_pistas.py [largura=130] [id ...]
Depois: python3 scripts/corrida/montar_pistas.py   (aponta para a pasta gerada)
"""
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from scipy.spatial import cKDTree

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "assets" / "jogos" / "corrida" / "pistas-190"
# deslocamentos (px) tentados, em ordem, para copiar grama de um trecho sem pista
DESLOCAMENTOS = [(dx, dy) for r in (260, 420, 640, 900, 1300, 1800) for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r), (r, r), (-r, r), (r, -r), (-r, -r))]


def densificar(pts: np.ndarray) -> np.ndarray:
    fechada = np.vstack([pts, pts[:1]])
    partes = []
    for a, b in zip(fechada[:-1], fechada[1:]):
        n = max(1, int(math.ceil(math.dist(a, b))))
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        partes.append(a + (b - a) * t)
    return np.vstack(partes)


def estreitar(png_in: Path, j: dict, nova: float) -> tuple[Image.Image, np.ndarray, cKDTree]:
    im = Image.open(png_in)
    img = np.asarray(im.convert("RGBA" if "A" in im.getbands() else "RGB"))
    h, w, canais = img.shape
    dense = densificar(np.array(j["centerline"], dtype=np.float64))
    tree = cKDTree(dense)
    velho = j["trackWidthPx"] / 2
    novo = nova / 2
    borda = j["surface"]["curbWidthPx"] + j["surface"]["runoffWidthPx"]
    raio_velho = velho + borda
    limite = raio_velho + 8

    # distância de cada pixel à linha central (inf = longe) e qual ponto é o mais próximo
    dist = np.full((h, w), np.inf, dtype=np.float32)
    prox = np.zeros((h, w), dtype=np.int32)
    xs = np.arange(w, dtype=np.float64)
    for y0 in range(0, h, 100):
        y1 = min(h, y0 + 100)
        yy, xx = np.meshgrid(np.arange(y0, y1, dtype=np.float64), xs, indexing="ij")
        d, i = tree.query(np.stack([xx.ravel(), yy.ravel()], -1), distance_upper_bound=limite, workers=-1)
        dist[y0:y1] = d.reshape(y1 - y0, w)
        prox[y0:y1] = np.minimum(i, len(dense) - 1).reshape(y1 - y0, w)

    out = img.copy()

    # 1. fundo: troca a faixa da pista antiga por grama de outro lugar do mapa
    py, px = np.nonzero(dist <= raio_velho + 4)
    pendente = np.ones(len(py), dtype=bool)
    for dx, dy in DESLOCAMENTOS:
        if not pendente.any():
            break
        qy, qx = py + dy, px + dx
        ok = pendente & (qy >= 0) & (qy < h) & (qx >= 0) & (qx < w)
        ok[ok] = np.isinf(dist[qy[ok], qx[ok]])
        out[py[ok], px[ok]] = img[qy[ok], qx[ok]]
        pendente &= ~ok
    sobrou = int(pendente.sum())

    # 2. pista nova: mesma arte, só mais estreita
    ny, nx = np.nonzero(dist <= novo + borda + 6)
    c = dense[prox[ny, nx]]
    v = np.stack([nx, ny], -1) - c
    d = dist[ny, nx].astype(np.float64)
    u = v / np.maximum(d, 1e-6)[:, None]
    d_src = np.where(d <= novo, d * velho / novo, d + (velho - novo))
    q = c + u * d_src[:, None]
    for k in range(canais):
        out[ny, nx, k] = np.clip(np.rint(map_coordinates(img[..., k].astype(np.float32), [q[:, 1], q[:, 0]], order=1, mode="nearest")), 0, 255)

    # confere: a amostra caiu na pista de OUTRO trecho (curvas muito coladas)?
    dq, _ = tree.query(q, workers=-1)
    errados = int((dq < d_src - 8).sum())
    print(f"    pixels da pista nova: {len(ny)}  fundo sem fonte: {sobrou}  amostras de outro trecho: {errados}")
    return Image.fromarray(out), dense, tree


def main() -> None:
    args = sys.argv[1:]
    nova = float(args[0]) if args and args[0].replace(".", "").isdigit() else 130.0
    ids = [a for a in args if not a.replace(".", "").isdigit()]
    destino = RAIZ / "assets" / "jogos" / "corrida" / f"pistas-{int(nova)}"
    if not destino.exists():
        shutil.copytree(ORIGEM, destino)
    lista = json.loads((ORIGEM / "pistas.json").read_text(encoding="utf-8"))["circuits"]
    for c in sorted(lista, key=lambda c: c["order"]):
        if ids and c["id"] not in ids:
            continue
        j = json.loads((ORIGEM / c["track"]).read_text(encoding="utf-8"))
        print(f"{c['order']:2} {c['id']}")
        if j.get("overpasses"):
            print("    tem viaduto: mantida a largura original")
            continue
        velho = j["trackWidthPx"]
        img, dense, tree = estreitar(ORIGEM / c["art"], j, nova)
        img.save(destino / c["art"], compress_level=6)
        k = nova / velho
        j["trackWidthPx"] = int(nova)
        j["startLine"]["widthPx"] = int(nova)
        for g in j.get("startGrid", []):
            _, i = tree.query(g["position"])
            cx, cy = dense[i]
            g["position"] = [round(cx + (g["position"][0] - cx) * k, 3), round(cy + (g["position"][1] - cy) * k, 3)]
            g["lateralOffsetPx"] = round(g["lateralOffsetPx"] * k)
        j["estreitadoDe"] = velho
        (destino / c["track"]).write_text(json.dumps(j, ensure_ascii=False, indent=1), encoding="utf-8")
    print("pronto:", destino)


if __name__ == "__main__":
    main()
