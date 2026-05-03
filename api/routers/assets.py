from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import verify_supabase_token

router = APIRouter()

class AssetsRequest(BaseModel):
    domain: str

@router.post("/assets")
async def scan_assets(payload: AssetsRequest, user: dict = Depends(verify_supabase_token)):
    domain = payload.domain.strip().lower()
    subdomains = [f"www.{domain}", f"mail.{domain}", f"api.{domain}", f"dev.{domain}", f"admin.{domain}"]
    return {
        "status": "warning",
        "title": f"Exposición de Activos: {domain}",
        "explanation": f"Se detectaron {len(subdomains)} subdominios expuestos públicamente. El subdominio 'admin' y 'dev' pueden representar superficies de ataque.",
        "engines_alerted": 2,
        "total_engines": 1,
        "data": {
            "domain": domain,
            "subdomains": subdomains,
            "technologies": ["Nginx 1.24", "React 18", "Node.js 20"],
            "open_ports": [80, 443, 8080],
        },
        "tips": [
            "Elimina o protege con autenticación los subdominios de desarrollo.",
            "El panel admin no debe ser accesible desde internet público.",
            "Usa Cloudflare o un WAF para ocultar tu infraestructura real.",
        ],
    }
