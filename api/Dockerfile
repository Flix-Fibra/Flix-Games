FROM python:3.12.16-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# Dependências com versões travadas (requirements.txt é gerado a partir do requirements.in)
COPY requirements.txt requirements-dev.txt ./
ARG INSTALAR_DEV=0
RUN pip install -r requirements.txt \
 && if [ "$INSTALAR_DEV" = "1" ]; then pip install -r requirements-dev.txt; fi

COPY app ./app
COPY migracoes ./migracoes
COPY tests ./tests

# Não roda como root dentro do container
RUN useradd --system --uid 10001 --no-create-home flix
USER flix

EXPOSE 8000
# Aplica migrações e sobe a API. 0.0.0.0 é DENTRO do container; fora, o compose publica só em 127.0.0.1.
CMD ["sh", "-c", "python -m app.migracoes && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1"]
