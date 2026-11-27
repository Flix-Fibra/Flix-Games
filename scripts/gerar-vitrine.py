#!/usr/bin/env python3
"""Gera as miniaturas da vitrine da tela de login (web/public/vitrine/<id>.webp + web/src/dados/vitrine.json).

Pega todos os jogos do catálogo (game.json com "catalogo") e reduz a capa para 240 e 512 px em WebP,
para o fundo animado do login não pesar no celular. Rode de novo ao incluir ou trocar um jogo:

    python3 scripts/gerar-vitrine.py
"""
import json
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "web" / "public" / "vitrine"
LADOS = (240, 512)  # 240 para celular simples; 512 para telas retina/4K
LISTA = RAIZ / "web" / "src" / "dados" / "vitrine.json"


def capa_do_jogo(pasta: Path, capa: str) -> Path | None:
    for base in (pasta / "public", pasta, pasta / "dist"):
        if (base / capa).is_file():
            return base / capa
    return None


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    jogos = []
    for gj in sorted(RAIZ.glob("games/*/game.json")):
        dados = json.loads(gj.read_text(encoding="utf-8"))
        if "catalogo" not in dados:
            continue
        origem = capa_do_jogo(gj.parent, dados.get("capa", "img/capa-cheia.png"))
        if origem is None:
            raise SystemExit(f"Capa não encontrada: {gj.parent.name}")
        jid = gj.parent.name
        with Image.open(origem) as im:
            im = im.convert("RGB")
            for lado in LADOS:
                nome = f"{jid}.webp" if lado == LADOS[0] else f"{jid}@{lado}.webp"
                im.resize((lado, lado), Image.LANCZOS).save(SAIDA / nome, "WEBP", quality=80, method=6)
        jogos.append({"id": jid, "nome": dados.get("name", jid)})
    LISTA.write_text(json.dumps(jogos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(jogos)} jogos na vitrine")


if __name__ == "__main__":
    main()
