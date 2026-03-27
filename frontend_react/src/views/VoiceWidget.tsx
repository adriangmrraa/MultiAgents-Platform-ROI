import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Phone, Mic, Headphones, Palette, Globe, Settings, Copy, Check,
    Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Zap,
    Volume2, Radio, Eye, Code, ArrowLeft, Send, UserX, FileText
} from 'lucide-react';

// --- Interfaces ---

interface VoiceWidgetConfig {
    id?: number;
    tenant_id?: number;
    agent_id: number;
    widget_name: string;
    brand_color: string;
    button_size: string;
    button_position: string;
    button_icon: string;
    avatar_url: string | null;
    welcome_message: string;
    voice_provider: string;
    voice_model: string;
    stt_provider: string;
    stt_model: string;
    language: string;
    voice_pipeline: string;
    realtime_provider: string;
    system_prompt_override: string | null;
    temperature_override: number | null;
    max_call_duration: number;
    api_key_mode: string;
    widget_token?: string;
    is_active: boolean;
    agent_name?: string;
    agent_model?: string;
}

interface Agent {
    id: number;
    name: string;
    role: string;
    model_version: string;
    enabled_tools: string[] | Record<string, any> | null;
    channels: string[] | Record<string, any> | null;
    is_active: boolean;
}

interface ProvidersData {
    realtime_providers: string[];
    tts_providers: string[];
    stt_providers: string[];
    voices: Record<string, string[]>;
    has_keys: Record<string, boolean>;
}

interface UsageData {
    plan: string;
    voice_minutes_included: number;
    voice_minutes_used: number;
    voice_minutes_remaining: number;
    overage_minutes: number;
    addon_price: number;
    billing_period_end: string | null;
}

const DEFAULT_CONFIG: VoiceWidgetConfig = {
    agent_id: 0,
    widget_name: 'Asistente de Voz',
    brand_color: '#8B5CF6',
    button_size: 'md',
    button_position: 'bottom-right',
    button_icon: 'phone',
    avatar_url: null,
    welcome_message: '¡Hola! Toca para hablar conmigo.',
    voice_provider: 'openai',
    voice_model: 'alloy',
    stt_provider: 'openai',
    stt_model: 'whisper-1',
    language: 'es',
    voice_pipeline: 'realtime',
    realtime_provider: 'openai',
    system_prompt_override: null,
    temperature_override: null,
    max_call_duration: 300,
    api_key_mode: 'platform',
    is_active: true,
};

// Fix for native <select> on dark backgrounds: options need dark bg + white text
const selectClass = "w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none appearance-none cursor-pointer";
const inputClass = "w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none";

// --- Main Component ---

