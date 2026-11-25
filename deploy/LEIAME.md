# Deploy do Flix Games

Servidor compartilhado `132.255.110.226` (porta SSH 2772), domínio `https://games.flixfibra.com.br` pelo Cloudflare.
O servidor também roda os sistemas da Flix e projetos de outros clientes. Por isso:

- o deploy é **sempre de um commit** (`git archive`), nunca da pasta de trabalho;
- só **depois das 18h** (Brasília);
- mexer no nginx exige **autorização** e `nginx -t` antes do reload;
- só o compose `flix-games` é reiniciado, nenhum outro serviço.

## Como fica no servidor

| O quê | Onde |
|---|---|
| Código do commit (build da API) | `/opt/flix-games/app` |
| Site estático (portal + `games/<pasta>/`) | `/opt/flix-games/site` |
| Segredos (`.env` com a senha do banco, `api_propria_chave`) | `/opt/flix-games/segredos` (pasta 700, nunca no git) |
| Banco | volume Docker `flix-games_db-dados` (sem porta publicada) |
| API | `127.0.0.1:8047` (compose `flix-games`, `compose.producao.yaml`) |
| nginx | `/etc/nginx/sites-available/flix-games` → `sites-enabled` (arquivo `deploy/nginx-flix-games.conf`) |
| Certificado | Let's Encrypt (certbot webroot `/var/www/flix-games-acme`), igual ao Pulse |

A API Própria só aceita a chave a partir do IP `132.255.110.226`. Esse é o IP de saída do servidor, conferido em 24/11/2026; ele não tem saída IPv6.

## Primeira vez (uma vez só)

Antes de começar, confirme no Cloudflare que o registro `games` aponta para `132.255.110.226`.

```bash
sudo install -d -m 755 /opt/flix-games /opt/flix-games/site /var/www/flix-games-acme
sudo install -d -m 700 /opt/flix-games/segredos
# Senha do banco: gerada no servidor, sem aparecer na tela
sudo sh -c 'umask 077; printf "POSTGRES_PASSWORD=%s\n" "$(openssl rand -hex 32)" > /opt/flix-games/segredos/.env'
# Chave da API Própria (o Marcio entrega em mãos). Enquanto não houver chave, um arquivo vazio:
# o login responde "tente mais tarde" (503), sem dizer que a senha está errada.
sudo install -m 400 -o 10001 -g 10001 /dev/null /opt/flix-games/segredos/api_propria_chave
# Usuários da equipe (só os hashes das senhas; vazio = ninguém da equipe entra)
sudo install -m 400 -o 10001 -g 10001 /dev/null /opt/flix-games/segredos/equipe
```

Acesso da equipe ao site antes do login do cliente funcionar: usuário e senha, na opção "Sou da equipe Flix Games" da tela de entrada. Para cadastrar ou trocar uma senha (digitada sem aparecer na tela; vale na hora):

```bash
sudo python3 /opt/flix-games/app/scripts/deploy/codigo_equipe.py rafael            # cadastra ou troca
sudo python3 /opt/flix-games/app/scripts/deploy/codigo_equipe.py tobias --remover   # tira o acesso
```

Para gravar a chave quando ela chegar, sem que ela vá para o histórico ou para a tela:

```bash
read -rs CHAVE && printf '%s' "$CHAVE" | sudo install -m 400 -o 10001 -g 10001 /dev/stdin /opt/flix-games/segredos/api_propria_chave; unset CHAVE
sudo docker compose -p flix-games -f /opt/flix-games/app/compose.producao.yaml --env-file /opt/flix-games/segredos/.env restart api
```

### Certificado

1. Instale um bloco só com HTTP: o primeiro `server` de `deploy/nginx-flix-games.conf`, mais a linha `limit_req_zone`.
2. Rode `sudo nginx -t && sudo systemctl reload nginx`.
3. Emita o certificado: `sudo certbot certonly --webroot -w /var/www/flix-games-acme -d games.flixfibra.com.br`.
4. Instale o arquivo completo e rode `nginx -t` e o reload de novo.

