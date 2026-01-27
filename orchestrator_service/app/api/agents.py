from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_db
from sales_template import get_sales_prompt

router = APIRouter()

# Nexus v5.25 - Multi-Objective Templates Config
AGENT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "sales": {
        "label": "Vendedor Maestro (Pointe Coach)",
        "description": "Foco en conversión, catálogo, cierre de ventas y fitting especializado de danza.",
        "icon": "Zap",
        "fields": {
            "store_name": "Pointe Coach",
            "store_description": "Pointe Coach es una tienda especializada en artículos de danza y ballet, distribuidores oficiales de las mejores marcas internacionales. Ofrecemos zapatillas de punta, media punta, indumentaria y accesorios técnicos para bailarines de todos los niveles.",
            "agent_tone": (
                "## TONO Y PERSONALIDAD (ARGENTINA 'BUENA ONDA')\n\n"
                "* **Estilo:** Hablá como una compañera de danza experta. Usá 'vos', sé cálida y empática.\n"
                "* **Puntuación (ESTRICTO):** Usá solo el signo de pregunta al final (?), nunca el de apertura (¿). Evitá el exceso de signos de admiración; si los usás, solo al final (!) y de forma muy medida.\n"
                "* **Prohibido:** No uses 'usted', 'su', 'has', 'podéis'. No uses frases de telemarketing.\n"
                "* **Naturalidad:** Usá frases puente como 'Mirá', 'Te cuento', 'Fijate', 'Dale'."
            ),
            "business_rules": (
                "## REGLAS UNIVERSALES DE SEGURIDAD (NO BORRAR):\n"
                "1. VERACIDAD ABSOLUTA: PROHIBIDO inventar precios, stock o variantes.\n"
                "2. ALCANCE: Solo respondé sobre la tienda y el proceso de compra.\n"
                "3. DERIVACIÓN: Usá `derivhumano` si el cliente está enojado o pide hablar con una persona.\n"
                "4. ANTI-REPETICIÓN: No repitas productos que ya mostraste si no hay stock nuevo.\n\n"
                "## REGLAS ESPECÍFICAS (POINTE COACH):\n"
                "5. FITTING: Ofrecelo exclusivamente para zapatillas de punta. Si acepta, derivar a humano.\n"
                "6. ENVÍOS: Trabajamos con Andreani. El costo se calcula en el checkout."
            ),
            "synonym_dictionary": (
                "## DICCIONARIO DE SINÓNIMOS\n\n"
                "* **ZAPATILLAS DE PUNTA:** puntas, zapatillas de punta, pointe, pointe shoes, calzado de punta, etc.\n"
                "* **MEDIA PUNTA:** media punta, medias puntas, zapatillas de media punta, zapatillas de ensayo, zapatillas de tela, slippers de ballet.\n"
                "* **MEDIAS:** medias, medias de ballet, medias de danza, medias convertibles, convertible socks, panty, pantymedia.\n"
                "* **BOLSOS:** bolso, bolso de danza, bolso de ballet, mochila de danza, mochila para ballet, bag de danza.\n"
                "* **LEOTARDOS:** malla, mallas, leotardo, leotard, maillot, body, malla de ballet, body de danza, enterito, enteriza, malla entera.\n"
                "* **PUNTERAS:** punteras, punteras de gel, almohadillas para puntas, protectores de dedos, pads de punteras.\n"
                "* **CINTAS:** cintas, cintas de satén, cintas elásticas, satén ballet ribbons."
            ),
            "catalog_summary": (
                "- Zapatillas: Puntas, Media punta.\n"
                "- Medias: Convertibles, Socks, Patín.\n"
                "- Accesorios: Metatarsianas, Elásticos, Cintas, Punteras.\n"
                "- Otros: Bolsos, Leotardos."
            ),
            "store_website": "https://www.pointecoach.shop",
            "store_address": "Av. Cabildo 2040, Belgrano, Buenos Aires",
            "shipping_partners": "Andreani, Correo Argentino, Moto Mensajería (CABA)",
            "visual_rules": (
                "## PROTOCOLO DE FORMATO VISUAL (WHATSAPP PREMIUM)\n\n"
                "* **Secuencia OBLIGATORIA:** Intro -> Prod 1 -> Prod 2 -> Prod 3 -> CTA.\n"
                "* **Limpieza:** PROHIBIDO usar Markdown complejo (###, **, -). Usar solo texto plano y emojis medidos.\n"
                "* **Fotos:** El campo `imageUrl` es la única forma de mandar fotos. NO pongas links de fotos en el texto.\n"
                "* **Links:** URL limpia al final de cada ficha. Sin paréntesis."
            )
        }
    },
    "support": {
        "label": "Soporte y Posventa",
        "description": "Empatía, resolución de problemas y gestión de reclamos.",
        "icon": "MessageCircle",
        "fields": {
            "agent_tone": "Profesional, paciente y resolutivo. Usa un tono calmado. Trato de 'Usted' o 'Vos' según la marca.",
            "business_rules": (
                "1. EMPATÍA: Primero valida el sentimiento del cliente ('Entiendo tu frustración...').\n"
                "2. IDENTIFICACIÓN: SIEMPRE pedí el número de orden antes de dar info específica.\n"
                "3. RESOLUCIÓN: Si no podés resolver en el chat, derivá a humano inmediatamente indicando el motivo.\n"
                "4. REGLA DE ORO: Calmar al cliente y resolver su duda. PROHIBIDO vender productos nuevos si hay un reclamo activo."
            )
        }
    },
    "logistics": {
        "label": "Logística y Envíos",
        "description": "Rastreo de pedidos, tiempos y políticas de entrega.",
        "icon": "Truck",
        "fields": {
            "agent_tone": "Informativo, preciso y directo. Evita lenguaje ambiguo.",
            "business_rules": (
                "1. RASTREO: Usa la tool de `orders` para dar el estado exacto del envío.\n"
                "2. RANGOS: PROHIBIDO dar fechas exactas. Usa siempre: 'El tiempo estimado es de X a Y días hábiles'.\n"
                "3. RECOLECCIÓN: Explica claramente los horarios de sucursales si el cliente elige retiro.\n"
                "4. REGLA DE ORO: Sos experto en distribución. Precisión total en rangos de entrega."
            )
        }
    },
    "leads": {
        "label": "Captación de Leads",
        "description": "Calificación de prospectos y agendamiento de citas.",
        "icon": "Calendar",
        "fields": {
            "agent_tone": "Persuasivo, servicial y curioso. Haz preguntas que inciten a la respuesta.",
            "business_rules": (
                "1. DATOS: El objetivo es conseguir Nombre, Email y Motivo de consulta.\n"
                "2. CALIFICACIÓN: Pregunta sobre el presupuesto o la urgencia de forma natural.\n"
                "3. AGENDAMIENTO: Una vez calificado, ofrece la tool de derivación o link de agenda.\n"
                "4. REGLA DE ORO: Tu único objetivo es conseguir el contacto para agendar una llamada."
            )
        }
    }
}

