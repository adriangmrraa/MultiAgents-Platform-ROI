import asyncio
import asyncpg
import os

# Usamos el DSN del usuario (Ajusta si corres localmente fuera de Docker)
# Para correrlo localmente, el usuario debería usar la IP/Host accesible
DSN = "postgresql://postgres:f4e157c4a332148ec012@localhost:5432/postgres" # Cambiado a localhost para prueba local si el puerto está mapeado

async def list_tenants():
    try:
        conn = await asyncpg.connect(DSN)
        rows = await conn.fetch("SELECT id, store_name, bot_phone_number FROM tenants")
        print("\n--- TENANTS ENCONTRADOS ---")
        for row in rows:
            print(f"ID: {row['id']} | Store: {row['store_name']} | Phone: {row['bot_phone_number']}")
        await conn.close()
    except Exception as e:
        print(f"Error al conectar: {e}")

if __name__ == "__main__":
    asyncio.run(list_tenants())
