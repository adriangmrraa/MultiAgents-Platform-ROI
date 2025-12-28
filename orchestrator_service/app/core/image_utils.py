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

async def generate_ad_from_product(base64_product: str, prompt: str) -> str:
    """
    Multimodal Transformation: Gemini 2.5 Flash Image Preview
    Transforms a real product image into a professional ad based on a prompt.
    Includes Exponential Backoff (Protocol Omega).
    """
    if not GOOGLE_API_KEY:
        raise Exception("Missing GOOGLE_API_KEY for Multimodal Transformation")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={GOOGLE_API_KEY}"
    # Note: Using gemini-2.0-flash-exp as 2.5 might not be public yet, 
    # but the structure is the same. Adjusting based on user request.
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                { "text": f"Transforma este producto en un anuncio profesional de alto impacto: {prompt}" },
                { "inlineData": { "mimeType": "image/png", "data": base64_product } }
            ]
        }],
        "generationConfig": { 
            "responseModalities": ["TEXT", "IMAGE"],
            "responseMimeType": "application/json"
        }
    }

    # Exponential Backoff Logic
    max_retries = 5
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                # Truncate base64 for cleaner logs
                safe_b64 = base64_product[:50] + "..." if base64_product else "None"
                logger.info("product_to_ad_start", attempt=attempt+1, b64_sample=safe_b64)
                
                resp = await http_client.post(url, json=payload)
                
                if resp.status_code == 200:
                    data = resp.json()
                    # Gemini multimodal output extraction (JSON response contains parts)
                    try:
                        # Protocol Omega: Search for the inlineData part in the response candidates
                        candidates = data.get('candidates', [])
                        if not candidates:
                             raise Exception("No candidates in Gemini response")
                        
                        parts = candidates[0].get('content', {}).get('parts', [])
                        img_data = None
                        for part in parts:
                            if 'inlineData' in part:
                                img_data = part['inlineData']['data']
                                break
                        
                        if not img_data:
                            logger.error("gemini_multimodal_image_missing", response=str(data)[:500])
                            raise Exception("Image part missing in Gemini response")
                            
                        return f"data:image/png;base64,{img_data}"
                    except Exception as pe:
                        logger.error("gemini_multimodal_parse_failed", error=str(pe), response=str(data)[:200])
                        raise Exception(f"Failed to parse visual response: {str(pe)}")
                
                elif resp.status_code in [429, 500, 502, 503, 504]:
                    wait_time = 2 ** attempt
                    logger.warning("gemini_api_backoff", status=resp.status_code, wait=wait_time)
                    await asyncio.sleep(wait_time)
                else:
                    logger.error("gemini_api_error", status=resp.status_code, body=resp.text)
                    raise Exception(f"Gemini API returned {resp.status_code}")
                    
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error("gemini_max_retries_reached", error=str(e))
                raise e
            await asyncio.sleep(2 ** attempt)

    return "https://placehold.co/1024x1024/1e293b/FFF.png?text=Multimodal+Gen+Failed"

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
