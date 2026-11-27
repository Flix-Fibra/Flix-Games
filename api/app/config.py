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
        # Login do cliente: rota do Flix Games na API Própria. "simulado" só em desenvolvimento (sem rede, sem chave).
        self.conferidor: str = os.environ.get("CONFERIDOR", "simulado" if self.modo == "desenvolvimento" else "api_propria")
        if self.conferidor not in ("api_propria", "simulado"):
            raise RuntimeError("CONFERIDOR deve ser 'api_propria' ou 'simulado'")
        if self.conferidor == "simulado" and self.modo != "desenvolvimento":
            raise RuntimeError("O conferidor simulado só existe em desenvolvimento.")
        self.confere_url: str = os.environ.get(
            "FLIX_GAMES_CONFERE_URL", "https://api-server.flixfibra.com.br/api/parceiro/flix-games/confere"
        )
        if not self.confere_url.startswith("https://"):
            raise RuntimeError("FLIX_GAMES_CONFERE_URL precisa ser https")
        # Caminho do arquivo com a chave da API Própria (segredo do compose). O valor nunca fica no ambiente.
        self.chave_api_propria_arquivo: str = os.environ.get("CHAVE_API_PROPRIA_ARQUIVO", "/run/secrets/api_propria_chave")

    @property
    def desenvolvimento(self) -> bool:
        return self.modo == "desenvolvimento"


config = Config()
