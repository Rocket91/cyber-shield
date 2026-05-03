"""
leakcheck.py — Verificación de brechas de datos

Estrategia:
- Con HIBP_API_KEY en .env ($3.5/mes): verifica el email directamente en HIBP
- Sin key: informa elegantemente y refiere a haveibeenpwned.com
"""

import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import verify_supabase_token

router = APIRouter()

HIBP_BASE = "https://haveibeenpwned.com/api/v3"
HIBP_KEY = os.getenv("HIBP_API_KEY", "")


class BreachRequest(BaseModel):
    email: str


@router.post("/breach")
async def check_breach(
    payload: BreachRequest,
    user: dict = Depends(verify_supabase_token),
):
    """
    Verifica si un email aparece en bases de datos de brechas conocidas.
    Usa HaveIBeenPwned v3 si hay API key, o informa elegantemente sin ella.
    """
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Introduce un correo electrónico válido.")

    # ── Con API Key de HIBP ────────────────────────────────────────────────
    if HIBP_KEY:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{HIBP_BASE}/breachedaccount/{email}",
                params={"truncateResponse": "false"},
                headers={
                    "User-Agent": "CyberShield-Security-App",
                    "hibp-api-key": HIBP_KEY,
                },
            )

        if r.status_code == 404:
            return _build_clean_response(email)
        if r.status_code == 429:
            raise HTTPException(status_code=429, detail="Demasiadas consultas. Espera un momento.")
        if r.status_code == 200:
            breaches = r.json()
            return _build_breach_response(email, [
                {
                    "name": b.get("Name", "Desconocido"),
                    "date": b.get("BreachDate", "Fecha desconocida"),
                    "data_classes": b.get("DataClasses", []),
                }
                for b in breaches
            ])

    # ── Sin API Key: consulta el total de brechas públicas como contexto ──
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{HIBP_BASE}/breaches",
            headers={"User-Agent": "CyberShield-Security-App"},
        )
    total_breaches = len(r.json()) if r.status_code == 200 else 0

    return {
        "status": "warning",
        "title": "Verificación manual recomendada",
        "explanation": (
            f"Para verificar brechas específicas de {email} se requiere acceso completo a HIBP. "
            f"Actualmente existen {total_breaches} bases de datos de brechas registradas. "
            f"Verifica tu correo en haveibeenpwned.com para un resultado exacto."
        ),
        "engines_alerted": 0,
        "total_engines": 1,
        "breach_count": 0,
        "sources": [],
        "tips": [
            "Verifica tu correo manualmente en: haveibeenpwned.com (gratis)",
            "Usa contraseñas únicas en cada servicio para limitar el daño en caso de brecha.",
            "Activa el doble factor de autenticación (2FA) en todos tus servicios críticos.",
        ],
    }


def _build_clean_response(email: str) -> dict:
    return {
        "status": "clean",
        "title": "¡Sin brechas detectadas!",
        "explanation": f"El correo {email} no fue encontrado en ninguna brecha de datos conocida según HaveIBeenPwned.",
        "engines_alerted": 0,
        "total_engines": 1,
        "breach_count": 0,
        "sources": [],
        "tips": [
            "Sigue usando contraseñas únicas para cada servicio.",
            "Activa la autenticación de dos factores en tus cuentas importantes.",
            "Verifica periódicamente si tu correo aparece en nuevas brechas.",
        ],
    }


def _build_breach_response(email: str, breaches: list) -> dict:
    breach_count = len(breaches)
    source_names = ", ".join([b["name"] for b in breaches[:3]])
    return {
        "status": "danger",
        "title": f"¡Alerta! Tu correo aparece en {breach_count} brecha(s)",
        "explanation": f"El correo {email} fue encontrado en {breach_count} brecha(s) incluyendo: {source_names}. Tus contraseñas pueden estar comprometidas.",
        "engines_alerted": breach_count,
        "total_engines": 1,
        "breach_count": breach_count,
        "sources": breaches,
        "tips": [
            "Cambia de inmediato las contraseñas de los servicios afectados.",
            "Activa la autenticación de dos factores en todas tus cuentas.",
            "Verifica si usas la misma contraseña en otros sitios y cámbiala también.",
        ],
    }
