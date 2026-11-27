import jogos from '../dados/vitrine.json';

const COLUNAS = 6;

/** Ordem diferente em cada coluna, para as capas não andarem lado a lado. */
function ordemDaColuna(c: number): { id: string; nome: string }[] {
  const passo = c * 3 + 1;
  return jogos.map((_, i) => jogos[(i * 7 + passo) % jogos.length]!);
}

/**
 * Fundo da tela de login: 6 colunas com as capas de todos os jogos, subindo e descendo alternadas.
 * Só decoração (aria-hidden); as capas são miniaturas leves geradas por scripts/gerar-vitrine.py.
 */
export function Vitrine() {
  return (
    <div className="gx-vitrine" aria-hidden="true">
      <div className="gx-vitrine-palco">
        {Array.from({ length: COLUNAS }, (_, c) => {
          const lista = ordemDaColuna(c);
          return (
            <div key={c} className={`gx-vitrine-coluna ${c % 2 ? 'desce' : 'sobe'}`} style={{ animationDuration: `${70 + c * 6}s` }}>
              {/* duas voltas da lista: a animação anda metade da altura e recomeça sem emenda */}
              {[...lista, ...lista].map((j, i) => (
                <img key={i} src={`/vitrine/${j.id}.webp`} alt="" width={240} height={240} loading="eager" decoding="async" draggable={false} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
