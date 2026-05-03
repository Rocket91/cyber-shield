import os
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter()

class NewsletterRequest(BaseModel):
    email: EmailStr

@router.post("/subscribe")
async def subscribe_newsletter(request: NewsletterRequest):
    # Variables de entorno
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    resend_key = os.getenv("RESEND_API_KEY")

    if not supabase_url or not supabase_key or not resend_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuración del servidor incompleta (variables de entorno faltantes)."
        )

    # 1. Guardar en Supabase
    async with httpx.AsyncClient() as client:
        # Petición a la tabla newsletter_subscribers creada vía MCP
        supabase_response = await client.post(
            f"{supabase_url}/rest/v1/newsletter_subscribers",
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            json={"email": request.email}
        )

        if not supabase_response.is_success:
            error_data = supabase_response.json()
            if error_data.get("code") == "23505":  # PostgreSQL unique violation
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este correo ya se encuentra suscrito a nuestro Newsletter."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo procesar la suscripción en la base de datos."
                )

    # 2. Enviar correo de bienvenida vía Resend
    html_content = """
    <div style="font-family: 'Inter', sans-serif; background-color: #0f172a; padding: 40px; color: #f8fafc; text-align: center;">
      <div style="background-color: #1e293b; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #334155;">
        <h1 style="color: #1db85e; margin-bottom: 20px;">¡Bienvenido a CyberShield!</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin-bottom: 30px;">
          Tu suscripción ha sido confirmada exitosamente. A partir de ahora recibirás nuestras noticias, guías y los mejores consejos para proteger tu infraestructura en la red.
        </p>
        <a href="https://cybershield.do" style="background-color: #1db85e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Visitar CyberShield</a>
      </div>
    </div>
    """

    async with httpx.AsyncClient() as client:
        # Validación extra: Imprimir parte de la key para confirmar que se leyó bien del .env
        print(f"DEBUG: Intentando enviar correo a {request.email} con Resend API Key: {resend_key[:5]}...{resend_key[-4:]}")
        
        resend_response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": "onboarding@resend.dev",  # Estrictamente onboarding@resend.dev
                "to": [request.email],
                "subject": "¡Bienvenido a CyberShield!",
                "html": html_content
            }
        )

        if not resend_response.is_success:
            # Imprimir el error exacto en la consola de FastAPI para depuración
            error_details = resend_response.text
            print(f"ERROR RESEND ({resend_response.status_code}): {error_details}")
            
            # Detectar error de dominio no verificado
            if "validation_error" in error_details.lower() or "domain" in error_details.lower():
                return {
                    "status": "partial_success",
                    "message": "Suscrito en base de datos. (Error: Resend requiere verificar el dominio remitente o usar correos autorizados)"
                }

            # Aunque falló el correo, se guardó en BD, así que devolvemos status 200 con warning.
            return {
                "status": "partial_success",
                "message": f"Suscrito en base de datos. (Falló el envío de correo de confirmación)"
            }

    return {
        "status": "success",
        "message": "¡Correo de confirmación enviado!"
    }
