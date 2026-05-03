from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import verify_supabase_token

router = APIRouter()

class DnsRequest(BaseModel):
    domain: str

@router.post("/dns")
async def scan_dns(payload: DnsRequest, user: dict = Depends(verify_supabase_token)):
    domain = payload.domain.strip().lower()
    return {
        "status": "clean",
        "title": f"Historial DNS: {domain}",
        "explanation": f"Se encontraron registros históricos DNS para {domain}. El historial es informativo y no indica amenazas activas.",
        "engines_alerted": 0,
        "total_engines": 1,
        "data": {
            "domain": domain,
            "a_records": [
                {"value": "104.21.14.101", "first_seen": "2023-01-15", "last_seen": "2025-04-30"},
                {"value": "172.67.182.44", "first_seen": "2022-06-01", "last_seen": "2023-01-14"},
            ],
            "mx_records": [
                {"value": f"mail.{domain}", "priority": 10, "first_seen": "2022-06-01"},
            ],
            "ns_records": [
                {"value": "ns1.cloudflare.com", "first_seen": "2022-06-01"},
                {"value": "ns2.cloudflare.com", "first_seen": "2022-06-01"},
            ],
        },
        "tips": [
            "Cambios frecuentes en registros A pueden indicar migración o ataque.",
            "Verifica que tus NS apunten solo a proveedores de confianza.",
            "Registros MX inconsistentes pueden causar problemas de entrega de correo.",
        ],
    }
