/** Página "Créditos e Licenças". A arte dos personagens é própria da Flix (assets/personagem). */
export function Creditos() {
  return (
    <section className="gx-view ativa creditos" aria-label="Créditos e Licenças">
      <div className="titulo-pagina">
        <h1>Créditos e Licenças</h1>
        <p>Quem fez o Flix Games</p>
      </div>

      <div className="perfil-grade">
        <section className="card">
          <h3>Arte dos personagens</h3>
          <p>Os personagens do Flix Games são arte própria da Flix Fibra, criados para a plataforma.</p>
        </section>

        <section className="card">
          <h3>Bibliotecas</h3>
          <ul className="creditos-lic">
            <li>React e React DOM — MIT</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
