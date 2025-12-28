import os
import openai
import base64
import httpx
import structlog
from fastapi import HTTPException

logger = structlog.get_logger()

async def analyze_image_with_gpt4o(image_url: str, prompt_context: str) -> str:
    """
    Uses GPT-4o Vision to describe the product in the image, strictly for DALL-E 3 reconstruction.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("Missing OPENAI_API_KEY")

    client = openai.AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert visual analyzer for AI Image Generation. Your goal is to describe the MAIN PRODUCT in the image so perfectly that DALL-E 3 can recreate it in a new context. Focus on color, texture, shape, materials, and distinct features. Do not describe the background."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Analyze this product image. Context: {prompt_context}. Return a descriptive paragraph."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                                "detail": "low"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error("gpt4o_vision_failed", error=str(e))
        raise e

async def generate_image_dalle3(full_prompt: str) -> str:
    """
    Generates image using DALL-E 3.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    client = openai.AsyncOpenAI(api_key=api_key)

    try:
        response = await client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            style="vivid" # Better for ads
        )
        return response.data[0].url
    except Exception as e:
        logger.error("dalle3_failed", error=str(e))
        raise e
