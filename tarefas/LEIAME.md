# tarefas/ — processos periódicos (ainda não criado)

Processo Python separado da API (Q46). Responsabilidades previstas:
- Revalidar a elegibilidade dos clientes na API do CRM e bloquear o acesso em até cerca de 1 hora após a perda (Q06/Q07).
- Depois de uma queda do sistema de clientes, conferir quem mudou de situação no intervalo (Q08).

Nenhuma requisição deve segurar conexão por muito tempo: chamadas lentas ficam aqui, não na API que atende o navegador.
