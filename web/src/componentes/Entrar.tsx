import { useState, type FormEvent } from 'react';
import { ErroApi, servico } from '../dados/servico';
import '../estilos/entrar.css';

/** Máscara de exibição: CPF 000.000.000-00 ou CNPJ 00.000.000/0000-00 (a API aceita com ou sem pontuação). */
function mascarar(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Entrada do cliente: CPF/CNPJ e senha do Minha Flix. A senha vai só para a nossa API (que confere na API Própria
 * da Flix) e não fica guardada no aparelho; o aparelho guarda só o cookie de sessão (HttpOnly).
 */
export function Entrar({ onEntrou }: { onEntrou: () => void }) {
  const [documento, setDocumento] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Acesso da equipe: usuário e senha cadastrados no servidor. Não aparece para o cliente;
  // a equipe abre pelo endereço com ?equipe (ex.: games.flixfibra.com.br/?equipe).
  const [equipe, setEquipe] = useState(() => new URLSearchParams(window.location.search).has('equipe'));
  const [usuario, setUsuario] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    setEnviando(true);
    try {
      if (equipe) await servico.entrarEquipe(usuario, senha);
      else await servico.entrar(documento, senha);
      setSenha('');

      onEntrou();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Sem conexão. Verifique a internet e tente de novo.');
      setEnviando(false);
    }
  }

  const digitos = documento.replace(/\D/g, '').length;
  return (
    <section className="gx-quem gx-entrar" aria-live="polite">
      <div className="gx-entrar-brilho" aria-hidden="true" />
      <div className="gx-entrar-marca">
        <img className="gx-quem-logo" src="/logo-flix-chapada.png" alt="Flix" width={218} height={84} />
        <span className="gx-entrar-games" aria-label="Games">GAMES</span>
      </div>
      <h1>{equipe ? 'Bem-vindo, equipe.' : <>Seu próximo jogo<br /><span>começa aqui.</span></>}</h1>
      <p className="gx-quem-sub">{equipe ? 'Acesso da equipe Flix Games.' : 'Entre com o CPF ou CNPJ e a senha do Minha Flix.'}</p>
      {equipe ? (
        <form className="gx-quem-novo" onSubmit={enviar} noValidate>
          <label className="gx-quem-campo">Usuário
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none"
              maxLength={30} required autoFocus />
          </label>
          <label className="gx-quem-campo">Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password"
              maxLength={128} required />
          </label>
          {erro && <p className="perfil-msg erro" role="alert">{erro}</p>}
          <button className="btn" type="submit" disabled={enviando || usuario.trim().length < 2 || !senha}>{enviando ? 'Conferindo…' : 'Entrar'}</button>
          <button className="btn light" type="button" onClick={() => { setEquipe(false); setErro(''); setSenha(''); }}>Entrar com CPF ou CNPJ</button>
        </form>
      ) : (
      <form className="gx-quem-novo" onSubmit={enviar} noValidate>
        <label className="gx-quem-campo">CPF ou CNPJ
          <input value={documento} onChange={(e) => setDocumento(mascarar(e.target.value))} inputMode="numeric"
            autoComplete="username" placeholder="000.000.000-00" maxLength={18} required autoFocus />
        </label>
        <label className="gx-quem-campo">Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password"
            maxLength={128} required />
        </label>
        <p className="gx-entrar-dica">No primeiro acesso, a senha é o próprio CPF ou CNPJ, só números.</p>
        {erro && <p className="perfil-msg erro" role="alert">{erro}</p>}
        <button className="btn" type="submit" disabled={enviando || (digitos !== 11 && digitos !== 14) || !senha}>
          {enviando ? 'Conferindo…' : 'Entrar'}
        </button>
      </form>
      )}
    </section>
  );
}
