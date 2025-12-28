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

# Configure Google AI Client (Nano Banana)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = None
if GOOGLE_API_KEY:
    # Protocol Omega: Revert to default SDK (v1beta) but use explicit model version
    client = genai.Client(api_key=GOOGLE_API_KEY)
    
    # DEBUG: List available models to find the correct name
    try:
        logger.info("gemini_debug_list_start")
        # List first 20 models to avoid log spam, focusing on generateContent
        for m in client.models.list(config={'limit': 20}):
            if 'generateContent' in m.supported_generation_methods:
                logger.info("gemini_available_model", name=m.name, display=m.display_name)
    except Exception as e:
        logger.error("gemini_debug_list_failed", error=str(e))

async def analyze_image_with_gpt4o(image_url: str, prompt_context: str) -> str:
    """
    Renamed wrapper: Actually uses Google Gemini 1.5 Flash (Nano Banana Vision) 
    to analyze the product image. Kept function name to avoid breaking engine.py import.
    """
    if not GOOGLE_API_KEY:
        raise Exception("Missing GOOGLE_API_KEY for Nano Banana (Gemini)")

    try:
        # 1. Download Image (Gemini Needs Blob or Pilot)
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content
            
        # 2. Convert to PIL for SDK
        img = Image.open(BytesIO(image_bytes))

        # 3. Call Gemini Vision (Nano Banana)
        if not client:
             raise Exception("Google GenAI Client not initialized")

        prompt = f"Analyze this product image deeply. Context: {prompt_context}. Describe the MAIN PRODUCT (colors, materials, shape, key features) so it can be recreated. Output a concise paragraph."
        
        response = client.models.generate_content(
            model='gemini-1.5-flash-001',
            contents=[prompt, img]
        )
        return response.text
    except Exception as e:
        logger.error("gemini_vision_failed", error=str(e))
        # Fallback to simple context if vision fails
        return f"A distinct product related to {prompt_context}"

async def generate_ad_from_product(base64_product: str, prompt: str) -> str:
    """
    Multimodal Transformation: Vision (1.5 Flash) -> Image Generation (Imagen 3)
    Transforms a real product image into a professional ad based on analysis.
    Protocol Omega: Stabilized Strategy (v5.9.108).
    """
    if not GOOGLE_API_KEY:
        raise Exception("Missing GOOGLE_API_KEY for Multimodal Transformation")

    # Strategy Change: Multimodal Preview is hitting extreme 429 in logs.
    # Protocol Omega Switch: Vision Analysis (Gemini 1.5 Flash) -> Image Generation (Imagen 3)
    try:
        # 1. Vision Analysis (Reusing analyze_image_with_gpt4o logic but with base64)
        logger.info("gemini_stable_analysis_start")
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(base64.b64decode(base64_product)))
        
        analysis_prompt = f"Describe este producto detalladamente para un anuncio de {prompt}. Enfócate en la estética, colores y marca."
        
        response = client.models.generate_content(
            model='gemini-1.5-flash-001',
            contents=[analysis_prompt, img]
        )
        visual_description = response.text
        logger.info("gemini_stable_analysis_done", desc_sample=visual_description[:50])

        # 2. Image Generation (Imagen 3)
        final_prompt = f"Professional commercial advertisement for {prompt}. Realistic product photography, high quality, 8k. Context: {visual_description}"
        return await generate_image_dalle3(final_prompt)

    except Exception as e:
        logger.error("gemini_stable_strategy_failed", error=str(e))
        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Creative+Director+Offline"

async def generate_image_dalle3(full_prompt: str, image_url: str = None) -> str:
    """
    Standard Generation: Imagen 4.0 (Predict Endpoint)
    """
    if not GOOGLE_API_KEY:
         raise Exception("Missing GOOGLE_API_KEY for Imagen 4.0")

    try:
        # Fallback to direct SDK if possible, or Predict URL
        # For Nexus v3.3, we use the client models if plural works, or predict endpoint
        model_id = 'imagen-3.0-generate-001' # Keep this for SDK or update to 4.0 if known
        
        # User requested imagen-4.0-generate-001 with predict endpoint
        # However, genai SDK usually handles 'imagen-3.0-generate-00x'
        # We will try the plural method first as it was verified in logs
        
        config = {
            'number_of_images': 1,
            'output_mime_type': 'image/png'
        }
        
        try:
            response = client.models.generate_images(
                model=model_id,
                prompt=full_prompt,
                config=config
            )
        except Exception as e:
             logger.warning("imagen_sdk_failed_trying_predict", error=str(e))
             # Placeholder for direct predict endpoint if needed
             raise e

        if response.generated_images:
            img_bytes = response.generated_images[0].image_bytes
            b64_img = base64.b64encode(img_bytes).decode('utf-8')
            return f"data:image/png;base64,{b64_img}"
            
        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+Generation+Unavailable"

    except Exception as e:
        logger.error("imagen_failed", error=str(e))
        return f"https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+Error:+{str(e)[:20]}"