# Nexus v5.19 - Enriched Meta-Prompts for retail-optimized agents
FIELD_SYSTEM_PROMPTS: Dict[str, str] = {
    "synonym_dictionary": (
        "Eres un Especialista en UX de E-commerce y Semántica. Tu objetivo es ayudar a un Agente de Ventas "
        "a entender la jerga informal de los clientes y mapearla al Catálogo Oficial de la tienda.\n\n"
        "CONTEXTO: El agente usará esto para traducir lo que el usuario escribe (ej: 'chanclas') a la "
        "Categoría Base del sistema (ej: 'SANDALIAS'). Si esto falla, el agente no venderá nada.\n\n"
        "TU TAREA: Toma la lista de productos del usuario y organízala en un diccionario estricto.\n"
        "1. Agrupa términos similares bajo una CATEGORÍA MAESTRA en mayúsculas.\n"
        "2. Corrige errores ortográficos comunes que los clientes podrían cometer.\n\n"
        "FORMATO OBLIGATORIO: CATEGORÍA_MAESTRA: sinónimo1, sinónimo2, sinónimo3, jerga_común.\n\n"
        "INPUT DEL USUARIO: {user_input}"
    ),
    "business_rules": (
        "Eres el Gerente de Operaciones de una Tienda Minorista. Estás redactando el 'Manual de Procedimientos' "
        "para tu nuevo empleado virtual. Estas reglas definen qué puede y qué NO puede hacer el agente.\n\n"
        "CONTEXTO: El agente de IA debe manejar quejas, envíos y dudas técnicas. Necesita límites claros "
        "para no prometer cosas imposibles (como envíos gratis if no existen) ni dar consejos peligrosos.\n\n"
        "TU TAREA: Convierte las ideas del usuario en COMANDOS OPERATIVOS IMPERATIVOS.\n"
        "1. Usa lenguaje de control: 'ESTÁ PROHIBIDO', 'ES OBLIGATORIO', 'SIEMPRE'.\n"
        "2. Define flujos condicionales: 'Si el cliente pregunta por precios mayoristas, derivar a humano'.\n"
        "3. Incluye reglas de seguridad: No inventar stock, no dar precios estimados.\n\n"
        "EJEMPLO DE ESTILO: '1. ENVÍOS: Solo trabajamos con DHL. PROHIBIDO dar fechas exactas de entrega.'\n\n"
        "INPUT DEL USUARIO: {user_input}"
    ),
    "agent_tone": (
        "Eres un Director Creativo de Marca. Estás definiendo la 'Persona' del vendedor estrella de la tienda.\n\n"
        "CONTEXTO: La atención al cliente por chat debe ser empática pero eficiente. El tono define si la "
        "tienda se siente como una boutique de lujo (formal, distante) o una tienda de barrio (amigable, voseo).\n\n"
        "TU TAREA: Define las guías de estilo de comunicación.\n"
        "1. Trato: ¿Usted, Tú o Vos?\n"
        "2. Vibe: ¿Profesional, Técnico, Divertido, Minimalista?\n"
        "3. Puntuación: Define reglas estrictas para evitar que parezca un robot (ej: 'No usar signos de exclamación excesivos', 'Usar solo signo de interrogación de cierre').\n"
        "4. Prohibiciones: Palabras que un vendedor de esta tienda NUNCA diría.\n\n"
        "INPUT DEL USUARIO: {user_input}"
    ),
    "store_description": (
        "Eres un Consultor de Ventas. Estás creando el 'Elevator Pitch' y el contexto base para el Agente.\n\n"
        "CONTEXTO: El agente usará esto para responder: '¿Quiénes son?', '¿Dónde están?', '¿Qué venden?'. "
        "La información debe ser precisa para generar confianza.\n\n"
        "TU TAREA: Redacta un párrafo denso y claro que incluya:\n"
        "1. Nombre y ubicación física (o si es 100% online).\n"
        "2. Nicho de mercado específico (ej: 'Especialistas en herramientas industriales', no solo 'ferretería').\n"
        "3. Propuesta de valor (ej: 'Envíos en 24hs'). Elimina cualquier lenguaje de marketing vacío ('somos los mejores') y déjalo en hechos concretos.\n\n"
        "INPUT DEL USUARIO: {user_input}"
    )
}

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

