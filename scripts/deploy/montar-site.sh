#!/usr/bin/env bash
# Monta o site estático do Flix Games (portal + jogos) a partir de uma cópia LIMPA do commit (git archive).
# Não usa a pasta de trabalho: o que não está commitado não vai para produção.
#
# Uso:  scripts/deploy/montar-site.sh <pasta-com-o-git-archive> <pasta-de-saída>
# Saída: <saída>/index.html, assets/, personagem/... e <saída>/games/<pasta>/ (build de cada jogo do catálogo).
set -euo pipefail

FONTE=$(cd "$1" && pwd)
SAIDA=$2
[ -f "$FONTE/package.json" ] && [ -d "$FONTE/web" ] || { echo "Isto não parece o Flix Games: $FONTE" >&2; exit 1; }
[ ! -e "$FONTE/.git" ] || { echo "Use uma cópia do git archive, não o repositório (evita levar arquivo não commitado)" >&2; exit 1; }
rm -rf "$SAIDA"; mkdir -p "$SAIDA/games"

cd "$FONTE"
npm ci --no-audit --no-fund
# Só os jogos que declaram "catalogo" no game.json (o jogo de teste do hub fica fora de produção)
for gj in games/*/game.json; do
  pasta=$(basename "$(dirname "$gj")")
  grep -q '"catalogo"' "$gj" || continue
  echo "== jogo $pasta"
  npm run build -w "games/$pasta"
  cp -R "games/$pasta/dist" "$SAIDA/games/$pasta"
done

echo "== portal"
(cd web && npm ci --no-audit --no-fund && npm run build)
cp -R web/dist/. "$SAIDA/"

# Nada de mapa de código-fonte nem arquivo oculto no site público
find "$SAIDA" \( -name '*.map' -o -name '.*' \) -type f -delete
echo "Site montado em $SAIDA ($(du -sh "$SAIDA" | cut -f1))"
