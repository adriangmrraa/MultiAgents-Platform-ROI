from typing import List, Dict, Any

DEFAULT_MODEL = "gpt-5-mini"

MODEL_REGISTRY = [
    {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini",
        "provider": "openai",
        "tier": "economy",
        "ui_metadata": {
            "label": "Eficiencia Diaria",
            "description": "Ideal para chats rápidos, emails y clasificación.",
            "color": "green",
            "icon": "lightning"
        }
    },
    {
        "id": "gemini-3-flash",
        "name": "Gemini 3 Flash",
        "provider": "google",
        "tier": "economy",
        "ui_metadata": {
            "label": "Ultra Velocidad",
            "description": "El modelo más rápido del mercado. Contexto masivo.",
            "color": "green",
            "icon": "flash_on"
        }
    },
    {
        "id": "gpt-5.2",
        "name": "GPT-5.2 (Nexus)",
        "provider": "openai",
        "tier": "advanced",
        "ui_metadata": {
            "label": "Estándar de Oro",
            "description": "Equilibrio perfecto entre creatividad y lógica.",
            "color": "blue",
            "icon": "auto_awesome"
        }
    },
    {
        "id": "gemini-3-pro",
        "name": "Gemini 3 Pro",
        "provider": "google",
        "tier": "advanced",
        "ui_metadata": {
            "label": "Multimodal Nativo",
            "description": "Superior en análisis de documentos y visión.",
            "color": "blue",
            "icon": "visibility"
        }
    },
    {
        "id": "o3-high",
        "name": "OpenAI o3 (High Reasoning)",
        "provider": "openai",
        "tier": "premium",
        "ui_metadata": {
            "label": "IQ Superior (Ph.D. Level)",
            "description": "Piensa antes de responder. Para programación y ciencia compleja.",
            "color": "purple",
            "icon": "psychology"
        }
    },
    {
        "id": "gemini-3-deep-think",
        "name": "Gemini 3 Deep Think",
        "provider": "google",
        "tier": "premium",
        "ui_metadata": {
            "label": "Razonamiento Profundo",
            "description": "Especialista en cadenas de pensamiento largas.",
            "color": "purple",
            "icon": "science"
        }
    }
]

def validate_model(model_id: str) -> str:
    """
    Validates a model ID against the registry.
    Returns the validated ID or the DEFAULT_MODEL.
    """
    if any(m["id"] == model_id for m in MODEL_REGISTRY):
        return model_id
    return DEFAULT_MODEL

def get_fallback_model(model_id: str) -> str:
    """
    Returns a fallback model if the premium one fails.
    Premium -> Advanced.
    """
    if model_id == "o3-high":
        return "gpt-5.2"
    if model_id == "gemini-3-deep-think":
        return "gemini-3-pro"
    return DEFAULT_MODEL
