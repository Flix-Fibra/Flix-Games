"""Filtro dos comentários (publicados na hora; a revisão humana vem por denúncia).

Recusa: palavrões e ofensas (inclusive com acento trocado, letra repetida ou números no lugar de letras),
links e domínios, e-mails e telefones (o cliente não deve expor contato, e evita golpe/spam).
É uma primeira barreira, não um moderador: a lista é curta de propósito e pode crescer com o uso.
"""
import re
import unicodedata

# Palavras proibidas já normalizadas (minúsculas, sem acento). Curtas (até 4 letras) só valem como palavra inteira.
# Ficaram de fora palavras comuns com outro sentido ("rola", "pica-pau", "macaco"), para não barrar frase normal.
OFENSIVAS = {
    "porra", "caralho", "buceta", "boceta", "xoxota", "puta", "puto", "putaria", "viado", "viadinho", "fdp",
    "arrombado", "arrombada", "cuzao", "merda", "bosta", "vagabunda", "vagabundo", "piranha", "corno",
    "desgracado", "desgracada", "foda", "foder", "fodase", "fodasse", "punheta", "cacete", "retardado",
    "retardada", "otario", "otaria", "babaca", "vadia", "cu", "bct", "pqp", "vsf", "tnc",
    "nazista", "estupro", "estuprador", "pedofilo", "crioulo", "sapatao", "traveco",
}
FRASES = ("filho da puta", "vai se foder", "vai tomar no", "pau no cu", "se mata", "se matar")

_LEET = str.maketrans({"4": "a", "@": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", "$": "s", "7": "t"})
_LINK = re.compile(r"(https?://|www\.|\b[a-z0-9-]{2,}\.(com|net|org|br|io|gg|xyz|me|tv|ly|app|site|info|online)\b)", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_CONTROLE = re.compile(r"[\u0000-\u0008\u000b-\u001f\u007f​-‏ -‮]")


def _normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).translate(_LEET)
    return t


def _ofende(t: str) -> bool:
    palavras = re.findall(r"[a-z]+", t)
    if any(p in OFENSIVAS for p in palavras):
        return True
    junto = " ".join(palavras)
    if any(f in junto for f in FRASES):
        return True
    # Letras separadas por ponto/espaço ("p.o.r.r.a", "p o r r a"): junta tudo e procura as palavras longas
    colado = "".join(palavras)
    return any(len(o) >= 5 and o in colado for o in OFENSIVAS)


def _tem_ofensa(texto: str) -> bool:
    t = _normalizar(texto)
    # Letra repetida para driblar o filtro: testa com as repetições reduzidas a duas ("porrrra" -> "porra")
    # e a uma ("merdaaa" -> "merda").
    return _ofende(re.sub(r"(.)\1{2,}", r"\1\1", t)) or _ofende(re.sub(r"(.)\1+", r"\1", t))


def limpar_comentario(texto: str) -> str:
    """Devolve o texto limpo ou levanta ValueError com a mensagem para o cliente."""
    t = _CONTROLE.sub("", texto).strip()
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    if len(t) < 2:
        raise ValueError("Escreva um comentário.")
    if len(t) > 500:
        raise ValueError("O comentário pode ter até 500 caracteres.")
    if _LINK.search(t) or _EMAIL.search(t):
        raise ValueError("Comentários não podem ter links nem e-mails.")
    if sum(ch.isdigit() for ch in re.sub(r"[\s().-]", "", t)) >= 8 and re.search(r"\d[\d\s().-]{7,}\d", t):
        raise ValueError("Comentários não podem ter número de telefone.")
    if _tem_ofensa(t):
        raise ValueError("Seu comentário tem palavras que não são permitidas aqui.")
    return t
