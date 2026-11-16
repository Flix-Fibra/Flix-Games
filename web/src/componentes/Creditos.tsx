import { useEffect, useState } from 'react';
import { itemPermitido, licencaPermitida, obterMotor } from '../lpc/motor';

const LPC_REPO = 'https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator';
const FONTE_PORTAL = 'https://github.com/Flix-Fibra/Flix-Games-';
const LICENCAS: [string, string][] = [
  ['CC0', 'https://creativecommons.org/public-domain/cc0/'],
  ['OGA-BY 3.0 / 4.0', 'https://static.opengameart.org/OGA-BY-3.0.txt'],
  ['CC-BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC-BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
];

/**
 * Página "Créditos e Licenças". Autores e licenças vêm do catálogo do Universal LPC (nada digitado à mão):
 * só das peças liberadas no portal. Lista completa de cada imagem: /lpc/CREDITS.csv (arquivo original do LPC).
 */
export function Creditos() {
  const [autores, setAutores] = useState<string[] | null>(null);
  const [porLicenca, setPorLicenca] = useState<[string, number][]>([]);

  useEffect(() => {
    const { catalogo, pronto } = obterMotor();
    void Promise.all([pronto, catalogo.ready.onCreditsReady]).then(() => {
      const nomes = new Set<string>();
      const contagem = new Map<string, number>();
      const visitar = (no: { items?: string[]; children?: Record<string, unknown> } | undefined) => {
        if (!no) return;
        for (const id of no.items ?? []) {
          if (!itemPermitido(id)) continue;
          for (const c of catalogo.getItemCredits(id).unwrapOr([])) {
            c.authors.forEach((a) => nomes.add(a.trim()));
            c.licenses.filter(licencaPermitida).forEach((l) => contagem.set(l.trim(), (contagem.get(l.trim()) ?? 0) + 1));
          }
        }
        Object.values(no.children ?? {}).forEach((f) => visitar(f as typeof no));
      };
      visitar(catalogo.getCategoryTree().unwrapOr(undefined));
      setAutores([...nomes].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setPorLicenca([...contagem].sort((a, b) => b[1] - a[1]));
    });
  }, []);

  return (
    <section className="gx-view ativa creditos" aria-label="Créditos e Licenças">
      <div className="titulo-pagina">
        <h1>Créditos e Licenças</h1>
        <p>Quem fez a arte dos personagens e as licenças do Flix Games</p>
      </div>

      <div className="perfil-grade">
        <section className="card">
          <h3>Arte dos personagens</h3>
          <p>Os personagens usam a arte do <a href={LPC_REPO} target="_blank" rel="noopener noreferrer">Universal LPC Spritesheet Character Generator</a>,
            contribuída ao projeto Liberated Pixel Cup no <a href="https://opengameart.org/content/lpc-collection" target="_blank" rel="noopener noreferrer">OpenGameArt.org</a>.</p>
          <p className="perfil-dica">No Flix Games só entram peças com licença CC0, OGA-BY ou CC-BY. As cores das peças são trocadas pelo editor (recolor); os desenhos não são alterados.</p>
          <p><a className="btn light" href="/lpc/CREDITS.csv" download>Baixar créditos completos (CREDITS.csv)</a></p>
          <h4>Licenças das peças liberadas</h4>
          <ul className="creditos-lic">
            {LICENCAS.map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer">{n}</a></li>)}
          </ul>
          {porLicenca.length > 0 && <p className="perfil-dica">Imagens por licença: {porLicenca.map(([l, n]) => `${l} (${n})`).join(' · ')}</p>}
        </section>

        <section className="card">
          <h3>Artistas</h3>
          {autores === null ? <p className="perfil-dica">Carregando…</p> : <p className="creditos-autores">{autores.join(', ')}</p>}
          <p className="perfil-dica">Cada imagem tem autor, licença e link de origem no CREDITS.csv. Os créditos do seu personagem também aparecem no editor e acompanham a exportação em PNG.</p>
        </section>

        <section className="card">
          <h3>Código-fonte</h3>
          <p>O portal do Flix Games (a parte que roda no navegador) é software livre, distribuído sob a <a href="/lpc/LICENSE" target="_blank" rel="noopener noreferrer">GNU GPL versão 3</a>, porque usa o código do Universal LPC (também GPL-3.0).</p>
          <ul className="creditos-lic">
            <li>Código do portal: <a href={FONTE_PORTAL} target="_blank" rel="noopener noreferrer">{FONTE_PORTAL}</a> (pasta <code>web/</code>)</li>
            <li>Universal LPC usado sem alterações, como submódulo em <code>web/lpc</code>: <a href={LPC_REPO} target="_blank" rel="noopener noreferrer">repositório original</a></li>
          </ul>
        </section>

        <section className="card">
          <h3>Bibliotecas</h3>
          <ul className="creditos-lic">
            <li>React e React DOM — MIT</li>
            <li>Mithril — MIT</li>
            <li>neverthrow — MIT</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
