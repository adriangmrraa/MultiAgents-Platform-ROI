"""
Brand DNA Extractor
Inspired by Google Pomelli's Business DNA feature.
Scans a store's website + TiendaNube API to extract:
- Color palette (from CSS, images, meta tags)
- Typography (Google Fonts, CSS font-family)
- Logo (Open Graph, favicon, TiendaNube API)
- Tone of voice (analyzed by Gemini from page text)
- Visual style (imagery patterns, photography style)
- Brand keywords & messaging patterns
"""
import re
import json
import structlog
import httpx
from typing import Dict, Any, Optional, List
from bs4 import BeautifulSoup
from collections import Counter

logger = structlog.get_logger()


class BrandDNAExtractor:
    """Extracts brand identity from a store's web presence."""

    def __init__(self, google_api_key: str = None):
        from app.core.image_utils import get_google_client
        self.google_client = get_google_client(google_api_key)

    async def extract(
        self,
        website_url: str = None,
        tiendanube_data: Dict = None,
        store_name: str = None,
        store_description: str = None
    ) -> Dict[str, Any]:
        """
        Full Brand DNA extraction pipeline.
        Combines web scraping + TiendaNube data + AI analysis.
        """
        dna = {
            "store_name": store_name or "",
            "colors": {"primary": [], "secondary": [], "background": [], "text": []},
            "typography": {"fonts": [], "heading_font": None, "body_font": None},
            "logo": {"url": None, "favicon": None},
            "tone_of_voice": {"style": "", "keywords": [], "formality": "neutral"},
            "visual_style": {"photography_style": "", "imagery_patterns": []},
            "messaging": {"tagline": "", "key_messages": [], "value_proposition": ""},
            "social_links": {},
            "meta": {"title": "", "description": "", "og_image": ""},
            "raw_text_sample": ""
        }

        # 1. Scrape website
        if website_url:
            web_data = await self._scrape_website(website_url)
            if web_data:
                dna = self._merge_web_data(dna, web_data)

        # 2. TiendaNube API data
        if tiendanube_data:
            dna = self._merge_tiendanube_data(dna, tiendanube_data)

        # 3. Store info fallbacks
        if store_name and not dna["store_name"]:
            dna["store_name"] = store_name
        if store_description:
            dna["messaging"]["value_proposition"] = store_description

        # 4. AI Analysis (tone of voice, visual style, messaging)
        if self.google_client and dna.get("raw_text_sample"):
            ai_analysis = await self._ai_analyze_brand(dna)
            if ai_analysis:
                dna = self._merge_ai_analysis(dna, ai_analysis)

        # Clean up
        dna.pop("raw_text_sample", None)

        return dna

    async def _scrape_website(self, url: str) -> Optional[Dict]:
        """Scrape website for brand elements."""
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; BrandDNA/1.0)"
                })
                if resp.status_code != 200:
                    logger.warning("brand_dna_scrape_failed", url=url, status=resp.status_code)
                    return None

            html = resp.text
            soup = BeautifulSoup(html, "html.parser")

            result = {
                "colors": self._extract_colors(html, soup),
                "fonts": self._extract_fonts(html, soup),
                "logo": self._extract_logo(soup, url),
                "meta": self._extract_meta(soup),
                "social_links": self._extract_social_links(soup),
                "text_sample": self._extract_text_sample(soup)
            }

            return result

        except Exception as e:
            logger.error("brand_dna_scrape_error", url=url, error=str(e))
            return None

    def _extract_colors(self, html: str, soup: BeautifulSoup) -> Dict:
        """Extract color palette from CSS and inline styles."""
        colors = {"primary": [], "secondary": [], "background": [], "text": []}

        # Extract all hex colors from CSS
        hex_pattern = r'#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b'
        all_hex = re.findall(hex_pattern, html)
        # Normalize to 6-char hex
        normalized = []
        for h in all_hex:
            if len(h) == 4:  # #abc -> #aabbcc
                h = f"#{h[1]*2}{h[2]*2}{h[3]*2}"
            normalized.append(h.lower())

        # Count frequency
        color_counts = Counter(normalized)
        # Filter out common defaults
        defaults = {'#ffffff', '#000000', '#fff', '#000', '#333333', '#666666', '#999999', '#cccccc'}
        filtered = {c: n for c, n in color_counts.items() if c not in defaults and n > 1}

        sorted_colors = sorted(filtered.items(), key=lambda x: -x[1])

        # Assign by frequency
        if sorted_colors:
            colors["primary"] = [sorted_colors[0][0]]
        if len(sorted_colors) > 1:
            colors["secondary"] = [c[0] for c in sorted_colors[1:4]]

        # Extract rgb/rgba colors
        rgb_pattern = r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)'
        rgb_matches = re.findall(rgb_pattern, html)
        for r, g, b in rgb_matches[:5]:
            hex_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
            if hex_color not in defaults:
                if hex_color not in colors["primary"] + colors["secondary"]:
                    colors["secondary"].append(hex_color)

        # CSS custom properties (--brand-color, --primary, etc.)
        css_var_pattern = r'--(?:brand|primary|accent|main|theme)[^:]*:\s*([^;]+)'
        css_vars = re.findall(css_var_pattern, html, re.IGNORECASE)
        for val in css_vars:
            val = val.strip()
            if val.startswith('#'):
                if val.lower() not in colors["primary"]:
                    colors["primary"].insert(0, val.lower())

        # Background colors from body/main elements
        body = soup.find('body')
        if body and body.get('style'):
            bg_match = re.search(r'background(?:-color)?:\s*([^;]+)', body['style'])
            if bg_match:
                colors["background"].append(bg_match.group(1).strip())

        return colors

    def _extract_fonts(self, html: str, soup: BeautifulSoup) -> List[str]:
        """Extract typography from Google Fonts links and CSS."""
        fonts = set()

        # Google Fonts links
        for link in soup.find_all('link', href=True):
            href = link['href']
            if 'fonts.googleapis.com' in href:
                # Extract font families from URL
                family_match = re.findall(r'family=([^&:]+)', href)
                for fam in family_match:
                    for f in fam.split('|'):
                        fonts.add(f.replace('+', ' ').split(':')[0])

        # CSS font-family declarations
        font_family_pattern = r"font-family:\s*['\"]?([^;'\"]+)"
        css_fonts = re.findall(font_family_pattern, html)
        for ff in css_fonts:
            # Take first font in stack
            first_font = ff.split(',')[0].strip().strip("'\"")
            if first_font.lower() not in ('serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'inherit', 'initial'):
                fonts.add(first_font)

        # @font-face declarations
        font_face_pattern = r"@font-face\s*\{[^}]*font-family:\s*['\"]?([^;'\"]+)"
        face_fonts = re.findall(font_face_pattern, html)
        for ff in face_fonts:
            fonts.add(ff.strip().strip("'\""))

        return list(fonts)[:8]

    def _extract_logo(self, soup: BeautifulSoup, base_url: str) -> Dict:
        """Extract logo URL from various sources."""
        logo = {"url": None, "favicon": None}

        # Open Graph image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            logo["url"] = self._resolve_url(og_image['content'], base_url)

        # Logo in img tags (common patterns)
        for img in soup.find_all('img'):
            src = img.get('src', '')
            alt = (img.get('alt', '') or '').lower()
            cls = ' '.join(img.get('class', []))

            if any(kw in src.lower() + alt + cls for kw in ['logo', 'brand', 'header-img']):
                logo["url"] = self._resolve_url(src, base_url)
                break

        # Favicon
        for link in soup.find_all('link', rel=True):
            rels = link['rel'] if isinstance(link['rel'], list) else [link['rel']]
            if any(r in ('icon', 'shortcut icon', 'apple-touch-icon') for r in rels):
                logo["favicon"] = self._resolve_url(link.get('href', ''), base_url)
                break

        return logo

    def _extract_meta(self, soup: BeautifulSoup) -> Dict:
        """Extract meta information."""
        meta = {"title": "", "description": "", "og_image": ""}

        title_tag = soup.find('title')
        if title_tag:
            meta["title"] = title_tag.get_text(strip=True)

        desc_tag = soup.find('meta', attrs={'name': 'description'})
        if desc_tag:
            meta["description"] = desc_tag.get('content', '')

        og_img = soup.find('meta', property='og:image')
        if og_img:
            meta["og_image"] = og_img.get('content', '')

        return meta

    def _extract_social_links(self, soup: BeautifulSoup) -> Dict:
        """Extract social media links."""
        social = {}
        patterns = {
            'instagram': r'instagram\.com/([^/?\s"]+)',
            'facebook': r'facebook\.com/([^/?\s"]+)',
            'twitter': r'(?:twitter|x)\.com/([^/?\s"]+)',
            'tiktok': r'tiktok\.com/@?([^/?\s"]+)',
            'youtube': r'youtube\.com/(?:channel/|@)?([^/?\s"]+)',
            'linkedin': r'linkedin\.com/(?:company/|in/)?([^/?\s"]+)'
        }

        html_str = str(soup)
        for platform, pattern in patterns.items():
            match = re.search(pattern, html_str)
            if match:
                social[platform] = match.group(1)

        return social

    def _extract_text_sample(self, soup: BeautifulSoup) -> str:
        """Extract meaningful text for tone analysis."""
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()

        text = soup.get_text(separator=' ', strip=True)
        # Clean up
        text = re.sub(r'\s+', ' ', text)
        return text[:3000]  # Limit for AI analysis

    def _resolve_url(self, url: str, base_url: str) -> str:
        """Resolve relative URLs."""
        if not url:
            return ""
        if url.startswith('http'):
            return url
        if url.startswith('//'):
            return f"https:{url}"
        if url.startswith('/'):
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            return f"{parsed.scheme}://{parsed.netloc}{url}"
        return f"{base_url.rstrip('/')}/{url}"

    def _merge_web_data(self, dna: Dict, web: Dict) -> Dict:
        """Merge web scraping results into DNA."""
        if web.get("colors"):
            dna["colors"] = web["colors"]
        if web.get("fonts"):
            dna["typography"]["fonts"] = web["fonts"]
            if web["fonts"]:
                dna["typography"]["heading_font"] = web["fonts"][0]
            if len(web["fonts"]) > 1:
                dna["typography"]["body_font"] = web["fonts"][1]
        if web.get("logo"):
            dna["logo"] = web["logo"]
        if web.get("meta"):
            dna["meta"] = web["meta"]
            if web["meta"].get("title"):
                dna["store_name"] = dna["store_name"] or web["meta"]["title"]
        if web.get("social_links"):
            dna["social_links"] = web["social_links"]
        if web.get("text_sample"):
            dna["raw_text_sample"] = web["text_sample"]
        return dna

    def _merge_tiendanube_data(self, dna: Dict, tn: Dict) -> Dict:
        """Merge TiendaNube API data into DNA."""
        if tn.get("name"):
            dna["store_name"] = tn["name"]
        if tn.get("logo"):
            dna["logo"]["url"] = dna["logo"]["url"] or tn["logo"]
        if tn.get("description"):
            dna["messaging"]["value_proposition"] = tn["description"]
        if tn.get("categories"):
            dna["messaging"]["key_messages"] = [c.get("name", {}).get("es", "") for c in tn["categories"][:10]]
        return dna

    async def _ai_analyze_brand(self, dna: Dict) -> Optional[Dict]:
        """Use Gemini to analyze brand tone, style, and messaging."""
        if not self.google_client:
            return None

        text_sample = dna.get("raw_text_sample", "")[:2000]
        colors = dna.get("colors", {})
        fonts = dna.get("typography", {}).get("fonts", [])
        store_name = dna.get("store_name", "")

        prompt = f"""Analiza la identidad de marca de "{store_name}" basandote en estos datos extraidos de su sitio web.

COLORES encontrados: {json.dumps(colors)}
TIPOGRAFIAS: {json.dumps(fonts)}
TEXTO DE LA PAGINA (muestra): {text_sample[:1500]}

Responde en JSON valido con esta estructura exacta:
{{
  "tone_of_voice": {{
    "style": "descripcion breve del estilo de comunicacion (ej: cercano y juvenil, profesional y serio, etc)",
    "keywords": ["5 palabras clave que definen la marca"],
    "formality": "casual|neutral|formal"
  }},
  "visual_style": {{
    "photography_style": "descripcion del estilo visual (ej: minimalista con fondos blancos, vibrante y colorido, etc)",
    "imagery_patterns": ["3 patrones visuales detectados"]
  }},
  "messaging": {{
    "tagline": "un tagline sugerido basado en la identidad detectada",
    "key_messages": ["3 mensajes clave de la marca"],
    "value_proposition": "propuesta de valor en 1 oracion"
  }},
  "suggested_primary_color": "#hexcolor mas representativo de la marca",
  "suggested_secondary_color": "#hexcolor secundario sugerido",
  "brand_personality": "una palabra que define la personalidad: audaz|elegante|divertida|seria|innovadora|artesanal|premium|accesible"
}}

SOLO responde con el JSON, sin texto adicional ni markdown."""

        try:
            response = self.google_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt]
            )
            text = response.text.strip()
            # Clean markdown code blocks if present
            if text.startswith('```'):
                text = re.sub(r'^```(?:json)?\n?', '', text)
                text = re.sub(r'\n?```$', '', text)

            return json.loads(text)
        except Exception as e:
            logger.error("brand_dna_ai_analysis_failed", error=str(e))
            return None

    def _merge_ai_analysis(self, dna: Dict, ai: Dict) -> Dict:
        """Merge AI analysis results."""
        if ai.get("tone_of_voice"):
            dna["tone_of_voice"] = ai["tone_of_voice"]
        if ai.get("visual_style"):
            dna["visual_style"] = ai["visual_style"]
        if ai.get("messaging"):
            for k, v in ai["messaging"].items():
                if v:
                    dna["messaging"][k] = v
        if ai.get("suggested_primary_color") and not dna["colors"]["primary"]:
            dna["colors"]["primary"] = [ai["suggested_primary_color"]]
        if ai.get("suggested_secondary_color") and not dna["colors"]["secondary"]:
            dna["colors"]["secondary"] = [ai["suggested_secondary_color"]]
        if ai.get("brand_personality"):
            dna["brand_personality"] = ai["brand_personality"]
        return dna
