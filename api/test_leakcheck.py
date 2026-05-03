import httpx
import asyncio

async def test():
    email = "test@gmail.com"
    print("=== Probando emailrep.io ===")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://emailrep.io/{email}",
            headers={"User-Agent": "CyberShield-Security-App"}
        )
        print("STATUS:", r.status_code)
        print("BODY:", r.text[:600])

asyncio.run(test())
