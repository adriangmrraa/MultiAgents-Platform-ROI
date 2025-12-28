import os
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
    client = genai.Client(api_key=GOOGLE_API_KEY)

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
            model='gemini-1.5-flash',
            contents=[prompt, img]
        )
        return response.text
    except Exception as e:
        logger.error("gemini_vision_failed", error=str(e))
        # Fallback to simple context if vision fails
        return f"A distinct product related to {prompt_context}"

async def generate_image_dalle3(full_prompt: str, image_url: str = None) -> str:
    """
    Renamed wrapper: Uses Google Imagen 3 (Nano Banana Gen) to create the context.
    Kept name to avoid breaking engine.py.
    Supports Image-to-Image (Reference Image) if image_url is provided.
    """
    if not client:
         raise Exception("Missing GOOGLE_API_KEY for Nano Banana (Imagen)")

    try:
        # 1. Prepare Reference Image if provided
        reference_images = []
        if image_url:
            async with httpx.AsyncClient() as http_client:
                resp = await http_client.get(image_url)
                if resp.status_code == 200:
                    img_bytes = resp.content
                    reference_images.append(
                        types.ReferenceImage(
                            subject_reference_image=types.SubjectReferenceImage(
                                image=types.Image(image_bytes=img_bytes)
                            )
                        )
                    )

        # 2. Call Imagen 3 (Nano Banana)
        # Using the latest SDK pattern for image generation with possible reference
        config = {
            'number_of_images': 1,
            'include_rai_reasoning': True,
            'output_mime_type': 'image/png'
        }
        
        if reference_images:
            config['reference_images'] = reference_images

        response = client.models.generate_image(
            model='imagen-3.0-generate-001',
            prompt=full_prompt,
            config=config
        )
        
        # 3. Extract and format output
        # The response structure for images in the new SDK usually contains bytes
        if response.generated_images:
            img_bytes = response.generated_images[0].image_bytes
            import base64
            b64_img = base64.b64encode(img_bytes).decode('utf-8')
            return f"data:image/png;base64,{b64_img}"
            
        # Fallback for Protocol Omega MVP stability
        if "Mock" in full_prompt or "Placeholder" in full_prompt:
             return "https://placehold.co/1024x1024.png?text=Nano+Banana+Gen"

        return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+3+Generation+Unavailable"

    except Exception as e:
        logger.error("imagen_failed", error=str(e))
        # Fallback to a styled placeholder to prevent breaking the flow
        return f"https://placehold.co/1024x1024/1e293b/FFF.png?text=Imagen+3+Error:+{str(e)[:20]}"
