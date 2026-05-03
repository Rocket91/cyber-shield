"""
safebrowsing.py — Ruta para detección de phishing/malware vía Google Safe Browsing API v4
"""

import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import verify_supabase_token

router = APIRouter()

GSB_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY")
GSB_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

THREAT_TYPES = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]

THREAT_LABELS = {
    "MALWARE": "Malware",
    "SOCIAL_ENGINEERING": "Phishing / Ingeniería Social",
    "UNWANTED_SOFTWARE": "Software No Deseado",
    "POTENTIALLY_HARMFUL_APPLICATION": "Aplicación Potencialmente Dañina",
}


class PhishingRequest(BaseModel):
    url: str


@router.post("/phishing")
async def check_phishing(
    payload: PhishingRequest,
    user: dict = Depends(verify_supabase_token),
):
    """
    Verifica si una URL está clasificada como phishing, malware o contenido
    dañino según Google Safe Browsing API v4.
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL requerida.")

    # Asegurar que tenga protocolo para que GSB la procese
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    body = {
        "client": {
            "clientId": "cybershield-local",
            "clientVersion": "1.0.0",
        },
        "threatInfo": {
            "threatTypes": THREAT_TYPES,
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            GSB_URL,
            params={"key": GSB_KEY},
            json=body,
        )

    if response.status_code == 400:
        raise HTTPException(status_code=400, detail="URL no válida para análisis.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Error al consultar Google Safe Browsing.")

    data = response.json()
    matches = data.get("matches", [])

    if not matches:
        return {
            "status": "clean",
            "title": "URL segura según Google Safe Browsing",
            "explanation": "Esta URL no está registrada como phishing, malware ni contenido dañino en la base de datos de Google Safe Browsing, que protege a más de 5 mil millones de dispositivos.",
            "engines_alerted": 0,
            "total_engines": 1,
            "threat_types": [],
            "tips": [
                "Aunque la URL es segura, verifica siempre el dominio antes de ingresar datos.",
                "Desconfía de páginas que piden datos de forma urgente o inesperada.",
                "Usa un gestor de contraseñas para evitar entrar en sitios falsos.",
            ],
        }
    else:
        threat_types_found = list({m.get("threatType", "UNKNOWN") for m in matches})
        threat_labels = [THREAT_LABELS.get(t, t) for t in threat_types_found]
        label_str = " / ".join(threat_labels)

        return {
            "status": "danger",
            "title": f"Peligro: {label_str} detectado",
            "explanation": f"Google Safe Browsing identificó esta URL como {label_str.lower()}. Esta página puede intentar robar tus datos personales o infectar tu dispositivo.",
            "engines_alerted": len(matches),
            "total_engines": 1,
            "threat_types": threat_types_found,
            "tips": [
                "Cierra esta página de inmediato y no ingreses ningún dato.",
                "Si ya ingresaste contraseñas, cámbialas de inmediato en el sitio oficial.",
                "Reporta esta URL para proteger a otros usuarios.",
            ],
        }
