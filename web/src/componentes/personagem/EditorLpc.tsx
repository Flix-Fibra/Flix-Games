import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { categoryTreeModelFactory } from '@lpc/category-tree';
import { servico } from '../../dados/servico';
import type { Perfil } from '../../dados/tipos';
import {
  aleatorio, atualizar, carregar, CORPOS, creditosAtuais, creditsToTxt, exportarConfig, obterMotor, pecasBloqueadas, renderer, restaurarPadrao,
} from '../../lpc/motor';
import { usarMotor } from '../../lpc/usarMotor';
import { useAviso } from '../Aviso';
import { NoLpc } from './ArvoreLpc';
import { DIRECOES, PreviaLpc } from './PreviaLpc';

/** Abas do portal -> categorias do catálogo do Universal LPC. */
const ABAS: { id: string; nome: string; raizes: string[] }[] = [
  { id: 'corpo', nome: 'Corpo', raizes: ['body'] },
  { id: 'rosto', nome: 'Rosto', raizes: ['head'] },
  { id: 'cabelo', nome: 'Cabelo', raizes: ['hair'] },
  { id: 'roupa', nome: 'Roupa', raizes: ['torso', 'legs', 'feet', 'arms'] },
];
const NOMES_RAIZ: Record<string, string> = { torso: 'Parte de cima', legs: 'Parte de baixo', feet: 'Calçados', arms: 'Braços e mãos' };

