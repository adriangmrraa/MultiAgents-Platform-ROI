from typing import List, Dict, Any

# REGISTRO DE MODELOS OFICIAL - ENERO 2026
# Actualizado vía documentación oficial (platform.openai.com / AI Studio)
# Contexto: Nexus v5.99

DEFAULT_MODEL = "gpt-5-mini"

MODEL_REGISTRY = {
    "openai": {
        "provider_name": "OpenAI",
        "models": [
            {
                "id": "gpt-5.2",
                "name": "GPT-5.2 (Flagship - Coding/Reasoning)",
                "capabilities": ["reasoning", "coding", "multimodal"],
                "config_params": ["reasoning_effort", "text_verbosity"],
                "tier": "flagship",
                "ui_metadata": {
                    "label": "Flagship (Coding/Reasoning)",
                    "description": "Mejor para coding/agentic.",
                    "color": "purple",
                    "icon": "auto_awesome"
                }
            },
            {
                "id": "gpt-5.2-pro",
                "name": "GPT-5.2 Pro (High Compute/Precision)",
                "capabilities": ["high_precision"],
                "tier": "premium",
                "ui_metadata": {
                    "label": "Pro (Alta Precisión)",
                    "description": "Más preciso para tareas complejas.",
                    "color": "purple",
                    "icon": "psychology"
                }
            },
            {
                "id": "gpt-5-mini",
                "name": "GPT-5 Mini (Fast & Efficient)",
                "capabilities": ["fast"],
                "tier": "economy",
                "ui_metadata": {
                    "label": "Mini (Rápido y Eficiente)",
                    "description": "Rápido/económico; ideal para escala.",
                    "color": "green",
                    "icon": "lightning"
                }
            },
            {
                "id": "gpt-5-nano",
                "name": "GPT-5 Nano (High Volume)",
                "capabilities": ["ultra_fast"],
                "tier": "economy",
                "ui_metadata": {
                    "label": "Nano (Ultra Rápido)",
                    "description": "Más rápido/barato para alto volumen.",
                    "color": "green",
                    "icon": "flash_on"
                }
            },
            {
                "id": "gpt-5.2-codex",
                "name": "GPT-5.2 Codex (Agentic Coding)",
                "capabilities": ["coding", "patching"],
                "tier": "advanced",
                "ui_metadata": {
                    "label": "Codex (Programación)",
                    "description": "Especializado en generación de código.",
                    "color": "blue",
                    "icon": "code"
                }
            },
            {
                "id": "gpt-4.1",
                "name": "GPT-4.1 (No-Reasoning Intelligent)",
                "capabilities": ["intelligent"],
                "tier": "advanced",
                "ui_metadata": {
                    "label": "GPT-4.1 (Inteligente)",
                    "description": "Versión robusta sin latencia de razonamiento.",
                    "color": "blue",
                    "icon": "auto_graph"
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
                "capabilities": ["1m_context", "video", "audio"],
                "tier": "advanced",
                "ui_metadata": {
                    "label": "Gemini 3 Pro",
                    "description": "Multimodal/complejo; 1M tokens.",
                    "color": "blue",
                    "icon": "visibility"
                }
            },
            {
                "id": "gemini-3-flash",
                "name": "Gemini 3 Flash (Low Latency)",
                "capabilities": ["high_throughput"],
                "tier": "economy",
                "ui_metadata": {
                    "label": "Gemini 3 Flash",
                    "description": "Agentic/coding rápido.",
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
    """Validates a model ID against the registry."""
    all_models = get_all_models()
    if any(m["id"] == model_id for m in all_models):
        return model_id
    return DEFAULT_MODEL

def get_model_info(model_id: str) -> Dict[str, Any]:
    """Returns full model info."""
    all_models = get_all_models()
    for model in all_models:
        if model["id"] == model_id:
            return model
    return next((m for m in all_models if m["id"] == DEFAULT_MODEL), all_models[0])

def get_fallback_model(model_id: str) -> str:
    """Fallbacks logic (deprecated legacy logic)"""
    return DEFAULT_MODEL
