"""Configuração vinda do ambiente (EnvironmentFile/compose). Nada de segredo no código."""
import os


class Config:
    def __init__(self) -> None:
        self.database_url: str = os.environ["DATABASE_URL"]
        # Padrão seguro: sem MODO definido, é produção (sem login simulado, sem /api/docs).
        self.modo: str = os.environ.get("MODO", "producao")
        if self.modo not in ("producao", "desenvolvimento"):
            raise RuntimeError("MODO deve ser 'producao' ou 'desenvolvimento'")
        # Cookie só por HTTPS em produção; em desenvolvimento local é http://127.0.0.1
        self.cookie_seguro: bool = os.environ.get("COOKIE_SEGURO", "1" if self.modo == "producao" else "0") == "1"

    @property
    def desenvolvimento(self) -> bool:
        return self.modo == "desenvolvimento"


config = Config()
