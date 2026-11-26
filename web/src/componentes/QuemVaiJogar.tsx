import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { iniciais, limparApelido, limparNome, validarApelido, validarNome } from '../dados/apelido';
import type { AlteracaoPerfil, NovoPerfil, Perfil } from '../dados/tipos';
import { Lapis } from './Icones';

interface Props {
  perfis: Perfil[];
  maxPerfis: number;
  cores: string[];
  atualId: string | null;
  onEntrar: (id: string) => Promise<void>;
  onCriar: (dados: NovoPerfil) => Promise<void>;
  onEditar: (id: string, dados: AlteracaoPerfil) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  /** Sai da conta neste aparelho (volta para a tela de entrada). */
  onSair: () => Promise<void>;
}

/**
 * Tela "Quem vai jogar?": até `maxPerfis` perfis por conta (Q23; valor vem da API). Em "Gerenciar perfis", tocar num
 * perfil abre o mesmo formulário da criação, preenchido, para editar ou excluir. Com o formulário aberto, a lista
 * some: só aparece o perfil que está sendo criado ou editado, com a escolha da cor de fundo.
 */
export function QuemVaiJogar({ perfis, maxPerfis: MAX_PERFIS, cores, atualId, onEntrar, onCriar, onEditar, onExcluir, onSair }: Props) {
  const [gerenciando, setGerenciando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [erro, setErro] = useState('');

  // Trava a rolagem da página de trás enquanto a tela está aberta
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function tocar(p: Perfil) {
    setErro('');
    if (gerenciando) { setEditando(p); return; }
    try { await onEntrar(p.id); } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível entrar.'); }
  }

  const fecharGerenciar = () => { setGerenciando(false); setEditando(null); setErro(''); };

  return (
    <section className="gx-quem" aria-labelledby="quem-titulo">
      <img className="gx-quem-logo" src="/logo-flix-chapada.png" alt="Flix" width={218} height={84} />
      <h1 id="quem-titulo">Quem vai jogar?</h1>
      <p className="gx-quem-sub">
        {criando ? 'Novo perfil' : editando ? 'Editar perfil' : gerenciando ? 'Escolha o perfil que quer editar ou excluir' : 'Escolha seu perfil'}
      </p>

      {!criando && !editando && <div className="gx-quem-lista">
        {perfis.map((p) => (
          <button key={p.id} type="button"
            className={'gx-pf' + (p.id === atualId ? ' atual' : '')}
            aria-label={(gerenciando ? 'Editar perfil ' : 'Entrar como ') + p.apelido}
            onClick={() => tocar(p)}>
            <span className="gx-pf-av" style={{ '--cor': p.cor } as CSSProperties}>{iniciais(p.apelido)}</span>
            {gerenciando && <span className="gx-pf-excluir gx-pf-editar" aria-hidden="true"><Lapis /></span>}
            <span className="gx-pf-nome">{p.apelido}</span>
            <span className="gx-pf-info">{gerenciando ? 'Toque para editar' : `Nível ${p.nivel}`}</span>
          </button>
        ))}
        {perfis.length < MAX_PERFIS && !gerenciando && (
          <button type="button" className="gx-pf novo" aria-label="Adicionar perfil" onClick={() => { setCriando(true); setErro(''); }}>
            <span className="gx-pf-av">+</span>
            <span className="gx-pf-nome">Adicionar perfil</span>
            <span className="gx-pf-info">{perfis.length} de {MAX_PERFIS} em uso</span>
          </button>
        )}
      </div>}

      {erro && !criando && !editando && <p className="perfil-msg erro" role="alert">{erro}</p>}
      {criando && !gerenciando && (
        <FormPerfil key="novo" perfis={perfis} cores={cores} titulo="Nickname do novo perfil" botao="Criar perfil"
          onCancelar={() => setCriando(false)}
          onEnviar={(d) => onCriar(d)} />
      )}
      {gerenciando && editando && (
        <FormPerfil key={editando.id} perfis={perfis} cores={cores} perfil={editando} titulo={`Nickname de ${editando.apelido}`} botao="Salvar"
          onCancelar={() => setEditando(null)}
          onEnviar={async (d) => { await onEditar(editando.id, d); setEditando(null); }}
          onExcluir={perfis.length > 1 ? async () => { await onExcluir(editando.id); fecharGerenciar(); } : undefined} />
      )}

      {!criando && !editando && (
        <button className="gx-quem-gerenciar" type="button" aria-pressed={gerenciando}
          onClick={() => (gerenciando ? fecharGerenciar() : (setGerenciando(true), setCriando(false), setErro('')))}>
          {gerenciando ? 'Concluído' : 'Gerenciar perfis'}
        </button>
      )}
      {!criando && !editando && !gerenciando && (
        <button className="gx-quem-sair" type="button" onClick={() => void onSair()}>Sair da conta</button>
      )}
      <p className="gx-quem-nota">Até {MAX_PERFIS} perfis por conta Flix. Cada perfil tem nickname, ranking, progresso e conquistas próprios.</p>
    </section>
  );
}

interface FormProps {
  perfis: Perfil[];
  cores: string[];
  perfil?: Perfil; // presente = edição
  titulo: string;
  botao: string;
  onCancelar: () => void;
  onEnviar: (dados: NovoPerfil) => Promise<void>;
  onExcluir?: () => Promise<void>; // só na edição, e só com mais de um perfil na conta
}

/**
 * Formulário de perfil (criação e edição): prévia do perfil com a cor de fundo escolhida, nickname, nome e sobrenome
 * obrigatórios e a chave de mostrar o nome. Na criação, a cor sugerida é a primeira da paleta ainda não usada na conta.
 */
function FormPerfil({ perfis, cores, perfil, titulo, botao, onCancelar, onEnviar, onExcluir }: FormProps) {
  const usadas = new Set(perfis.filter((p) => p.id !== perfil?.id).map((p) => p.cor.toUpperCase()));
  const [cor, setCor] = useState(perfil?.cor.toUpperCase() ?? cores.find((c) => !usadas.has(c)) ?? cores[0] ?? '#D2232A');
  const [apelido, setApelido] = useState(perfil?.apelido ?? '');
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [sobrenome, setSobrenome] = useState(perfil?.sobrenome ?? '');
  const [mostrarNome, setMostrarNome] = useState(perfil?.mostrarNome ?? false);
  const [erro, setErro] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const v = limparApelido(apelido);
    const msg = validarApelido(v, perfis, perfil?.id ?? null) ?? validarNome(nome, 'nome') ?? validarNome(sobrenome, 'sobrenome');
    if (msg) { setErro(msg); return; }
    setEnviando(true);
    try {
      await onEnviar({ apelido: v, nome: limparNome(nome) ?? '', sobrenome: limparNome(sobrenome) ?? '', mostrarNome, cor });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setEnviando(false);
    }
  }

  async function excluir() {
    if (!onExcluir) return;
    if (!confirmarExclusao) { setConfirmarExclusao(true); return; } // exclusão em dois toques, sem janela de confirmação
    try { await onExcluir(); } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível excluir.'); }
  }

  const id = perfil ? `pf-${perfil.id}` : 'pf-novo';
  return (
    <form className="gx-quem-novo" onSubmit={enviar} noValidate>
      <div className="gx-quem-previa" aria-hidden="true">
        <span className="gx-pf-av" style={{ '--cor': cor } as CSSProperties}>{iniciais(limparApelido(apelido)) || '+'}</span>
        <strong>{limparApelido(apelido) || (perfil ? perfil.apelido : 'Novo perfil')}</strong>
      </div>
      <div className="gx-cores" role="radiogroup" aria-label="Cor de fundo do perfil">
        {cores.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`}
            className={'gx-cor' + (cor === c ? ' ativa' : '')} style={{ '--cor': c } as CSSProperties} onClick={() => setCor(c)} />
        ))}
      </div>
      <label htmlFor={`${id}-apelido`}>{titulo}</label>
      <input id={`${id}-apelido`} ref={campo} value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={20} autoComplete="off"
        placeholder="Ex.: Ana_Gamer" aria-describedby={`${id}-dica`} required />
      <p id={`${id}-dica`} className="perfil-dica">Único entre todos os jogadores. É o que todos veem no ranking.</p>
      <div className="gx-nome-campos">
        <label className="gx-quem-campo">Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoComplete="off" required />
        </label>
        <label className="gx-quem-campo">Sobrenome
          <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} maxLength={60} autoComplete="off" required />
        </label>
      </div>
      <label className="gx-switch">
        <input type="checkbox" checked={mostrarNome} onChange={(e) => setMostrarNome(e.target.checked)} />
        <span className="gx-switch-trilho" aria-hidden="true" />
        <span><strong>Mostrar o nome verdadeiro no ranking</strong></span>
      </label>
      {erro && <p className="perfil-msg erro" role="alert">{erro}</p>}
      <div className="gx-quem-botoes">
        <button className="btn light" type="button" onClick={onCancelar}>Cancelar</button>
        <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : botao}</button>
      </div>
      {onExcluir && (
        <button type="button" className={'gx-quem-excluir' + (confirmarExclusao ? ' confirmar' : '')} onClick={excluir}>
          {confirmarExclusao ? 'Toque de novo para excluir este perfil' : 'Excluir perfil'}
        </button>
      )}
    </form>
  );
}
