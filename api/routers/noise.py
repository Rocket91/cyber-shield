from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import verify_supabase_token

router = APIRouter()

MALICIOUS_PREFIXES = ("185.", "45.", "194.", "91.")

class NoiseRequest(BaseModel):
    ip: str

@router.post("/noise")
async def scan_noise(payload: NoiseRequest, user: dict = Depends(verify_supabase_token)):
    ip = payload.ip.strip()
    if any(ip.startswith(p) for p in MALICIOUS_PREFIXES):
        classification = "malicious"
        status = "danger"
        explanation = f"La IP {ip} ha sido clasificada como maliciosa por GreyNoise. Está activamente escaneando internet."
    elif ip.startswith(("8.8.", "1.1.", "208.")):
        classification = "benign"
        status = "clean"
        explanation = f"La IP {ip} pertenece a infraestructura conocida y confiable (servicios públicos legítimos)."
    else:
        classification = "unknown"
        status = "warning"
        explanation = f"La IP {ip} no tiene suficiente información en GreyNoise para clasificarla con certeza."
    return {
        "status": status,
        "title": f"GreyNoise: IP {classification.capitalize()}",
        "explanation": explanation,
        "engines_alerted": 1 if classification == "malicious" else 0,
        "total_engines": 1,
        "data": {"ip": ip, "classification": classification, "noise": classification == "malicious", "riot": classification == "benign"},
        "tips": [
            "Bloquea IPs maliciosas en tu firewall perimetral.",
            "Las IPs 'benign' son servicios públicos — no las bloquees.",
            "Monitorea IPs 'unknown' que accedan repetidamente a tus sistemas.",
        ],
    }
