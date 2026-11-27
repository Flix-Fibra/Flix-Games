#!/usr/bin/env bash
# Deploy do Flix Games no servidor 132.255.110.226, num comando só.
# Instalado como /usr/local/sbin/deploy-flix-games (root:root, 755) por deploy/instalar-deploy.sh.
#
#   sudo /usr/local/sbin/deploy-flix-games            publica a Principal do GitHub
#   sudo /usr/local/sbin/deploy-flix-games --voltar   volta para a versão anterior (código da API e site)
#
# Por que o código vem do GitHub, e não de um pacote enviado por quem roda: a regra do sudoers libera este comando
# sem senha, e o deploy sobe contêineres como root. Se quem roda pudesse escolher o código, a regra equivaleria a
# root total. Assim, quem roda escolhe só QUANDO publicar; O QUÊ é sempre a Principal, onde só entra o que a
# equipe já aceitou (a mesma regra de confiança de hoje).
#
# Ordem: tudo que pode falhar (baixar, montar o site, construir a imagem) acontece antes de tocar no que está no ar.
# Só um deploy por vez (trava). Cada execução fica registrada em /var/log/flix-games-deploy.log.
set -euo pipefail
umask 022
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

REPO_URL=https://github.com/Flix-Fibra/Flix-Games.git   # repositório público: leitura sem chave
RAMO=Principal
RAIZ=/opt/flix-games
TRABALHO=/var/lib/flix-games-deploy          # espelho do repositório e área de montagem
CONSTRUTOR=flixgames-build                   # usuário sem privilégios: roda npm e a montagem do site
BACKUPS=/var/backups/flix-games              # backups do banco (os 14 mais recentes)
LOG=/var/log/flix-games-deploy.log
DC=(docker compose -p flix-games --env-file "$RAIZ/segredos/.env")
QUEM=${SUDO_USER:-root}

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo: sudo $0 ${*:-}" >&2; exit 1; }
exec 9>/run/lock/flix-games-deploy.lock
flock -n 9 || { echo "Outro deploy do Flix Games está em andamento. Tente de novo em alguns minutos." >&2; exit 1; }
cd "$TRABALHO"   # o sudo mantém a pasta de quem chamou (ex.: /home/rodrigo), que o usuário de montagem não lê

registrar() { printf '%s  %-10s %s\n' "$(date '+%F %T')" "$QUEM" "$*" >> "$LOG"; }
api_no_ar() {
  for _ in $(seq 1 45); do curl -fsS http://127.0.0.1:8047/api/saude >/dev/null 2>&1 && return 0; sleep 2; done
  return 1
}
como_construtor() { runuser -u "$CONSTRUTOR" -- env HOME="$TRABALHO/home" "$@"; }

