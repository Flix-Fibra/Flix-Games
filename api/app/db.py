"""Pool de conexões com o Postgres. Cada requisição usa uma conexão e uma transação."""
from collections.abc import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import config

pool = ConnectionPool(
    config.database_url,
    min_size=1,
    max_size=5,  # ~50 jogadores no início (Q40); ajustar com medição
    kwargs={"row_factory": dict_row},
    open=False,
)


def conexao() -> Iterator[Connection]:
    """Dependência do FastAPI: confirma a transação no fim; desfaz se der erro."""
    with pool.connection() as c:
        yield c
