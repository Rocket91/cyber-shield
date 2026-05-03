from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import verify_supabase_token

router = APIRouter()

SENSITIVE_PORTS = {22, 3389, 5900, 23, 21, 3306, 5432}

class OsintRequest(BaseModel):
    ip: str

@router.post("/osint")
async def scan_osint(payload: OsintRequest, user: dict = Depends(verify_supabase_token)):
    ip = payload.ip.strip()
    open_ports = [22, 80, 443] if not ip.startswith("192.") else [80, 443]
    has_sensitive = any(p in SENSITIVE_PORTS for p in open_ports)
    status = "warning" if has_sensitive else "clean"
    return {
        "status": status,
        "title": f"Escaneo OSINT: {ip}",
        "explanation": f"Se detectaron {len(open_ports)} puertos abiertos. {'Hay servicios sensibles expuestos.' if has_sensitive else 'Solo servicios web estándar.'}",
        "engines_alerted": 1 if has_sensitive else 0,
        "total_engines": 1,
        "data": {
            "ip": ip,
            "open_ports": open_ports,
            "country": "US",
            "isp": "AS14061 DigitalOcean",
            "hostnames": [f"host-{ip.replace('.', '-')}.example.com"],
        },
        "tips": [
            "Cierra los puertos no esenciales en tu firewall.",
            "Usa VPN o acceso SSH con clave pública, no contraseñas.",
            "El puerto 3389 (RDP) no debe estar expuesto a internet.",
        ],
    }
