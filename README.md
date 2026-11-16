# 🛡️ CyberShield

**Plataforma SaaS unificada de ciberseguridad para la gestión de vulnerabilidades en pymes dominicanas.**

Proyecto de tesis para optar por el título de Ingeniero en Sistemas de Computación — Universidad Católica del Cibao (UCATECI), mayo 2026.

---

## ¿Qué problema resuelve?

Una pyme que quiere revisar una IP, un archivo y una contraseña hoy necesita tres plataformas distintas, y las soluciones corporativas cuestan demasiado para este sector. CyberShield reúne esas herramientas en una sola consola, en español, con respuestas pensadas para quien no es especialista en seguridad: un veredicto claro (limpio / advertencia / peligro) y recomendaciones concretas.

## Herramientas del dashboard

| Herramienta | Estado | Fuente |
|---|---|---|
| Analizar URL | ✅ Real | VirusTotal |
| Analizar archivo | ✅ Real | VirusTotal |
| Brechas de datos (correo) | ✅ Real | Have I Been Pwned |
| Phishing / Malware | ✅ Real | Google Safe Browsing |
| Fortaleza de contraseña | ✅ Real | Cálculo en el navegador (la contraseña no se envía a ningún servidor) |
| OSINT / Puertos | 🧪 Simulado | Respuestas de demostración |
| Reputación de dominio | 🧪 Simulado | Respuestas de demostración |
| Base de phishing | 🧪 Simulado | Heurística por palabras clave |
| Auditoría SSL/TLS | 🧪 Simulado | Respuestas de demostración |
| Reputación de IP | 🧪 Simulado | Respuestas de demostración |
| Exposición de activos | 🧪 Simulado | Respuestas de demostración |
| Inteligencia de ruido | 🧪 Simulado | Respuestas de demostración |
| Historial DNS | 🧪 Simulado | Respuestas de demostración |
| Threat Intelligence | 🧪 Simulado | Respuestas de demostración |

> Los módulos marcados como **simulados** muestran la interfaz y el flujo completos del producto, pero todavía no consultan una fuente externa. Están pensados como prototipo.

## Funcionalidades

- Autenticación de usuarios con Supabase (registro, inicio de sesión, recuperación de contraseña).
- Planes **Básico** (gratis), **Premium** ($12/mes) e **Institucional** ($49/mes), con un módulo de gestión de personal para el plan Institucional.
- Interfaz en **español, inglés y portugués**, con modo oscuro.
- Historial de análisis, reportes y alertas por usuario.
- Páginas de documentación, referencia de la API, blog de seguridad, estado del servicio, términos y política de privacidad.

## Arquitectura

```
Navegador (HTML + CSS + JS)
        │  Authorization: Bearer <JWT de Supabase>
        ▼
FastAPI  (api/)  ── valida el JWT contra Supabase ──►  Supabase (Auth + PostgreSQL con RLS)
        │
        ├──► VirusTotal
        ├──► Have I Been Pwned
        ├──► Google Safe Browsing
        └──► Resend (correo del newsletter)
```

- **Frontend:** HTML, CSS y JavaScript vanilla, una página por módulo (cada una con su `.css` y `.js`).
- **Backend:** FastAPI actúa como *proxy*: las claves de las APIs externas viven solo en el servidor, nunca en el navegador.
- **Seguridad:** cada endpoint exige un token de Supabase válido; la tabla `perfiles` usa Row Level Security para que cada usuario solo vea y edite su propio perfil.

## Stack

Python · FastAPI · Uvicorn · httpx · Supabase (Auth + PostgreSQL) · HTML/CSS/JavaScript · VirusTotal API · Have I Been Pwned API · Google Safe Browsing API · Resend

## Estructura del proyecto

```
cyber-shield/
├── api/
│   ├── main.py            # App FastAPI y registro de routers
│   ├── auth.py            # Validación del JWT de Supabase
│   ├── routers/           # Un router por herramienta
│   └── .env.example       # Variables de entorno
├── supabase/schema.sql    # Tabla perfiles, políticas RLS y trigger de registro
├── Imagenes/              # Recursos gráficos
├── index.html / .css / .js
├── dashboard.*            # Consola de herramientas
├── login.* · login_pyme.* · reset_password.* · perfil.*
├── modulo_personal.*      # Gestión de personal (plan Institucional)
├── precios.* · contacto.* · estado_servicio.* · blog_seguridad.*
├── documentacion.html · api_reference.html
└── i18n.js                # Traducciones ES / EN / PT
```

## Ejecutarlo en local

**Requisitos:** Python 3.10+, un proyecto de Supabase y las claves de API que quieras probar.

1. Clona e instala las dependencias:

   ```bash
   git clone https://github.com/Rocket91/cyber-shield.git
   cd cyber-shield
   python -m venv .venv
   source .venv/bin/activate        # En Windows: .venv\Scripts\activate
   pip install -r api/requirements.txt
   ```

2. Crea la base de datos: abre el *SQL Editor* de tu proyecto de Supabase y ejecuta `supabase/schema.sql`.

3. Configura las variables de entorno:

   ```bash
   cp api/.env.example api/.env
   ```

   | Variable | Para qué sirve |
   |---|---|
   | `SUPABASE_URL` | URL de tu proyecto de Supabase |
   | `SUPABASE_ANON_KEY` | Clave `anon` de tu proyecto |
   | `VT_API_KEY` | VirusTotal |
   | `HIBP_API_KEY` | Have I Been Pwned |
   | `GOOGLE_SAFE_BROWSING_KEY` | Google Safe Browsing |
   | `RESEND_API_KEY` | Envío de correo del newsletter |

4. En los archivos `.js` del frontend, cambia la URL y la clave `anon` de Supabase por las de tu proyecto.

5. Levanta el backend:

   ```bash
   uvicorn api.main:app --reload --port 8000
   ```

   La documentación interactiva queda en `http://localhost:8000/docs`.

6. Sirve el frontend en el puerto `5500` (por ejemplo con la extensión *Live Server* de VS Code) y abre `index.html`. El CORS del backend solo acepta `localhost` en los puertos 5500 y 3000.

## Endpoints principales

Todos requieren `Authorization: Bearer <token de Supabase>`.

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/v1/scan/url` | Análisis de URL (VirusTotal) |
| `POST` | `/api/v1/scan/file` | Análisis de archivo (VirusTotal) |
| `POST` | `/api/v1/scan/breach` | Brechas de datos de un correo |
| `POST` | `/api/v1/scan/phishing` | Phishing y malware (Safe Browsing) |
| `POST` | `/api/v1/scan/{osint, domain, ssl, ip, assets, noise, dns, threat, phishtank}` | Módulos simulados |
| `POST` | `/api/v1/newsletter/subscribe` | Suscripción al newsletter (no requiere sesión) |

## Limitaciones y trabajo futuro

- Reemplazar los módulos simulados por fuentes reales (escaneo de puertos, auditoría TLS, DNS, reputación de IP y dominio).
- Desplegar el backend: hoy el frontend apunta a `http://localhost:8000`.
- Ampliar las pruebas automáticas (por ahora solo existe `api/test_leakcheck.py`).

## Autor

**Luis Diego Matías Núñez** — Ingeniería en Sistemas de Computación, UCATECI.
Asesor de tesis: Ing. Diego Orlando Matías.
GitHub: [@Rocket91](https://github.com/Rocket91)
