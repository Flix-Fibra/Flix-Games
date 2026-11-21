#!/usr/bin/env python3
"""
Monta os personagens Flix a partir da arte da equipe (assets/personagem/fontes/): cada visual é um personagem
COMPLETO, já com o cabelo no corpo. Aqui nada é recortado nem redesenhado; só:
  1. reduz para a grade de pixels (cada "pixel" da arte vira 1 pixel), com o mesmo tamanho para todos
     (distância dos olhos aos pés = OLHO_PE);
  2. centraliza todos no mesmo quadro, com os olhos no mesmo ponto;
  3. grava os PNGs e o catalogo.json em web/public/personagem/.

Uso (precisa de Pillow e NumPy):  python3 scripts/personagem/montar.py   (ou npm run personagem)
"""
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FONTES = RAIZ / "assets" / "personagem"
SAIDA = RAIZ / "web" / "public" / "personagem"

QUADRO = (154, 121)       # altura, largura (folga dos lados para cabelos volumosos)
OLHOS = (60.0, 50.0)      # x, y dos olhos no quadro
OLHO_PE = 99.0            # pixels da arte entre a linha dos olhos e a sola do tênis
RE_ID = re.compile(r"^[a-z0-9-]{1,40}$")


def hsv(a: np.ndarray):
    rgb = a[..., :3].astype(float) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0)
    return s, mx


def olhos(a: np.ndarray) -> "tuple[float, float]":
    """Centro dos olhos: o branco do olho (claro e sem cor) na parte de cima do personagem."""
    s, v = hsv(a)
    al = a[..., 3] > 0
    ys = np.where(al.any(1))[0]
    m = al & (v > 0.8) & (s < 0.2)
    m[int(ys.min() + (ys.max() - ys.min()) * 0.4):] = False
    yy, xx = np.where(m)
    if len(yy) < 2:
        raise SystemExit("Não achei os olhos (branco do olho) na imagem.")
    return float(xx.mean()), float(yy.mean())


def reduzir(a: np.ndarray, p: float, px: float, py: float) -> np.ndarray:
    """Cada bloco p×p vira 1 pixel: mediana do miolo do bloco (ignora as bordas borradas)."""
    H, W = a.shape[:2]
    xs, ys = np.arange(px, W - 1, p), np.arange(py, H - 1, p)
    o = np.zeros((len(ys) - 1, len(xs) - 1, 4), np.uint8)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            x0, x1 = int(xs[i] + p * 0.25), int(xs[i + 1] - p * 0.25)
            y0, y1 = int(ys[j] + p * 0.25), int(ys[j + 1] - p * 0.25)
            c = a[y0:y1 + 1, x0:x1 + 1].reshape(-1, 4)
            if (c[:, 3] > 128).mean() < 0.5:
                continue
            c = c[c[:, 3] > 128]
            o[j, i, :3] = np.median(c[:, :3], 0)
            o[j, i, 3] = 255
    return o


def padronizar(arq: Path, geo: "tuple | None" = None) -> "tuple[np.ndarray, tuple]":
    """
    Personagem no quadro comum: mesmo tamanho (olhos→pés) e olhos no mesmo ponto. Devolve também a geometria usada:
    as versões de tom de pele de um visual reaproveitam a do original (é o mesmo desenho; procurar os olhos de novo
    numa pele clara poderia confundir o brilho da pele com o branco do olho).
    """
    a = np.array(Image.open(arq).convert("RGBA")).astype(int)
    a[a[..., 3] <= 128] = 0
    if geo is None:
        ox, oy = olhos(a)
        pe = np.where((a[..., 3] > 0).any(1))[0].max()
        p = (pe - oy) / OLHO_PE  # pixels da imagem por pixel da arte
        geo = (ox, oy, p, a.shape[:2])
    ox, oy, p, tam = geo
    if a.shape[:2] != tam:
        raise SystemExit(f"{arq.name}: tamanho diferente do original ({a.shape[1]}x{a.shape[0]})")
    # grade alinhada para os olhos caírem no meio de um pixel
    px, py = (ox - p / 2) % p, oy % p
    sm = reduzir(a, p, px, py)
    dx = int(round(OLHOS[0] - (ox - px) / p))
    dy = int(round(OLHOS[1] - (oy - py) / p))
    out = np.zeros((*QUADRO, 4), np.uint8)
    H, W = sm.shape[:2]
    ys, xs = np.mgrid[0:H, 0:W]
    ok = (sm[..., 3] > 0) & (ys + dy >= 0) & (ys + dy < QUADRO[0]) & (xs + dx >= 0) & (xs + dx < QUADRO[1])
    out[ys[ok] + dy, xs[ok] + dx] = sm[ok]
    cortado = int((sm[..., 3] > 0).sum() - ok.sum())
    if cortado:
        print(f"  aviso: {arq.name} ficou com {cortado} pixels fora do quadro")
    return out, geo


