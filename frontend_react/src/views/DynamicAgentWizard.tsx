import { useRef, useState, useEffect } from 'react'; // Nexus v5.26 Fix
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Save, Info, Sparkles, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, AlertCircle, Store, LifeBuoy, Truck, Calendar, MessageSquare, Send, Bot, User, Trash2, Facebook, Globe } from 'lucide-react';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'toggle';
    defaultValue: string;
    placeholder: string;
    description: string;
    rows?: number;
}

const AGENT_CONFIG_SCHEMA: FieldConfig[] = [
    {
        "key": "store_name",
        "label": "Nombre del Negocio",
        "type": "text",
        "defaultValue": "Pointe Coach",
        "placeholder": "Ej: Ferrería Central",
        "description": "El nombre oficial de tu tienda que usará el agente para presentarse."
    },
    {
        "key": "shadow_rag_enabled",
        "label": "Activar Shadow Learning (Memoria Híbrida)",
        "type": "toggle",
        "defaultValue": "false",
        "placeholder": "",
        "description": "ADVERTENCIA: Si activas esto, el agente leerá el historial de chats pasados para imitar el estilo y recordar contexto. Consume más tokens."
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
];

// --- Nexus v5.26: Live Preview Panel ---
const LivePreviewPanel = ({ formData, tenantId = 1, knowledgeCollections = [] }: { formData: Record<string, any>, tenantId?: number, knowledgeCollections?: string[] }) => {
    const { fetchApi } = useApi();
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
        { role: 'assistant', content: 'Hola, soy tu agente en modo prueba. Edita las reglas a la izquierda y probame en tiempo real.' }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isThinking]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;
        const text = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setIsThinking(true);

        try {
            // Call Nexus v5.26 Simulation Endpoint
            // We pass the RAW formData so the backend constructs the transient agent
            // v5.58 Fix: Provide full identity context
            const payload = {
                tenant_id: tenantId || 1,
                message: text,
                history: messages.slice(-6), // Keep context tight
                // Transient Agent Config - Must match backend expectation
                formData: {
                    ...formData,
                    // Nested config for injection
                    config: {
                        knowledge_config: {
                            collections: knowledgeCollections
                        }
                    }
                }
            };

            const res = await fetchApi('/admin/agents/simulate', {
                method: 'POST',
                body: payload
            });

            if (res.status === 'success') {
                setMessages(prev => [...prev, { role: 'assistant', content: res.response || '⚠️ Sin respuesta.' }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: res.response || '⚠️ Error simulando respuesta.' }]);
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error de conexión con el simulador.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold text-white text-sm">Prueba en Vivo</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-2 py-1 rounded-full">Modo Borrador</span>
                    <button
                        onClick={() => setMessages([{ role: 'assistant', content: 'Chat reiniciado.' }])}
                        className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                        title="Limpiar Chat"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-white/10' : 'bg-accent'
                            }`}>
                            {m.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm ${m.role === 'user'
                            ? 'bg-white/10 text-white rounded-tr-sm'
                            : 'bg-black/60 border border-white/10 text-white/90 rounded-tl-sm'
                            }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                            <Bot size={14} className="text-white" />
                        </div>
                        <div className="bg-black/60 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-white/10 bg-white/5">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="relative flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe un mensaje de prueba..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:border-accent outline-none placeholder:text-white/20 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isThinking}
                        className="absolute right-2 p-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg shadow-lg disabled:opacity-0 transition-all transform hover:scale-105"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};

// === Tenant Selector Component (v7.0 Multi-Tenant Binding) ===
const TenantSelector = ({ selectedTenantId, onChange }: { selectedTenantId: number, onChange: (id: number) => void }) => {
    const { fetchApi } = useApi();
    const [tenants, setTenants] = useState<{ id: number, store_name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTenants = async () => {
            try {
                const data = await fetchApi('/admin/tenants');
                if (Array.isArray(data)) setTenants(data);
            } catch (err) {
                console.error("Failed to load tenants", err);
            } finally {
                setLoading(false);
            }
        };
        loadTenants();
    }, []);

    if (loading || tenants.length <= 1) return null; // Hide if single tenant

    return (
        <div className="glass p-6 rounded-2xl border border-white/5 mb-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg">
                    <Store size={18} className="text-cyan-300" />
                </div>
                <h3 className="text-sm font-bold text-white">Tienda Asociada (Tenant)</h3>
            </div>

            <div className="relative">
                <select
                    value={selectedTenantId}
                    onChange={(e) => onChange(parseInt(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
                >
                    {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.store_name} (ID: {t.id})</option>
                    ))}
                </select>
                <div className="absolute right-4 top-3.5 pointer-events-none text-white/40">▼</div>
            </div>

            <p className="mt-3 text-[10px] text-white/30">
                Este agente solo podrá acceder a credenciales y canales vinculados a esta tienda.
            </p>
        </div>
    );
};

export const DynamicAgentWizard = () => {
    const { fetchApi, loading } = useApi();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { agentId } = useParams(); // Start editing logic support
    const [schema] = useState<FieldConfig[]>(AGENT_CONFIG_SCHEMA);
    const [templates, setTemplates] = useState<Record<string, any>>({});
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        AGENT_CONFIG_SCHEMA.forEach(f => initial[f.key] = f.defaultValue);
        // Nexus v5.99: Brain Defaults
        initial['model_provider'] = 'openai';
        initial['model_version'] = 'gpt-4o';
        initial['temperature'] = '0.7';
        return initial;
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [resetFeedback, setResetFeedback] = useState<string | null>(null);
    const [improvingFields, setImprovingFields] = useState<Record<string, boolean>>({});
    const [improveError, setImproveError] = useState<string | null>(null);
    const [knowledgeCollections, setKnowledgeCollections] = useState<string[]>([]);

    // Nexus v5.99: Tools Management
    const [availableTools, setAvailableTools] = useState<any[]>([]);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [selectedTools, setSelectedTools] = useState<string[]>(['search_specific_products', 'orders', 'derivhumano']); // Defaults
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp', 'web']); // Defaults
    const [channelStatus, setChannelStatus] = useState<Record<string, boolean>>({ whatsapp: false, instagram: false, facebook: false, web: true });
    const [selectedTenantId, setSelectedTenantId] = useState<number>(user?.tenant_id || 1); // v7.0 Multi-tenant binding

    useEffect(() => {
        // Load Templates, Tools & Integration Status
        const initData = async () => {
            try {
                const [tpls, tools, models, status] = await Promise.all([
                    fetchApi('/admin/agent-templates'),
                    fetchApi('/admin/tools'),
                    fetchApi('/admin/models'),
                    fetchApi('/admin/integrations/status')
                ]);

                setTemplates(tpls);
                if (Array.isArray(tools)) setAvailableTools(tools);
                if (Array.isArray(models)) setAvailableModels(models);
                if (status) setChannelStatus(status);
            } catch (err) {
                console.error("Failed to load init data", err);
            }
        };
        initData();

        if (agentId) {
            const loadAgent = async () => {
                try {
                    const agent = await fetchApi(`/admin/agents/${agentId}/config`);
                    if (agent) {
                        const cfg = agent.config || {};
                        const getDef = (k: string) => AGENT_CONFIG_SCHEMA.find(f => f.key === k)?.defaultValue || '';

                        // 1. Core Metadata
                        setFormData({
                            ...agent,
                            ...cfg,
                            temperature: agent.temperature?.toString() || '0.7',
                            store_name: agent.name || getDef('store_name'),
                            agent_tone: cfg.agent_tone || agent.system_prompt_template || getDef('agent_tone'),
                            business_rules: cfg.business_rules || getDef('business_rules'),
                            synonym_dictionary: cfg.synonym_dictionary || getDef('synonym_dictionary'),
                            store_description: cfg.store_description || getDef('store_description'),
                            catalog_summary: cfg.catalog_summary || getDef('catalog_summary'),
                            store_website: cfg.store_website || agent.store_website || getDef('store_website'),
                            model_provider: agent.model_provider || 'openai',
                            model_version: agent.model_version || 'gpt-4o',
                            template_type: cfg.template_type || agent.template_type
                        });

                        const parseArray = (data: any) => {
                            if (!data) return [];
                            if (Array.isArray(data)) return data;
                            if (typeof data === 'string') {
                                try { return JSON.parse(data); } catch { return []; }
                            }
                            return [];
                        };

                        // 2. Tools
                        setSelectedTools(parseArray(agent.enabled_tools));

                        // 3. Channels (Persistence Fix)
                        const loadedChannels = parseArray(agent.channels);
                        if (loadedChannels.length > 0) {
                            setSelectedChannels(loadedChannels);
                        }

                        // 4. Knowledge
                        let loadedCols = parseArray(agent.knowledge_sources);
                        if (loadedCols.length === 0 && agent.config?.knowledge_config?.collections) {
                            loadedCols = agent.config.knowledge_config.collections;
                        }
                        setKnowledgeCollections(loadedCols);
                    }
                } catch (err) {
                    console.error("Failed to load agent data", err);
                    setError("No se pudo cargar la configuración del agente.");
                }
            };
            loadAgent();
        }
    }, [agentId, fetchApi]);

    const handleLoadTemplate = (key: string) => {
        const tpl = templates[key];
        if (!tpl) return;

        setSelectedTemplate(key);
        setFormData(prev => ({
            ...prev,
            agent_tone: tpl.agent_tone,
            business_rules: tpl.business_rules,
            synonym_dictionary: tpl.synonym_dictionary,
            template_type: key // Important for simulation
        }));
    };

    const getIconForTemplate = (key: string) => {
        switch (key) {
            case 'sales': return <Store size={24} />;
            case 'support': return <LifeBuoy size={24} />;
            case 'logistics': return <Truck size={24} />;
            case 'leads': return <Calendar size={24} />;
            default: return <Sparkles size={24} />;
        }
    };

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
        setImproveError(null);
        try {
            const res = await fetchApi('/admin/ai/improve-prompt', {
                method: 'POST',
                body: { text, context: 'field', field: key, tenant_id: 0 }
            });

            if (res.refined_text) {
                setFormData(prev => ({ ...prev, [key]: res.refined_text }));
            }
        } catch (err: any) {
            console.error(`Failed to improve field ${key}`, err);
            if (err.status === 400 || err.message?.includes('API KEY')) {
                setImproveError('Configura tu API Key de OpenAI en Ajustes para usar la mejora con IA.');
            } else {
                setImproveError('Error al procesar la mejora. Revisa tu conexión o configuración.');
            }
            setTimeout(() => setImproveError(null), 5000);
        } finally {
            setImprovingFields(prev => ({ ...prev, [key]: false }));
        }
    };

    // --- Knowledge Selector Component ---
    const KnowledgeSelector = ({ selected, onChange }: { selected: string[], onChange: (cols: string[]) => void }) => {
        const { fetchApi } = useApi();
        const [collections, setCollections] = useState<string[]>([]);
        const [loadingCollections, setLoadingCollections] = useState(true);

        const fetchCollections = async () => {
            try {
                setLoadingCollections(true);
                console.log("🔄 Fetching RAG collections...");
                const data = await fetchApi('/admin/knowledge/collections');

                if (Array.isArray(data)) {
                    setCollections(data);
                    console.log("✅ Collections loaded:", data.length);
                } else {
                    console.warn("⚠️ Collections data is not an array:", data);
                    setCollections([]);
                }
            } catch (err) {
                console.error("❌ Error loading collections:", err);
            } finally {
                setLoadingCollections(false);
            }
        };

        useEffect(() => {
            fetchCollections();
        }, []);

        const toggleCollection = (col: string) => {
            if (selected.includes(col)) {
                onChange(selected.filter(c => c !== col));
            } else {
                onChange([...selected, col]);
            }
        };

        return (
            <div className="glass p-6 rounded-2xl border border-white/5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                        <Bot size={16} /> Base de Conocimiento (RAG)
                    </h3>
                    <button
                        type="button"
                        onClick={fetchCollections}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                        title="Recargar colecciones"
                    >
                        {/* Inline SVG for Refresh to avoid import issues if RefreshCw missing */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                    </button>
                </div>

                {loadingCollections ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 animate-pulse">
                        <div className="w-3 h-3 bg-gray-500 rounded-full" /> Cargando colecciones...
                    </div>
                ) : collections.length === 0 ? (
                    <div className="text-xs text-gray-500 bg-white/5 p-3 rounded-lg border border-white/5">
                        No se encontraron colecciones disponibles. <br />
                        Asegúrate de haber subido documentos en la sección "Base de Conocimiento".
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {collections.map(col => (
                            <button
                                key={col}
                                type="button"
                                onClick={() => toggleCollection(col)}
                                className={`flex items-center gap-2 p-3 rounded-xl transition-all border text-xs text-left
                                    ${selected.includes(col)
                                        ? 'bg-accent/20 border-accent text-white'
                                        : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'}
                                `}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center
                                    ${selected.includes(col) ? 'bg-accent border-accent' : 'border-white/20'}
                                `}>
                                    {selected.includes(col) && <CheckCircle2 size={10} className="text-white" />}
                                </div>
                                <span className="truncate">{col}</span>
                            </button>
                        ))}
                    </div>
                )}

                <p className="mt-3 text-[10px] text-white/30">
                    Selecciona las colecciones que este agente debe priorizar.
                </p>
            </div>
        );
    };



    // --- Nexus v5.99: Channel Selection Utility ---
    const ChannelSelector = () => {
        const channels = [
            { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={16} /> },
            { id: 'instagram', label: 'Instagram', icon: <Info size={16} /> },
            { id: 'facebook', label: 'Facebook', icon: <Facebook size={16} /> },
            { id: 'web', label: 'Web Widget', icon: <Globe size={16} /> }
        ];

        const toggleChannel = (id: string) => {
            if (!channelStatus[id]) return; // Block if not connected
            setSelectedChannels(prev =>
                prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
            );
        };

        return (
            <div className="glass p-6 rounded-2xl border border-white/5 mb-6">
                <h3 className="text-sm font-bold text-white mb-4">¿Dónde trabajará este agente?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {channels.map((ch) => {
                        const isConnected = channelStatus[ch.id];
                        const isActive = selectedChannels.includes(ch.id);

                        return (
                            <button
                                key={ch.id}
                                type="button"
                                onClick={() => toggleChannel(ch.id)}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all
                                    ${isConnected
                                        ? isActive ? 'bg-accent/20 border-accent text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                                        : 'bg-black/40 border-white/5 text-gray-500 cursor-not-allowed opacity-50'}
                                `}
                            >
                                <div className={`p-2 rounded-lg ${isActive ? 'bg-accent text-white' : 'bg-white/10'}`}>
                                    {ch.icon}
                                </div>
                                <span className="text-[10px] font-bold uppercase">{ch.label}</span>
                                {!isConnected && <span className="text-[9px] text-red-400 font-medium">Desconectado</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- Nexus v5.99: Tool Selection Utility ---
    const ToolSelector = () => {
        const toggleTool = (toolName: string) => {
            if (selectedTools.includes(toolName)) {
                setSelectedTools(prev => prev.filter(t => t !== toolName));
            } else {
                setSelectedTools(prev => [...prev, toolName]);
            }
        };

        if (availableTools.length === 0) return null;

        return (
            <div className="glass p-6 rounded-2xl border border-white/5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Bot size={18} className="text-green-300" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Capacidades / Herramientas</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableTools.map((tool) => (
                        <button
                            key={tool.name}
                            type="button"
                            onClick={() => toggleTool(tool.name)}
                            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all group
                                ${selectedTools.includes(tool.name)
                                    ? 'bg-green-500/10 border-green-500/50 hover:bg-green-500/20'
                                    : 'bg-black/20 border-white/5 hover:bg-white/5'}
                            `}
                        >
                            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors
                                ${selectedTools.includes(tool.name) ? 'bg-green-500 border-green-500' : 'border-white/20'}
                            `}>
                                {selectedTools.includes(tool.name) && <CheckCircle2 size={12} className="text-black" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white mb-0.5 flex items-center gap-2">
                                    {tool.label || tool.name}
                                    {tool.category === 'system' && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300">Sistema</span>}
                                </div>
                                <div className="text-[10px] text-white/50 leading-tight">
                                    {tool.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // --- Nexus v5.99: AI Brain Configuration ---
    const BrainConfigPanel = () => {
        // Dynamic Model Filtering
        const currentProvider = formData.model_provider || 'openai';
        const filteredModels = availableModels.filter(m => m.provider === currentProvider);

        const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newProvider = e.target.value;
            // Auto-select first model of new provider to avoid invalid state
            const firstModel = availableModels.find(m => m.provider === newProvider);

            setFormData(prev => ({
                ...prev,
                model_provider: newProvider,
                model_version: firstModel ? firstModel.id : ''
            }));
        };

        return (
            <div className="glass p-6 rounded-2xl border border-white/5 mb-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Sparkles size={18} className="text-purple-300" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Configuración del Cerebro (IA)</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Provider & Model */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Proveedor de Inteligencia</label>
                            <div className="relative">
                                <select
                                    value={formData.model_provider || 'openai'}
                                    onChange={handleProviderChange}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                                >
                                    <option value="openai">OpenAI (GPT)</option>
                                    <option value="google">Google (Gemini)</option>
                                </select>
                                <div className="absolute right-4 top-3.5 pointer-events-none text-white/40">▼</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2">Modelo Neural</label>
                            <div className="relative">
                                <select
                                    value={formData.model_version || ''}
                                    onChange={(e) => handleChange('model_version', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                                >
                                    {filteredModels.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name || m.id} {m.ui_metadata?.label ? `(${m.ui_metadata.label})` : ''}
                                        </option>
                                    ))}
                                    {filteredModels.length === 0 && <option value="">Cargando modelos...</option>}
                                </select>
                                <div className="absolute right-4 top-3.5 pointer-events-none text-white/40">▼</div>
                            </div>
                        </div>
                    </div>

                    {/* Temperature Slider */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-gray-400">Creatividad (Temperatura)</label>
                            <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-purple-300">
                                {formData.temperature || "0.7"}
                            </span>
                        </div>

                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={formData.temperature || "0.7"}
                            onChange={(e) => handleChange('temperature', e.target.value)}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />

                        <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                            <span>Preciso (0.0)</span>
                            <span>Equilibrado (0.5)</span>
                            <span>Creativo (1.0)</span>
                        </div>

                        <p className="mt-3 text-[10px] text-gray-400 leading-relaxed border-t border-white/5 pt-3">
                            <Info size={10} className="inline mr-1 mb-0.5" />
                            Valores bajos (0-0.3) son ideales para soporte técnico y datos exactos. Valores altos (0.7-1.0) funcionan mejor para ventas y conversación natural.
                        </p>
                    </div>
                </div>

                {/* Reasoning Effort Slider (GPT-5.2 only) - Nexus v5.99 */}
                {(formData.model_version === 'gpt-5.2' || formData.model_version === 'gpt-5.2-pro') && (
                    <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-purple-300">Esfuerzo de Razonamiento (GPT-5.2)</label>
                            <span className="text-xs font-mono bg-purple-500/20 px-2 py-1 rounded text-purple-200">
                                {formData.reasoning_effort || "medium"}
                            </span>
                        </div>

                        <select
                            value={formData.reasoning_effort || "medium"}
                            onChange={(e) => handleChange('reasoning_effort', e.target.value)}
                            className="w-full bg-black/40 border border-purple-500/30 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                        >
                            <option value="none">Ninguno (Más Rápido)</option>
                            <option value="low">Bajo</option>
                            <option value="medium">Medio (Recomendado)</option>
                            <option value="high">Alto</option>
                            <option value="xhigh">Muy Alto (Máxima Precisión)</option>
                        </select>

                        <p className="mt-3 text-[10px] text-purple-300/60 leading-relaxed border-t border-purple-500/10 pt-3">
                            <Info size={10} className="inline mr-1 mb-0.5" />
                            Controla cuánto "piensa" el modelo antes de responder. Valores altos mejoran la precisión en tareas complejas pero aumentan el tiempo de respuesta.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccess(false);

        const criticalFields = ['agent_tone', 'synonym_dictionary', 'business_rules'];
        const emptyFields = criticalFields.filter(key => !formData[key]?.trim());

        if (emptyFields.length > 0) {
            setError(`Los campos críticos (${emptyFields.map(k => schema.find(f => f.key === k)?.label).join(', ')}) no pueden estar vacíos.`);
            setIsSaving(false);
            return;
        }

        try {
            const payload = {
                ...formData,
                name: formData['store_name'] || "Agente de Ventas",
                tenant_id: selectedTenantId, // v7.0: Use selected tenant instead of user.tenant_id
                role: 'sales',
                system_prompt_template: formData['agent_tone'],

                // Explicit Persistence Fixes
                model_provider: formData.model_provider || 'openai',
                model_version: formData.model_version || 'gpt-4o',
                temperature: parseFloat(formData.temperature) || 0.7,
                template_type: selectedTemplate || formData.template_type,
                enabled_tools: selectedTools,
                knowledge_sources: knowledgeCollections,
                channels: selectedChannels, // Using the new state
                store_website: formData.store_website, // Explicit URL Persistence

                // Config JSONB (Metadata)
                config: {
                    ...formData,
                    knowledge_config: {
                        collections: knowledgeCollections
                    },
                    template_type: selectedTemplate || formData.template_type,
                    store_website: formData.store_website // Sync inside JSON too
                }
            };

            await fetchApi(agentId ? `/admin/agents/${agentId}` : '/admin/agents', {
                method: agentId ? 'PUT' : 'POST',
                body: payload
            });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            console.error("Save Error:", err);
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
        <div className="max-w-7xl mx-auto px-6 py-12 relative h-screen overflow-hidden">
            {resetFeedback && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-accent/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl animate-bounce-subtle flex items-center gap-2 text-sm font-bold">
                    <RotateCcw size={16} />
                    {resetFeedback}
                </div>
            )}

            {improveError && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl animate-shake flex items-center gap-2 text-sm font-bold">
                    <AlertCircle size={16} />
                    {improveError}
                </div>
            )}

            <button
                onClick={() => navigate('/agents')}
                className="mb-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
            >
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                    <ArrowRight className="rotate-180" size={18} />
                </div>
                <span className="font-medium text-sm">Volver a mis Agentes</span>
            </button>

            {/* Main Grid Layout (Nexus v5.26) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start h-[calc(100vh-150px)]">

                {/* Left Column: Form (Scrollable) */}
                <div className="lg:col-span-3 h-full overflow-y-auto pr-2 custom-scrollbar pb-24">
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-accent rounded-2xl shadow-lg shadow-accent/20">
                                <Sparkles className="text-white" size={24} />
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tight">
                                {agentId ? 'Editar Agente' : 'Nuevo Agente'} {selectedTemplate && <span className="text-white/30 text-2xl font-normal">/ {selectedTemplate}</span>}
                            </h1>
                        </div>
                        <p className="text-white/50 text-lg leading-relaxed max-w-2xl">
                            Configura el cerebro de tu IA. Nexus inyectará estas reglas en el sistema base <span className="text-accent font-bold">Pointe Coach™</span> para alinear el comportamiento con tu marca.
                        </p>
                    </div>

                    {/* Template Selector */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        {Object.entries(templates).map(([key, tpl]: [string, any]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => handleLoadTemplate(key)}
                                className={`
                                    relative p-4 rounded-2xl border text-left transition-all group overflow-hidden
                                    ${selectedTemplate === key
                                        ? 'bg-accent border-accent text-white shadow-xl shadow-accent/20 scale-[1.02]'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30 hover:bg-white/10'}
                                `}
                            >
                                <div className={`mb-3 p-2 rounded-xl w-fit ${selectedTemplate === key ? 'bg-white/20' : 'bg-white/5'}`}>
                                    {getIconForTemplate(key)}
                                </div>
                                <h3 className={`font-bold text-sm mb-1 ${selectedTemplate === key ? 'text-white' : 'text-white'}`}>
                                    {tpl.label}
                                </h3>
                                <p className={`text-[10px] leading-relaxed ${selectedTemplate === key ? 'text-white/80' : 'text-white/40'}`}>
                                    {tpl.description}
                                </p>
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* v7.0: Tenant Selection */}
                        <TenantSelector selectedTenantId={selectedTenantId} onChange={setSelectedTenantId} />

                        {/* Nexus v5.99: Channel Selection */}
                        <ChannelSelector />

                        {/* Nexus v5.99: Tool Selection */}
                        <ToolSelector />

                        {/* Nexus v5.99: Brain Configuration */}
                        <BrainConfigPanel />


                        {/* Nexus v5.91: Knowledge Base Config */}
                        <KnowledgeSelector selected={knowledgeCollections} onChange={setKnowledgeCollections} />


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
                                    ) : field.type === 'toggle' ? (
                                        <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl p-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-white">Estado</span>
                                                <span className="text-xs text-gray-400">{formData[field.key] === 'true' ? 'Activado' : 'Desactivado'}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleChange(field.key, formData[field.key] === 'true' ? 'false' : 'true')}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData[field.key] === 'true' ? 'bg-accent' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-md ${formData[field.key] === 'true' ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>
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

                        <div className="fixed bottom-8 right-8 lg:right-[42%] z-50">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="bg-accent hover:bg-accent-hover text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-accent/40 flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={20} />
                                )}
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Column: Live Preview (Desktop) */}
                <div className="hidden lg:flex lg:col-span-2 h-full flex-col sticky top-8">
                    <LivePreviewPanel
                        formData={formData}
                        tenantId={user?.tenant_id}
                        knowledgeCollections={knowledgeCollections}
                    />
                </div>
            </div>

            {/* Mobile Floating Preview Button */}
            <div className="fixed bottom-8 left-8 z-40 lg:hidden">
                <button
                    onClick={() => { }}
                    className="bg-white text-black p-4 rounded-full shadow-xl font-bold flex items-center gap-2"
                >
                    <MessageSquare size={20} />
                    <span className="text-xs">Probar Chat</span>
                </button>
            </div>
        </div>
    );
};
