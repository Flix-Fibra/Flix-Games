import { useEffect, useState, type FormEvent } from 'react';
import { iniciais, limparApelido, validarApelido } from '../dados/apelido';
import { CONQUISTAS, JOGOS } from '../dados/catalogo';
import { servico } from '../dados/servico';
import type { Aparelho, Perfil as TPerfil } from '../dados/tipos';
import { useAviso } from './Aviso';
import { Camera, IconeAparelho, Mini, Trocar, Trofeu } from './Icones';

interface Props {
  perfil: TPerfil;
  perfis: TPerfil[];
  onSalvar: (p: TPerfil) => Promise<void>;
  onTrocarPerfil: () => void;
}

const num = (n: number) => n.toLocaleString('pt-BR');

export function Perfil({ perfil, perfis, onSalvar, onTrocarPerfil }: Props) {
  const avisar = useAviso();
  const [apelido, setApelido] = useState(perfil.apelido);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);

  useEffect(() => { setApelido(perfil.apelido); setMsg(null); }, [perfil.id, perfil.apelido]);
  useEffect(() => { servico.listarAparelhos().then(setAparelhos).catch(() => setAparelhos([])); }, []);

  const comRanking = JOGOS.filter((j) => j.ranking);
  const comPosicao = comRanking.filter((j) => perfil.jogos[j.id]?.posicao);
  const melhor = [...comPosicao].sort((a, b) => (perfil.jogos[a.id]!.posicao! - perfil.jogos[b.id]!.posicao!))[0];
  const feitas = perfil.conquistas.filter(Boolean).length;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = limparApelido(apelido);
    const erro = validarApelido(v, perfis, perfil.id);
    if (erro) { setMsg({ tipo: 'erro', texto: erro }); return; }
    await onSalvar({ ...perfil, apelido: v });
    setMsg({ tipo: 'ok', texto: 'Salvo (protótipo: só neste navegador).' });
  }

  async function ocultar(valor: boolean) {
    await onSalvar({ ...perfil, oculto: valor });
    avisar(valor ? 'Seu perfil está oculto no ranking' : 'Seu perfil voltou a aparecer no ranking');
  }

  async function desconectar(a: Aparelho) {
    if (a.atual) { avisar('Protótipo: aqui sairia só deste aparelho'); return; }
    await servico.desconectarAparelho(a.id);
    setAparelhos((lista) => lista.filter((x) => x.id !== a.id));
    avisar(`${a.nome} desconectado`);
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
            <button className="perfil-avatar" type="button" aria-label="Trocar avatar" style={{ background: perfil.cor, color: '#fff' }}
              onClick={() => avisar('Protótipo: aqui abre a escolha de avatar')}>
              <span id="p-avatar">{iniciais(perfil.apelido)}</span>
              <span className="perfil-avatar-trocar" aria-hidden="true"><Camera />Trocar</span>
            </button>
          </div>
          <div className="perfil-dados">
            <h2>{perfil.apelido}</h2>
            <p>Cliente Flix · jogando desde {perfil.desde}</p>
            <span className="perfil-papel">Nível {perfil.nivel}</span>
            <button className="btn light gx-trocar" type="button" onClick={onTrocarPerfil}><Trocar />Trocar perfil</button>
          </div>
          <dl className="perfil-fatos">
            <div><dt>Partidas</dt><dd>{num(perfil.partidas)}</dd></div>
            <div><dt>Conquistas</dt><dd>{feitas} de {CONQUISTAS.length}</dd></div>
            <div><dt>Melhor posição</dt><dd>{melhor ? `${perfil.jogos[melhor.id]!.posicao}º · ${melhor.nome}` : '—'}</dd></div>
          </dl>
        </section>

        <div className="perfil-grade">
          <section className="card">
            <h3>Apelido e privacidade</h3>
            <form className="perfil-form" onSubmit={salvar} noValidate>
              <label>Apelido público
                <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={20} autoComplete="nickname" />
              </label>
              <p className="perfil-dica">De 3 a 20 caracteres: letras, números, espaço, _ ou -. Apelidos ofensivos são removidos pela equipe Flix.</p>
              <label className="gx-switch">
                <input type="checkbox" checked={perfil.oculto} onChange={(e) => ocultar(e.target.checked)} />
                <span className="gx-switch-trilho" aria-hidden="true" />
                <span><strong>Ocultar meu perfil do ranking</strong><small>Outros clientes não veem seu apelido nem sua posição.</small></span>
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
                    <span><strong>{j.nome}</strong><small>{s?.posicao ? `Recorde: ${num(s.melhor ?? 0)} ${j.unidade}` : 'Ainda não jogou'}</small></span>
                    <span className="gx-pos-grande">{s?.posicao ? `${s.posicao}º` : '—'}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h3>Conquistas</h3>
            <div className="gx-conquistas">
              {CONQUISTAS.map((c, i) => (
                <div key={c.nome} className={'gx-conquista' + (perfil.conquistas[i] ? '' : ' bloq')}>
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
              {aparelhos.map((a) => (
                <li key={a.id} className={'aparelho' + (a.atual ? ' atual' : '')}>
                  <span className="aparelho-icone"><IconeAparelho tipo={a.tipo} /></span>
                  <span className="aparelho-texto">
                    <strong>{a.nome}{a.atual && <span className="selo-aparelho">Este aparelho</span>}</strong>
                    <span>{a.detalhe}</span>
                  </span>
                  <button className="btn light aparelho-sair" type="button" onClick={() => desconectar(a)}>{a.atual ? 'Sair' : 'Desconectar'}</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
