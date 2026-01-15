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
    # Commented out for production
    # try:
    #     logger.info("gemini_debug_list_start")
    #     for m in client.models.list():
    #         if 'generateContent' in m.supported_generation_methods:
    #             logger.info("gemini_available_model", name=m.name, display=m.display_name)
    # except Exception as e:
    #     logger.error("gemini_debug_list_failed", error=str(e))

def get_google_client(api_key: str = None):
    """Returns a GenAI client using the provided key or the global one."""
    target_key = api_key or GOOGLE_API_KEY
    if not target_key:
        return None
    # We create a new client for each request if a specific key is used to ensure isolation
    return genai.Client(api_key=target_key)

async def analyze_image_with_gpt4o(image_url: str, prompt_context: str, google_api_key: str = None) -> str:
    """
    Renamed wrapper: Actually uses Google Gemini 1.5 Flash (Nano Banana Vision) 
    to analyze the product image. Kept function name to avoid breaking engine.py import.
    """
    target_client = get_google_client(google_api_key)
    if not target_client:
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
        prompt = f"Analyze this product image deeply. Context: {prompt_context}. Describe the MAIN PRODUCT (colors, materials, shape, key features) so it can be recreated. Output a concise paragraph."
        
        # Upgrade to gemini-2.5-flash (Available per Runtime Logs) to bypass 2.0-flash Quota/429
        response = target_client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=[prompt, img]
        )
        return response.text
    except Exception as e:
        logger.error("gemini_vision_failed", error=str(e))
        # Fallback to simple context if vision fails
        return f"A distinct product related to {prompt_context}"

async def generate_ad_from_product(base64_product: str, prompt: str, google_api_key: str = None) -> str:
    """
    Multimodal Transformation: Vision (1.5 Flash) -> Image Generation (Imagen 3)
    Transforms a real product image into a professional ad based on analysis.
    Protocol Omega: Stabilized Strategy (v5.9.108).
    """
    target_client = get_google_client(google_api_key)
    if not target_client:
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
        
        response = target_client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[analysis_prompt, img]
        )
        visual_description = response.text
        logger.info("gemini_stable_analysis_done", desc_sample=visual_description[:50])

        # 2. Image Generation (Imagen 3) with Subject Reference
        final_prompt = f"Professional commercial advertisement for {prompt}. Realistic product photography, high quality, 8k. Context: {visual_description}"
        return await generate_image_dalle3(final_prompt, reference_image=img, google_api_key=google_api_key)

    except Exception as e:
        logger.error("gemini_stable_strategy_failed", error=str(e))
        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Creative+Director+Offline"

async def generate_image_dalle3(full_prompt: str, reference_image: Image.Image = None, google_api_key: str = None) -> str:
    """
    Standard Generation: Imagen 3.0 (Nano Banana)
    Supports Subject Reference if available.
    """
    target_client = get_google_client(google_api_key)
    if not target_client:
         raise Exception("Missing GOOGLE_API_KEY for Imagen 3.0")

    try:
        model_id = 'imagen-3.0-generate-001'
        
        config = {
            'number_of_images': 1,
            'output_mime_type': 'image/png'
        }
        
        try:
            # We will use the standard call.
            response = target_client.models.generate_images(
                model=model_id,
                prompt=full_prompt,
                config=config
            )
        except Exception as e:
             logger.warning("imagen_sdk_failed_trying_predict", error=str(e))
             raise e

        if response.generated_images:
            img_bytes = response.generated_images[0].image_bytes
            b64_img = base64.b64encode(img_bytes).decode('utf-8')
            return f"data:image/png;base64,{b64_img}"
            
        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+Generation+Unavailable"

    except Exception as e:
        logger.error("imagen_failed", error=str(e))
        return f"https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+Error:+{str(e)[:20]}"