export const VoiceWidget: React.FC = () => {
    const { fetchApi } = useApi();
    const { user } = useAuth();

    const [widgets, setWidgets] = useState<VoiceWidgetConfig[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [providers, setProviders] = useState<ProvidersData | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [formData, setFormData] = useState<VoiceWidgetConfig>({ ...DEFAULT_CONFIG });
    const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showOverride, setShowOverride] = useState(false);
    const [planBlocked, setPlanBlocked] = useState(false);
    const [ngcKeyInput, setNgcKeyInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    // Mobile: tab navigation
    const [mobileTab, setMobileTab] = useState<'config' | 'preview'>('config');
    const [showEditor, setShowEditor] = useState(false);
    const [showDevInstructions, setShowDevInstructions] = useState(false);
    const [devCopied, setDevCopied] = useState(false);
    // Collapsible sections state (all collapsed by default)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        const [widgetData, agentData, providerData, usageData] = await Promise.all([
            fetchApi('/admin/voice-widget/config').catch(() => null),
            fetchApi('/admin/agents').catch(() => []),
            fetchApi('/admin/voice-widget/providers').catch(() => null),
            fetchApi('/admin/voice-widget/usage').catch(() => null),
        ]);
        if (widgetData && !widgetData.detail) {
            setWidgets(Array.isArray(widgetData) ? widgetData : []);
        } else if (widgetData?.detail?.includes('Pro and Enterprise')) {
            setPlanBlocked(true);
        }
        if (agentData) setAgents(Array.isArray(agentData) ? agentData.filter((a: Agent) => a.is_active) : []);
        if (providerData && !providerData.detail) setProviders(providerData);
        if (usageData && !usageData.detail) setUsage(usageData);
    };

    const handleSave = async () => {
        if (!formData.agent_id) { setError('Selecciona un agente'); return; }
        setIsSaving(true);
        setError(null);
        try {
            if (isEditing && selectedWidgetId) {
                await fetchApi(`/admin/voice-widget/config/${selectedWidgetId}`, { method: 'PUT', body: formData });
            } else {
                await fetchApi('/admin/voice-widget/config', { method: 'POST', body: formData });
            }
            await loadAll();
            setIsEditing(false);
            setSelectedWidgetId(null);
            setFormData({ ...DEFAULT_CONFIG });
            setShowEditor(false);
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este widget?')) return;
        await fetchApi(`/admin/voice-widget/config/${id}`, { method: 'DELETE' });
        loadAll();
        if (selectedWidgetId === id) {
            setSelectedWidgetId(null);
            setIsEditing(false);
            setFormData({ ...DEFAULT_CONFIG });
            setShowEditor(false);
        }
    };

    const selectWidget = (w: VoiceWidgetConfig) => {
        setFormData({ ...w });
        setSelectedWidgetId(w.id || null);
        setIsEditing(true);
        setShowEditor(true);
    };

    const startNew = () => {
        setFormData({ ...DEFAULT_CONFIG });
        setSelectedWidgetId(null);
        setIsEditing(false);
        setShowEditor(true);
    };

    const handleSaveNgcKey = async () => {
        if (!ngcKeyInput.trim()) return;
        try {
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: { name: 'NGC_API_KEY', value: ngcKeyInput.trim(), category: 'nvidia', scope: 'tenant' }
            });
            setNgcKeyInput('');
            loadAll();
        } catch (err: any) {
            setError(err.message || 'Error al guardar API Key');
        }
    };

    const getApiBase = () => {
        if (window.location.origin.includes('localhost')) return 'http://localhost:3000';
        return window.location.origin.replace('frontend', 'orchestrator-service');
    };

    const getSnippetCode = () => {
        if (!formData.widget_token) return '';
        const apiBase = getApiBase();
        return `<script>\n  (function(d,t) {\n    var s=d.createElement(t);\n    s.src="${apiBase}/static/voice-widget-sdk.js";\n    s.defer=true;s.async=true;\n    s.dataset.token="${formData.widget_token}";\n    d.head.appendChild(s);\n  })(document,"script");\n</script>`;
    };

    const copySnippet = () => {
        const snippet = getSnippetCode();
        if (!snippet) return;
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyDevInstructions = () => {
        const snippet = getSnippetCode();
        if (!snippet) return;
        const instructions = `INSTRUCCIONES PARA INSTALAR EL WIDGET DE VOZ
=============================================

Hola! Necesito que instales este widget de asistente de voz en mi tienda online.
Es un boton flotante que permite a los visitantes hablar por voz con nuestro asistente de IA.

PASOS:
1. Ingresa al panel de administracion de la tienda (Tienda Nube / Shopify / WordPress)
2. Ve a la seccion de "Codigo personalizado" o "Scripts externos"
   - En Tienda Nube: Configuracion > Codigos externos > Footer
   - En Shopify: Tienda online > Temas > Editar codigo > theme.liquid (antes de </body>)
   - En WordPress: Apariencia > Editor de temas > footer.php (antes de </body>)
3. Pega el siguiente codigo EXACTAMENTE como esta, antes de la etiqueta </body>:

${snippet}

IMPORTANTE:
- No modifiques ninguna parte del codigo
- El widget aparecera como un boton flotante en la esquina inferior de la pagina
- Si necesitas desactivarlo, simplemente elimina este codigo
- El widget se configura desde nuestro panel, no hace falta tocar nada mas en la tienda

Cualquier duda, avisame!`;

        navigator.clipboard.writeText(instructions);
        setDevCopied(true);
        setTimeout(() => setDevCopied(false), 2500);
    };

    const selectedAgent = agents.find(a => a.id === formData.agent_id);
    const currentVoices = providers?.voices?.[formData.voice_pipeline === 'realtime' ? formData.realtime_provider : formData.voice_provider] || providers?.voices?.['openai'] || [];

    const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    // planBlocked = demo mode (Free users can see but not save)

    // --- Preview Component (reusable for desktop & mobile) ---
    // IMPORTANT: Use fragments directly instead of inline component functions
    // to avoid React re-mounting on every state change (which causes input focus loss).
    const previewContent = (
        <div className="space-y-4">
            <div className="glass p-4 lg:p-5 rounded-xl border border-white/5">
                <h3 className="text-sm font-bold mb-3 text-white flex items-center gap-2">
                    <Eye size={16} className="text-green-400" /> Preview
                </h3>
                <div className="relative h-52 lg:h-64 bg-white rounded-xl overflow-hidden border border-white/10">
                    <div className="absolute top-0 w-full h-7 bg-gray-100 border-b flex items-center px-3 gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <div className="mx-auto w-20 lg:w-24 h-3 bg-gray-200 rounded-full" />
                    </div>
                    <div className="flex items-center justify-center h-full text-gray-200 font-bold text-base lg:text-lg tracking-widest">
                        TU TIENDA
                    </div>
                    <div className={`absolute bottom-3 lg:bottom-4 flex flex-col items-end gap-1.5 lg:gap-2 ${formData.button_position === 'bottom-right' ? 'right-3 lg:right-4' : 'left-3 lg:left-4'}`}>
                        <div className="bg-white text-black text-[9px] lg:text-[10px] px-2 py-1 lg:px-2.5 lg:py-1.5 rounded-l-xl rounded-t-xl shadow-lg border border-gray-100 max-w-[120px] lg:max-w-[130px] leading-tight">
                            {formData.welcome_message}
                        </div>
                        <div
                            style={{ backgroundColor: formData.brand_color }}
                            className={`rounded-full shadow-xl flex items-center justify-center text-white transition-all ${
                                formData.button_size === 'sm' ? 'w-9 h-9 lg:w-10 lg:h-10' :
                                formData.button_size === 'lg' ? 'w-13 h-13 lg:w-14 lg:h-14' : 'w-11 h-11 lg:w-12 lg:h-12'
                            }`}
                        >
                            {formData.avatar_url ? (
                                <img src={formData.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                            ) : (
                                formData.button_icon === 'mic' ? <Mic size={18} /> :
                                formData.button_icon === 'headset' ? <Headphones size={18} /> :
                                <Phone size={18} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Embed Code + Installation Guide */}
            <div className="glass p-4 lg:p-5 rounded-xl border border-white/5 bg-black/40">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Code size={14} className="text-green-400" /> Instalacion
                    </h3>
                    {formData.widget_token && (
                        <button onClick={copySnippet}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                                copied ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                            }`}>
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copiado' : 'Copiar codigo'}
                        </button>
                    )}
                </div>

                {/* Code Block */}
                <div className="bg-[#0a0a0a] p-3 rounded-lg border border-white/5 overflow-x-auto">
                    <pre className="text-[10px] lg:text-[11px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap break-all">
                        {formData.widget_token
                            ? getSnippetCode()
                            : 'Guarda el widget primero para obtener tu codigo.'
                        }
                    </pre>
                </div>

                {/* Quick Guide */}
                {formData.widget_token && (
                    <div className="mt-3 space-y-3">
                        {/* Step-by-step mini guide */}
                        <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                            <p className="text-[11px] font-bold text-blue-300 mb-2">Como instalar:</p>
                            <div className="space-y-1.5">
                                <div className="flex items-start gap-2">
                                    <span className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-blue-300">1</span>
                                    <p className="text-[10px] text-slate-400">Copia el codigo de arriba</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-blue-300">2</span>
                                    <p className="text-[10px] text-slate-400">Ingresa al admin de tu tienda</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-blue-300">3</span>
                                    <p className="text-[10px] text-slate-400">
                                        <span className="text-white font-medium">Tienda Nube:</span> Configuracion &gt; Codigos externos &gt; Footer
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="w-4 h-4 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-blue-300">4</span>
                                    <p className="text-[10px] text-slate-400">
                                        Pega el codigo antes de <code className="text-blue-300">&lt;/body&gt;</code> y guarda
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* "No soy dev" button */}
                        <button
                            onClick={() => setShowDevInstructions(!showDevInstructions)}
                            className="w-full p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg text-left transition-all hover:bg-amber-500/10 active:scale-[0.99]"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserX size={14} className="text-amber-400" />
                                    <span className="text-xs font-bold text-amber-300">No soy desarrollador</span>
                                </div>
                                <ChevronDown size={14} className={`text-amber-400 transition-transform ${showDevInstructions ? 'rotate-180' : ''}`} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Copia instrucciones completas para enviar a tu desarrollador o soporte tecnico
                            </p>
                        </button>

                        {showDevInstructions && (
                            <div className="space-y-2 animate-fade-in">
                                {/* Preview of what will be copied */}
                                <div className="bg-[#0a0a0a] p-3 rounded-lg border border-amber-500/10 max-h-40 overflow-y-auto">
                                    <p className="text-[10px] font-mono text-amber-200/80 whitespace-pre-wrap leading-relaxed">
                                        INSTRUCCIONES PARA INSTALAR EL WIDGET DE VOZ{'\n'}
                                        =============================================={'\n\n'}
                                        Hola! Necesito que instales este widget de asistente de voz en mi tienda online.{'\n\n'}
                                        PASOS:{'\n'}
                                        1. Ingresa al panel de administracion de la tienda{'\n'}
                                        2. Ve a "Codigo personalizado" o "Scripts externos"{'\n'}
                                        {'   '}- Tienda Nube: Configuracion &gt; Codigos externos &gt; Footer{'\n'}
                                        {'   '}- Shopify: Tienda online &gt; Temas &gt; Editar codigo{'\n'}
                                        {'   '}- WordPress: Apariencia &gt; Editor de temas &gt; footer.php{'\n'}
                                        3. Pega el codigo (incluido abajo) antes de &lt;/body&gt;{'\n\n'}
                                        [Codigo script incluido]{'\n\n'}
                                        IMPORTANTE: No modifiques ninguna parte del codigo.
                                    </p>
                                </div>

                                <button
                                    onClick={copyDevInstructions}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                                        devCopied
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30'
                                    }`}
                                >
                                    {devCopied ? (
                                        <><Check size={16} /> Instrucciones copiadas!</>
                                    ) : (
                                        <><FileText size={16} /> Copiar instrucciones para mi dev</>
                                    )}
                                </button>

                                <p className="text-[9px] text-slate-600 text-center">
                                    Se copia un texto completo con el codigo + pasos + indicaciones listo para enviar por WhatsApp, email o chat
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // --- Editor Form ---
    const editorContent = (
        <div className="space-y-3 lg:space-y-4">
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* Agent Selector */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <button onClick={() => toggleSection('agent')}
                    className="w-full p-4 lg:p-5 flex items-center justify-between text-white active:bg-white/5 transition-colors">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <Zap size={16} className="text-violet-400" /> Agente
                        {selectedAgent && <span className="text-[10px] text-slate-500 font-normal ml-1">— {selectedAgent.name}</span>}
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${openSections.agent ? 'rotate-180' : ''}`} />
                </button>
                {openSections.agent && (
                    <div className="px-4 lg:px-5 pb-4 lg:pb-5 border-t border-white/5 pt-3">
                        {agents.length === 0 ? (
                            <div className="text-center py-6">
                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <Zap size={20} className="text-slate-500" />
                                </div>
                                <p className="text-slate-500 text-sm mb-2">No tienes agentes activos</p>
                                <a href="/agents" className="text-violet-400 text-sm hover:underline font-medium">Crear un agente</a>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={formData.agent_id}
                                    onChange={e => setFormData({ ...formData, agent_id: parseInt(e.target.value) })}
                                    className={selectClass}
                                >
                                    <option value={0} className="bg-[#1a1a2e] text-slate-400">Selecciona un agente...</option>
                                    {agents.map(a => <option key={a.id} value={a.id} className="bg-[#1a1a2e] text-white">{a.name} ({a.role})</option>)}
                                </select>
                                {selectedAgent && (
                                    <div className="mt-2 p-3 bg-violet-500/5 border border-violet-500/10 rounded-lg text-xs space-y-1">
                                        <p className="text-slate-400">Modelo: <span className="text-violet-300 font-medium">{selectedAgent.model_version}</span></p>
                                        <p className="text-slate-400">Tools: <span className="text-violet-300 font-medium">{(Array.isArray(selectedAgent.enabled_tools) ? selectedAgent.enabled_tools : []).join(', ') || 'Ninguna'}</span></p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Voice Config */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <button onClick={() => toggleSection('voice')}
                    className="w-full p-4 lg:p-5 flex items-center justify-between text-white active:bg-white/5 transition-colors">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <Volume2 size={16} className="text-violet-400" /> Voz
                        <span className="text-[10px] text-slate-500 font-normal ml-1">— {formData.voice_pipeline === 'realtime' ? 'Realtime' : 'Cascaded'}</span>
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${openSections.voice ? 'rotate-180' : ''}`} />
                </button>
                {openSections.voice && (
                <div className="px-4 lg:px-5 pb-4 lg:pb-5 border-t border-white/5 pt-3">

                {/* Pipeline */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {['realtime', 'cascaded'].map(p => (
                        <button key={p} onClick={() => setFormData({ ...formData, voice_pipeline: p })}
                            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                                formData.voice_pipeline === p ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/5' : 'border-white/5 hover:bg-white/5 active:bg-white/10'
                            }`}>
                            <p className="font-bold text-white text-xs">{p === 'realtime' ? 'Realtime' : 'Cascaded'}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">{p === 'realtime' ? 'Baja latencia' : 'Multi-provider'}</p>
                            {p === 'realtime' && <span className="inline-block mt-1 text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">RECOMENDADO</span>}
                        </button>
                    ))}
                </div>

                {/* Provider */}
                {formData.voice_pipeline === 'realtime' && (
                    <div className="space-y-3 mb-3">
                        <label className="block text-xs font-bold text-slate-400">Proveedor</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['openai', 'nvidia'].map(prov => {
                                const hasKey = providers?.has_keys?.[prov];
                                return (
                                    <button key={prov}
                                        onClick={() => hasKey && setFormData({ ...formData, realtime_provider: prov, voice_model: prov === 'nvidia' ? 'magpie-tts-es' : 'alloy' })}
                                        disabled={!hasKey}
                                        className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                                            formData.realtime_provider === prov
                                                ? 'border-violet-500 bg-violet-500/10'
                                                : hasKey ? 'border-white/5 hover:bg-white/5' : 'border-white/5 opacity-40'
                                        }`}>
                                        <p className="font-bold text-white text-xs">{prov === 'openai' ? 'OpenAI' : 'NVIDIA Riva'}</p>
                                        <p className="text-slate-500 text-[10px] mt-0.5">{prov === 'openai' ? '~300ms' : 'Sub-25ms ASR'}</p>
                                        {!hasKey && <a href="/credentials" className="text-violet-400 text-[10px] hover:underline mt-1 block" onClick={e => e.stopPropagation()}>Agregar Key</a>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {formData.voice_pipeline === 'cascaded' && (
                    <div className="space-y-3 mb-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">TTS</label>
                            <select value={formData.voice_provider} onChange={e => setFormData({ ...formData, voice_provider: e.target.value })} className={selectClass}>
                                {(providers?.tts_providers || ['openai']).map(p => <option key={p} value={p} className="bg-[#1a1a2e] text-white">{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">STT</label>
                            <select value={formData.stt_provider} onChange={e => setFormData({ ...formData, stt_provider: e.target.value })} className={selectClass}>
                                {(providers?.stt_providers || ['openai']).map(p => <option key={p} value={p} className="bg-[#1a1a2e] text-white">{p}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Voice + Lang + Duration */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Voz</label>
                        <select value={formData.voice_model} onChange={e => setFormData({ ...formData, voice_model: e.target.value })} className={selectClass}>
                            {currentVoices.map((v: string) => <option key={v} value={v} className="bg-[#1a1a2e] text-white">{v}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Idioma</label>
                            <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} className={selectClass}>
                                <option value="es" className="bg-[#1a1a2e] text-white">Espanol</option>
                                <option value="en" className="bg-[#1a1a2e] text-white">English</option>
                                <option value="pt" className="bg-[#1a1a2e] text-white">Portugues</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Max (seg)</label>
                            <input type="number" min={60} max={600} value={formData.max_call_duration}
                                onChange={e => setFormData({ ...formData, max_call_duration: parseInt(e.target.value) || 300 })}
                                className={inputClass} />
                        </div>
                    </div>
                </div>
                </div>
                )}
            </div>

            {/* Visual */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <button onClick={() => toggleSection('visual')}
                    className="w-full p-4 lg:p-5 flex items-center justify-between text-white active:bg-white/5 transition-colors">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <Palette size={16} className="text-violet-400" /> Visual
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${openSections.visual ? 'rotate-180' : ''}`} />
                </button>
                {openSections.visual && (
                <div className="px-4 lg:px-5 pb-4 lg:pb-5 border-t border-white/5 pt-3 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Nombre</label>
                        <input type="text" value={formData.widget_name}
                            onChange={e => setFormData({ ...formData, widget_name: e.target.value })}
                            className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Color</label>
                        <div className="flex gap-2">
                            <input type="color" value={formData.brand_color}
                                onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                className="h-10 w-14 rounded-lg cursor-pointer bg-transparent border border-white/10" />
                            <input type="text" value={formData.brand_color}
                                onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                className={`flex-1 font-mono ${inputClass}`} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5">Tamano</label>
                            <div className="flex gap-1.5">
                                {['sm', 'md', 'lg'].map(s => (
                                    <button key={s} onClick={() => setFormData({ ...formData, button_size: s })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${formData.button_size === s ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                        {s.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5">Posicion</label>
                            <div className="flex gap-1.5">
                                {[{ k: 'bottom-right', l: 'Der' }, { k: 'bottom-left', l: 'Izq' }].map(p => (
                                    <button key={p.k} onClick={() => setFormData({ ...formData, button_position: p.k })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${formData.button_position === p.k ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                        {p.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">Icono</label>
                        <div className="flex gap-2">
                            {[
                                { key: 'phone', icon: <Phone size={18} />, label: 'Telefono' },
                                { key: 'mic', icon: <Mic size={18} />, label: 'Microfono' },
                                { key: 'headset', icon: <Headphones size={18} />, label: 'Headset' },
                            ].map(opt => (
                                <button key={opt.key} onClick={() => setFormData({ ...formData, button_icon: opt.key })}
                                    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${formData.button_icon === opt.key ? 'border-violet-500 bg-violet-500/15 text-white shadow-lg shadow-violet-500/10' : 'border-white/10 text-slate-500 hover:bg-white/5'}`}>
                                    {opt.icon}
                                    <span className="text-[9px]">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Avatar (opcional)</label>
                        <input type="text" value={formData.avatar_url || ''} placeholder="https://..."
                            onChange={e => setFormData({ ...formData, avatar_url: e.target.value || null })}
                            className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Mensaje</label>
                        <input type="text" value={formData.welcome_message}
                            onChange={e => setFormData({ ...formData, welcome_message: e.target.value })}
                            className={inputClass} />
                    </div>
                </div>
                )}
            </div>

            {/* Override (Collapsible) */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <button onClick={() => setShowOverride(!showOverride)}
                    className="w-full p-4 flex items-center justify-between text-white active:bg-white/5 transition-colors">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <Settings size={16} className="text-slate-500" /> Override (Opcional)
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${showOverride ? 'rotate-180' : ''}`} />
                </button>
                {showOverride && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        <p className="text-[10px] text-slate-600">Deja vacio para usar la config del agente.</p>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">System Prompt</label>
                            <textarea value={formData.system_prompt_override || ''} rows={3}
                                placeholder="Override del prompt del agente..."
                                onChange={e => setFormData({ ...formData, system_prompt_override: e.target.value || null })}
                                className={`${inputClass} resize-none`} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Temperatura: {formData.temperature_override ?? 'Auto'}</label>
                            <input type="range" min={0} max={1} step={0.1} value={formData.temperature_override ?? 0.3}
                                onChange={e => setFormData({ ...formData, temperature_override: parseFloat(e.target.value) })}
                                className="w-full accent-violet-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* API Mode */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <button onClick={() => toggleSection('api')}
                    className="w-full p-4 lg:p-5 flex items-center justify-between text-white active:bg-white/5 transition-colors">
                    <span className="text-sm font-bold flex items-center gap-2">
                        <Radio size={16} className="text-violet-400" /> API
                        <span className="text-[10px] text-slate-500 font-normal ml-1">— {formData.api_key_mode === 'byok' ? 'Tu API Key' : 'Future API'}</span>
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${openSections.api ? 'rotate-180' : ''}`} />
                </button>
                {openSections.api && (
                <div className="px-4 lg:px-5 pb-4 lg:pb-5 border-t border-white/5 pt-3">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                            { key: 'platform', label: 'Future API', desc: `${usage?.voice_minutes_included || 0} min/mes` },
                            { key: 'byok', label: 'Tu API Key', desc: 'Ilimitado' },
                        ].map(m => (
                            <button key={m.key} onClick={() => setFormData({ ...formData, api_key_mode: m.key })}
                                className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                                    formData.api_key_mode === m.key ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 hover:bg-white/5'
                                }`}>
                                <p className="font-bold text-white text-xs">{m.label}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">{m.desc}</p>
                            </button>
                        ))}
                    </div>
                    {formData.api_key_mode === 'byok' && formData.realtime_provider === 'nvidia' && !providers?.has_keys?.nvidia && (
                        <div className="space-y-2 mt-3 p-3 bg-white/5 rounded-lg">
                            <label className="block text-xs font-bold text-slate-400">NGC API Key</label>
                            <textarea value={ngcKeyInput} rows={2} placeholder="Pega tu NGC API Key..."
                                onChange={e => setNgcKeyInput(e.target.value)}
                                className={`${inputClass} text-xs font-mono resize-none`} />
                            <button onClick={handleSaveNgcKey}
                                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors active:scale-[0.98]">
                                Guardar Key
                            </button>
                        </div>
                    )}
                    {formData.api_key_mode === 'byok' && formData.realtime_provider === 'openai' && (
                        <p className="text-[10px] text-slate-600 mt-1">Usa tu OpenAI Key de Credenciales.</p>
                    )}
                </div>
                )}
            </div>

            {/* Save / Upgrade CTA */}
            {planBlocked ? (
                <div className="space-y-2">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                        <p className="text-amber-300 text-xs font-medium mb-1">Modo vista previa</p>
                        <p className="text-slate-500 text-[10px]">Suscribite a Pro o Enterprise para activar Voice Widget</p>
                    </div>
                    <a href="/billing"
                        className="block w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20 text-sm text-center">
                        Activar Voice Widget
                    </a>
                </div>
            ) : (
                <button onClick={handleSave} disabled={isSaving || !formData.agent_id}
                    className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20 text-sm">
                    {isSaving ? 'Guardando...' : isEditing ? 'Actualizar Widget' : 'Crear Widget'}
                </button>
            )}
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto animate-fade-in px-3 lg:px-0 pb-28 lg:pb-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-5 lg:p-8 mb-4 lg:mb-6">
                <div className="flex items-center gap-3 lg:gap-6">
                    <div className="bg-violet-600 p-2.5 lg:p-4 rounded-xl shadow-lg shadow-violet-500/30 shrink-0">
                        <Phone size={22} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg lg:text-2xl font-bold text-white">Voice Widget</h2>
                        <p className="text-slate-300 text-xs lg:text-sm mt-0.5 truncate lg:whitespace-normal">
                            Asistente de voz embebible para tu tienda
                        </p>
                    </div>
                </div>
            </div>

            {/* Demo Banner for Free users */}
            {planBlocked && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 lg:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                            <Zap size={14} className="text-amber-400" />
                        </div>
                        <p className="text-xs text-amber-200 truncate lg:whitespace-normal">
                            <span className="font-bold">Vista previa</span> — Explora la configuracion del Voice Widget
                        </p>
                    </div>
                    <a href="/billing" className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors">
                        Activar
                    </a>
                </div>
            )}

            {/* Usage Bar */}
            {usage && usage.plan !== 'free' && !planBlocked && (
                <div className="glass p-3 lg:p-4 rounded-xl border border-white/5 mb-4 lg:mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] lg:text-xs font-bold text-slate-400">Consumo</span>
                        <span className="text-[10px] lg:text-xs text-slate-500">
                            {formData.api_key_mode === 'byok' ? 'BYOK ilimitado' : `${usage.voice_minutes_used} / ${usage.voice_minutes_included} min`}
                        </span>
                    </div>
                    {formData.api_key_mode !== 'byok' && (
                        <div className="w-full bg-white/5 rounded-full h-1.5 lg:h-2">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    usage.voice_minutes_used / usage.voice_minutes_included > 0.95 ? 'bg-red-500' :
                                    usage.voice_minutes_used / usage.voice_minutes_included > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (usage.voice_minutes_used / Math.max(1, usage.voice_minutes_included)) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Mobile: show list or editor */}
            {!showEditor ? (
                <>
                    {/* Widget List */}
                    <div className="glass p-4 lg:p-6 rounded-xl border border-white/5 mb-4 lg:mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base lg:text-lg font-bold text-white">Mis Widgets</h3>
                            <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-violet-600/20">
                                <Plus size={14} /> Nuevo
                            </button>
                        </div>
                        {widgets.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Phone size={24} className="text-slate-600" />
                                </div>
                                <p className="text-slate-500 text-sm mb-1">Sin widgets</p>
                                <p className="text-slate-600 text-xs">Crea tu primer widget de voz</p>
                            </div>
                        ) : (
                            <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
                                {widgets.map(w => (
                                    <div key={w.id} onClick={() => selectWidget(w)}
                                        className={`p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] hover:bg-white/5 ${
                                            selectedWidgetId === w.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/5'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: w.brand_color }}>
                                                <Phone size={16} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{w.widget_name}</p>
                                                <p className="text-[11px] text-slate-500 truncate">{w.agent_name || `Agent #${w.agent_id}`}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`w-2 h-2 rounded-full ${w.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id!); }} className="text-red-400/60 hover:text-red-400 p-1.5 -mr-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Back Button */}
                    <button onClick={() => setShowEditor(false)}
                        className="flex items-center gap-2 text-slate-400 text-sm mb-3 active:text-white hover:text-white transition-colors">
                        <ArrowLeft size={16} /> Volver a widgets
                    </button>

                    {/* Mobile Tab Switcher */}
                    <div className="lg:hidden flex gap-1 mb-4 bg-white/5 p-1 rounded-xl">
                        <button onClick={() => setMobileTab('config')}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mobileTab === 'config' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400'}`}>
                            Configurar
                        </button>
                        <button onClick={() => setMobileTab('preview')}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${mobileTab === 'preview' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400'}`}>
                            Preview & Codigo
                        </button>
                    </div>

                    {/* Desktop: 2 columns / Mobile: tabs */}
                    <div className="lg:grid lg:grid-cols-2 lg:gap-6">
                        <div className={`${mobileTab !== 'config' ? 'hidden lg:block' : ''}`}>
                            {editorContent}
                        </div>
                        <div className={`${mobileTab !== 'preview' ? 'hidden lg:block' : ''}`}>
                            {previewContent}
                        </div>
                    </div>
                </>
            )}

            {/* Desktop: always show editor below list when not in mobile edit mode */}
            {!showEditor && widgets.length > 0 && (
                <div className="hidden lg:block">
                    <p className="text-slate-600 text-sm text-center py-4">Selecciona un widget para editarlo o crea uno nuevo.</p>
                </div>
            )}
        </div>
    );
};
