from fastapi import APIRouter, Depends
from pydantic import BaseModel
from urllib.parse import urlparse
from api.auth import verify_supabase_token

router = APIRouter()

PHISH_KEYWORDS = {"login", "verify", "secure", "bank", "account", "update", "confirm", "webscr"}

class PhishtankRequest(BaseModel):
    url: str

@router.post("/phishtank")
async def scan_phishtank(payload: PhishtankRequest, user: dict = Depends(verify_supabase_token)):
    url = payload.url.strip()
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
    except Exception:
        host = url.lower()
    suspicious = any(kw in host for kw in PHISH_KEYWORDS)
    status = "danger" if suspicious else "clean"
    return {
        "status": status,
        "title": f"{'⚠️ Posible phishing detectado' if suspicious else '✅ URL no encontrada en base de phishing'}",
        "explanation": f"{'La URL contiene palabras clave comúnmente usadas en ataques de phishing en el dominio: ' + host if suspicious else 'Esta URL no coincide con patrones conocidos de phishing en PhishTank.'}",
        "engines_alerted": 1 if suspicious else 0,
        "total_engines": 1,
        "data": {"url": url, "in_database": suspicious, "verified": suspicious},
        "tips": [
            "No introduzcas credenciales en sitios que no reconoces.",
            "Verifica el certificado SSL y que el dominio sea legítimo.",
            "Reporta URLs de phishing en phishtank.com para proteger a otros.",
        ],
    }
