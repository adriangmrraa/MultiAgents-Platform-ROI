"""
Creative Studio Service
Pomelli-inspired asset generation and editing system.

Features:
- Photoshoot: Transform product photos into studio-quality shots (4 templates)
- Campaign Generator: Generate multi-channel marketing campaigns
- Asset Editor: Edit any asset (image or text) with natural language prompts
- All assets are persisted and versioned in the database
"""
import json
import uuid
import base64
import structlog
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.core.image_utils import get_google_client, generate_image, generate_image_dalle3

logger = structlog.get_logger()

# Photoshoot template prompts
PHOTOSHOOT_TEMPLATES = {
    "studio": {
        "name": "Studio",
        "description": "Fondo limpio de estudio profesional con iluminacion suave",
        "prompt_suffix": "Clean studio background, professional product photography, soft studio lighting, white or gradient background, sharp focus, commercial quality, 8k, no text"
    },
    "floating": {
        "name": "Floating",
        "description": "Producto flotando con sombra dramatica y fondo gradiente",
        "prompt_suffix": "Product floating in mid-air, dramatic shadow below, gradient background, levitation effect, clean modern aesthetic, product photography, 8k, no text"
    },
    "lifestyle": {
        "name": "Lifestyle",
        "description": "Producto en un escenario de estilo de vida real",
        "prompt_suffix": "Product in a real lifestyle scene, natural setting, warm ambient lighting, editorial photography style, aspirational environment, 8k, no text"
    },
    "in_use": {
        "name": "In Use",
        "description": "Producto siendo usado por una persona en contexto natural",
        "prompt_suffix": "Product being used by a person, natural context, lifestyle photography, warm tones, authentic moment, editorial quality, 8k, no text"
    },
    "ingredient": {
        "name": "Ingredient",
        "description": "Producto rodeado de sus ingredientes o materiales",
        "prompt_suffix": "Product surrounded by its raw ingredients or materials, flat lay composition, artistic arrangement, premium food/beauty photography style, 8k, no text"
    }
}

# Campaign channel formats
CAMPAIGN_CHANNELS = {
    "instagram_post": {"name": "Instagram Post", "aspect": "1:1", "max_text": 150},
    "instagram_story": {"name": "Instagram Story", "aspect": "9:16", "max_text": 80},
    "facebook_ad": {"name": "Facebook Ad", "aspect": "1.91:1", "max_text": 125},
    "whatsapp_promo": {"name": "WhatsApp Promo", "aspect": "1:1", "max_text": 200},
    "email_banner": {"name": "Email Banner", "aspect": "2:1", "max_text": 50},
    "web_hero": {"name": "Web Hero Banner", "aspect": "16:9", "max_text": 60}
}


