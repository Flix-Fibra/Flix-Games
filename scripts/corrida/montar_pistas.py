#!/usr/bin/env python3
"""
Prepara as 24 pistas da Corrida Flix (G12) a partir do pacote da equipe (assets/jogos/corrida/pistas/: um PNG de
1280 x 800 com o cenário inteiro e um JSON com a linha central, na mesma escala). Nada é redesenhado:

  - copia cada PNG para games/corrida/public/img/pistas/<id>.png (o jogo amplia ESCALA vezes, sem suavizar);
  - gera games/corrida/src/pistasDados.ts com a linha central, a largura do asfalto e o tamanho do mundo já
    multiplicados por ESCALA (o jogo e os testes usam esses números; a física sai da geometria, não da imagem).

ESCALA = 4 (inteira, a pixel art fica nítida): asfalto de 68 a 84 px para um carro de 41 x 19 e voltas de ~35 a
~65 s, dentro do que o jogo já esperava.

Uso: python3 scripts/corrida/montar_pistas.py
"""
import json
import math
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "assets" / "jogos" / "corrida" / "pistas"
# Arte no tamanho do jogo (1 px da imagem = 1 px do mundo, sem ampliar): 4000 x 2500 com asfalto de 190 px (pedido em
# 23/11/2026 para caberem os 11 carros lado a lado). Quando uma pista existe aqui, ela substitui a do pacote antigo.
FONTE_V2 = RAIZ / "assets" / "jogos" / "corrida" / "pistas-190"
JOGO = RAIZ / "games" / "corrida"
ESCALA = 3  # só para o pacote antigo


def main() -> None:
    # lista das pistas: a do pacote no tamanho do jogo; o pacote antigo só entra se a pasta nova não existir
    origem_lista = FONTE_V2 if (FONTE_V2 / "pistas.json").exists() else FONTE
    lista = json.loads((origem_lista / "pistas.json").read_text(encoding="utf-8"))["circuits"]
    v2 = {}
    if (FONTE_V2 / "pistas.json").exists():
        v2 = {c["id"]: c for c in json.loads((FONTE_V2 / "pistas.json").read_text(encoding="utf-8"))["circuits"]}
    saida_img = JOGO / "public" / "img" / "pistas"
    saida_img.mkdir(parents=True, exist_ok=True)
    linhas = []
    for c in sorted(lista, key=lambda c: c["order"]):
        origem, escala = FONTE, ESCALA
        if c["id"] in v2:
            c, origem, escala = v2[c["id"]], FONTE_V2, 1
        j = json.loads((origem / c["track"]).read_text(encoding="utf-8"))
        if not j.get("closed"):
            raise SystemExit(f"{c['id']}: pista aberta")
        shutil.copyfile(origem / c["art"], saida_img / f"{c['id']}.png")
        # versão 2: linha central bem densa (0,6 px a ~10 px); 1 ponto a cada ~12 px basta para o jogo
        pts = j["centerline"]
        if escala == 1:
            enxuta, ultimo = [], None
            for x, y in pts:
                if ultimo is None or math.dist(ultimo, (x, y)) >= 12:
                    enxuta.append((x, y))
                    ultimo = (x, y)
            pts = enxuta
        pontos = [[round(x * escala), round(y * escala)] for x, y in pts]
        item = {
            "id": c["id"],
            "nome": c["name"],
            "w": j["imageWidth"] * escala,
            "h": j["imageHeight"] * escala,
            "largura": round(j["trackWidthPx"] * escala),
            "arte": f"img/pistas/{c['id']}.png",
            "escala": escala,
            "pontos": pontos,
        }
        if escala == 1 and len(j.get("startGrid", [])) >= 11:
            # grid de largada desenhado na arte (posição de cada carro, do 1º ao 11º)
            item["grade"] = [[round(g["position"][0]), round(g["position"][1])] for g in sorted(j["startGrid"], key=lambda g: g["slot"])]
        if j.get("overpasses"):
            item["cruza"] = True
        linhas.append("  " + json.dumps(item, ensure_ascii=False, separators=(", ", ": ")) + ",")
        print(f"ok  {c['order']:2}  {c['id']}{'  (v2, tamanho real)' if escala == 1 else ''}")
    ts = (
        "// Gerado por scripts/corrida/montar_pistas.py a partir de assets/jogos/corrida/pistas. Não edite à mão.\n"
        "// Traçados derivados de bacinger/f1-circuits (MIT); ver assets/jogos/corrida/pistas/LICENCA-TRACADOS.txt.\n"
        "import type { PistaDef } from './pistas';\n\n"
        "export const PISTAS_ARTE: readonly PistaDef[] = [\n" + "\n".join(linhas) + "\n];\n"
    )
    (JOGO / "src" / "pistasDados.ts").write_text(ts, encoding="utf-8")
    print(f"{len(linhas)} pistas -> games/corrida/src/pistasDados.ts")


if __name__ == "__main__":
    main()