function baixar(nome: string, dados: Blob) {
  const url = URL.createObjectURL(dados);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props { perfil: Perfil; onSalvo: (p: Perfil) => void; onFechar: () => void }

export function EditorLpc({ perfil, onSalvo, onFechar }: Props) {
  const avisar = useAviso();
  const { catalogo, estado } = usarMotor();
  const [aba, setAba] = useState('corpo');
  const [direcao, setDirecao] = useState(2);
  const [creditos, setCreditos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => { void carregar(perfil.personagem).then(() => setCarregado(true)); }, [perfil.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const arvore = categoryTreeModelFactory.create(catalogo, estado);
  const raizes = arvore.isLoading ? [] : arvore.roots;

  async function salvar() {
    const bloqueadas = pecasBloqueadas();
    if (bloqueadas.length) { avisar(`Há peças fora da licença permitida: ${bloqueadas.slice(0, 2).join(', ')}`); return; }
    setSalvando(true);
    try {
      onSalvo(await servico.salvarPersonagem(perfil.id, exportarConfig()));
      avisar('Personagem salvo!');
      onFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  /** PNG com fundo transparente: o personagem de frente (ampliado) e a folha completa de animações. */
  function exportar() {
    const folha = renderer.canvas;
    if (!folha) return;
    const retrato = document.createElement('canvas');
    retrato.width = 256; retrato.height = 256;
    const ctx = retrato.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(folha, 0, (8 + 2) * 64, 64, 64, 0, 0, 256, 256);
    retrato.toBlob((b) => b && baixar(`personagem-${perfil.apelido}.png`, b), 'image/png');
    folha.toBlob((b) => b && baixar(`personagem-${perfil.apelido}-animacoes.png`, b), 'image/png');
    // créditos das imagens usadas acompanham a exportação (exigência das licenças CC-BY/OGA-BY)
    baixar(`personagem-${perfil.apelido}-creditos.txt`, new Blob([creditsToTxt(creditosAtuais())], { type: 'text/plain' }));
    avisar('PNG e créditos baixados.');
  }

  const listaCreditos = creditos ? creditosAtuais() : [];

  return createPortal(
    <div className="gx-av lpc" role="dialog" aria-modal="true" aria-label="Criar personagem">
      <div className="gx-jogo-barra">
        <button className="gx-jogo-btn" type="button" onClick={onFechar} aria-label="Fechar sem salvar">✕</button>
        <strong>Seu personagem</strong>
        <span />
      </div>

      <div className="gx-av-corpo">
        <div className="gx-av-palco lpc-palco">
          {carregado ? <PreviaLpc tamanho={256} direcao={direcao} /> : <p className="perfil-dica">Carregando o gerador…</p>}
          <div className="lpc-girar">
            <button type="button" className="btn light" aria-label="Girar para a esquerda" onClick={() => setDirecao((d) => (d + 3) % 4)}>⟲</button>
            <span className="perfil-dica">{({ up: 'De costas', left: 'Esquerda', down: 'De frente', right: 'Direita' } as const)[DIRECOES[direcao]!]}</span>
            <button type="button" className="btn light" aria-label="Girar para a direita" onClick={() => setDirecao((d) => (d + 1) % 4)}>⟳</button>
          </div>
          <div className="lpc-acoes">
            <button type="button" className="btn light" onClick={() => void aleatorio().then(() => avisar('Personagem sorteado!'))}>🎲 Aleatório</button>
            <button type="button" className="btn light" onClick={() => void restaurarPadrao()}>Padrão</button>
            <button type="button" className="btn light" onClick={exportar}>Exportar PNG</button>
            <button type="button" className="btn light" aria-pressed={creditos} onClick={() => setCreditos(!creditos)}>Créditos</button>
          </div>
        </div>

        <div className="gx-av-painel">
          {creditos ? (
            <section className="lpc-creditos">
              <h4>Créditos das imagens deste personagem</h4>
              <p className="perfil-dica">Arte do Universal LPC Spritesheet Character Generator. Só peças com licença CC0, OGA-BY ou CC-BY.</p>
              <ul>
                {listaCreditos.map((c) => (
                  <li key={c.fileName}>
                    <strong>{c.fileName}</strong>
                    <span>{c.authors.join(', ')}</span>
                    <span className="perfil-dica">{c.licenses.join(' · ')}{c.urls[0] && <> · <a href={c.urls[0]} target="_blank" rel="noopener noreferrer">origem</a></>}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <div className="gx-filtro-jogos" role="tablist" aria-label="Partes do personagem">
                {ABAS.map((a) => (
                  <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="gx-filtro gx-av-aba" onClick={() => setAba(a.id)}>{a.nome}</button>
                ))}
              </div>
              {aba === 'corpo' && (
                <>
                  <h4>Tipo de corpo</h4>
                  <div className="gx-av-itens">
                    {CORPOS.map((c) => (
                      <button key={c.valor} type="button" className={'gx-av-item' + (estado.bodyType === c.valor ? ' ativo' : '')}
                        onClick={() => { estado.bodyType = c.valor; atualizar(); }}>{c.nome}</button>
                    ))}
                  </div>
                </>
              )}
              {arvore.isLoading && <p className="perfil-dica">Carregando peças…</p>}
              {ABAS.find((a) => a.id === aba)!.raizes.map((r) => {
                const prov = raizes.find((x) => x.key === r);
                estado.expandedNodes[r] = true; // a categoria da aba fica sempre aberta (o modelo do LPC só lista itens expandidos)
                const no = prov?.createModel();
                if (!no) return null;
                return (
                  <div key={r}>
                    {ABAS.find((a) => a.id === aba)!.raizes.length > 1 && <h4>{NOMES_RAIZ[r] ?? r}</h4>}
                    <NoLpc no={no} caminho={r} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="gx-av-rodape">
        <button className="btn light" type="button" onClick={onFechar}>Cancelar</button>
        <button className="btn" type="button" onClick={salvar} disabled={salvando || !carregado}>{salvando ? 'Salvando…' : 'Salvar personagem'}</button>
      </div>
    </div>,
    document.body,
  );
}

/** Retrato estático (de frente) do personagem salvo, para o perfil. */
export function RetratoLpc({ tamanho = 96 }: { tamanho?: number }) {
  return <PreviaLpc tamanho={tamanho} direcao={2} animar={false} />;
}

export { obterMotor };
