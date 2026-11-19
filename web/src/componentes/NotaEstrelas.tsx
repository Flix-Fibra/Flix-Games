/**
 * Nota média do jogo em estrelas, só para leitura (cartões dos jogos). A camada dourada é cortada na fração da
 * nota: 4,3 mostra quatro estrelas cheias e 30% da quinta. Sem notas, estrelas vazias e "Sem notas".
 */
export function NotaEstrelas({ avaliacao }: { avaliacao?: { media: number | null; total: number } }) {
  const media = avaliacao?.media ?? null;
  const total = avaliacao?.total ?? 0;
  const texto = media === null ? null : media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rotulo = media === null ? 'Sem notas ainda'
    : `Nota ${texto} de 5, ${total} ${total === 1 ? 'avaliação' : 'avaliações'}`;
  return (
    <span className="gx-nota" role="img" aria-label={rotulo}>
      <span className="gx-nota-estrelas" aria-hidden="true">
        <span className="gx-nota-fundo">★★★★★</span>
        <span className="gx-nota-cheia" style={{ width: `${((media ?? 0) / 5) * 100}%` }}>★★★★★</span>
      </span>
      <span className={'gx-nota-valor' + (texto ? '' : ' vazio')} aria-hidden="true">{texto ?? 'Sem notas'}</span>
      {media !== null && <span className="gx-nota-total" aria-hidden="true">({total})</span>}
    </span>
  );
}
