"""
main.py — FastAPI app principal de CyberShield

Arrancar en local:
    cd "Cyber Shield"
    uvicorn api.main:app --reload --port 8000

Endpoints disponibles:
    POST /scan/url       → VirusTotal URL analysis
    POST /scan/file      → VirusTotal File analysis
    POST /scan/breach    → LeakCheck email breach check
    POST /scan/phishing  → Google Safe Browsing

Todos requieren: Authorization: Bearer <supabase_jwt>
"""

from dotenv import load_dotenv
load_dotenv("api/.env")  # Cargar .env antes de importar routers

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import (
    virustotal, leakcheck, safebrowsing, newsletter,
    osint, domain, phishtank, ssl_audit, ip_reputation,
    assets, noise, dns_history, threat_intel,
)

app = FastAPI(
    title="CyberShield API",
    description="Backend proxy para herramientas de análisis de seguridad.",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(virustotal.router,    prefix="/api/v1/scan", tags=["VirusTotal"])
app.include_router(leakcheck.router,     prefix="/api/v1/scan", tags=["LeakCheck"])
app.include_router(safebrowsing.router,  prefix="/api/v1/scan", tags=["Safe Browsing"])
app.include_router(newsletter.router,    prefix="/api/v1/newsletter", tags=["Newsletter"])
app.include_router(osint.router,         prefix="/api/v1/scan", tags=["OSINT"])
app.include_router(domain.router,        prefix="/api/v1/scan", tags=["Domain"])
app.include_router(phishtank.router,     prefix="/api/v1/scan", tags=["PhishTank"])
app.include_router(ssl_audit.router,     prefix="/api/v1/scan", tags=["SSL"])
app.include_router(ip_reputation.router, prefix="/api/v1/scan", tags=["IP Reputation"])
app.include_router(assets.router,        prefix="/api/v1/scan", tags=["Assets"])
app.include_router(noise.router,         prefix="/api/v1/scan", tags=["Noise"])
app.include_router(dns_history.router,   prefix="/api/v1/scan", tags=["DNS"])
app.include_router(threat_intel.router,  prefix="/api/v1/scan", tags=["Threat Intel"])



@app.get("/")
async def health():
    return {"status": "ok", "service": "CyberShield API", "version": "1.0.0"}
