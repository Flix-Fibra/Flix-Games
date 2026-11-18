import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { iniciais, limparApelido, validarApelido } from '../dados/apelido';
import type { Perfil } from '../dados/tipos';
import { Lixeira } from './Icones';

interface Props {
  perfis: Perfil[];
  maxPerfis: number;
  atualId: string | null;
  onEntrar: (id: string) => Promise<void>;
  onCriar: (apelido: string) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
}

/** Tela "Quem vai jogar?": até `maxPerfis` perfis por conta (Q23; valor vem da API). */
export function QuemVaiJogar({ perfis, maxPerfis: MAX_PERFIS, atualId, onEntrar, onCriar, onExcluir }: Props) {
  const [gerenciando, setGerenciando] = useState(false);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  // Trava a rolagem da página de trás enquanto a tela está aberta
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => { if (criando) campo.current?.focus(); }, [criando]);

  async function tocar(p: Perfil) {
    setErro('');
    try {
      if (!gerenciando) { await onEntrar(p.id); return; }
      if (perfis.length < 2) return; // a conta precisa de pelo menos um perfil
      if (confirmarId !== p.id) { setConfirmarId(p.id); return; } // exclusão em dois toques, sem janela de confirmação
      await onExcluir(p.id);
      setConfirmarId(null);
      setGerenciando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível completar.');
    }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    const v = limparApelido(novo);
    if (perfis.length >= MAX_PERFIS) { setErro(`Limite de ${MAX_PERFIS} perfis por conta.`); return; }
    const msg = validarApelido(v, perfis, null);
    if (msg) { setErro(msg); return; }
    try { await onCriar(v); } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível criar o perfil.'); }
  }

  return (
    <section className="gx-quem" aria-labelledby="quem-titulo">
      <img className="gx-quem-logo" src="/logo-flix-chapada.png" alt="Flix" width={218} height={84} />
      <h1 id="quem-titulo">Quem vai jogar?</h1>
      <p className="gx-quem-sub">{gerenciando ? 'Escolha o perfil que quer excluir' : 'Escolha seu perfil'}</p>

      <div className="gx-quem-lista">
        {perfis.map((p) => {
          const conf = confirmarId === p.id;
          return (
            <button key={p.id} type="button"
              className={'gx-pf' + (p.id === atualId ? ' atual' : '') + (conf ? ' confirmar' : '')}
              aria-label={(gerenciando ? 'Excluir perfil ' : 'Entrar como ') + p.apelido}
              onClick={() => tocar(p)}>
              <span className="gx-pf-av" style={{ '--cor': p.cor } as CSSProperties}>{iniciais(p.apelido)}</span>
              {gerenciando && perfis.length > 1 && <span className="gx-pf-excluir" aria-hidden="true"><Lixeira /></span>}
              <span className="gx-pf-nome">{p.apelido}</span>
              <span className="gx-pf-info">{gerenciando ? (conf ? 'Toque de novo para excluir' : 'Toque para excluir') : `Nível ${p.nivel}`}</span>
            </button>
          );
        })}
        {perfis.length < MAX_PERFIS && !gerenciando && (
          <button type="button" className="gx-pf novo" aria-label="Adicionar perfil" onClick={() => { setCriando(true); setNovo(''); setErro(''); }}>
            <span className="gx-pf-av">+</span>
            <span className="gx-pf-nome">Adicionar perfil</span>
            <span className="gx-pf-info">{perfis.length} de {MAX_PERFIS} em uso</span>
          </button>
        )}
      </div>

      {erro && !criando && <p className="perfil-msg erro" role="alert">{erro}</p>}
      {criando && !gerenciando && (
        <form className="gx-quem-novo" onSubmit={criar} noValidate>
          <label htmlFor="in-novo">Apelido do novo perfil</label>
          <input id="in-novo" ref={campo} value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={20} autoComplete="off" placeholder="Ex.: Ana_Gamer" />
          {erro && <p className="perfil-msg erro" role="alert">{erro}</p>}
          <div className="gx-quem-botoes">
            <button className="btn light" type="button" onClick={() => setCriando(false)}>Cancelar</button>
            <button className="btn" type="submit">Criar perfil</button>
          </div>
        </form>
      )}

      {(perfis.length > 1 || gerenciando) && (
        <button className="gx-quem-gerenciar" type="button" aria-pressed={gerenciando}
          onClick={() => { setGerenciando(!gerenciando); setConfirmarId(null); setCriando(false); }}>
          {gerenciando ? 'Concluído' : 'Gerenciar perfis'}
        </button>
      )}
      <p className="gx-quem-nota">Até {MAX_PERFIS} perfis por conta Flix. Cada perfil tem apelido, ranking, progresso e conquistas próprios.</p>
    </section>
  );
}
