import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Phone, Mic, Headphones, Palette, Globe, Settings, Copy, Check,
    Plus, Trash2, Edit2, ChevronDown, ChevronUp, AlertCircle, Zap,
    Volume2, Radio
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
    enabled_tools: string[];
    channels: string[];
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
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este widget? Esta acción no se puede deshacer.')) return;
        await fetchApi(`/admin/voice-widget/config/${id}`, { method: 'DELETE' });
        loadAll();
        if (selectedWidgetId === id) {
            setSelectedWidgetId(null);
            setIsEditing(false);
            setFormData({ ...DEFAULT_CONFIG });
        }
    };

    const selectWidget = (w: VoiceWidgetConfig) => {
        setFormData({ ...w });
        setSelectedWidgetId(w.id || null);
        setIsEditing(true);
    };

    const startNew = () => {
        setFormData({ ...DEFAULT_CONFIG });
        setSelectedWidgetId(null);
        setIsEditing(false);
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

    const copySnippet = () => {
        if (!formData.widget_token) return;
        const apiBase = window.location.origin.includes('localhost')
            ? 'http://localhost:3000'
            : window.location.origin.replace('frontend', 'orchestrator-service');
        const snippet = `<script>\n  (function(d,t) {\n    var s=d.createElement(t);\n    s.src="${apiBase}/static/voice-widget-sdk.js";\n    s.defer=true;s.async=true;\n    s.dataset.token="${formData.widget_token}";\n    d.head.appendChild(s);\n  })(document,"script");\n</script>`;
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const selectedAgent = agents.find(a => a.id === formData.agent_id);
    const currentVoices = providers?.voices?.[formData.realtime_provider] || providers?.voices?.['openai'] || [];

    // --- Plan Blocked ---
    if (planBlocked) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center animate-fade-in">
                <div className="glass p-12 rounded-2xl border border-white/5">
                    <Phone size={48} className="text-violet-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Voice Widget</h2>
                    <p className="text-slate-400 mb-6">Disponible en planes Pro y Enterprise</p>
                    <a href="/billing" className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors inline-block">
                        Ver Planes
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-4 lg:p-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 lg:p-8">
                <div className="flex items-start gap-4 lg:gap-6">
                    <div className="bg-violet-600 p-3 lg:p-4 rounded-xl shadow-lg shadow-violet-500/30">
                        <Phone size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">Voice Widget</h2>
                        <p className="text-slate-300 text-sm lg:text-base max-w-xl">
                            Configura un asistente de voz embebible en tu tienda. Los visitantes podrán hablar directamente con tu agente IA.
                        </p>
                    </div>
                </div>
            </div>

            {/* Usage Bar */}
            {usage && usage.plan !== 'free' && (
                <div className="glass p-4 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400">Consumo de Voz</span>
                        <span className="text-xs text-slate-500">
                            {formData.api_key_mode === 'byok' ? 'Modo BYOK — uso ilimitado' : `${usage.voice_minutes_used} / ${usage.voice_minutes_included} min`}
                        </span>
                    </div>
                    {formData.api_key_mode !== 'byok' && (
                        <div className="w-full bg-white/5 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${
                                    usage.voice_minutes_used / usage.voice_minutes_included > 0.95 ? 'bg-red-500' :
                                    usage.voice_minutes_used / usage.voice_minutes_included > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (usage.voice_minutes_used / Math.max(1, usage.voice_minutes_included)) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Widget List */}
            <div className="glass p-4 lg:p-6 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Mis Widgets</h3>
                    <button onClick={startNew} className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors">
                        <Plus size={14} /> Nuevo Widget
                    </button>
                </div>
                {widgets.length === 0 ? (
                    <p className="text-slate-500 text-sm">No tienes widgets creados. Crea el primero.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {widgets.map(w => (
                            <div
                                key={w.id}
                                onClick={() => selectWidget(w)}
                                className={`p-4 rounded-lg border cursor-pointer transition-all hover:bg-white/5 ${
                                    selectedWidgetId === w.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/5'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: w.brand_color }}>
                                        <Phone size={14} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{w.widget_name}</p>
                                        <p className="text-xs text-slate-500">{w.agent_name || `Agent #${w.agent_id}`}</p>
                                    </div>
                                    <span className={`w-2 h-2 rounded-full ${w.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>
                                <div className="mt-2 flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id!); }} className="text-red-400 hover:text-red-300 p-1">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Editor + Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Editor */}
                <div className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    {/* Section 1: Agent Selector */}
                    <div className="glass p-5 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-white">
                            <Zap size={16} className="text-violet-400" /> Agente
                        </h3>
                        {agents.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-slate-500 text-sm mb-2">No tienes agentes activos</p>
                                <a href="/agents" className="text-violet-400 text-sm hover:underline">Crear un agente →</a>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={formData.agent_id}
                                    onChange={e => setFormData({ ...formData, agent_id: parseInt(e.target.value) })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                                >
                                    <option value={0}>Selecciona un agente...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                                </select>
                                {selectedAgent && (
                                    <div className="mt-2 p-3 bg-white/5 rounded-lg text-xs text-slate-400 space-y-1">
                                        <p>Modelo: <span className="text-white">{selectedAgent.model_version}</span></p>
                                        <p>Tools: <span className="text-white">{(selectedAgent.enabled_tools || []).join(', ') || 'Ninguna'}</span></p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Section 2: Voice Pipeline + Provider */}
                    <div className="glass p-5 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-white">
                            <Volume2 size={16} className="text-violet-400" /> Configuración de Voz
                        </h3>

                        {/* Pipeline Toggle */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {['realtime', 'cascaded'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFormData({ ...formData, voice_pipeline: p })}
                                    className={`p-3 rounded-lg border text-xs text-left transition-all ${
                                        formData.voice_pipeline === p ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    <p className="font-bold text-white">{p === 'realtime' ? 'Realtime' : 'Cascaded'}</p>
                                    <p className="text-slate-500 mt-1">{p === 'realtime' ? 'Baja latencia' : 'Multi-provider'}</p>
                                    {p === 'realtime' && <span className="text-[10px] text-violet-400 font-bold">RECOMENDADO</span>}
                                </button>
                            ))}
                        </div>

                        {/* Provider Selector */}
                        {formData.voice_pipeline === 'realtime' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-400">Proveedor Realtime</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['openai', 'nvidia'].map(prov => {
                                        const hasKey = providers?.has_keys?.[prov];
                                        return (
                                            <button
                                                key={prov}
                                                onClick={() => hasKey && setFormData({
                                                    ...formData,
                                                    realtime_provider: prov,
                                                    voice_model: prov === 'nvidia' ? 'magpie-tts-es' : 'alloy'
                                                })}
                                                disabled={!hasKey}
                                                className={`p-3 rounded-lg border text-xs text-left transition-all ${
                                                    formData.realtime_provider === prov
                                                        ? 'border-violet-500 bg-violet-500/10'
                                                        : hasKey ? 'border-white/5 hover:bg-white/5' : 'border-white/5 opacity-40 cursor-not-allowed'
                                                }`}
                                            >
                                                <p className="font-bold text-white">{prov === 'openai' ? 'OpenAI Realtime' : 'NVIDIA Riva NIM'}</p>
                                                <p className="text-slate-500 mt-1">
                                                    {prov === 'openai' ? '~200-500ms latencia' : 'ASR sub-25ms + tu LLM'}
                                                </p>
                                                {!hasKey && (
                                                    <a href="/credentials" className="text-violet-400 hover:underline mt-1 block" onClick={e => e.stopPropagation()}>
                                                        Agregar API Key →
                                                    </a>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cascaded: separate STT/TTS selectors */}
                        {formData.voice_pipeline === 'cascaded' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Proveedor TTS</label>
                                    <select value={formData.voice_provider} onChange={e => setFormData({ ...formData, voice_provider: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none">
                                        {(providers?.tts_providers || ['openai']).map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Proveedor STT</label>
                                    <select value={formData.stt_provider} onChange={e => setFormData({ ...formData, stt_provider: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none">
                                        {(providers?.stt_providers || ['openai']).map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Voice Model */}
                        <div className="mt-3">
                            <label className="block text-xs font-bold text-slate-400 mb-1">Voz</label>
                            <select value={formData.voice_model} onChange={e => setFormData({ ...formData, voice_model: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none">
                                {currentVoices.map((v: string) => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>

                        {/* Language + Duration */}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Idioma</label>
                                <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none">
                                    <option value="es">Español</option>
                                    <option value="en">English</option>
                                    <option value="pt">Português</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Duración máx (seg)</label>
                                <input type="number" min={60} max={600} value={formData.max_call_duration}
                                    onChange={e => setFormData({ ...formData, max_call_duration: parseInt(e.target.value) || 300 })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Visual Customization */}
                    <div className="glass p-5 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-white">
                            <Palette size={16} className="text-violet-400" /> Personalización
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Nombre del Widget</label>
                                <input type="text" value={formData.widget_name}
                                    onChange={e => setFormData({ ...formData, widget_name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Color de Marca</label>
                                <div className="flex gap-2">
                                    <input type="color" value={formData.brand_color}
                                        onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                        className="h-10 w-16 rounded cursor-pointer bg-transparent border-none" />
                                    <input type="text" value={formData.brand_color}
                                        onChange={e => setFormData({ ...formData, brand_color: e.target.value })}
                                        className="flex-1 bg-white/5 border border-white/10 rounded px-3 text-sm text-white font-mono" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Tamaño</label>
                                <div className="flex gap-2">
                                    {['sm', 'md', 'lg'].map(s => (
                                        <button key={s} onClick={() => setFormData({ ...formData, button_size: s })}
                                            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${formData.button_size === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                            {s.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Posición</label>
                                <div className="flex gap-2">
                                    {['bottom-right', 'bottom-left'].map(pos => (
                                        <button key={pos} onClick={() => setFormData({ ...formData, button_position: pos })}
                                            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${formData.button_position === pos ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                            {pos === 'bottom-right' ? 'Derecha' : 'Izquierda'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Icono</label>
                                <div className="flex gap-2">
                                    {[
                                        { key: 'phone', icon: <Phone size={16} /> },
                                        { key: 'mic', icon: <Mic size={16} /> },
                                        { key: 'headset', icon: <Headphones size={16} /> },
                                    ].map(opt => (
                                        <button key={opt.key} onClick={() => setFormData({ ...formData, button_icon: opt.key })}
                                            className={`p-2.5 rounded-lg border transition-all ${formData.button_icon === opt.key ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-white/10 text-slate-500 hover:bg-white/5'}`}>
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Avatar URL (opcional)</label>
                                <input type="text" value={formData.avatar_url || ''} placeholder="https://..."
                                    onChange={e => setFormData({ ...formData, avatar_url: e.target.value || null })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Mensaje de Bienvenida</label>
                                <input type="text" value={formData.welcome_message}
                                    onChange={e => setFormData({ ...formData, welcome_message: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Agent Override (Collapsible) */}
                    <div className="glass rounded-xl border border-white/5">
                        <button onClick={() => setShowOverride(!showOverride)}
                            className="w-full p-5 flex items-center justify-between text-white">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <Settings size={16} className="text-violet-400" /> Override de Agente (Opcional)
                            </span>
                            {showOverride ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {showOverride && (
                            <div className="px-5 pb-5 space-y-3">
                                <p className="text-[10px] text-slate-500">Si dejas vacío, se usa la config del agente seleccionado.</p>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">System Prompt Override</label>
                                    <textarea value={formData.system_prompt_override || ''} rows={4}
                                        placeholder="Dejar vacío para usar el prompt del agente..."
                                        onChange={e => setFormData({ ...formData, system_prompt_override: e.target.value || null })}
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Temperatura: {formData.temperature_override ?? 'Auto'}</label>
                                    <input type="range" min={0} max={1} step={0.1} value={formData.temperature_override ?? 0.3}
                                        onChange={e => setFormData({ ...formData, temperature_override: parseFloat(e.target.value) })}
                                        className="w-full" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 5: Billing Mode */}
                    <div className="glass p-5 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-white">
                            <Radio size={16} className="text-violet-400" /> Modo de API
                        </h3>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {[
                                { key: 'platform', label: 'API de Future', desc: `${usage?.voice_minutes_included || 0} min/mes incluidos` },
                                { key: 'byok', label: 'Mi propia API Key', desc: 'Uso ilimitado' },
                            ].map(m => (
                                <button key={m.key} onClick={() => setFormData({ ...formData, api_key_mode: m.key })}
                                    className={`p-3 rounded-lg border text-xs text-left transition-all ${
                                        formData.api_key_mode === m.key ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 hover:bg-white/5'
                                    }`}>
                                    <p className="font-bold text-white">{m.label}</p>
                                    <p className="text-slate-500 mt-1">{m.desc}</p>
                                </button>
                            ))}
                        </div>
                        {formData.api_key_mode === 'byok' && formData.realtime_provider === 'nvidia' && !providers?.has_keys?.nvidia && (
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-400">NGC API Key</label>
                                <textarea value={ngcKeyInput} rows={2} placeholder="Pega aquí tu NGC API Key (se almacenará encriptada)"
                                    onChange={e => setNgcKeyInput(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-violet-500 outline-none resize-none" />
                                <p className="text-[10px] text-slate-500">Obtenla en org.ngc.nvidia.com/setup/api-keys</p>
                                <button onClick={handleSaveNgcKey}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors">
                                    Guardar API Key
                                </button>
                            </div>
                        )}
                        {formData.api_key_mode === 'byok' && formData.realtime_provider === 'openai' && (
                            <p className="text-[10px] text-slate-500">Se usará tu OpenAI API Key de Credenciales.</p>
                        )}
                    </div>

                    {/* Save Button */}
                    <button onClick={handleSave} disabled={isSaving || !formData.agent_id}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors">
                        {isSaving ? 'Guardando...' : isEditing ? 'Actualizar Widget' : 'Crear Widget'}
                    </button>
                </div>

                {/* Right: Preview + Snippet */}
                <div className="space-y-4">
                    {/* Live Preview */}
                    <div className="glass p-5 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold mb-3 text-white flex items-center gap-2">
                            <Globe size={16} className="text-green-400" /> Preview
                        </h3>
                        <div className="relative h-64 bg-white rounded-xl overflow-hidden border border-white/10 opacity-90">
                            <div className="absolute top-0 w-full h-7 bg-gray-100 border-b flex items-center px-3 gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                <div className="mx-auto w-24 h-3 bg-gray-200 rounded-full" />
                            </div>
                            <div className="flex items-center justify-center h-full text-gray-300 font-bold text-lg tracking-widest">
                                TU TIENDA
                            </div>
                            {/* Widget Button */}
                            <div className={`absolute bottom-4 flex flex-col items-end gap-2 ${formData.button_position === 'bottom-right' ? 'right-4' : 'left-4'}`}>
                                <div className="bg-white text-black text-[10px] px-2.5 py-1.5 rounded-l-xl rounded-t-xl shadow-lg border border-gray-100 max-w-[130px]">
                                    {formData.welcome_message}
                                </div>
                                <div
                                    style={{ backgroundColor: formData.brand_color }}
                                    className={`rounded-full shadow-xl flex items-center justify-center text-white ${
                                        formData.button_size === 'sm' ? 'w-10 h-10' :
                                        formData.button_size === 'lg' ? 'w-14 h-14' : 'w-12 h-12'
                                    }`}
                                >
                                    {formData.avatar_url ? (
                                        <img src={formData.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                                    ) : (
                                        formData.button_icon === 'mic' ? <Mic size={20} /> :
                                        formData.button_icon === 'headset' ? <Headphones size={20} /> :
                                        <Phone size={20} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Embed Code */}
                    <div className="glass p-5 rounded-xl border border-white/5 bg-black/40">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Globe size={14} className="text-green-400" /> Código de Instalación
                            </h3>
                            {formData.widget_token && (
                                <button onClick={copySnippet}
                                    className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                                        copied ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                                    }`}>
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            )}
                        </div>
                        <div className="bg-[#0f0f0f] p-3 rounded-lg border border-white/5 overflow-x-auto">
                            <pre className="text-[10px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
                                {formData.widget_token
                                    ? `<script>\n  (function(d,t) {\n    var s=d.createElement(t);\n    s.src="YOUR_API_URL/static/voice-widget-sdk.js";\n    s.defer=true;s.async=true;\n    s.dataset.token="${formData.widget_token}";\n    d.head.appendChild(s);\n  })(document,"script");\n</script>`
                                    : 'Guarda el widget primero para obtener tu código de instalación.'
                                }
                            </pre>
                        </div>
                        <div className="mt-3 flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <Phone size={14} className="text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-200">
                                Copia este código y pégalo antes de <code>&lt;/body&gt;</code> en el HTML de tu Tienda Nube.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
