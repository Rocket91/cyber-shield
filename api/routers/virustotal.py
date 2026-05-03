"""
virustotal.py — Rutas para análisis de URLs y archivos vía VirusTotal API v3
"""

import os
import asyncio
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from api.auth import verify_supabase_token

router = APIRouter()

VT_API_KEY = os.getenv("VT_API_KEY")
VT_BASE = "https://www.virustotal.com/api/v3"
HEADERS = {"x-apikey": VT_API_KEY}

MAX_POLL_ATTEMPTS = 10
POLL_INTERVAL_SEC = 3


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_vt_stats(stats: dict, analysis_id: str = "") -> dict:
    """Convierte las estadísticas de VirusTotal al formato estándar del backend."""
    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)
    total = sum(stats.values())

    if malicious > 0:
        status = "danger"
        threat_label = "Amenaza Crítica"
    elif suspicious > 0:
        status = "warning"
        threat_label = "Sospechoso"
    else:
        status = "clean"
        threat_label = "Limpio"

    tips_clean = [
        "Mantén tu navegador y sistema operativo siempre actualizados.",
        "No compartas contraseñas aunque el sitio parezca seguro.",
        "Si recibes este enlace inesperadamente, verifica siempre el remitente.",
    ]
    tips_danger = [
        "No ingreses datos personales ni contraseñas en este sitio.",
        "Si ya introdujiste una contraseña, cámbiala de inmediato en el sitio oficial.",
        "Reporta el enlace para ayudar a proteger a otros usuarios.",
    ]
    tips_warning = [
        "Procede con extrema cautela ante este contenido.",
        "Evita introducir tarjetas de crédito o datos bancarios.",
        "Verifica si el dominio tiene errores ortográficos.",
    ]

    tips_map = {"clean": tips_clean, "danger": tips_danger, "warning": tips_warning}

    return {
        "status": status,
        "title": (
            "¡Sin amenazas detectadas!"
            if status == "clean"
            else f"Peligro: {threat_label} detectado"
            if status == "danger"
            else "Análisis sospechoso"
        ),
        "explanation": (
            "Este elemento ha sido analizado por múltiples motores y no se encontraron amenazas."
            if status == "clean"
            else f"{malicious} motor(es) de seguridad marcaron este elemento como malicioso de {total} analizados."
            if status == "danger"
            else f"{suspicious} motor(es) detectaron comportamiento sospechoso. Procede con cautela."
        ),
        "engines_alerted": malicious + suspicious,
        "total_engines": total,
        "tips": tips_map[status],
        "analysis_url": f"https://www.virustotal.com/gui/url/{analysis_id}" if analysis_id else None,
    }


async def _poll_analysis(analysis_id: str) -> dict:
    """Espera a que el análisis de VT esté completo y devuelve los stats."""
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(MAX_POLL_ATTEMPTS):
            r = await client.get(f"{VT_BASE}/analyses/{analysis_id}", headers=HEADERS)
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail="Error al consultar VirusTotal.")
            data = r.json()
            status = data["data"]["attributes"]["status"]
            if status == "completed":
                return data["data"]["attributes"]["stats"]
            await asyncio.sleep(POLL_INTERVAL_SEC)

    # Si se agota el polling, devolver los stats disponibles
    return data["data"]["attributes"].get("stats", {})


# ─── Endpoint: Analizar URL ────────────────────────────────────────────────────

class URLRequest(BaseModel):
    url: str


@router.post("/url")
async def scan_url(
    payload: URLRequest,
    user: dict = Depends(verify_supabase_token),
):
    """Analiza una URL con VirusTotal. Primero intenta obtener resultados en caché."""
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL requerida.")

    # Intentar resultados en caché primero (evita gastar cuota)
    url_id = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")

    async with httpx.AsyncClient(timeout=20) as client:
        cached = await client.get(f"{VT_BASE}/urls/{url_id}", headers=HEADERS)

        if cached.status_code == 200:
            # Tenemos resultados en caché
            attrs = cached.json()["data"]["attributes"]
            stats = attrs.get("last_analysis_stats", {})
            return _normalize_vt_stats(stats, url_id)

        # No hay caché — enviar para análisis
        submit = await client.post(
            f"{VT_BASE}/urls",
            headers=HEADERS,
            data={"url": url},
        )
        if submit.status_code not in (200, 202):
            raise HTTPException(status_code=502, detail="VirusTotal no pudo procesar la URL.")

        analysis_id = submit.json()["data"]["id"]

    stats = await _poll_analysis(analysis_id)
    return _normalize_vt_stats(stats, analysis_id)


# ─── Endpoint: Analizar Archivo ────────────────────────────────────────────────

@router.post("/file")
async def scan_file(
    file: UploadFile = File(...),
    user: dict = Depends(verify_supabase_token),
):
    """Sube un archivo a VirusTotal y devuelve el resultado del análisis."""
    content = await file.read()
    max_size = 32 * 1024 * 1024  # 32 MB
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 32 MB.")

    async with httpx.AsyncClient(timeout=60) as client:
        submit = await client.post(
            f"{VT_BASE}/files",
            headers=HEADERS,
            files={"file": (file.filename, content, file.content_type or "application/octet-stream")},
        )
        if submit.status_code not in (200, 202):
            raise HTTPException(status_code=502, detail="VirusTotal no pudo procesar el archivo.")

        analysis_id = submit.json()["data"]["id"]

    stats = await _poll_analysis(analysis_id)
    result = _normalize_vt_stats(stats, analysis_id)
    result["filename"] = file.filename
    return result
