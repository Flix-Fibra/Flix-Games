#!/usr/bin/env bash
# Instala o deploy com um comando no 132.255.110.226. Roda UMA vez, com sudo, a partir da pasta com os três arquivos
# (deploy-flix-games.sh, sudoers-flix-games-deploy e este). Pode rodar de novo para atualizar o script.
#
#   sudo bash instalar-deploy.sh
#
# Cria: o usuário sem privilégios flixgames-build (monta o site; sem login), /var/lib/flix-games-deploy,
# /usr/local/sbin/deploy-flix-games, a regra /etc/sudoers.d/zzz-flix-games-deploy (conferida com visudo antes de
# valer) e o log /var/log/flix-games-deploy.log. Não mexe no site no ar, no nginx nem no banco.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo: sudo bash $0" >&2; exit 1; }
AQUI=$(cd "$(dirname "$0")" && pwd)
for f in deploy-flix-games.sh sudoers-flix-games-deploy; do [ -f "$AQUI/$f" ] || { echo "Falta $AQUI/$f" >&2; exit 1; }; done

TRABALHO=/var/lib/flix-games-deploy
if ! id flixgames-build >/dev/null 2>&1; then
  useradd --system --home-dir "$TRABALHO/home" --shell /usr/sbin/nologin --user-group flixgames-build
  echo "usuário flixgames-build criado"
fi
install -d -m 755 -o root -g root "$TRABALHO"
install -d -m 755 -o flixgames-build -g flixgames-build "$TRABALHO/home"

install -m 755 -o root -g root "$AQUI/deploy-flix-games.sh" /usr/local/sbin/deploy-flix-games
bash -n /usr/local/sbin/deploy-flix-games

# A regra só vale se o visudo aprovar (um sudoers com erro pode travar o sudo do servidor inteiro)
T=$(mktemp)
install -m 440 -o root -g root "$AQUI/sudoers-flix-games-deploy" "$T"
visudo -cf "$T" >/dev/null || { rm -f "$T"; echo "Regra do sudoers recusada pelo visudo; nada foi instalado nela." >&2; exit 1; }
mv "$T" /etc/sudoers.d/zzz-flix-games-deploy

touch /var/log/flix-games-deploy.log && chmod 644 /var/log/flix-games-deploy.log   # legível pela equipe: quem, quando, qual commit

echo "Pronto. Teste: sudo -n /usr/local/sbin/deploy-flix-games   (sem senha, só este comando)"