## Cada deploy (a partir do commit)

No Mac, na pasta do repositório:

```bash
COMMIT=$(git rev-parse --short HEAD)   # o commit que vai ao ar (já com push)
git archive "$COMMIT" | ssh -p 2772 fael-mac@132.255.110.226 "rm -rf /tmp/flix-games-$COMMIT && mkdir /tmp/flix-games-$COMMIT && tar -x -C /tmp/flix-games-$COMMIT"
```

No servidor:

```bash
C=/tmp/flix-games-<COMMIT>
# 1. backup do banco (a partir do 2º deploy)
sudo docker compose -p flix-games -f /opt/flix-games/app/compose.producao.yaml --env-file /opt/flix-games/segredos/.env \
  exec -T db pg_dump -U flixgames -d flixgames | gzip > ~/backup-flix-games-$(date +%Y%m%d-%H%M).sql.gz
# 2. monta o site numa pasta nova (a do ar continua servindo)
cp -R "$C" "$C-build" && "$C/scripts/deploy/montar-site.sh" "$C-build" /tmp/flix-games-site-nova && rm -rf "$C-build"
# 3. troca o código da API e o site
sudo rm -rf /opt/flix-games/app.anterior && { [ -d /opt/flix-games/app ] && sudo mv /opt/flix-games/app /opt/flix-games/app.anterior || true; }
sudo mv "$C" /opt/flix-games/app
sudo rm -rf /opt/flix-games/site.anterior && sudo mv /opt/flix-games/site /opt/flix-games/site.anterior && sudo mv /tmp/flix-games-site-nova /opt/flix-games/site
# 4. sobe a API; as migrações rodam sozinhas ao iniciar
cd /opt/flix-games/app && sudo docker compose -p flix-games -f compose.producao.yaml --env-file /opt/flix-games/segredos/.env up -d --build
# 5. catálogo (nome, capa e pasta de cada jogo, a partir dos game.json)
node scripts/sincronizar-catalogo.mjs | sudo docker compose -p flix-games -f compose.producao.yaml --env-file /opt/flix-games/segredos/.env \
  exec -T db psql -v ON_ERROR_STOP=1 -q -U flixgames -d flixgames
```

Publicar um jogo é uma decisão, não um passo do deploy. Todos nascem sem publicar, e o G10 depende do jurídico:
`UPDATE jogos SET publicado = TRUE WHERE id IN (...)`.

### Conferir depois de subir

"No ar" não prova que funciona. Confira cada item:

- `curl -s https://games.flixfibra.com.br/api/saude` → `{"ok":true}` (isso confere o banco também).
- `curl -sI https://games.flixfibra.com.br/` → 200; `curl -sI https://games.flixfibra.com.br/games/snake/` → 200 com `access-control-allow-origin: *`.
- `curl -s -o /dev/null -w '%{http_code}' https://games.flixfibra.com.br/api/docs` → 404 (sem documentação em produção).
- `sudo docker compose -p flix-games -f /opt/flix-games/app/compose.producao.yaml logs --tail 50 api` → sem erro, e sem CPF ou senha em linha nenhuma.
- No celular: tela "Entrar no Flix Games", login de teste, abrir um jogo, terminar uma partida e ver o ranking.

### Voltar atrás

```bash
sudo mv /opt/flix-games/site /opt/flix-games/site.quebrado && sudo mv /opt/flix-games/site.anterior /opt/flix-games/site
sudo mv /opt/flix-games/app /opt/flix-games/app.quebrado && sudo mv /opt/flix-games/app.anterior /opt/flix-games/app
cd /opt/flix-games/app && sudo docker compose -p flix-games -f compose.producao.yaml --env-file /opt/flix-games/segredos/.env up -d --build
```

Uma migração nova não se desfaz sozinha. Se ela quebrar alguma coisa, restaure o backup do passo 1.
