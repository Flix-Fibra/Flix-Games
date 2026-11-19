import { useEffect, useState, type FormEvent } from 'react';
import { iniciais, limparApelido, limparNome, nomeCompleto, validarApelido, validarNome } from '../dados/apelido';
import { formatarPontos, tipoAparelho, vistoHa } from '../dados/formatar';
import { servico } from '../dados/servico';
import type { AlteracaoPerfil, Aparelho, Jogo, Perfil as TPerfil } from '../dados/tipos';
import { EditorPersonagem } from './personagem/EditorPersonagem';
import { fotoDoRosto } from '../personagem/flix';
import { useAviso } from './Aviso';
import { Camera, IconeAparelho, Mini, Trocar, Trofeu } from './Icones';

interface Props {
  jogos: Jogo[];
  perfil: TPerfil;
  perfis: TPerfil[];
  onSalvar: (dados: AlteracaoPerfil) => Promise<void>;
  onTrocarPerfil: () => void;
  onSair: () => Promise<void>;
  onAtualizado: (p: TPerfil) => void;
}

export function Perfil({ jogos, perfil, perfis, onSalvar, onTrocarPerfil, onSair, onAtualizado }: Props) {
  const avisar = useAviso();
  const [apelido, setApelido] = useState(perfil.apelido);
  const [nome, setNome] = useState(perfil.nome ?? '');
  const [sobrenome, setSobrenome] = useState(perfil.sobrenome ?? '');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [aparelhos, setAparelhos] = useState<Aparelho[] | null>(null);
  const [editor, setEditor] = useState(false);
  // Foto do rosto do personagem salvo
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    setFoto(null);
    if (!perfil.personagem) return;
    let ativo = true;
    void fotoDoRosto(perfil.personagem).then((u) => { if (ativo) setFoto(u); });
    return () => { ativo = false; };
  }, [perfil.personagem]);

  useEffect(() => { setApelido(perfil.apelido); setMsg(null); }, [perfil.id, perfil.apelido]);
  useEffect(() => { setNome(perfil.nome ?? ''); setSobrenome(perfil.sobrenome ?? ''); }, [perfil.id, perfil.nome, perfil.sobrenome]);
  useEffect(() => { servico.aparelhos().then(setAparelhos).catch(() => setAparelhos([])); }, []);

  const comRanking = jogos.filter((j) => j.ranking);
  const comPosicao = comRanking.filter((j) => perfil.jogos[j.id]?.posicao);
  const melhor = [...comPosicao].sort((a, b) => perfil.jogos[a.id]!.posicao! - perfil.jogos[b.id]!.posicao!)[0];
  const feitas = perfil.conquistas.filter((c) => c.feita).length;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = limparApelido(apelido);
    const erro = validarApelido(v, perfis, perfil.id) ?? validarNome(nome, 'nome') ?? validarNome(sobrenome, 'sobrenome'); // ajuda rápida; quem decide é a API
    if (erro) { setMsg({ tipo: 'erro', texto: erro }); return; }
    try {
      await onSalvar({ apelido: v, nome: limparNome(nome), sobrenome: limparNome(sobrenome) });
      setMsg({ tipo: 'ok', texto: 'Dados salvos.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível salvar.' });
    }
  }

  async function ocultar(valor: boolean) {
    try {
      await onSalvar({ oculto: valor });
      avisar(valor ? 'Seu perfil está oculto no ranking' : 'Seu perfil voltou a aparecer no ranking');
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
  }

  // Ligar a exibição envia junto o nome digitado (a API exige nome para mostrar)
  async function mostrarNome(valor: boolean) {
    const n = limparNome(nome);
    if (valor && !n) { setMsg({ tipo: 'erro', texto: 'Preencha o nome para mostrá-lo no ranking.' }); return; }
    try {
      await onSalvar(valor ? { nome: n, sobrenome: limparNome(sobrenome), mostrarNome: true } : { mostrarNome: false });
      avisar(valor ? 'Seu nome aparece no ranking, abaixo do nickname' : 'Seu nome não aparece mais no ranking');
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
  }

  async function desconectar(a: Aparelho) {
    try {
      if (a.atual) { await onSair(); return; }
      await servico.desconectarAparelho(a.id);
      setAparelhos((lista) => lista?.filter((x) => x.id !== a.id) ?? null);
      avisar(`${a.nome} desconectado`);
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível desconectar.'); }
  }

  return (
    <section className="gx-view ativa" aria-label="Perfil">
      <div className="titulo-pagina">
        <h1>Meu perfil</h1>
        <p>Como os outros clientes veem você no Flix Games</p>
      </div>

      <div className="perfil">
        <section className="card perfil-conta">
          <div className="perfil-foto">
            <button className="perfil-avatar" type="button" aria-label="Editar personagem" style={{ background: perfil.cor, color: '#fff' }}
              onClick={() => setEditor(true)}>
              <span id="p-avatar">{foto ? <img className="avatar-foto" src={foto} alt="" draggable={false} /> : iniciais(perfil.apelido)}</span>
              <span className="perfil-avatar-trocar" aria-hidden="true"><Camera />Trocar</span>
            </button>
          </div>
          <div className="perfil-dados">
            <h2>{perfil.apelido}</h2>
            {nomeCompleto(perfil) && <p className="gx-nome-real">{nomeCompleto(perfil)}{perfil.mostrarNome ? '' : ' · só você vê'}</p>}
            <p>Cliente Flix · jogando desde {perfil.desde}</p>
            <span className="perfil-papel">Nível {perfil.nivel}</span>
            <button className="btn light gx-trocar" type="button" onClick={onTrocarPerfil}><Trocar />Trocar perfil</button>
          </div>
          <dl className="perfil-fatos">
            <div><dt>Partidas</dt><dd>{perfil.partidas.toLocaleString('pt-BR')}</dd></div>
            <div><dt>Conquistas</dt><dd>{feitas} de {perfil.conquistas.length}</dd></div>
            <div><dt>Melhor posição</dt><dd>{melhor ? `${perfil.jogos[melhor.id]!.posicao}º · ${melhor.nome}` : '—'}</dd></div>
          </dl>
        </section>

        <div className="perfil-grade">
          <section className="card">
            <h3>Nickname, nome e privacidade</h3>
            <form className="perfil-form" onSubmit={salvar} noValidate>
              <label>Nickname
                <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={20} autoComplete="nickname" required />
              </label>
              <p className="perfil-dica">Obrigatório e único: nenhum outro jogador pode usar o mesmo. Aparece para todos. De 3 a 20 caracteres: letras, números, espaço, _ ou -. Nicknames ofensivos são removidos pela equipe Flix.</p>
              <div className="gx-nome-campos">
                <label>Nome
                  <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoComplete="given-name" required />
                </label>
                <label>Sobrenome
                  <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} maxLength={60} autoComplete="family-name" required />
                </label>
              </div>
              <label className="gx-switch">
                <input type="checkbox" checked={perfil.mostrarNome} onChange={(e) => mostrarNome(e.target.checked)} />
                <span className="gx-switch-trilho" aria-hidden="true" />
                <span><strong>Mostrar meu nome no ranking</strong><small>Desligado, só você vê o seu nome. Ligado, ele aparece discretamente abaixo do nickname.</small></span>
              </label>
              <label className="gx-switch">
                <input type="checkbox" checked={perfil.oculto} onChange={(e) => ocultar(e.target.checked)} />
                <span className="gx-switch-trilho" aria-hidden="true" />
                <span><strong>Ocultar meu perfil do ranking</strong><small>Outros clientes não veem seu nickname nem sua posição.</small></span>
              </label>
              {msg && <p className={'perfil-msg ' + msg.tipo} role="status">{msg.texto}</p>}
              <button className="btn" type="submit">Salvar</button>
            </form>
          </section>

          <section className="card">
            <h3>Minhas posições</h3>
            <ul className="gx-lista">
              {comRanking.map((j) => {
                const s = perfil.jogos[j.id];
                return (
                  <li key={j.id}>
                    <Mini jogo={j} />
                    <span><strong>{j.nome}</strong><small>{s?.posicao ? `Recorde: ${formatarPontos(s.melhor ?? 0, j.unidade)}` : 'Ainda não jogou'}</small></span>
                    <span className="gx-pos-grande">{s?.posicao ? `${s.posicao}º` : '—'}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h3>Conquistas</h3>
            <div className="gx-conquistas">
              {perfil.conquistas.map((c) => (
                <div key={c.nome} className={'gx-conquista' + (c.feita ? '' : ' bloq')}>
                  <div className="gx-conquista-ic"><Trofeu /></div>
                  <strong>{c.nome}</strong><small>{c.desc}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Aparelhos conectados</h3>
            <p className="perfil-dica">Sair desconecta só o aparelho escolhido. Os outros continuam conectados.</p>
            <ul className="aparelhos">
              {aparelhos === null ? <li className="perfil-dica">Carregando…</li> : aparelhos.map((a) => (
                <li key={a.id} className={'aparelho' + (a.atual ? ' atual' : '')}>
                  <span className="aparelho-icone"><IconeAparelho tipo={tipoAparelho(a.nome)} /></span>
                  <span className="aparelho-texto">
                    <strong>{a.nome}{a.atual && <span className="selo-aparelho">Este aparelho</span>}</strong>
                    <span>{a.atual ? 'agora' : vistoHa(a.vistoEm)}</span>
                  </span>
                  <button className="btn light aparelho-sair" type="button" onClick={() => desconectar(a)}>{a.atual ? 'Sair' : 'Desconectar'}</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      {editor && <EditorPersonagem perfil={perfil} onSalvo={onAtualizado} onFechar={() => setEditor(false)} />}
    </section>
  );
}
