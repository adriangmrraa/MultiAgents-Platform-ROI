import requests
import json
import uuid

# --- CONFIGURACIÓN ---
GATEWAY_URL = "https://multiagents-whatsapp-service.yn8wow.easypanel.host" # O http://localhost:8002
SECRET_TOKEN = "7876867976967967967463422222456467776967967585795679"

def simulate_chatwoot_message(channel="Instagram", content="Hola, ¿qué productos tienes?"):
    """Simula un mensaje entrante de Chatwoot (IG/FB)"""
    url = f"{GATEWAY_URL}/webhooks/chatwoot?secret={SECRET_TOKEN}"
    
    payload = {
        "event": "message_created",
        "id": str(uuid.uuid4()),
        "content": content,
        "conversation": {
            "id": 9991, # ID de conversación en Chatwoot
            "channel": f"Channel::{channel}",
            "inbox_id": 10
        },
        "sender": {
            "id": 555,
            "name": "Tester Omega",
            "source_id": f"psid_{channel.lower()}_test_123" # Simula el PSID
        },
        "account": {
            "id": 1 # ID de cuenta de Chatwoot
        }
    }
    
    print(f"\n🚀 Enviando señal de prueba para {channel}...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Respuesta: {response.text}")
    except Exception as e:
        print(f"❌ Error al conectar con el Gateway: {e}")

if __name__ == "__main__":
    print("--- PROTOCOLO DE PRUEBA NEXUS v4.0 ---")
    simulate_chatwoot_message("Instagram", "Probando conexión de Instagram")
    simulate_chatwoot_message("Facebook", "Probando conexión de Facebook")