# ---------- Voltar para a versão anterior ----------
if [ "${1:-}" = "--voltar" ] && [ $# -eq 1 ]; then
  [ -d "$RAIZ/app.anterior" ] && [ -d "$RAIZ/site.anterior" ] || { echo "Não há versão anterior guardada." >&2; exit 1; }
  echo "== Voltando para a versão anterior (a atual passa a ser a anterior)"
  mv "$RAIZ/app" "$RAIZ/app.troca" && mv "$RAIZ/app.anterior" "$RAIZ/app" && mv "$RAIZ/app.troca" "$RAIZ/app.anterior"
  mv "$RAIZ/site" "$RAIZ/site.troca" && mv "$RAIZ/site.anterior" "$RAIZ/site" && mv "$RAIZ/site.troca" "$RAIZ/site.anterior"
  cd "$RAIZ/app"
  "${DC[@]}" -f compose.producao.yaml up -d --build
  if api_no_ar; then registrar "voltar: ok"; echo "== Pronto: versão anterior no ar."
  else registrar "voltar: API não respondeu"; echo "A API não respondeu em 90 s. Veja: sudo ${DC[*]} -f $RAIZ/app/compose.producao.yaml logs --tail 50 api" >&2; exit 1; fi
  echo "Uma migração de banco não se desfaz sozinha; se for o caso, os backups estão em $BACKUPS."
  exit 0
fi
[ $# -eq 0 ] || { echo "Uso: deploy-flix-games [--voltar]" >&2; exit 2; }

# ---------- 1. Código da Principal (espelho local do repositório público) ----------
if [ ! -d "$TRABALHO/repo.git" ]; then git clone --quiet --mirror "$REPO_URL" "$TRABALHO/repo.git"; fi
git -C "$TRABALHO/repo.git" fetch --quiet --prune
COMMIT=$(git -C "$TRABALHO/repo.git" rev-parse --short=7 "refs/heads/$RAMO")
TITULO=$(git -C "$TRABALHO/repo.git" log -1 --format=%s "$COMMIT")
echo "== Publicando $COMMIT: $TITULO"
registrar "início $COMMIT"
trap 'registrar "FALHOU $COMMIT (antes de terminar; veja a saída do comando)"' ERR

M="$TRABALHO/montagem"
rm -rf "$M" && install -d -m 755 -o "$CONSTRUTOR" -g "$CONSTRUTOR" "$M"
FONTE="$M/fonte"; SITE_NOVO="$M/site"
como_construtor mkdir "$FONTE"
git -C "$TRABALHO/repo.git" archive "$COMMIT" | como_construtor tar -x -C "$FONTE"

# ---------- 2. Site (portal + jogos), montado sem privilégios numa cópia ----------
echo "== Montando o site"
como_construtor cp -R "$FONTE" "$M/fonte-build"
como_construtor "$FONTE/scripts/deploy/montar-site.sh" "$M/fonte-build" "$SITE_NOVO"
rm -rf "$M/fonte-build"
[ -f "$SITE_NOVO/index.html" ] || { echo "O site montado não tem index.html." >&2; exit 1; }

# ---------- 3. Imagem nova da API, ainda sem trocar nada ----------
echo "== Construindo a imagem da API"
"${DC[@]}" -f "$FONTE/compose.producao.yaml" build api

# ---------- 4. Backup do banco ----------
install -d -m 700 "$BACKUPS"
B="$BACKUPS/flix-games-$(date +%Y%m%d-%H%M%S)-antes-de-$COMMIT.sql.gz"
"${DC[@]}" -f "$RAIZ/app/compose.producao.yaml" exec -T db pg_dump -U flixgames -d flixgames | gzip > "$B"
chmod 600 "$B"
ls -1t "$BACKUPS"/*.sql.gz | tail -n +15 | xargs -r rm --
echo "== Backup: $B ($(du -h "$B" | cut -f1))"

# ---------- 5. Troca: a versão do ar vira a anterior ----------
chown -R root:root "$FONTE" "$SITE_NOVO"   # o que vai ao ar não fica editável pelo usuário de montagem
rm -rf "$RAIZ/app.anterior" "$RAIZ/site.anterior"
mv "$RAIZ/app" "$RAIZ/app.anterior" && mv "$FONTE" "$RAIZ/app"
mv "$RAIZ/site" "$RAIZ/site.anterior" && mv "$SITE_NOVO" "$RAIZ/site"

# ---------- 6. API com a imagem nova (as migrações rodam ao iniciar) ----------
cd "$RAIZ/app"
"${DC[@]}" -f compose.producao.yaml up -d
if ! api_no_ar; then
  registrar "FALHOU $COMMIT: API não respondeu depois da troca"
  echo "A API não respondeu em 90 s. Para voltar: sudo /usr/local/sbin/deploy-flix-games --voltar" >&2
  exit 1
fi

# ---------- 7. Catálogo (nome, capa e pasta de cada jogo, dos game.json) ----------
como_construtor node "$RAIZ/app/scripts/sincronizar-catalogo.mjs" \
  | "${DC[@]}" -f compose.producao.yaml exec -T db psql -v ON_ERROR_STOP=1 -q -U flixgames -d flixgames

trap - ERR
registrar "ok $COMMIT: $TITULO"
echo "== Pronto: $COMMIT no ar. Saúde pública: $(curl -s https://games.flixfibra.com.br/api/saude)"
echo "   Para voltar: sudo /usr/local/sbin/deploy-flix-games --voltar"