class CreativeStudio:
    """Full creative studio for brand asset generation and editing."""

    def __init__(self, google_api_key: str = None):
        self.google_client = get_google_client(google_api_key)
        self.google_api_key = google_api_key

    # ==================== PHOTOSHOOT ====================

    async def photoshoot(
        self,
        product_image_url: str,
        product_name: str,
        template: str = "studio",
        brand_dna: Dict = None,
        custom_prompt: str = None,
        model_tier: str = None
    ) -> Dict[str, Any]:
        """
        Transform a product photo into a studio-quality shot.
        Returns generated image as base64 data URL.
        """
        if template not in PHOTOSHOOT_TEMPLATES:
            template = "studio"

        tmpl = PHOTOSHOOT_TEMPLATES[template]

        # 1. Analyze original product image
        product_description = await self._analyze_product(product_image_url, product_name)

        # 2. Build prompt incorporating brand DNA
        brand_context = ""
        if brand_dna:
            colors = brand_dna.get("colors", {}).get("primary", [])
            style = brand_dna.get("visual_style", {}).get("photography_style", "")
            personality = brand_dna.get("brand_personality", "")
            if colors:
                brand_context += f"Brand colors: {', '.join(colors)}. "
            if style:
                brand_context += f"Brand visual style: {style}. "
            if personality:
                brand_context += f"Brand personality: {personality}. "

        final_prompt = f"Professional product photography of {product_description}. "
        if custom_prompt:
            final_prompt += f"{custom_prompt}. "
        final_prompt += f"{brand_context}{tmpl['prompt_suffix']}"

        # 3. Generate image
        image_url = await generate_image(final_prompt, model_tier=model_tier, google_api_key=self.google_api_key)

        return {
            "image_url": image_url,
            "template": template,
            "template_name": tmpl["name"],
            "model_tier": model_tier or "nano-banana",
            "prompt_used": final_prompt,
            "product_name": product_name,
            "product_description": product_description
        }

    # ==================== CAMPAIGN GENERATOR ====================

    async def generate_campaign(
        self,
        product_name: str,
        product_image_url: str = None,
        campaign_goal: str = "vender",
        channels: List[str] = None,
        brand_dna: Dict = None,
        custom_prompt: str = None,
        num_variations: int = 3,
        model_tier: str = None
    ) -> Dict[str, Any]:
        """
        Generate a multi-channel marketing campaign.
        Returns text + image assets for each channel.
        """
        if not channels:
            channels = ["instagram_post", "whatsapp_promo", "facebook_ad"]

        # 1. Analyze product if image available
        product_desc = ""
        if product_image_url:
            product_desc = await self._analyze_product(product_image_url, product_name)

        # 2. Build brand context
        brand_context = self._build_brand_context(brand_dna)

        # 3. Generate campaign copy for all channels
        campaign_assets = []

        for channel_key in channels:
            channel = CAMPAIGN_CHANNELS.get(channel_key)
            if not channel:
                continue

            # Generate text variations
            texts = await self._generate_campaign_texts(
                product_name=product_name,
                product_desc=product_desc,
                campaign_goal=campaign_goal,
                channel=channel,
                brand_context=brand_context,
                custom_prompt=custom_prompt,
                num_variations=num_variations
            )

            # Generate image for the channel
            image_url = None
            if product_image_url:
                img_prompt = f"Marketing {channel['name']} creative for {product_name}. {product_desc}. {brand_context}. {campaign_goal}. Professional advertising photography, commercial quality, 8k, no text on image"
                if custom_prompt:
                    img_prompt = f"{custom_prompt}. {img_prompt}"
                image_url = await generate_image(img_prompt, model_tier=model_tier, google_api_key=self.google_api_key)

            campaign_assets.append({
                "channel": channel_key,
                "channel_name": channel["name"],
                "aspect_ratio": channel["aspect"],
                "texts": texts,
                "image_url": image_url
            })

        return {
            "campaign_goal": campaign_goal,
            "product_name": product_name,
            "channels": campaign_assets,
            "brand_context": brand_context
        }

    # ==================== ASSET EDITOR ====================

    async def edit_image_asset(
        self,
        original_image_url: str,
        edit_prompt: str,
        product_name: str = None,
        brand_dna: Dict = None,
        model_tier: str = None
    ) -> Dict[str, Any]:
        """
        Edit an existing image asset using natural language prompt.
        Analyzes the original image + applies the edit instruction.
        """
        # 1. Analyze original image
        original_desc = ""
        if self.google_client:
            try:
                if original_image_url.startswith("data:image"):
                    # Base64 image
                    b64_data = original_image_url.split(",")[1]
                    from PIL import Image
                    from io import BytesIO
                    img = Image.open(BytesIO(base64.b64decode(b64_data)))

                    response = self.google_client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=[
                            "Describe esta imagen detalladamente: composicion, colores, objetos, estilo fotografico, fondo. Se conciso.",
                            img
                        ]
                    )
                    original_desc = response.text
                else:
                    from app.core.image_utils import analyze_image_with_gpt4o
                    original_desc = await analyze_image_with_gpt4o(original_image_url, "marketing asset", self.google_api_key)
            except Exception as e:
                logger.warning("edit_image_analysis_failed", error=str(e))

        # 2. Build edit prompt
        brand_context = self._build_brand_context(brand_dna) if brand_dna else ""

        final_prompt = f"Create a modified version of this image: {original_desc}. "
        final_prompt += f"MODIFICATION REQUESTED: {edit_prompt}. "
        if product_name:
            final_prompt += f"Product: {product_name}. "
        final_prompt += f"{brand_context}Professional quality, 8k, commercial photography, no text."

        # 3. Generate edited image
        new_image = await generate_image(final_prompt, model_tier=model_tier, google_api_key=self.google_api_key)

        return {
            "image_url": new_image,
            "edit_prompt": edit_prompt,
            "original_description": original_desc[:200],
            "prompt_used": final_prompt
        }

    async def edit_text_asset(
        self,
        original_text: str,
        edit_prompt: str,
        asset_type: str = "scripts",
        brand_dna: Dict = None
    ) -> Dict[str, Any]:
        """
        Edit a text asset (script, copy, tagline) using natural language.
        """
        if not self.google_client:
            return {"text": original_text, "error": "No AI client available"}

        brand_context = self._build_brand_context(brand_dna) if brand_dna else ""
        tone = ""
        if brand_dna:
            tone_data = brand_dna.get("tone_of_voice", {})
            tone = f"Tono de voz: {tone_data.get('style', 'profesional')}. Formalidad: {tone_data.get('formality', 'neutral')}."

        prompt = f"""Eres un copywriter experto. Edita el siguiente texto de marketing segun las instrucciones del usuario.

TEXTO ORIGINAL:
{original_text}

INSTRUCCION DEL USUARIO: {edit_prompt}

CONTEXTO DE MARCA: {brand_context}
{tone}

TIPO DE ASSET: {asset_type}

Reglas:
- Mantene la estructura general a menos que el usuario pida cambiarla
- Aplica las correcciones pedidas
- Mantene el tono de la marca
- No agregues explicaciones, solo devuelve el texto editado

TEXTO EDITADO:"""

        try:
            response = self.google_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt]
            )
            new_text = response.text.strip()
            return {
                "text": new_text,
                "edit_prompt": edit_prompt,
                "asset_type": asset_type
            }
        except Exception as e:
            logger.error("edit_text_failed", error=str(e))
            return {"text": original_text, "error": str(e)}

    # ==================== HELPERS ====================

    async def _analyze_product(self, image_url: str, product_name: str) -> str:
        """Analyze a product image to get description."""
        try:
            from app.core.image_utils import analyze_image_with_gpt4o
            desc = await analyze_image_with_gpt4o(
                image_url,
                f"product: {product_name}",
                self.google_api_key
            )
            return desc
        except Exception as e:
            logger.warning("product_analysis_fallback", error=str(e))
            return product_name

    def _build_brand_context(self, brand_dna: Dict = None) -> str:
        """Build brand context string from DNA."""
        if not brand_dna:
            return ""

        parts = []
        colors = brand_dna.get("colors", {}).get("primary", [])
        if colors:
            parts.append(f"Brand colors: {', '.join(colors[:3])}")

        style = brand_dna.get("visual_style", {}).get("photography_style", "")
        if style:
            parts.append(f"Visual style: {style}")

        personality = brand_dna.get("brand_personality", "")
        if personality:
            parts.append(f"Brand personality: {personality}")

        return ". ".join(parts)

    async def _generate_campaign_texts(
        self,
        product_name: str,
        product_desc: str,
        campaign_goal: str,
        channel: Dict,
        brand_context: str,
        custom_prompt: str = None,
        num_variations: int = 3
    ) -> List[Dict]:
        """Generate campaign copy variations for a channel."""
        if not self.google_client:
            return [{"headline": product_name, "body": f"Descubri {product_name}", "cta": "Comprar ahora"}]

        prompt = f"""Genera {num_variations} variaciones de copy para una campana de marketing.

PRODUCTO: {product_name}
DESCRIPCION: {product_desc}
OBJETIVO: {campaign_goal}
CANAL: {channel['name']}
LIMITE TEXTO: {channel['max_text']} caracteres aprox
CONTEXTO DE MARCA: {brand_context}
{f'INSTRUCCION ADICIONAL: {custom_prompt}' if custom_prompt else ''}

Responde en JSON array con esta estructura:
[
  {{
    "headline": "titulo impactante corto",
    "body": "texto principal del post/ad",
    "cta": "call to action",
    "hashtags": ["3 hashtags relevantes"]
  }}
]

SOLO responde con el JSON array, sin texto adicional ni markdown."""

        try:
            response = self.google_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt]
            )
            text = response.text.strip()
            import re
            if text.startswith('```'):
                text = re.sub(r'^```(?:json)?\n?', '', text)
                text = re.sub(r'\n?```$', '', text)
            return json.loads(text)
        except Exception as e:
            logger.error("campaign_text_gen_failed", error=str(e))
            return [{"headline": product_name, "body": f"Descubri {product_name}", "cta": "Comprar ahora", "hashtags": []}]


def get_photoshoot_templates() -> List[Dict]:
    """Return available photoshoot templates."""
    return [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in PHOTOSHOOT_TEMPLATES.items()
    ]


def get_campaign_channels() -> List[Dict]:
    """Return available campaign channels."""
    return [
        {"id": k, "name": v["name"], "aspect_ratio": v["aspect"]}
        for k, v in CAMPAIGN_CHANNELS.items()
    ]
