from typing import List, Dict, Any

# REGISTRO DE MODELOS OFICIAL - ENERO 2026
# Nexus v5.99: Updated to match OpenAI GPT-5 family and Google Gemini 3 specifications

DEFAULT_MODEL = "gpt-5-mini"

MODEL_REGISTRY = {
    "openai": {
        "provider_name": "OpenAI",
        "models": [
            {
                "id": "gpt-5.2",
                "name": "GPT-5.2 (Flagship - Coding/Reasoning)",
                "tier": "flagship",
                "capabilities": ["reasoning", "coding", "multimodal"],
                "config_params": ["reasoning_effort", "text_verbosity"],
                "ui_metadata": {
                    "label": "Flagship (Coding/Reasoning)",
                    "description": "Modelo principal con capacidades avanzadas de razonamiento y programación.",
                    "color": "purple",
                    "icon": "auto_awesome"
                }
            },
            {
                "id": "gpt-5.2-pro",
                "name": "GPT-5.2 Pro (High Compute/Precision)",
                "tier": "premium",
                "capabilities": ["high_precision"],
                "config_params": ["reasoning_effort"],
                "ui_metadata": {
                    "label": "Pro (Alta Precisión)",
                    "description": "Versión de alto cómputo para tareas que requieren máxima precisión.",
                    "color": "purple",
                    "icon": "psychology"
                }
            },
            {
                "id": "gpt-5-mini",
                "name": "GPT-5 Mini (Fast & Efficient)",
                "tier": "economy",
                "capabilities": ["fast"],
                "config_params": [],
                "ui_metadata": {
                    "label": "Mini (Rápido y Eficiente)",
                    "description": "Ideal para chats rápidos, emails y clasificación.",
                    "color": "green",
                    "icon": "lightning"
                }
            },
            {
                "id": "gpt-5-nano",
                "name": "GPT-5 Nano (High Volume)",
                "tier": "economy",
                "capabilities": ["ultra_fast"],
                "config_params": [],
                "ui_metadata": {
                    "label": "Nano (Alto Volumen)",
                    "description": "Ultra rápido para procesamiento masivo de mensajes.",
                    "color": "green",
                    "icon": "flash_on"
                }
            },
            {
                "id": "gpt-5.2-codex",
                "name": "GPT-5.2 Codex (Agentic Coding)",
                "tier": "advanced",
                "capabilities": ["coding", "patching"],
                "config_params": [],
                "ui_metadata": {
                    "label": "Codex (Programación Agéntica)",
                    "description": "Especializado en generación y parcheo de código.",
                    "color": "blue",
                    "icon": "code"
                }
            }
        ]
    },
    "google": {
        "provider_name": "Google Vertex AI / AI Studio",
        "models": [
            {
                "id": "gemini-3-pro",
                "name": "Gemini 3 Pro (1M Context - Multimodal)",
                "tier": "advanced",
                "capabilities": ["1m_context", "video", "audio"],
                "config_params": [],
                "ui_metadata": {
                    "label": "Pro (1M Contexto)",
                    "description": "Contexto masivo con soporte multimodal (video, audio).",
                    "color": "blue",
                    "icon": "visibility"
                }
            },
            {
                "id": "gemini-3-flash",
                "name": "Gemini 3 Flash (Low Latency)",
                "tier": "economy",
                "capabilities": ["high_throughput"],
                "config_params": [],
                "ui_metadata": {
                    "label": "Flash (Baja Latencia)",
                    "description": "El modelo más rápido del mercado.",
                    "color": "green",
                    "icon": "flash_on"
                }
            }
        ]
    }
}

def get_all_models() -> List[Dict[str, Any]]:
    """Returns a flat list of all models across providers for UI rendering."""
    all_models = []
    for provider_key, provider_data in MODEL_REGISTRY.items():
        for model in provider_data["models"]:
            all_models.append({
                **model,
                "provider": provider_key,
                "provider_name": provider_data["provider_name"]
            })
    return all_models

def validate_model(model_id: str) -> str:
    """
    Validates a model ID against the registry.
    Returns the validated ID or the DEFAULT_MODEL.
    """
    all_models = get_all_models()
    if any(m["id"] == model_id for m in all_models):
        return model_id
    return DEFAULT_MODEL

def get_model_info(model_id: str) -> Dict[str, Any]:
    """Returns full model information including capabilities and config params."""
    all_models = get_all_models()
    for model in all_models:
        if model["id"] == model_id:
            return model
    # Return default model info if not found
    return next((m for m in all_models if m["id"] == DEFAULT_MODEL), all_models[0])

def get_fallback_model(model_id: str) -> str:
    """
    Returns a fallback model if the premium one fails.
    Premium -> Advanced -> Economy.
    """
    model_info = get_model_info(model_id)
    provider = model_info.get("provider", "openai")
    
    # Fallback logic by tier
    if model_info["tier"] in ["premium", "flagship"]:
        # Try to find an advanced model from same provider
        all_models = get_all_models()
        advanced = next((m["id"] for m in all_models if m["provider"] == provider and m["tier"] == "advanced"), None)
        if advanced:
            return advanced
    
    # Ultimate fallback
    return DEFAULT_MODEL
