/* Flix Games — protótipo visual. Dados fictícios; nada é enviado a servidor.
   Textos que no futuro virão de clientes (apelidos) passam por esc() antes de ir para o HTML. */
(function () {
  'use strict';

  var ICONES = {
    voo: '<path d="M4 13c3-5 8-6 12-4l4-2-1 4c0 4-4 7-9 7-3 0-5-1-6-2l3-1c-2 0-3-1-3-2z"/><circle cx="15" cy="10" r="1.2" fill="#000"/>',
    labirinto: '<path d="M3 3h18v18H3zm3 3v12h12V6zm3 3h6v6H9z" fill-rule="evenodd"/>',
    soma: '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" opacity=".95"/>',
    cobrinha: '<path d="M4 18h6v-6h6V6h4v4h-2v6h-6v6H4z"/><circle cx="19" cy="7.5" r="1" fill="#000"/>',
    blocos: '<path d="M4 14h5v5H4zm5 0h5v5H9zm5 0h5v5h-5zM9 9h5v5H9zM9 4h5v5H9z"/>',
    corrida: '<path d="M13 4a2 2 0 1 1 0 .01zM8 21l3-7 3 2v5h2v-6l-3-3 1-3c1 2 3 3 5 3v-2c-2 0-3-1-4-3l-1-1c-1 0-2 0-3 1L7 10v4h2v-3l2-1-4 11z"/>',
    paciencia: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 4c-2 2-4 3-4 5a2 2 0 0 0 3.5 1.3L11 16h2l-.5-2.7A2 2 0 0 0 16 12c0-2-2-3-4-5z"/>',
    memoria: '<path d="M3 5h8v14H3zm10 0h8v14h-8z" opacity=".95"/><path d="M7 10l1 2-1 2-1-2zm10 0l1 2-1 2-1-2z" fill="#000"/>'
  };
  var TROFEU = '<path d="M7 4h10v3a5 5 0 0 1-4 4.9V15h3v3H8v-3h3v-3.1A5 5 0 0 1 7 7zM4 5h2v2a2 2 0 0 1-2-2zm16 0a2 2 0 0 1-2 2V5z"/>';
  var CORACAO = '<path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"/>';
  var LIXEIRA = '<path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z"/>';

  // Catálogo (igual para todos). Nomes próprios: o catálogo real depende da Q11/Q12 (licenças).
  // "topo" = pontuação do 1º lugar no ranking fictício.
  var JOGOS = [
    { id: 'voo', nome: 'Voo Flix', genero: 'Habilidade · 1 jogador', c1: '#f59e0b', c2: '#b45309', ranking: true, unidade: 'obstáculos', topo: 108,
      desc: 'Toque para voar e passe pelo maior número de obstáculos sem bater. Partidas rápidas, perfeitas para o intervalo.', tamanho: '1,2 MB' },
    { id: 'labirinto', nome: 'Labirinto Sombrio', genero: 'Ação · 1 jogador', c1: '#b91c1c', c2: '#450a0a', ranking: true, unidade: 'pontos', topo: 26100,
      desc: 'Atravesse corredores escuros, encontre as chaves e chegue à saída. Funciona com controle.', tamanho: '9,8 MB', controle: true },
    { id: 'soma', nome: 'Soma 2048', genero: 'Quebra-cabeça · 1 jogador', c1: '#eab308', c2: '#a16207', ranking: true, unidade: 'pontos', topo: 27300,
      desc: 'Junte peças iguais até chegar ao 2048. Seu progresso fica salvo para continuar em outro aparelho.', tamanho: '0,4 MB' },
    { id: 'cobrinha', nome: 'Cobrinha', genero: 'Clássico · 1 jogador', c1: '#22c55e', c2: '#14532d', ranking: true, unidade: 'pontos', topo: 470,
      desc: 'Coma, cresça e não encoste no próprio rabo. O clássico que roda em qualquer celular.', tamanho: '0,3 MB', controle: true },
    { id: 'blocos', nome: 'Blocos em Queda', genero: 'Quebra-cabeça · 1 jogador', c1: '#8b5cf6', c2: '#3b0764', ranking: true, unidade: 'linhas', topo: 150,
      desc: 'Encaixe os blocos e complete linhas antes que a pilha chegue ao topo.', tamanho: '0,6 MB', controle: true },
    { id: 'corrida', nome: 'Corrida Infinita', genero: 'Corrida · 1 jogador', c1: '#06b6d4', c2: '#164e63', ranking: true, unidade: 'metros', topo: 13400,
      desc: 'Desvie, pule e colete moedas pelo maior percurso que conseguir.', tamanho: '3,1 MB' },
    { id: 'paciencia', nome: 'Paciência', genero: 'Cartas · 1 jogador', c1: '#e11d48', c2: '#4c0519', ranking: false,
      desc: 'O jogo de cartas mais conhecido, sem pressa. Este jogo não tem ranking.', tamanho: '0,8 MB' },
    { id: 'memoria', nome: 'Memória', genero: 'Raciocínio · 1 jogador', c1: '#ec4899', c2: '#831843', ranking: false,
      desc: 'Vire as cartas e encontre os pares. Treine a memória em partidas curtas.', tamanho: '0,5 MB' }
  ];
  var CONQUISTAS = [
    { nome: 'Primeira partida', desc: 'Jogue qualquer jogo' },
    { nome: 'Top 5', desc: 'Entre no top 5 de um jogo' },
    { nome: 'Voo longo', desc: '50 obstáculos no Voo Flix' },
    { nome: 'Persistente', desc: 'Jogue 7 dias seguidos' },
    { nome: 'Colecionador', desc: 'Jogue 5 jogos diferentes' },
    { nome: 'Lenda', desc: 'Seja 1º em um ranking' }
  ];
  var APELIDOS = ['NightOwl', 'Guh_77', 'LariGamer', 'Toddy', 'Bruxinha', 'Zé Turbo', 'Neguinho_BR', 'Pixel', 'Mih', 'Kaique', 'DonaCida', 'Lobo', 'Fefe', 'Jotapê'];

  // ---------- Perfis: no máximo 2 por conta. Cada um tem ranking, progresso, favoritos e conquistas próprios. ----------
  var MAX_PERFIS = 2;
  var CORES = ['#D2232A', '#2773D2', '#7654C4', '#15803D'];
  var PERFIS_EXEMPLO = [
    { id: 'p1', apelido: 'RafaPlayer', cor: '#D2232A', nivel: 7, partidas: 248, desde: 'nov/2026', oculto: false,
      conquistas: [1, 1, 1, 1, 0, 0], favs: {},
      jogos: { voo: { melhor: 87, posicao: 4 }, labirinto: { melhor: 15420, posicao: 12, progresso: 35 }, soma: { melhor: 24310, posicao: 2, progresso: 60 },
               cobrinha: { melhor: 312, posicao: 9 }, blocos: { melhor: 64, posicao: 21 }, corrida: { melhor: 4380, posicao: 33 }, paciencia: { progresso: 80 } } },
    { id: 'p2', apelido: 'Ana_Gamer', cor: '#2773D2', nivel: 3, partidas: 41, desde: 'nov/2026', oculto: false,
      conquistas: [1, 0, 0, 0, 0, 0], favs: { memoria: true },
      jogos: { voo: { melhor: 34, posicao: 18 }, memoria: { progresso: 45 }, cobrinha: { melhor: 120, posicao: 27 } } }
  ];

  var perfis, atualId;
  try { perfis = JSON.parse(localStorage.getItem('flixgames-perfis') || 'null'); } catch (e) { perfis = null; }
  if (!Array.isArray(perfis) || !perfis.length || perfis.length > MAX_PERFIS) perfis = JSON.parse(JSON.stringify(PERFIS_EXEMPLO));
  try { atualId = localStorage.getItem('flixgames-perfil'); } catch (e) { atualId = null; }
  function salvarPerfis() {
    try { localStorage.setItem('flixgames-perfis', JSON.stringify(perfis)); localStorage.setItem('flixgames-perfil', atualId || ''); } catch (e) { /* sem storage */ }
  }
  function perfilAtual() { return perfis.filter(function (p) { return p.id === atualId; })[0] || null; }
  function EU() { return perfilAtual() || perfis[0]; }
  function st(j) { return EU().jogos[j.id] || {}; } // estatísticas do perfil atual neste jogo

  // ---------- utilidades ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function svg(paths) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>'; }
  function num(n) { return Number(n).toLocaleString('pt-BR'); }
  function iniciaisTxt(a) { return a.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase(); }
  function iniciais(a) { return esc(iniciaisTxt(a)); }
  var toastT;
  function avisar(msg) {
    var el = $('toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }
  function mini(j) { return '<span class="gx-mini" style="--t1:' + j.c1 + ';--t2:' + j.c2 + '">' + svg(ICONES[j.id]) + '</span>'; }
  var RE_APELIDO = /^[A-Za-zÀ-ÿ0-9 _-]{3,20}$/;
  function limparApelido(v) { return v.trim().replace(/\s+/g, ' '); }
  function apelidoEmUso(v, excetoId) {
    return perfis.some(function (p) { return p.id !== excetoId && p.apelido.toLowerCase() === v.toLowerCase(); });
  }

  // Ranking fictício e estável por jogo; o perfil atual entra na posição dele (se já jogou)
  function rankingDe(j) {
    if (!j.ranking) return [];
    var s = st(j), lista = [], eu = EU();
    for (var i = 1; i <= 10; i++) {
      if (i === s.posicao) { lista.push({ pos: i, apelido: eu.apelido, pontos: s.melhor, eu: true }); continue; }
      lista.push({ pos: i, apelido: APELIDOS[(i * 3 + j.nome.length) % APELIDOS.length], pontos: Math.round(j.topo * (1 - (i - 1) * 0.06)) });
    }
    if (s.posicao > 10) lista.push({ pos: s.posicao, apelido: eu.apelido, pontos: s.melhor, eu: true });
    return lista;
  }
  function linha(r, unidade) {
    var p = r.pos <= 3 ? ' p' + r.pos : '';
    return '<li class="gx-linha' + (r.eu ? ' eu' : '') + '">' +
      '<span class="gx-pos' + p + '">' + r.pos + 'º</span>' +
      '<span class="gx-mini-av"' + (r.eu ? ' style="background:' + EU().cor + '"' : '') + '>' + iniciais(r.apelido) + '</span>' +
      '<span class="gx-apelido">' + esc(r.apelido) + (r.eu ? ' (você)' : '') + '</span>' +
      '<span class="gx-pontos">' + num(r.pontos) + ' <small>' + esc(unidade || '') + '</small></span></li>';
  }

  // ---------- Início ----------
  var sel = 0;
  var trilho = $('trilho');

  function montarTrilho() {
    var favs = EU().favs;
    trilho.innerHTML = JOGOS.map(function (j, i) {
      return '<button class="gx-tile" role="option" data-i="' + i + '" aria-label="' + esc(j.nome) + '"' +
        ' style="--t1:' + j.c1 + ';--t2:' + j.c2 + '">' + svg(ICONES[j.id]) +
        (favs[j.id] ? '<span class="gx-tile-fav">' + svg(CORACAO) + '</span>' : '') +
        '<span class="gx-tile-nome">' + esc(j.nome) + '</span></button>';
    }).join('');
  }

  function selecionar(i, rolar) {
    sel = (i + JOGOS.length) % JOGOS.length;
    var j = JOGOS[sel], s = st(j);
    Array.prototype.forEach.call(trilho.children, function (t, k) {
      t.classList.toggle('ativo', k === sel);
      t.setAttribute('aria-selected', k === sel ? 'true' : 'false');
      t.tabIndex = k === sel ? 0 : -1;
    });
    if (rolar) trilho.children[sel].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    document.documentElement.style.setProperty('--c1', j.c1);
    document.documentElement.style.setProperty('--c2', j.c2);
    $('hero-genero').textContent = j.genero;
    $('hero-titulo').textContent = j.nome;
    $('hero-desc').textContent = j.desc;
    var chips = [];
    if (j.ranking && s.posicao) {
      chips.push('<span class="gx-chip ouro">' + svg(TROFEU) + s.posicao + 'º no ranking</span>');
      chips.push('<span class="gx-chip">Recorde: ' + num(s.melhor) + ' ' + esc(j.unidade) + '</span>');
    } else if (j.ranking) {
      chips.push('<span class="gx-chip">Você ainda não pontuou</span>');
    }
    if (j.controle) chips.push('<span class="gx-chip">Aceita controle</span>');
    chips.push('<span class="gx-chip">' + esc(j.tamanho) + '</span>');
    $('hero-chips').innerHTML = chips.join('');
    $('btn-jogar-txt').textContent = s.progresso ? 'Continuar' : 'Jogar';
    var fav = !!EU().favs[j.id];
    $('btn-fav').setAttribute('aria-pressed', fav ? 'true' : 'false');
    $('btn-fav').querySelector('span').textContent = fav ? 'Favorito' : 'Favoritar';
    $('btn-ver-ranking').hidden = !j.ranking;

    $('faixa-top').hidden = !j.ranking;
    if (j.ranking) {
      $('top-nome').textContent = j.nome;
      $('top5').innerHTML = rankingDe(j).slice(0, 5).map(function (r) { return linha(r, j.unidade); }).join('');
    }
  }

  function montarContinuar() {
    var lista = JOGOS.filter(function (j) { return st(j).progresso; });
    $('continuar').innerHTML = lista.length ? lista.map(function (j) {
      var p = st(j).progresso;
      return '<button class="gx-cont" data-id="' + j.id + '">' + mini(j) +
        '<span class="gx-cont-info"><strong>' + esc(j.nome) + '</strong><small>' + p + '% concluído</small>' +
        '<span class="gx-barra"><i style="width:' + p + '%"></i></span></span></button>';
    }).join('') : '<p class="perfil-dica">Nenhum jogo em andamento. Escolha um jogo acima para começar.</p>';
  }

  trilho.addEventListener('click', function (e) {
    var t = e.target.closest('.gx-tile'); if (!t) return;
    var i = Number(t.dataset.i);
    if (i === sel) jogar(); else selecionar(i, true);
  });
  $('continuar').addEventListener('click', function (e) {
    var b = e.target.closest('.gx-cont'); if (!b) return;
    selecionar(JOGOS.findIndex(function (j) { return j.id === b.dataset.id; }), true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function jogar() { avisar('Protótipo: aqui abre "' + JOGOS[sel].nome + '"'); }
  $('btn-jogar').addEventListener('click', jogar);
  $('btn-fav').addEventListener('click', function () {
    var j = JOGOS[sel], favs = EU().favs;
    if (favs[j.id]) delete favs[j.id]; else favs[j.id] = true;
    salvarPerfis(); montarTrilho(); selecionar(sel, false);
    avisar(favs[j.id] ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
  });
  $('btn-ver-ranking').addEventListener('click', function () { rankJogo = sel; mostrar('ranking'); });

  // ---------- Ranking ----------
  var rankJogo = 0;
  var comRanking = JOGOS.map(function (j, i) { return i; }).filter(function (i) { return JOGOS[i].ranking; });

  function montarRanking() {
    if (!JOGOS[rankJogo].ranking) rankJogo = comRanking[0];
    $('filtro-jogos').innerHTML = comRanking.map(function (i) {
      var j = JOGOS[i];
      return '<button class="gx-filtro" role="tab" data-i="' + i + '" aria-selected="' + (i === rankJogo) + '">' + mini(j) + esc(j.nome) + '</button>';
    }).join('');
    var j = JOGOS[rankJogo], lista = rankingDe(j);
    var cores = ['var(--silver)', 'var(--gold)', 'var(--bronze)'];
    $('podio').innerHTML = [lista[1], lista[0], lista[2]].map(function (r, k) {
      return '<div class="gx-podio-item" style="--cor:' + cores[k] + '"><div class="gx-podio-av">' + iniciais(r.apelido) + '</div>' +
        '<div class="gx-podio-base"><strong>' + r.pos + 'º ' + esc(r.apelido) + '</strong><span>' + num(r.pontos) + '</span></div></div>';
    }).join('');
    $('lista-ranking').innerHTML = lista.slice(3).map(function (r) { return linha(r, j.unidade); }).join('');
  }
  $('filtro-jogos').addEventListener('click', function (e) {
    var b = e.target.closest('.gx-filtro'); if (!b) return;
    rankJogo = Number(b.dataset.i); montarRanking();
  });

  // ---------- Perfil ----------
  function montarPerfil() {
    var eu = EU(), ini = iniciaisTxt(eu.apelido);
    $('p-apelido').textContent = eu.apelido;
    $('p-avatar').textContent = ini;
    $('btn-avatar').style.background = eu.cor; $('btn-avatar').style.color = '#fff';
    $('avatar-topo').textContent = ini; $('avatar-topo').style.background = eu.cor;
    $('in-apelido').value = eu.apelido;
    $('msg-apelido').textContent = '';
    $('ocultar').checked = !!eu.oculto;
    $('p-nivel').textContent = 'Nível ' + eu.nivel;
    $('p-desde').textContent = 'Cliente Flix · jogando desde ' + eu.desde;
    $('p-partidas').textContent = num(eu.partidas);

    var comPos = JOGOS.filter(function (j) { return j.ranking && st(j).posicao; });
    var melhor = comPos.slice().sort(function (a, b) { return st(a).posicao - st(b).posicao; })[0];
    $('p-melhor').textContent = melhor ? st(melhor).posicao + 'º · ' + melhor.nome : '—';

    $('posicoes').innerHTML = JOGOS.filter(function (j) { return j.ranking; }).map(function (j) {
      var s = st(j);
      return '<li>' + mini(j) + '<span><strong>' + esc(j.nome) + '</strong><small>' +
        (s.posicao ? 'Recorde: ' + num(s.melhor) + ' ' + esc(j.unidade) : 'Ainda não jogou') + '</small></span>' +
        '<span class="gx-pos-grande">' + (s.posicao ? s.posicao + 'º' : '—') + '</span></li>';
    }).join('');
    var feitas = eu.conquistas.filter(Boolean).length;
    $('p-conq').textContent = feitas + ' de ' + CONQUISTAS.length;
    $('conquistas').innerHTML = CONQUISTAS.map(function (c, i) {
      return '<div class="gx-conquista' + (eu.conquistas[i] ? '' : ' bloq') + '"><div class="gx-conquista-ic">' + svg(TROFEU) + '</div>' +
        '<strong>' + esc(c.nome) + '</strong><small>' + esc(c.desc) + '</small></div>';
    }).join('');
    montarAparelhos();
  }

  // Aparelhos (Q09): sessão sem prazo por aparelho; sair desconecta só aquele aparelho. São da conta, não do perfil.
  var APARELHOS = [
    { nome: 'Este celular', det: 'App Flix · Android · agora', atual: true, tipo: 'cel' },
    { nome: 'Notebook', det: 'Chrome · Windows · ontem às 21:40', tipo: 'pc' },
    { nome: 'Tablet', det: 'Safari · iPadOS · há 6 dias', tipo: 'tab' }
  ];
  var ICO_AP = {
    cel: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    pc: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M2 19.5h20"/>',
    tab: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M11 18.5h2"/>'
  };
  function montarAparelhos() {
    $('aparelhos').innerHTML = APARELHOS.map(function (a, i) {
      return '<li class="aparelho' + (a.atual ? ' atual' : '') + '"><span class="aparelho-icone"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICO_AP[a.tipo] + '</svg></span>' +
        '<span class="aparelho-texto"><strong>' + esc(a.nome) + (a.atual ? ' <span class="selo-aparelho">Este aparelho</span>' : '') + '</strong><span>' + esc(a.det) + '</span></span>' +
        '<button class="btn light aparelho-sair" type="button" data-i="' + i + '">' + (a.atual ? 'Sair' : 'Desconectar') + '</button></li>';
    }).join('');
  }
  $('aparelhos').addEventListener('click', function (e) {
    var b = e.target.closest('.aparelho-sair'); if (!b) return;
    var a = APARELHOS[Number(b.dataset.i)];
    if (a.atual) { avisar('Protótipo: aqui sairia só deste aparelho'); return; }
    APARELHOS.splice(Number(b.dataset.i), 1); montarAparelhos();
    avisar(a.nome + ' desconectado');
  });

  // Apelido: checagem no aparelho só para ajudar; a validação e a moderação de verdade são no servidor (Q25).
  $('form-apelido').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = limparApelido($('in-apelido').value), msg = $('msg-apelido'), eu = EU();
    if (!RE_APELIDO.test(v)) { msg.className = 'perfil-msg erro'; msg.textContent = 'Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.'; return; }
    if (apelidoEmUso(v, eu.id)) { msg.className = 'perfil-msg erro'; msg.textContent = 'O outro perfil da conta já usa esse apelido.'; return; }
    eu.apelido = v; eu.oculto = $('ocultar').checked; salvarPerfis();
    montarPerfil(); selecionar(sel, false);
    $('msg-apelido').className = 'perfil-msg ok'; $('msg-apelido').textContent = 'Salvo (protótipo: só neste navegador).';
  });
  $('btn-avatar').addEventListener('click', function () { avisar('Protótipo: aqui abre a escolha de avatar'); });
  $('ocultar').addEventListener('change', function () {
    EU().oculto = this.checked; salvarPerfis();
    avisar(this.checked ? 'Seu perfil está oculto no ranking' : 'Seu perfil voltou a aparecer no ranking');
  });

  // ---------- Quem vai jogar? ----------
  var gerenciando = false, confirmarId = null;

  function montarQuem() {
    var html = perfis.map(function (p) {
      var conf = confirmarId === p.id;
      var info = gerenciando ? (conf ? 'Toque de novo para excluir' : 'Toque para excluir') : 'Nível ' + p.nivel;
      return '<button class="gx-pf' + (p.id === atualId ? ' atual' : '') + (conf ? ' confirmar' : '') + '" type="button" data-id="' + p.id + '"' +
        ' aria-label="' + (gerenciando ? 'Excluir perfil ' : 'Entrar como ') + esc(p.apelido) + '">' +
        '<span class="gx-pf-av" style="--cor:' + p.cor + '">' + iniciais(p.apelido) + '</span>' +
        (gerenciando && perfis.length > 1 ? '<span class="gx-pf-excluir" aria-hidden="true">' + svg(LIXEIRA) + '</span>' : '') +
        '<span class="gx-pf-nome">' + esc(p.apelido) + '</span><span class="gx-pf-info">' + info + '</span></button>';
    }).join('');
    if (perfis.length < MAX_PERFIS && !gerenciando) {
      html += '<button class="gx-pf novo" type="button" data-novo="1" aria-label="Adicionar perfil"><span class="gx-pf-av">+</span>' +
        '<span class="gx-pf-nome">Adicionar perfil</span><span class="gx-pf-info">' + perfis.length + ' de ' + MAX_PERFIS + ' em uso</span></button>';
    }
    $('quem-lista').innerHTML = html;
    $('quem-sub').textContent = gerenciando ? 'Escolha o perfil que quer excluir' : 'Escolha seu perfil';
    $('btn-gerenciar').setAttribute('aria-pressed', gerenciando ? 'true' : 'false');
    $('btn-gerenciar').textContent = gerenciando ? 'Concluído' : 'Gerenciar perfis';
    $('btn-gerenciar').hidden = perfis.length < 2 && !gerenciando;
  }
  function abrirQuem() {
    gerenciando = false; confirmarId = null; $('form-novo').hidden = true;
    montarQuem(); $('quem').hidden = false; document.body.style.overflow = 'hidden';
  }
  function fecharQuem() { $('quem').hidden = true; document.body.style.overflow = ''; }
  function entrar(id) {
    atualId = id; salvarPerfis(); fecharQuem();
    montarTrilho(); montarContinuar(); montarPerfil(); selecionar(0, false); mostrar('inicio');
    avisar('Olá, ' + EU().apelido + '!');
  }

  $('quem-lista').addEventListener('click', function (e) {
    var b = e.target.closest('.gx-pf'); if (!b) return;
    if (b.dataset.novo) { $('form-novo').hidden = false; $('msg-novo').textContent = ''; $('in-novo').value = ''; $('in-novo').focus(); return; }
    var id = b.dataset.id;
    if (!gerenciando) { entrar(id); return; }
    if (perfis.length < 2) return; // a conta precisa de pelo menos um perfil
    if (confirmarId !== id) { confirmarId = id; montarQuem(); return; }
    var nome = perfis.filter(function (p) { return p.id === id; })[0].apelido;
    perfis = perfis.filter(function (p) { return p.id !== id; });
    if (atualId === id) atualId = null;
    confirmarId = null; gerenciando = false; salvarPerfis(); montarQuem();
    avisar('Perfil ' + nome + ' excluído');
  });
  $('btn-gerenciar').addEventListener('click', function () { gerenciando = !gerenciando; confirmarId = null; $('form-novo').hidden = true; montarQuem(); });
  $('cancelar-novo').addEventListener('click', function () { $('form-novo').hidden = true; });
  $('form-novo').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = limparApelido($('in-novo').value), msg = $('msg-novo');
    if (perfis.length >= MAX_PERFIS) { msg.textContent = 'Limite de ' + MAX_PERFIS + ' perfis por conta.'; return; }
    if (!RE_APELIDO.test(v)) { msg.textContent = 'Use de 3 a 20 caracteres: letras, números, espaço, _ ou -.'; return; }
    if (apelidoEmUso(v, null)) { msg.textContent = 'Esse apelido já está em uso nesta conta.'; return; }
    var usadas = perfis.map(function (p) { return p.cor; });
    var cor = CORES.filter(function (c) { return usadas.indexOf(c) < 0; })[0] || CORES[0];
    var novo = { id: 'p' + Date.now(), apelido: v, cor: cor, nivel: 1, partidas: 0, desde: 'hoje', oculto: false, conquistas: [0, 0, 0, 0, 0, 0], favs: {}, jogos: {} };
    perfis.push(novo); salvarPerfis(); $('form-novo').hidden = true;
    entrar(novo.id);
  });
  $('avatar-topo').addEventListener('click', abrirQuem);
  $('btn-trocar').addEventListener('click', abrirQuem);

  // ---------- Navegação entre seções ----------
  function mostrar(v) {
    document.querySelectorAll('.gx-view').forEach(function (s) { s.classList.toggle('ativa', s.id === 'v-' + v); });
    document.querySelectorAll('.gx-nav-item').forEach(function (b) {
      var on = b.dataset.view === v; b.classList.toggle('ativo', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (v === 'ranking') montarRanking();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { mostrar(b.dataset.view); });
  });
  function viewAtual() {
    if (!$('quem').hidden) return 'quem';
    var a = document.querySelector('.gx-view.ativa'); return a ? a.id.slice(2) : '';
  }

  // ---------- Teclado e controle (setas escolhem, Enter/A joga) ----------
  document.addEventListener('keydown', function (e) {
    if (viewAtual() !== 'inicio') return;
    if (e.target.closest && e.target.closest('.gx-acoes, .gx-cont, input')) return;
    if (e.key === 'ArrowRight') { selecionar(sel + 1, true); trilho.children[sel].focus({ preventScroll: true }); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { selecionar(sel - 1, true); trilho.children[sel].focus({ preventScroll: true }); e.preventDefault(); }
  });

  var ultimo = {}, rodando = false;
  function lerControle() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = null;
    for (var i = 0; i < pads.length; i++) if (pads[i]) { p = pads[i]; break; }
    if (!p) { rodando = false; return; }
    function apertou(n) { var b = p.buttons[n] && p.buttons[n].pressed; var antes = ultimo[n]; ultimo[n] = b; return b && !antes; }
    if (viewAtual() === 'inicio') {
      if (apertou(15)) selecionar(sel + 1, true);
      if (apertou(14)) selecionar(sel - 1, true);
      if (apertou(0)) jogar();
    }
    requestAnimationFrame(lerControle);
  }
  window.addEventListener('gamepadconnected', function () {
    avisar('Controle conectado');
    if (!rodando) { rodando = true; requestAnimationFrame(lerControle); }
  });

  // ---------- Tema (claro/escuro) e topo de vidro ao rolar ----------
  $('tema').addEventListener('click', function () {
    var escuro = document.documentElement.getAttribute('data-theme') === 'dark';
    if (escuro) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('flixgames-tema', escuro ? 'light' : 'dark'); } catch (e) { /* sem storage */ }
  });
  var topo = $('topo');
  function rolou() { topo.classList.toggle('rolado', window.scrollY > 8); }
  window.addEventListener('scroll', rolou, { passive: true }); rolou();

  // ---------- Abertura ----------
  // Links diretos: #perfis abre a escolha; #inicio, #ranking e #perfil entram no perfil salvo (ou no 1º).
  var aba = location.hash.slice(1);
  if (['inicio', 'ranking', 'perfil'].indexOf(aba) >= 0 && !perfilAtual()) atualId = perfis[0].id;
  montarTrilho(); montarContinuar(); montarPerfil(); selecionar(0, false);
  if (aba === 'ranking' || aba === 'perfil') mostrar(aba);
  if (aba === 'perfis' || !perfilAtual()) abrirQuem(); // sem perfil escolhido neste aparelho: pergunta quem vai jogar
})();
