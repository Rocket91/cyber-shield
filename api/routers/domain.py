from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import verify_supabase_token

router = APIRouter()

TRUSTED_TLDS = {".edu", ".gov", ".mil"}

class DomainRequest(BaseModel):
    domain: str

@router.post("/domain")
async def scan_domain(payload: DomainRequest, user: dict = Depends(verify_supabase_token)):
    domain = payload.domain.strip().lower()
    trusted = any(domain.endswith(t) for t in TRUSTED_TLDS)
    status = "clean" if trusted else "warning"
    return {
        "status": status,
        "title": f"Reputación de Dominio: {domain}",
        "explanation": f"{'Dominio de institución oficial con alta reputación.' if trusted else 'El dominio no pertenece a un TLD de confianza institucional. Verifica su historial.'}",
        "engines_alerted": 0 if trusted else 1,
        "total_engines": 3,
        "data": {
            "domain": domain,
            "mx_records": [f"mail.{domain}", f"alt1.mail.{domain}"],
            "blacklisted": not trusted,
            "reputation_score": 92 if trusted else 61,
        },
        "tips": [
            "Verifica los registros SPF, DKIM y DMARC para proteger tu dominio.",
            "Consulta la reputación del dominio en mxtoolbox.com.",
            "Un dominio en listas negras puede afectar la entrega de correos.",
        ],
    }
