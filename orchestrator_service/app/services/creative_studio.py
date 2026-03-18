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

# Photoshoot template prompts — professional commercial photography
PHOTOSHOOT_TEMPLATES = {
    "studio": {
        "name": "Studio",
        "description": "Fondo limpio de estudio profesional con iluminacion suave",
        "prompt_suffix": (
            "Shot in a high-end photography studio. Seamless white or soft gradient background. "
            "Three-point lighting setup: key light at 45 degrees creating gentle highlights, fill light "
            "softening shadows, rim light separating the product from the background. "
            "Razor-sharp focus on the product with subtle depth of field on edges. "
            "Color-accurate representation, true-to-life textures and materials. "
            "Shot with a Phase One IQ4 150MP at f/8, 1/125s, ISO 50. "
            "Post-production: subtle shadow under product for grounding, clean retouching, "
            "magazine-ready commercial quality. 8K resolution. No text, no watermarks, no logos."
        )
    },
    "floating": {
        "name": "Floating",
        "description": "Producto flotando con sombra dramatica y fondo gradiente",
        "prompt_suffix": (
            "Product elegantly suspended in mid-air, defying gravity with a sense of luxury and weightlessness. "
            "Dramatic soft shadow cast directly below on a reflective surface, creating depth and dimension. "
            "Rich gradient background transitioning from deep charcoal to warm amber or brand-complementary tones. "
            "Cinematic lighting: strong key light from above-left with atmospheric volumetric haze. "
            "Subtle motion blur particles or light rays adding dynamism. "
            "Shot with Sony A7R V, 90mm macro, f/5.6 for perfect product isolation. "
            "Premium e-commerce aesthetic, Apple-level presentation quality. "
            "8K resolution. No text, no watermarks."
        )
    },
    "lifestyle": {
        "name": "Lifestyle",
        "description": "Producto en un escenario de estilo de vida aspiracional",
        "prompt_suffix": (
            "Product placed naturally in a beautifully styled aspirational environment. "
            "Golden hour natural lighting streaming through windows, creating warm highlights and soft shadows. "
            "Carefully curated scene with complementary props that tell a story: marble surfaces, linen textures, "
            "fresh botanicals, artisan ceramics — all supporting the product as the hero. "
            "Shallow depth of field (f/2.8) drawing the eye to the product while the environment remains "
            "dreamy and inviting. Editorial photography style inspired by Kinfolk and Cereal magazine. "
            "Color palette is warm, muted, and cohesive. Feels authentic yet elevated. "
            "Shot with Hasselblad X2D 100C. 8K resolution. No text, no watermarks."
        )
    },
    "in_use": {
        "name": "In Use",
        "description": "Producto siendo usado por una persona en contexto natural",
        "prompt_suffix": (
            "Product being naturally used by an attractive, diverse model in an authentic real-world moment. "
            "The model interacts with the product genuinely — no forced poses, capturing a candid, aspirational instant. "
            "Soft natural backlighting creating a warm halo effect around the subject. "
            "Environment is contextually relevant: modern home, outdoor terrace, urban cafe, or workspace. "
            "Skin tones are rich and natural, clothing is contemporary and stylish. "
            "Focus split between the product and the model's expression of satisfaction/enjoyment. "
            "Editorial fashion photography quality, inspired by campaigns from Glossier, Aesop, or Nike. "
            "Shot with Canon R5, 85mm f/1.4 for beautiful bokeh. 8K resolution. No text, no watermarks."
        )
    },
    "ingredient": {
        "name": "Ingredient",
        "description": "Producto rodeado de sus ingredientes o materiales clave",
        "prompt_suffix": (
            "Stunning overhead flat-lay composition with the product as the centerpiece, surrounded by a curated "
            "arrangement of its raw ingredients, key materials, or sensory elements. "
            "Each ingredient is artistically placed: fresh herbs with water droplets, spices in small ceramic bowls, "
            "raw materials with natural textures, essential oils, botanical elements — all radiating outward. "
            "Surface is premium: dark slate, aged wood, Italian marble, or handmade ceramic. "
            "Dramatic top-down lighting with subtle side highlights on each element. "
            "Color story is cohesive: earthy, vibrant, or monochromatic depending on the brand. "
            "Food/beauty photography at its finest — David Loftus and Gentl & Hyers inspired. "
            "Shot with Sony A7 IV, 35mm f/2.8 for flat-lay perfection. 8K resolution. No text, no watermarks."
        )
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


# Model Shoot templates — product + person/model scenes
MODEL_SHOOT_TEMPLATES = {
    "urban_street": {
        "name": "Urban Street",
        "description": "Modelo en la calle con el producto, look urbano y moderno",
        "prompt_suffix": (
            "Model walking through a trendy urban street, naturally holding/wearing/using the product. "
            "Street photography aesthetic: candid movement, shallow depth of field blurring the city behind. "
            "Warm afternoon light reflecting off buildings, subtle lens flare. Outfit is modern streetwear. "
            "Inspired by campaigns from Off-White, Nike SB, and Carhartt WIP. "
            "Shot with Leica Q3, 28mm f/1.7, capturing authentic street energy. "
            "8K resolution. No text, no watermarks, no logos."
        )
    },
    "cozy_home": {
        "name": "Hogar Cozy",
        "description": "Modelo usando el producto en un ambiente hogareño y calido",
        "prompt_suffix": (
            "Model comfortably using the product in a beautifully designed modern home interior. "
            "Warm, inviting atmosphere: soft knit blankets, warm lighting, plants, wooden textures. "
            "The model exudes relaxation and genuine satisfaction. Natural smile, bare feet optional. "
            "Soft window light creating gentle shadows, hygge Scandinavian interior design. "
            "Inspired by IKEA lifestyle shoots and West Elm campaigns. "
            "Shot with Sony A7 IV, 35mm f/1.8, warm color grade. "
            "8K resolution. No text, no watermarks."
        )
    },
    "outdoor_adventure": {
        "name": "Aventura Outdoor",
        "description": "Modelo con el producto en naturaleza, aventura y libertad",
        "prompt_suffix": (
            "Model actively using the product in a stunning natural landscape: mountains, forest trail, "
            "lakeside, or desert. The scene conveys freedom, adventure, and aspiration. "
            "Dynamic composition with the model in action — hiking, exploring, or pausing to admire the view. "
            "Golden hour backlighting creating dramatic silhouette edges and warm skin tones. "
            "Outdoor gear is subtle and stylish, not overloaded. Sweat and authenticity welcome. "
            "Inspired by Patagonia, The North Face, and REI campaigns. "
            "Shot with Nikon Z8, 24-70mm f/2.8. 8K resolution. No text, no watermarks."
        )
    },
    "cafe_social": {
        "name": "Cafe & Social",
        "description": "Modelo en un cafe o espacio social usando el producto",
        "prompt_suffix": (
            "Model sitting in a stylish artisan cafe or co-working space, naturally interacting with the product. "
            "Scene includes authentic details: latte art, laptop, notebook, exposed brick, hanging plants. "
            "The model is focused, content, and effortlessly stylish. Candid mid-conversation or mid-thought moment. "
            "Soft ambient lighting from large windows, bokeh from background patrons and warm pendant lights. "
            "Lifestyle editorial quality, inspired by Blue Bottle Coffee and WeWork campaign aesthetics. "
            "Shot with Fujifilm X-T5, 56mm f/1.2, film-like color science. "
            "8K resolution. No text, no watermarks."
        )
    },
    "fitness_wellness": {
        "name": "Fitness & Wellness",
        "description": "Modelo activo/a usando el producto en contexto fitness o bienestar",
        "prompt_suffix": (
            "Athletic model using the product during or after a workout session: yoga studio, gym, "
            "running track, or meditation space. Body language conveys strength, focus, and vitality. "
            "Dewy skin with natural post-workout glow, dynamic pose showing the product in action. "
            "Clean, minimal environment with motivational atmosphere. "
            "Dramatic directional lighting highlighting muscle definition and product details. "
            "Inspired by Lululemon, Alo Yoga, and Under Armour campaign photography. "
            "Shot with Canon R5, 70-200mm f/2.8 for compression and bokeh. "
            "8K resolution. No text, no watermarks."
        )
    },
    "professional_workspace": {
        "name": "Workspace Pro",
        "description": "Modelo profesional usando el producto en oficina o estudio",
        "prompt_suffix": (
            "Professional model using the product in a sleek, modern workspace or creative studio. "
            "Clean desk setup, premium materials: walnut desk, leather chair, brass accents. "
            "The model is focused, competent, and stylishly dressed in smart casual. "
            "Natural side lighting from floor-to-ceiling windows with city view or greenery. "
            "The product is integrated naturally into the workflow — not posed but discovered. "
            "Corporate-editorial hybrid style, inspired by Apple, Herman Miller, and Beats campaigns. "
            "Shot with Hasselblad X2D, 80mm f/1.9. 8K resolution. No text, no watermarks."
        )
    },
    "night_out": {
        "name": "Night Out",
        "description": "Modelo con el producto en una salida nocturna elegante",
        "prompt_suffix": (
            "Model using the product during an elevated night out: rooftop bar, art gallery opening, "
            "upscale restaurant, or city nightscape. Glamorous but not overdone. "
            "Dramatic low-light photography: neon reflections, candlelight, bokeh from city lights. "
            "The model is confident, magnetic, and the product is a natural extension of their style. "
            "Rich, moody color palette: deep blues, warm ambers, subtle magentas. "
            "Inspired by Tom Ford, YSL, and Hennessy campaign aesthetics. "
            "Shot with Sony A7S III, 50mm f/1.2, ISO 3200 for beautiful grain. "
            "8K resolution. No text, no watermarks."
        )
    },
    "beach_summer": {
        "name": "Beach & Verano",
        "description": "Modelo con el producto en playa o ambiente veraniego",
        "prompt_suffix": (
            "Model using the product on a pristine beach, poolside, or tropical setting. "
            "Sun-kissed skin, natural wind-swept hair, relaxed genuine smile. "
            "Crystal clear water, white sand, palm fronds framing the composition. "
            "Harsh midday sun tamed with reflectors creating soft fill, or golden hour warmth. "
            "The product is the natural companion to this aspirational summer moment. "
            "Inspired by Dior, Chanel, and Zimmermann resort campaigns. "
            "Shot with Canon R6 II, 85mm f/1.2, vivid color profile. "
            "8K resolution. No text, no watermarks."
        )
    }
}


def get_model_shoot_templates():
    """Return model shoot templates for API."""
    return [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in MODEL_SHOOT_TEMPLATES.items()
    ]


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
        brand_context = self._build_brand_context(brand_dna)

        final_prompt = (
            f"Create a photorealistic commercial product photograph of: {product_description}. "
            f"The product must be the absolute hero of the image, perfectly lit and in sharp focus. "
        )
        if brand_context:
            final_prompt += f"BRAND IDENTITY: {brand_context}. The image must reflect these brand attributes in color temperature, mood, and styling. "
        if custom_prompt:
            final_prompt += f"CREATIVE DIRECTION: {custom_prompt}. "
        final_prompt += f"TECHNICAL EXECUTION: {tmpl['prompt_suffix']}"

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

    # ==================== MODEL SHOOT ====================

    async def model_shoot(
        self,
        product_image_url: str,
        product_name: str,
        model_image_url: str = None,
        template: str = "urban_street",
        brand_dna: Dict = None,
        custom_prompt: str = None,
        model_tier: str = None
    ) -> Dict[str, Any]:
        """
        Generate a product shot with a human model wearing/using the product.
        The model's face and body are replicated from the reference photo.
        The prompt adapts dynamically to the product type (clothing, shoes, accessories, etc.)
        """
        if template not in MODEL_SHOOT_TEMPLATES:
            template = "urban_street"

        tmpl = MODEL_SHOOT_TEMPLATES[template]

        # 1. Deep product analysis — what IS it and how should a person interact with it?
        product_analysis = await self._analyze_product_for_model_shoot(product_image_url, product_name)

        # 2. Deep model analysis — exact face, body, style replication
        model_description = ""
        if model_image_url and self.google_client:
            model_description = await self._analyze_model_reference(model_image_url)

        # 3. Build context-aware prompt
        brand_context = self._build_brand_context(brand_dna)

        # Core prompt — adapts to product type
        final_prompt = (
            f"Create a photorealistic commercial photograph. "
            f"PRODUCT: {product_analysis['description']}. "
            f"PRODUCT INTERACTION: {product_analysis['interaction_instruction']}. "
        )

        # Model identity — exact replication
        if model_description:
            final_prompt += (
                f"MODEL IDENTITY (MUST REPLICATE EXACTLY): {model_description}. "
                f"The model in the generated image MUST have the EXACT same face, facial features, "
                f"skin tone, hair color, hair style, and body proportions as described. "
                f"DO NOT change the model's appearance — only change their outfit/accessories "
                f"based on the product. "
            )

        # Product-specific wearing/usage instruction
        final_prompt += f"{product_analysis['wearing_instruction']} "

        if brand_context:
            final_prompt += f"BRAND AESTHETIC: {brand_context}. "
        if custom_prompt:
            final_prompt += f"CREATIVE DIRECTION: {custom_prompt}. "
        final_prompt += f"SCENE & TECHNICAL: {tmpl['prompt_suffix']}"

        # 4. Generate
        image_url = await generate_image(final_prompt, model_tier=model_tier, google_api_key=self.google_api_key)

        return {
            "image_url": image_url,
            "template": template,
            "template_name": tmpl["name"],
            "model_tier": model_tier or "nano-banana",
            "prompt_used": final_prompt,
            "product_name": product_name,
            "product_description": product_analysis["description"],
            "product_category": product_analysis["category"],
            "model_description": model_description or None
        }

    async def _analyze_product_for_model_shoot(self, image_url: str, product_name: str) -> Dict:
        """
        Deep analysis of the product to determine how a model should interact with it.
        Returns category, description, and specific wearing/holding instructions.
        """
        if not self.google_client:
            return {
                "description": product_name,
                "category": "general",
                "interaction_instruction": f"The model is using {product_name}",
                "wearing_instruction": f"The model naturally interacts with {product_name}."
            }

        try:
            from app.core.image_utils import analyze_image_with_gpt4o
            analysis_prompt = (
                f"Analyze this product image of '{product_name}'. I need you to determine:\n"
                f"1. CATEGORY: Is it clothing (top/bottom/dress/jacket/suit), footwear (sneakers/heels/boots), "
                f"accessory (watch/jewelry/bag/hat/sunglasses), cosmetics/skincare, food/drink, electronics, "
                f"home decor, or other?\n"
                f"2. DESCRIPTION: Describe the product in detail — colors, materials, style, design features.\n"
                f"3. HOW_WORN: If wearable, exactly how should the model wear it? (e.g., 'on feet' for shoes, "
                f"'on upper body' for shirts, 'on wrist' for watches, 'carried in hand' for bags, "
                f"'held/presented' for non-wearable items)\n\n"
                f"Respond in this EXACT format (3 lines, no extra text):\n"
                f"CATEGORY: [category]\n"
                f"DESCRIPTION: [detailed description]\n"
                f"HOW_WORN: [specific instruction]"
            )

            raw = await analyze_image_with_gpt4o(image_url, analysis_prompt, self.google_api_key)

            # Parse response
            lines = raw.strip().split("\n")
            category = "general"
            description = product_name
            how_worn = f"naturally interacting with {product_name}"

            for line in lines:
                line = line.strip()
                if line.upper().startswith("CATEGORY:"):
                    category = line.split(":", 1)[1].strip().lower()
                elif line.upper().startswith("DESCRIPTION:"):
                    description = line.split(":", 1)[1].strip()
                elif line.upper().startswith("HOW_WORN:"):
                    how_worn = line.split(":", 1)[1].strip()

            # Build context-aware instructions based on category
            interaction = self._build_interaction_instruction(category, description, product_name)
            wearing = self._build_wearing_instruction(category, description, product_name, how_worn)

            return {
                "description": description,
                "category": category,
                "interaction_instruction": interaction,
                "wearing_instruction": wearing
            }
        except Exception as e:
            logger.warning("product_model_shoot_analysis_failed", error=str(e))
            return {
                "description": product_name,
                "category": "general",
                "interaction_instruction": f"The model is presenting {product_name}",
                "wearing_instruction": f"The model naturally interacts with {product_name}."
            }

    def _build_interaction_instruction(self, category: str, description: str, name: str) -> str:
        """Build how the model should interact based on product category."""
        if any(w in category for w in ["clothing", "top", "bottom", "dress", "jacket", "shirt", "pants", "remera"]):
            return f"The model is WEARING this {name} as clothing. It must be visible on their body, properly fitted and styled."
        elif any(w in category for w in ["footwear", "shoe", "sneaker", "boot", "heel", "zapatilla", "zapato"]):
            return f"The model is WEARING these {name} on their feet. The shoes must be clearly visible and in focus."
        elif any(w in category for w in ["watch", "jewelry", "ring", "necklace", "bracelet", "earring"]):
            return f"The model is WEARING this {name} as jewelry/accessory. It must be visible and highlighted."
        elif any(w in category for w in ["bag", "purse", "backpack", "cartera", "mochila"]):
            return f"The model is CARRYING this {name}. It should be held naturally or worn on the shoulder."
        elif any(w in category for w in ["hat", "cap", "sunglasses", "glasses", "gorra", "lentes"]):
            return f"The model is WEARING this {name} on their head/face. It must be the focal accessory."
        elif any(w in category for w in ["cosmetic", "skincare", "beauty", "perfume", "makeup"]):
            return f"The model is HOLDING and PRESENTING this {name} near their face/hands, showing the product elegantly."
        elif any(w in category for w in ["food", "drink", "beverage"]):
            return f"The model is ENJOYING/CONSUMING this {name}. Natural, appetizing moment of consumption."
        elif any(w in category for w in ["electronic", "phone", "laptop", "gadget", "tech"]):
            return f"The model is USING this {name} naturally in context. The device screen or product is visible."
        else:
            return f"The model is HOLDING and PRESENTING this {name}, showing it to camera while interacting naturally."

    def _build_wearing_instruction(self, category: str, description: str, name: str, how_worn: str) -> str:
        """Build specific wearing/styling instructions."""
        if any(w in category for w in ["clothing", "top", "bottom", "dress", "jacket", "shirt", "pants", "remera"]):
            return (
                f"CRITICAL WARDROBE: The model MUST be wearing this exact product: {description}. "
                f"The {name} is the MAIN garment — it must be clearly visible, properly fitted on the model's body. "
                f"Style the rest of the outfit to complement the product without competing. "
                f"The product garment must be recognizable — same colors, design, and details as the original."
            )
        elif any(w in category for w in ["footwear", "shoe", "sneaker", "boot", "heel", "zapatilla", "zapato"]):
            return (
                f"CRITICAL FOOTWEAR: The model MUST be wearing this exact product on their feet: {description}. "
                f"Frame the shot to clearly show the shoes — ankle-down detail or full body with visible feet. "
                f"The {name} must be recognizable — same colors, sole, design details as the original product. "
                f"Pair with complementary clothing that doesn't distract from the shoes."
            )
        elif any(w in category for w in ["bag", "purse", "backpack", "cartera", "mochila"]):
            return (
                f"CRITICAL ACCESSORY: The model MUST be carrying/wearing this exact product: {description}. "
                f"The {name} is prominently visible — held in hand, on shoulder, or worn naturally. "
                f"Same colors, texture, hardware, and design details as the original product."
            )
        else:
            return (
                f"PRODUCT PLACEMENT: The model must be {how_worn} with this exact product: {description}. "
                f"The {name} is the HERO of the image — in sharp focus and prominently displayed. "
                f"The product must be recognizable — same colors and details as the original."
            )

    async def _analyze_model_reference(self, model_image_url: str) -> str:
        """
        Deep analysis of model reference photo for exact face/body replication.
        """
        if not self.google_client:
            return ""

        try:
            from app.core.image_utils import analyze_image_with_gpt4o
            prompt = (
                "You are a professional casting director describing a model for an exact photographic replication. "
                "Analyze this person's photo and describe them with EXTREME precision so another artist can "
                "recreate their EXACT appearance. Include ALL of the following:\n\n"
                "FACE: Face shape (oval/round/square/heart), forehead size, eyebrow shape and thickness, "
                "eye shape and color, nose shape and size, lip shape and fullness, jawline definition, "
                "cheekbone prominence, any distinctive features (dimples, freckles, moles, beauty marks).\n\n"
                "HAIR: Exact color (not just 'brown' — be specific like 'warm chestnut brown with caramel highlights'), "
                "texture (straight/wavy/curly/coily), length, style, parting, volume.\n\n"
                "SKIN: Exact skin tone (use Fitzpatrick scale or precise description like 'warm olive with golden undertones'), "
                "skin texture, any visible features.\n\n"
                "BODY: Approximate height impression (tall/average/petite), body type (athletic/slim/curvy/muscular), "
                "shoulder width, proportions.\n\n"
                "VIBE: Overall energy (confident/relaxed/elegant/edgy/warm/professional), "
                "apparent age range, gender expression.\n\n"
                "Output a SINGLE detailed paragraph. Do NOT include what they are wearing — "
                "only describe the PERSON themselves (face, hair, skin, body, vibe)."
            )
            return await analyze_image_with_gpt4o(model_image_url, prompt, self.google_api_key)
        except Exception as e:
            logger.warning("model_reference_analysis_failed", error=str(e))
            return ""

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

        # 3. Generate campaign assets for all channels in parallel
        import asyncio

        valid_channels = [(k, CAMPAIGN_CHANNELS[k]) for k in channels if k in CAMPAIGN_CHANNELS]

        async def _generate_channel(channel_key: str, channel: Dict) -> Dict:
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

            # Generate campaign image optimized for the channel
            image_url = None
            if product_image_url:
                img_prompt = (
                    f"Create a high-converting {channel['name']} advertisement image for {product_name}. "
                    f"Product: {product_desc}. "
                    f"Campaign objective: {campaign_goal}. "
                    f"The image must stop the scroll — visually striking, emotionally compelling, and conversion-optimized. "
                    f"Use proven advertising composition: rule of thirds, clear visual hierarchy, product as hero element. "
                    f"Lighting is cinematic and premium. Colors evoke the desired emotion for {campaign_goal}. "
                )
                if brand_context:
                    img_prompt += f"BRAND IDENTITY: {brand_context}. "
                if custom_prompt:
                    img_prompt += f"CREATIVE DIRECTION: {custom_prompt}. "
                img_prompt += (
                    f"Aspect ratio optimized for {channel['name']} ({channel['aspect']}). "
                    f"Professional advertising photography, magazine-quality, photorealistic, 8K. "
                    f"NO text, NO typography, NO logos, NO watermarks — text will be added in post-production."
                )
                image_url = await generate_image(img_prompt, model_tier=model_tier, google_api_key=self.google_api_key)

            return {
                "channel": channel_key,
                "channel_name": channel["name"],
                "aspect_ratio": channel["aspect"],
                "texts": texts,
                "image_url": image_url
            }

        # Run all channels in parallel
        campaign_assets = await asyncio.gather(
            *[_generate_channel(k, ch) for k, ch in valid_channels],
            return_exceptions=True
        )

        # Filter out exceptions
        campaign_assets = [
            a for a in campaign_assets
            if not isinstance(a, Exception)
        ]

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
        """Build brand context string from DNA for image generation prompts."""
        if not brand_dna:
            return ""

        parts = []

        # Colors
        colors = brand_dna.get("colors", {})
        primary = colors.get("primary", [])
        secondary = colors.get("secondary", [])
        if primary:
            parts.append(f"Brand primary colors: {', '.join(primary[:4])}")
        if secondary:
            parts.append(f"Secondary colors: {', '.join(secondary[:3])}")

        # Typography style
        typography = brand_dna.get("typography", {})
        if isinstance(typography, dict):
            font_style = typography.get("style") or typography.get("primary", "")
            if font_style:
                parts.append(f"Typography style: {font_style}")

        # Visual style
        visual = brand_dna.get("visual_style", {})
        if isinstance(visual, dict):
            photo_style = visual.get("photography_style", "")
            aesthetic = visual.get("aesthetic", "")
            mood = visual.get("mood", "")
            if photo_style:
                parts.append(f"Photography style: {photo_style}")
            if aesthetic:
                parts.append(f"Visual aesthetic: {aesthetic}")
            if mood:
                parts.append(f"Mood: {mood}")

        # Brand personality & tone
        personality = brand_dna.get("brand_personality", "")
        if personality:
            parts.append(f"Brand personality: {personality}")

        tone = brand_dna.get("tone_of_voice", "") or brand_dna.get("tone", "")
        if tone:
            parts.append(f"Tone: {tone}")

        # Target audience
        audience = brand_dna.get("target_audience", "")
        if audience:
            parts.append(f"Target audience: {audience}")

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

        goal_frameworks = {
            "vender": "Use AIDA (Attention-Interest-Desire-Action). Lead with the transformation, not the product. Create urgency without being pushy.",
            "promocion": "Lead with the offer value. Use anchoring (was $X, now $Y). Create FOMO with time-limited language. Emphasize savings percentage.",
            "lanzamiento": "Build anticipation and exclusivity. Use 'first', 'new', 'introducing'. Create a sense of being part of something new. Emphasize innovation.",
            "engagement": "Ask provocative questions. Use 'you' language. Create debate or emotional resonance. Optimize for comments and shares, not clicks.",
            "branding": "Focus on brand values and emotional connection. Tell a micro-story. Use sensory language. Make the audience feel, not think."
        }
        framework = goal_frameworks.get(campaign_goal, goal_frameworks["vender"])

        prompt = f"""You are a senior copywriter at a top advertising agency (Ogilvy, Wieden+Kennedy level).
Generate {num_variations} high-converting copy variations for a {channel['name']} campaign.

PRODUCT: {product_name}
PRODUCT DETAILS: {product_desc}
CAMPAIGN OBJECTIVE: {campaign_goal}
CHANNEL: {channel['name']}
CHARACTER LIMIT: ~{channel['max_text']} characters for body text
BRAND CONTEXT: {brand_context}
{f'CREATIVE BRIEF: {custom_prompt}' if custom_prompt else ''}

COPYWRITING FRAMEWORK: {framework}

RULES:
- Headlines must be punchy, benefit-driven, max 8 words. Use power words that trigger emotion.
- Body copy must be scannable, conversational, and end with a clear reason to act NOW.
- CTAs must be specific and action-oriented (not generic "Learn more" — use "Get yours today", "Claim 50% off", etc.)
- Each variation must have a different angle/hook (emotional, rational, social proof, urgency, curiosity).
- Write in Spanish (Latin America) unless brand context indicates otherwise.
- Hashtags must be a mix of high-volume and niche-specific.

Respond ONLY with a JSON array:
[
  {{
    "headline": "punchy headline here",
    "body": "compelling body copy",
    "cta": "specific call to action",
    "hashtags": ["#relevant", "#niche", "#branded"]
  }}
]

NO markdown, NO explanation, ONLY the JSON array."""

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
