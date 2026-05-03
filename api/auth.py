"""
auth.py — Validación de tokens JWT de Supabase

Cada endpoint del backend llama a verify_supabase_token() para confirmar
que el usuario está autenticado antes de realizar llamadas a APIs externas.
"""

import os
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

security = HTTPBearer()


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Valida el Bearer token contra el endpoint /auth/v1/user de Supabase.
    Devuelve el objeto de usuario si el token es válido.
    Lanza 401 si el token es inválido o expiró.
    """
    token = credentials.credentials

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Sesión inválida o expirada. Inicia sesión nuevamente.",
        )

    return response.json()
