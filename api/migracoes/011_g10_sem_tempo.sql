-- G10 virou jogo clássico de linhas sem limite de tempo (pedido do solicitante, 19/11/2026):
-- a partida só termina quando a pilha chega ao topo. Texto do catálogo deixa de falar em "2 minutos".
UPDATE jogos
   SET descricao = 'Encaixe as peças que caem e complete linhas antes que a pilha chegue ao topo.',
       metrica   = 'Pontos por linhas'
 WHERE id = 'g10';