def gravar_tons(cfg: dict, arquivo: str, nomes: "list[str]", geo: tuple, saida: str) -> "list[str]":
    """
    Versões de tom de pele do visual, feitas pela equipe: <nome>-<tom>.png na mesma pasta do original (nomes: os jeitos
    de chamar o visual, ex.: "black-power-m" ou "ondulado"). O tom padrão é o próprio original. Devolve os tons achados.
    """
    achados = []
    pasta = (FONTES / "fontes" / arquivo).parent
    for t in cfg.get("peles", {}).get("tons", []):
        if t["id"] == cfg["peles"]["padrao"]:
            continue
        arq = next((pasta / f"{n}-{t['id']}.png" for n in nomes if (pasta / f"{n}-{t['id']}.png").exists()), None)
        if arq:
            Image.fromarray(padronizar(arq, geo)[0]).save(SAIDA / f"{saida}-{t['id']}.png", optimize=True)
            achados.append(t["id"])
    return achados


def main() -> None:
    cfg = json.loads((FONTES / "fontes.json").read_text(encoding="utf-8"))
    SAIDA.mkdir(parents=True, exist_ok=True)
    for velho in [*SAIDA.glob("*.png"), *SAIDA.glob("*.webp")]:
        velho.unlink()

    corpos, visuais = [], []
    tons_careca = {}
    for cid, c in cfg["corpos"].items():
        arte, geo = padronizar(FONTES / "fontes" / c["careca"])
        Image.fromarray(arte).save(SAIDA / f"careca-{cid}.png", optimize=True)
        corpos.append({"id": cid, "nome": c["nome"]})
        tons_careca[cid] = gravar_tons(cfg, c["careca"], [f"careca-{cid}"], geo, f"careca-{cid}")
        print(f"ok  careca {cid}")
    vistos = set()
    for v in cfg["visuais"]:
        if not RE_ID.match(v["id"]) or (v["id"], v["corpo"]) in vistos:
            raise SystemExit(f"id inválido ou repetido: {v['id']}")
        vistos.add((v["id"], v["corpo"]))
        nome = f"{v['id']}-{v['corpo']}.png"
        arte, geo = padronizar(FONTES / "fontes" / v["arquivo"])
        Image.fromarray(arte).save(SAIDA / nome, optimize=True)
        item = {"id": v["id"], "nome": v["nome"], "corpo": v["corpo"]}
        if v.get("categoria"):
            if v["categoria"] not in cfg.get("categorias", {}):
                raise SystemExit(f"categoria sem nome em 'categorias': {v['categoria']}")
            item["categoria"] = v["categoria"]
        else:  # Desenvolvedores retratam pessoas reais: sem troca de tom de pele
            tons = gravar_tons(cfg, v["arquivo"], [f"{v['id']}-{v['corpo']}", v["id"]], geo, f"{v['id']}-{v['corpo']}")
            if tons:
                item["peles"] = tons
        visuais.append(item)
        print(f"ok  {v['corpo']} {v['id']}")

    # Secretos (easter egg): foto nítida, sem reduzir para pixels; só redimensiona e grava em WebP
    for v in cfg.get("secretos", []):
        if not RE_ID.match(v["id"]):
            raise SystemExit(f"id inválido: {v['id']}")
        if not (FONTES / "fontes" / v["arquivo"]).exists():
            # a foto do secreto não vai para o repositório (LGPD): sem ela, o easter egg simplesmente não aparece
            print(f"--  secreto {v['id']}: imagem ausente, fica de fora")
            continue
        im = Image.open(FONTES / "fontes" / v["arquivo"]).convert("RGB")
        larg = v.get("largura", 720)
        im = im.resize((larg, round(im.height * larg / im.width)), Image.LANCZOS)
        nome = f"{v['id']}-{v['corpo']}.webp"
        im.save(SAIDA / nome, quality=84, method=6)
        visuais.append({"id": v["id"], "nome": v["nome"], "corpo": v["corpo"], "categoria": "secreto", "foto": nome,
                        "rosto": v["rosto"]})
        print(f"ok  secreto {v['id']} ({im.width}x{im.height})")

    for c in corpos:  # visual padrão do corpo: o primeiro da lista dele (fora das categorias especiais)
        c["padrao"] = next(v["id"] for v in visuais if v["corpo"] == c["id"] and not v.get("categoria"))

    h = hashlib.sha256()
    for f in sorted([*SAIDA.glob("*.png"), *SAIDA.glob("*.webp")]):
        h.update(f.name.encode() + f.read_bytes())
    catalogo = {
        "v": 2,
        "versao": h.hexdigest()[:10],
        "tamanho": [QUADRO[1], QUADRO[0]],
        "olhos": list(OLHOS),
        "corpos": corpos,
        # abas extras do editor (ex.: Desenvolvedores); os visuais delas dizem a categoria
        "categorias": [{"id": k, "nome": c["nome"]} for k, c in cfg.get("categorias", {}).items()],
        # "careca" existe nos dois corpos; os demais visuais são de um corpo só
        # tons de pele do editor; cada visual diz quais tons tem além do padrão (arquivo <id>-<corpo>-<tom>.png)
        "peles": {"padrao": cfg["peles"]["padrao"], "tons": [{"id": t["id"], "nome": t["nome"], "cor": t["cor"]}
                                                             for t in cfg["peles"]["tons"]]} if cfg.get("peles") else None,
        "visuais": [{"id": "careca", "nome": "Careca", "corpo": c["id"],
                     **({"peles": tons_careca[c["id"]]} if tons_careca[c["id"]] else {})} for c in corpos] + visuais,
    }
    (SAIDA / "catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"catálogo: {len(corpos)} corpos, {len(visuais)} visuais -> {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
