import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Save, Info, Sparkles, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea';
    defaultValue: string;
    placeholder: string;
    description: string;
    rows?: number;
}

export const DynamicAgentWizard: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [schema, setSchema] = useState<FieldConfig[]>([]);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [resetFeedback, setResetFeedback] = useState<string | null>(null);
    const [improvingFields, setImprovingFields] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // In a real app, this might be a local import or an API call to a config endpoint
        // For this task, we will simulate loading the config we generated
        const loadConfig = async () => {
            try {
                // Nexus v5.16 Enriched Config Simulation
                const config = {
                    "agent_config_schema": [
                        {
                            "key": "store_name",
                            "label": "Nombre del Negocio",
                            "type": "text",
                            "defaultValue": "Pointe Coach",
                            "placeholder": "Ej: Ferrería Central",
                            "description": "El nombre oficial de tu tienda que usará el agente para presentarse."
                        },
                        {
                            "key": "store_description",
                            "label": "Descripción Comercial (Contexto)",
                            "type": "textarea",
                            "rows": 5,
                            "defaultValue": "Pointe Coach es una tienda especializada en artículos de danza y ballet, distribuidores oficiales de las mejores marcas internacionales. Ofrecemos zapatillas de punta, media punta, indumentaria y accesorios técnicos para bailarines de todos los niveles.",
                            "placeholder": "Ej: Distribuidora líder de herramientas industriales y para el hogar con más de 20 años de experiencia.",
                            "description": "El 'Quiénes Somos' que le da contexto al cerebro del agente."
                        },
                        {
                            "key": "agent_tone",
                            "label": "Personalidad / Tono",
                            "type": "textarea",
                            "rows": 15,
                            "defaultValue": "## TONO Y PERSONALIDAD (ARGENTINA 'BUENA ONDA')\n\n* **Estilo:** Hablá como una compañera de danza experta. Usá 'vos', sé cálida y empática.\n* **Puntuación (ESTRICTO):** Usá solo el signo de pregunta al final (?), nunca el de apertura (¿). Evitá el exceso de signos de admiración; si los usás, solo al final (!) y de forma muy medida.\n* **Prohibido:** No uses 'usted', 'su', 'has', 'podéis'. No uses frases de telemarketing.\n* **Naturalidad:** Usá frases puente como 'Mirá', 'Te cuento', 'Fijate', 'Dale'.\n* **Empatía:** Si el usuario te pregunta '¿Cómo estás?', respondé con calidez y preguntale a él también antes de avanzar. Si el usuario tiene dudas o problemas (talle, dolor), validá su sentimiento y ofrecé ayuda.",
                            "placeholder": "Ej: Formal, serio y profesional. Usa 'Usted' y evita modismos.",
                            "description": "Define la voz de tu marca. Copia este formato para especificar dialectos, uso de emojis y reglas de puntuación estrictas."
                        },
                        {
                            "key": "synonym_dictionary",
                            "label": "Diccionario de Sinónimos (Mapeo Inteligente)",
                            "type": "textarea",
                            "rows": 20,
                            "defaultValue": "## DICCIONARIO DE SINÓNIMOS\n\n* **ZAPATILLAS DE PUNTA:** puntas, zapatillas de punta, pointe, pointe shoes, calzado de punta, etc.\n* **MEDIA PUNTA:** media punta, medias puntas, zapatillas de media punta, zapatillas de ensayo, zapatillas de tela, slippers de ballet.\n* **MEDIAS:** medias, medias de ballet, medias de danza, medias convertibles, convertible socks, panty, pantymedia.\n* **BOLSOS:** bolso, bolso de danza, bolso de ballet, mochila de danza, mochila para ballet, bag de danza.\n* **LEOTARDOS:** malla, mallas, leotardo, leotard, maillot, body, malla de ballet, body de danza, enterito, enteriza, malla entera.\n* **PUNTERAS:** punteras, punteras de gel, almohadillas para puntas, protectores de dedos, pads de punteras.\n* **PROTECTORES DE PUNTAS:** protectores de puntas, toppers de puntas, protectores de punta de gel.\n* **METATARSIANAS:** metatarsianas, almohadillas metatarsianas, pads metatarsianas, gel metatarsianas.\n* **CINTAS:** cintas, cintas de satén, cintas elásticas, satén ballet ribbons.",
                            "placeholder": "CATEGORÍA_REAL: sinónimo1, sinónimo2",
                            "description": "CRÍTICO: El agente usa esto para entender jerga. Formato obligatorio: CATEGORÍA_REAL: sinónimo1, sinónimo2. Si tu cliente dice 'puntas', el agente buscará 'Zapatillas de Punta'."
                        },
                        {
                            "key": "business_rules",
                            "label": "Reglas de Oro del Negocio",
                            "type": "textarea",
                            "rows": 20,
                            "defaultValue": "## REGLAS UNIVERSALES DE SEGURIDAD (NO BORRAR):\n1. VERACIDAD ABSOLUTA: Está PROHIBIDO inventar precios, stock, variantes o fechas de entrega. Si la herramienta no te da el dato, decí \"No tengo esa información en este momento\" y derivá a un humano.\n2. ALCANCE: Solo respondé preguntas relacionadas con la tienda, los productos y el proceso de compra. Si te preguntan de política, religión o competencia, respondé amablemente que solo podés ayudar con productos de la tienda.\n3. DERIVACIÓN INTELIGENTE: Usá la tool `derivhumano` inmediatamente si: (A) El cliente está enojado o frustrado. (B) Hay un problema con un pago o envío demorado. (C) Piden hablar con una persona.\n4. PROMOCIONES: Solo mencioná descuentos o cupones si aparecen explícitamente en la tool `cupones_list`. No asumas que hay envíos gratis a menos que sea una regla confirmada.\n5. ANTI-REPETICIÓN: Si ya mostraste un producto y el usuario pide \"más opciones\" pero no hay más, decí la verdad. No repitas los mismos productos como si fueran nuevos.\n\n## REGLAS ESPECÍFICAS DE ESTE NEGOCIO (EJEMPLO - MODIFICAR):\n6. FITTING (EJEMPLO): Ofrecelo exclusivamente para zapatillas de punta. Si acepta, derivar a humano.\n7. ENVÍOS (EJEMPLO): Trabajamos con Andreani. El costo se calcula en el checkout.",
                            "placeholder": "1. Regla de envíos...\n2. Regla de devoluciones...",
                            "description": "Incluye reglas base de seguridad. Mantené las primeras 5 y modificá las reglas específicas (punto 6 en adelante) según tu negocio."
                        },
                        {
                            "key": "catalog_summary",
                            "label": "Resumen de Categorías",
                            "type": "textarea",
                            "rows": 8,
                            "defaultValue": "- Zapatillas: Puntas, Media punta.\n- Medias: Convertibles, Socks, Contemporáneo, Poliamida, Patín.\n- Accesorios: Metatarsianas, Bolsa de red, Elásticos, Cintas, Endurecedor de puntas, Punteras, Protectores.\n- Otros: Bolsos, Leotardos.",
                            "placeholder": "Lista de tus categorías principales.",
                            "description": "Mapa mental de tus categorías principales para búsquedas proactivas."
                        },
                        {
                            "key": "store_website",
                            "label": "URL de la Web",
                            "type": "text",
                            "defaultValue": "https://www.pointecoach.shop",
                            "placeholder": "https://tu-tienda.com",
                            "description": "Link principal para el Call to Action final."
                        }
                    ]
                };
                setSchema(config.agent_config_schema as FieldConfig[]);

                // Initialize form with default values
                const initialData: Record<string, string> = {};
                config.agent_config_schema.forEach(field => {
                    initialData[field.key] = field.defaultValue;
                });
                setFormData(initialData);
            } catch (err) {
                console.error("Failed to load schema", err);
                setError("Error al cargar la configuración del asistente.");
            }
        };

        loadConfig();
    }, []);

    const handleChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleResetField = (key: string) => {
        const field = schema.find(f => f.key === key);
        if (field) {
            setFormData(prev => ({ ...prev, [key]: field.defaultValue }));
            setResetFeedback(`Campo "${field.label}" restaurado al ejemplo.`);
            setTimeout(() => setResetFeedback(null), 3000);
        }
    };

    const handleImproveField = async (key: string) => {
        const text = formData[key];
        if (!text) return;

        setImprovingFields(prev => ({ ...prev, [key]: true }));
        try {
            // Nexus v5.19 - Calling enriched field improvement endpoint
            const res = await fetchApi('/admin/ai/improve-prompt', {
                method: 'POST',
                body: { text, context: 'field', field: key, tenant_id: 0 } // tenant_id 0 as placeholder for wizard
            });

            if (res.refined_text) {
                setFormData(prev => ({ ...prev, [key]: res.refined_text }));
            }
        } catch (err: any) {
            console.error(`Failed to improve field ${key}`, err);
        } finally {
            setImprovingFields(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccess(false);

        // Validation for critical fields
        const criticalFields = ['agent_tone', 'synonym_dictionary', 'business_rules'];
        const emptyFields = criticalFields.filter(key => !formData[key]?.trim());

        if (emptyFields.length > 0) {
            setError(`Los campos críticos (${emptyFields.map(k => schema.find(f => f.key === k)?.label).join(', ')}) no pueden estar vacíos. ¿Quieres cargar el ejemplo por defecto?`);
            setIsSaving(false);
            return;
        }

        try {
            await fetchApi('/admin/agents', {
                method: 'POST',
                body: formData
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Error al guardar el agente.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && schema.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Sparkles className="animate-pulse text-accent w-12 h-12" />
            </div>
        );
    }

    return (
        <div className="view active animate-fade-in p-6 overflow-y-auto max-w-4xl mx-auto pb-24">
            {resetFeedback && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-accent/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl animate-bounce-subtle flex items-center gap-2 text-sm font-bold">
                    <RotateCcw size={16} />
                    {resetFeedback}
                </div>
            )}

            <header className="mb-8">
                <div className="flex items-center gap-2 text-accent mb-2">
                    <Sparkles size={20} />
                    <span className="text-sm font-bold tracking-widest uppercase">Nexus v5.16 Safety</span>
                </div>
                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40 mb-4">
                    Dynamic Agent Wizard
                </h1>
                <p className="text-secondary max-w-2xl">
                    Crea tu Agente Maestro. Hemos pre-cargado el ejemplo de <span className="text-white font-bold">Pointe Coach</span> para guiarte. Si te pierdes, usa el botón de restaurar.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid gap-6">
                    {schema.map((field) => (
                        <div key={field.key} className="glass p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all group relative">
                            <div className="flex items-center justify-between mb-4">
                                <label className="block">
                                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">
                                        {field.label}
                                        {['agent_tone', 'synonym_dictionary', 'business_rules'].includes(field.key) && (
                                            <span className="text-accent ml-1">*</span>
                                        )}
                                    </span>
                                </label>
                                <div className="flex items-center gap-3">
                                    {(['agent_tone', 'synonym_dictionary', 'business_rules', 'store_description'].includes(field.key)) && (
                                        <button
                                            type="button"
                                            onClick={() => handleImproveField(field.key)}
                                            disabled={improvingFields[field.key]}
                                            className="flex items-center gap-1 text-[10px] text-accent hover:text-white transition-colors disabled:opacity-50"
                                        >
                                            <Sparkles size={12} className={improvingFields[field.key] ? 'animate-pulse' : ''} />
                                            {improvingFields[field.key] ? 'Mejorando...' : 'Mejorar con IA'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleResetField(field.key)}
                                        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white transition-colors"
                                        title="Restaurar valor de ejemplo"
                                    >
                                        <RotateCcw size={12} />
                                        Restaurar Ejemplo
                                    </button>
                                </div>
                            </div>

                            {field.type === 'textarea' ? (
                                <textarea
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={`w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-accent outline-none transition-all placeholder:text-white/10 ${field.rows && field.rows >= 10 ? 'font-mono text-xs leading-relaxed' : 'text-sm'
                                        }`}
                                    style={{ minHeight: field.rows ? `${field.rows * 24}px` : '120px' }}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-accent outline-none transition-all placeholder:text-white/10"
                                />
                            )}

                            <div className="mt-3 flex items-start gap-2 text-xs text-white/40">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <span>{field.description}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-2xl flex items-start gap-4 animate-shake">
                        <AlertCircle size={24} className="shrink-0" />
                        <div>
                            <p className="font-bold mb-1">Error de Validación</p>
                            <p className="text-sm opacity-80">{error}</p>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-6 rounded-2xl flex items-center gap-4 animate-fade-in">
                        <CheckCircle2 size={24} className="shrink-0" />
                        <p className="font-bold">Agente configurado exitosamente. La Armada se ha actualizado.</p>
                    </div>
                )}

                {/* Security Footer */}
                <div className="glass p-8 rounded-3xl border border-accent/10 flex items-center gap-6 mt-12 mb-24 grayscale-[0.5] opacity-80 hover:grayscale-0 hover:opacity-100 transition-all">
                    <div className="bg-accent/20 p-4 rounded-2xl text-accent">
                        <ShieldCheck size={32} />
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-1 uppercase tracking-widest text-xs">Protección de Inteligencia Central</h4>
                        <p className="text-sm text-secondary leading-relaxed">
                            Tu agente incluye protección **anti-alucinaciones**, **Sandwich Defense** contra inyecciones y **formato JSON automático**. Tus datos alimentan la plantilla, pero la seguridad de Nexus te protege por detrás.
                        </p>
                    </div>
                </div>

                <div className="fixed bottom-8 right-8 z-50">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-accent hover:bg-accent-hover text-white px-10 py-5 rounded-full font-bold shadow-2xl shadow-accent/40 flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        {isSaving ? 'Guardando...' : 'Guardar Configuración Agente'}
                        <ArrowRight size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};
