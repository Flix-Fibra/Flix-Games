#!/usr/bin/env python3
"""
Monta as folhas de quadros do portal do Flix Runner a partir da arte da equipe (assets/jogos/flix-runner/portal/).
Nada é redesenhado: só recorta, reduz e junta os quadros.

  - portal_entrada.png: Julia correndo para dentro do portal (GIF de entrada, sem o tchauzinho: quadros 0-4 e 14-20)
  - portal_saida.png:   Julia saindo do portal e voltando a correr (GIF de saída, todos os quadros)
  - portal_girando.png: o portal sozinho (vídeo webm com fundo transparente): abrindo, girando e fechando

Escala: a Julia dos GIFs (~360 px de altura) fica do tamanho da personagem do jogo (~81 unidades), desenhada em 2x
(RENDER do jogo). Imprime as medidas que o jogo usa (theme.ts, PORTAL).

Uso: python3 scripts/runner/montar_portal.py   (Pillow + NumPy; o webm precisa de ffmpeg com libvpx-vp9 no PATH,
ou FFMPEG=/caminho/do/ffmpeg)
"""
import json
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "assets" / "jogos" / "flix-runner" / "portal"
SAIDA = RAIZ / "games" / "runner" / "public" / "img" / "portal"
ESCALA_GIF = 0.448        # 2 x (81 / 362): Julia do GIF -> personagem do jogo, em 2x
ALTURA_PORTAL = 266       # altura do portal do webm em 2x, igual à do portal dos GIFs (592 px x 0,448)
COLUNAS = 6


def quadros_gif(arq: Path, indices=None):
    im = Image.open(arq)
    out = []
    for i in range(im.n_frames):
        if indices is None or i in indices:
            im.seek(i)
            out.append((im.convert("RGBA").copy(), im.info.get("duration", 100)))
    return out


def caixa(imgs):
    """Retângulo que contém tudo o que não é transparente em todos os quadros."""
    x0 = y0 = 10**9
    x1 = y1 = 0
    for im in imgs:
        a = np.array(im)[..., 3]
        ys, xs = np.where(a > 8)
        if len(xs):
            x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max()), max(y1, ys.max())
    return int(x0), int(y0), int(x1) + 1, int(y1) + 1


def folha(imgs, escala, nome):
    x0, y0, x1, y1 = caixa(imgs)
    w, h = round((x1 - x0) * escala), round((y1 - y0) * escala)
    linhas = (len(imgs) + COLUNAS - 1) // COLUNAS
    f = Image.new("RGBA", (w * min(COLUNAS, len(imgs)), h * linhas), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        q = im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)
        f.paste(q, ((i % COLUNAS) * w, (i // COLUNAS) * h))
    SAIDA.mkdir(parents=True, exist_ok=True)
    # paleta de 256 cores (com transparência): arquivo bem menor para o celular, sem diferença visível na pixel art
    f.quantize(256, method=Image.Quantize.FASTOCTREE).save(SAIDA / f"{nome}.png", optimize=True)
    return {"w": w, "h": h, "x0": x0, "y0": y0, "escala": escala}


def medida_portal(im, x_lado):
    """Centro e base do portal num quadro do GIF (o portal fica de um lado, a Julia do outro)."""
    a = np.array(im)[..., 3]
    a = a[:, x_lado[0]:x_lado[1]]
    ys, xs = np.where(a > 40)
    return (xs.min() + xs.max()) / 2 + x_lado[0], ys.max()


def main():
    info = {}
    # Entrada: corre até o portal (0-4) e entra (14-20), sem o tchauzinho (5-13)
    ent = quadros_gif(FONTE / "Julia_entrada_portal.gif", set([0, 1, 2, 3, 4, *range(14, 21)]))
    m = folha([q for q, _ in ent], ESCALA_GIF, "portal_entrada")
    px, pb = medida_portal(ent[-1][0], (0, 1000))  # último quadro: só o portal
    jx = np.where(np.array(ent[0][0])[..., 3][:, :420] > 40)[1]
    m.update(portalX=round((px - m["x0"]) * ESCALA_GIF), base=round((pb - m["y0"]) * ESCALA_GIF),
             juliaX=round(((jx.min() + jx.max()) / 2 - m["x0"]) * ESCALA_GIF), duracoes=[d for _, d in ent])
    info["entrada"] = m

    # Saída: todos os quadros
    sai = quadros_gif(FONTE / "Julia_saida_portal.gif")
    m = folha([q for q, _ in sai], ESCALA_GIF, "portal_saida")
    px, pb = medida_portal(sai[-1][0], (0, 460))
    jx = np.where(np.array(sai[-1][0])[..., 3][:, 600:] > 40)[1] + 600
    m.update(portalX=round((px - m["x0"]) * ESCALA_GIF), base=round((pb - m["y0"]) * ESCALA_GIF),
             juliaX=round(((jx.min() + jx.max()) / 2 - m["x0"]) * ESCALA_GIF), duracoes=[d for _, d in sai])
    info["saida"] = m

    # Portal sozinho (webm com transparência), 10 quadros por segundo
    ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([ffmpeg, "-v", "error", "-c:v", "libvpx-vp9", "-i", str(FONTE / "Portal_Flix_Transparente.webm"),
                        "-vf", "fps=10", "-pix_fmt", "rgba", f"{tmp}/f%03d.png"], check=True)
        web = [Image.open(p).convert("RGBA") for p in sorted(Path(tmp).glob("f*.png"))]
    x0, y0, x1, y1 = caixa(web)
    m = folha(web, ALTURA_PORTAL / (y1 - y0), "portal_girando")
    m.update(portalX=m["w"] // 2, base=m["h"], quadros=len(web))
    info["girando"] = m
    print(json.dumps(info, indent=1))


if __name__ == "__main__":
    main()
