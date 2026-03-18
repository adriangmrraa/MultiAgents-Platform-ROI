import os
import base64
import asyncio
from google import genai
from google.genai import types
import structlog
from fastapi import HTTPException
import httpx
from PIL import Image
from io import BytesIO

logger = structlog.get_logger()

# ==================== MODEL CATALOG ====================

IMAGE_MODELS = {
    "nano-banana-2": {
        "id": "gemini-3.1-flash-image-preview",
        "name": "Nano Banana 2",
        "description": "Rapido y con image-to-image. Gemini 3.1 Flash Image.",
        "method": "gemini_native",
        "supports_references": True,
        "cost_label": "~$0.04/img",
        "speed": "fast",
    },
    "nano-banana-pro": {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana Pro",
        "description": "Maxima calidad. Gemini 3 Pro con razonamiento avanzado.",
        "method": "gemini_native",
        "supports_references": True,
        "cost_label": "~$0.07/img",
        "speed": "slow",
    },
}

DEFAULT_MODEL = "nano-banana-2"


def get_image_models():
    """Return catalog of available image models for frontend."""
    return [
        {"key": k, **{f: v[f] for f in ("name", "description", "cost_label", "speed")}}
        for k, v in IMAGE_MODELS.items()
    ]


# ==================== GOOGLE CLIENT ====================

def get_google_client(api_key: str = None):
    """Returns a GenAI client using the provided key or the global one."""
    from app.core.config import settings
    target_key = api_key or settings.GOOGLE_API_KEY
    if not target_key:
        return None
    return genai.Client(api_key=target_key)


# ==================== VISION ANALYSIS ====================

async def analyze_image_with_gpt4o(image_url: str, prompt_context: str, google_api_key: str = None) -> str:
    """Analyze a product image using Gemini Vision."""
    target_client = get_google_client(google_api_key)
    if not target_client:
        raise Exception("Missing GOOGLE_API_KEY")

    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content

        img = Image.open(BytesIO(image_bytes))
        prompt = f"Analyze this product image deeply. Context: {prompt_context}. Describe the MAIN PRODUCT (colors, materials, shape, key features) so it can be recreated. Output a concise paragraph."

        response = target_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, img]
        )
        return response.text
    except Exception as e:
        logger.error("gemini_vision_failed", error=str(e))
        return f"A distinct product related to {prompt_context}"


# ==================== AD GENERATION (LEGACY) ====================

async def generate_ad_from_product(base64_product: str, prompt: str, google_api_key: str = None) -> str:
    """Multimodal: Vision Analysis -> Image Generation."""
    target_client = get_google_client(google_api_key)
    if not target_client:
        raise Exception("Missing GOOGLE_API_KEY")

    try:
        logger.info("gemini_stable_analysis_start")
        img = Image.open(BytesIO(base64.b64decode(base64_product)))

        analysis_prompt = f"Describe este producto detalladamente para un anuncio de {prompt}. Enfócate en la estética, colores y marca."
        response = target_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[analysis_prompt, img]
        )
        visual_description = response.text
        logger.info("gemini_stable_analysis_done", desc_sample=visual_description[:50])

        final_prompt = f"Professional commercial advertisement for {prompt}. Realistic product photography, high quality, 8k. Context: {visual_description}"
        return await generate_image(final_prompt, google_api_key=google_api_key)

    except Exception as e:
        logger.error("gemini_stable_strategy_failed", error=str(e))
        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Creative+Director+Offline"


# ==================== IMAGE GENERATION ====================

async def generate_image(full_prompt: str, model_tier: str = None, google_api_key: str = None, reference_images: list = None) -> str:
    """
    Generate an image using the specified Nano Banana model tier.
    Falls back through models if the selected one fails.
    reference_images: optional list of PIL.Image objects to use as visual references.
    """
    target_client = get_google_client(google_api_key)
    if not target_client:
        raise Exception("Missing GOOGLE_API_KEY for image generation")

    tier = model_tier or DEFAULT_MODEL
    model_config = IMAGE_MODELS.get(tier, IMAGE_MODELS[DEFAULT_MODEL])

    # Build fallback chain: selected model first, then others
    all_tiers = [tier] + [k for k in IMAGE_MODELS if k != tier]

    for t in all_tiers:
        cfg = IMAGE_MODELS[t]
        model_id = cfg["id"]
        method = cfg["method"]

        try:
            if method == "imagen":
                result = await _generate_with_imagen(target_client, model_id, full_prompt)
            else:
                result = await _generate_with_gemini(target_client, model_id, full_prompt, reference_images)

            if result:
                logger.info("image_generated", model=model_id, tier=t, has_references=bool(reference_images))
                return result

        except Exception as e:
            logger.warning("image_model_failed", tier=t, model=model_id, error=str(e)[:120])
            continue

    logger.error("all_image_generation_failed", prompt_preview=full_prompt[:50])
    return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Image+Generation+Unavailable"


async def _generate_with_imagen(client, model_id: str, prompt: str) -> str | None:
    """Generate image using Imagen 3 API."""
    response = client.models.generate_images(
        model=model_id,
        prompt=prompt,
        config={'number_of_images': 1, 'output_mime_type': 'image/png'}
    )
    if response.generated_images:
        img_bytes = response.generated_images[0].image_bytes
        b64 = base64.b64encode(img_bytes).decode('utf-8')
        return f"data:image/png;base64,{b64}"
    return None


async def _generate_with_gemini(client, model_id: str, prompt: str, reference_images: list = None) -> str | None:
    """Generate image using Gemini native image generation, optionally with reference images."""
    # Build contents: prompt + optional reference images
    if reference_images:
        contents = [prompt] + reference_images
        modalities = ['TEXT', 'IMAGE']  # Need TEXT+IMAGE for multimodal input
    else:
        contents = prompt
        modalities = ['IMAGE']

    response = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=modalities,
        )
    )
    if response.candidates:
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.mime_type.startswith('image/'):
                b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                mime = part.inline_data.mime_type.split('/')[-1]
                return f"data:image/{mime};base64,{b64}"
    return None


# Backward compatibility alias
generate_image_dalle3 = generate_image
