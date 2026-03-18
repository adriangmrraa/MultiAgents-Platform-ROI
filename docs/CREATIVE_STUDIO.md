# Future Platform — Creative Studio (Business Forge)

## Overview

The Creative Studio allows tenants to generate professional marketing content using AI. It includes brand identity extraction, product photography, model shoots, and multi-channel campaign generation.

## Features

### Brand DNA Extraction
- Analyzes tenant's website + TiendaNube catalog
- Extracts: colors, typography, tone of voice, visual style, target audience
- Stored as `brand_dna` asset in `business_assets`
- Used to enhance all subsequent AI generations

### Photoshoot Studio
5 scene templates for product photography:
- **Studio** — clean white/gradient background
- **Floating** — levitation effect
- **Lifestyle** — contextual environment
- **In Use** — product being used
- **Ingredient** — deconstructed/components view

### Model Shoot
8 scene templates with AI-generated models:
- Various settings (urban, nature, studio, etc.)
- Supports reference photo for model appearance
- Brand DNA applied to styling

### Campaign Generator
Multi-channel content generation:
- Instagram (post + story)
- Facebook (post + ad)
- WhatsApp (message + status)
- Email (subject + body)
- Web (banner + CTA)

### AI Prompt Enhancer
Transforms simple descriptions into professional prompts using Brand DNA context.

## Image Generation Models

| Model | Cost/Image | Quality |
|-------|-----------|---------|
| Gemini 3.1-flash-image-preview | ~$0.04 | Good |
| Gemini 3-pro-image-preview | ~$0.07 | High |

## BYOK (Bring Your Own Key)

Each tenant uses their own Google API key for image generation. Keys are stored encrypted in the credential vault.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gallery/brand-dna` | POST | Extract brand DNA from website |
| `/gallery/photoshoot` | POST | Generate product photos |
| `/gallery/model-shoot` | POST | Generate model scenes |
| `/gallery/campaign` | POST | Generate multi-channel campaign |
| `/gallery/enhance-prompt` | POST | AI prompt enhancement |
| `/gallery/edit-image` | POST | Edit generated image |
| `/gallery/assets` | GET | List tenant gallery assets |
| `/gallery/assets/{id}` | DELETE | Delete asset |
