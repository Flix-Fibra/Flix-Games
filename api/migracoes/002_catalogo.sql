-- Catálogo de trabalho G01–G15 (docs/prompt-inicio-minigames-flix.md, seção 10).
-- Nomes são "de trabalho" (validar com marketing). Todos nascem NÃO publicados:
-- publicar é decisão da equipe (G10 só depois do parecer do jurídico, Q47).
-- [H] Limites de pontuação e duração mínima são provisórios: servem para recusar valor absurdo
--     enviado pelo navegador (seção 6.4). Ajustar por jogo quando cada um estiver pronto.

INSERT INTO jogos (id, nome, genero, descricao, cor1, cor2, metrica, unidade, ordem, pontos_min, pontos_max, duracao_min_ms, onda, vitrine) VALUES
('g01', 'Flix Run',            'Runner',     'Corra, pule os obstáculos e vá o mais longe que conseguir. Um toque para pular.',      '#f97316', '#9a3412', 'Distância mais coletáveis', 'pontos',     'maior',     0,   1000000,  3000, 1,  1),
('g02', 'Voo Flix',            'Arcade',     'Toque para voar e passe pelo maior número de portões sem bater.',                      '#f59e0b', '#b45309', 'Portões ultrapassados',     'portões',    'maior',     0,     10000,  2000, 1,  2),
('g03', 'Cobrinha',            'Arcade',     'Coma, cresça e não encoste no próprio rabo.',                                          '#22c55e', '#14532d', 'Pontos por comida',         'pontos',     'maior',     0,    500000,  3000, 1,  3),
('g04', 'Quebra-Blocos',       'Arcade',     'Rebata a bola e quebre todos os blocos sem deixá-la cair.',                            '#06b6d4', '#155e75', 'Blocos e bônus',            'pontos',     'maior',     0,   1000000,  5000, 2,  6),
('g05', 'Travessia',           'Arcade',     'Atravesse ruas e rios até chegar do outro lado.',                                      '#84cc16', '#3f6212', 'Avanço, chegada e tempo',   'pontos',     'maior',     0,    500000,  5000, 2,  7),
('g06', 'Minigolfe',           'Esporte',    'Acerte o buraco com o menor número de tacadas.',                                       '#10b981', '#065f46', 'Tacadas no conjunto',       'tacadas',    'menor',     9,       500, 20000, 2,  8),
('g07', 'Plataforma Flix',     'Plataforma', 'Pule entre plataformas e chegue ao fim da fase no menor tempo.',                       '#8b5cf6', '#3b0764', 'Tempo da fase',             'ms',         'menor', 20000,   3600000, 20000, 3, 10),
('g08', 'Missão Relâmpago',    'Ação',       'Avance pela fase e acerte os alvos em sequência.',                                     '#ef4444', '#7f1d1d', 'Alvos com sequência',       'pontos',     'maior',     0,   1000000, 10000, 3, 11),
('g09', 'Faixa a Faixa',       'Arcade',     'Avance pelas faixas sem ser atropelado.',                                              '#eab308', '#a16207', 'Faixas atravessadas',       'faixas',     'maior',     0,     20000,  3000, 3, 12),
('g10', 'Blocos em Queda',     'Puzzle',     'Encaixe os blocos e complete linhas no modo de 2 minutos.',                            '#a855f7', '#581c87', 'Pontos em 2 minutos',       'pontos',     'maior',     0,   2000000, 10000, 3, 13),
('g11', 'Arena Flix',          'Tiro',       'Sobreviva na arena e acerte os inimigos com seu projétil.',                            '#b91c1c', '#450a0a', 'Inimigos por sobrevivência','pontos',     'maior',     0,   1000000, 10000, 4, 15),
('g12', 'Corrida Pixel',       'Corrida',    'Faça a volta mais rápida na pista.',                                                   '#0ea5e9', '#0c4a6e', 'Melhor volta',              'ms',         'menor', 15000,    600000, 15000, 3, 14),
('g13', 'Cabeçada',            'Esporte',    'Futebol de cabeça 1 contra 1: faça o máximo de gols em 2 minutos.',                    '#16a34a', '#14532d', 'Gols em 2 minutos',         'gols',       'maior',     0,       200, 10000, 2,  9),
('g14', 'Torre Espiral',       'Arcade',     'Desça pela torre giratória sem cair nas partes vermelhas.',                            '#ec4899', '#831843', 'Andares descidos',          'andares',    'maior',     0,     10000,  2000, 2,  5),
('g15', 'Cesta Flix',          'Arcade',     'Pule de aro em aro e acerte a cesta em sequência.',                                    '#e11d48', '#4c0519', 'Cestas com sequência',      'pontos',     'maior',     0,    500000,  2000, 1,  4);