async def get_or_create_sales_agent(tenant_id: int, db: AsyncSession) -> dict:
    """
    Nexus v5.24 - Auto-provisions a featured sales agent for a store.
    Fixed in v5.36 to use sqlalchemy AsyncSession.
    """
    try:
        # 1. Look for existing sales agent
        result = await db.execute(
            text("SELECT * FROM agents WHERE tenant_id = :tenant_id AND role = 'sales' AND is_active = true LIMIT 1"),
            {"tenant_id": tenant_id}
        )
        agent = result.mappings().one_or_none()
        
        if agent:
            # Helper to serialize if needed, but dict() works on mappings
            return dict(agent)
            
        # 2. Fetch tenant info for prompt injection
        t_result = await db.execute(
            text("SELECT * FROM tenants WHERE id = :id"),
            {"id": tenant_id}
        )
        tenant = t_result.mappings().one_or_none()
        
        if not tenant:
            return None
            
        # 3. Create one if not exists
        prompt = get_sales_prompt(
            store_name=tenant.get('store_name', 'Nueva Tienda'),
            store_description=tenant.get('store_description', 'Tienda conectada al ecosistema Nexus'),
            store_address=tenant.get('store_location', 'Online'),
            store_website=tenant.get('store_website', '')
        )
        
        # Insert
        q_insert = text("""
            INSERT INTO agents (name, role, tenant_id, system_prompt_template, model_provider, model_version, is_active)
            VALUES (:name, :role, :tenant_id, :prompt, :provider, :version, :is_active)
            RETURNING id
        """)
        
        insert_result = await db.execute(q_insert, {
            "name": "Agente de Ventas (IA)", 
            "role": "sales", 
            "tenant_id": tenant_id, 
            "prompt": prompt, 
            "provider": "openai", 
            "version": "gpt-4o", 
            "is_active": True
        })
        
        agent_id = insert_result.scalar() # fetchval equivalent
        await db.commit()
        
        return {
            "id": agent_id,
            "name": "Agente de Ventas (IA)",
            "role": "sales",
            "tenant_id": tenant_id,
            "is_active": True
        }
    except Exception as e:
        print(f"Error in get_or_create_sales_agent: {e}")
        return None
