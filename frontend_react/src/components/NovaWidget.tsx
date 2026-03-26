import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Sparkles, X, Send, AlertTriangle, Lightbulb, Shield, BookOpen,
    Package, Image, Bot, Link, Database, Clock, ArrowRight, Check,
    MessageCircle, BarChart2, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';

interface NovaCheck {
    type: 'warning' | 'suggestion' | 'alert' | 'info';
    icon: string;
    message: string;
    action: string;
    weight?: number;
}

interface DailyAnalysis {
    available: boolean;
    analysis?: {
        temas_frecuentes?: { tema: string; cantidad_aprox?: number }[];
        problemas?: string[];
        temas_sin_cobertura?: string[];
        sugerencias?: { titulo: string; detalle: string }[];
        satisfaccion_estimada?: number;
        resumen?: string;
        conversations_count?: number;
        derivations_count?: number;
    };
}

const ICON_MAP: Record<string, React.ReactNode> = {
    'package': <Package size={14} />,
    'image': <Image size={14} />,
    'alert-triangle': <AlertTriangle size={14} />,
    'bot': <Bot size={14} />,
    'sparkles': <Sparkles size={14} />,
    'link': <Link size={14} />,
    'database': <Database size={14} />,
    'clock': <Clock size={14} />,
    'shield': <Shield size={14} />,
    'book': <BookOpen size={14} />,
    'message-circle': <MessageCircle size={14} />,
};

const ACTION_ROUTES: Record<string, string> = {
    'cargar_productos': '/products',
    'agregar_fotos': '/products',
    'actualizar_stock': '/products',
    'crear_agente': '/onboarding-wizard',
    'mejorar_prompt': '/agents',
    'conectar_canales': '/settings/meta',
    'subir_docs': '/knowledge',
    'ver_planes': '/billing',
    'ver_chats': '/chats',
    'ver_errores': '/chats',
};

const PAGE_NAMES: Record<string, string> = {
    'dashboard': 'Dashboard',
    'products': 'Productos',
    'agents': 'Agentes',
    'chats': 'Conversaciones',
    'analytics': 'Analytics',
    'knowledge': 'Knowledge',
    'settings': 'Configuracion',
    'billing': 'Billing',
    'voice-widget': 'Voice Widget',
};

export const NovaWidget: React.FC = () => {
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'health' | 'insights'>('chat');
    const [healthData, setHealthData] = useState<any>(null);
    const [dailyData, setDailyData] = useState<DailyAnalysis | null>(null);
    const [context, setContext] = useState<any>(null);
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [pulse, setPulse] = useState(true);
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
    const [appliedIdxs, setAppliedIdxs] = useState<number[]>([]);
    const [showAllChecks, setShowAllChecks] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Detect current page
    const currentPage = (() => {
        const path = location.pathname;
        if (path === '/') return 'dashboard';
        if (path.includes('product')) return 'products';
        if (path.includes('agent')) return 'agents';
        if (path.includes('chat')) return 'chats';
        if (path.includes('analytics')) return 'analytics';
        if (path.includes('knowledge')) return 'knowledge';
        if (path.includes('setting')) return 'settings';
        if (path.includes('billing')) return 'billing';
        if (path.includes('voice-widget')) return 'voice-widget';
        return 'dashboard';
    })();

    // Don't show on onboarding wizard
    if (location.pathname.includes('onboarding-wizard')) return null;

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Fetch context + health when opening
    useEffect(() => {
        if (isOpen) {
            fetchContext();
            fetchHealth();
            fetchDailyAnalysis();
        }
    }, [isOpen, currentPage]);

    // Stop pulse after 10 seconds
    useEffect(() => {
        const timer = setTimeout(() => setPulse(false), 10000);
        return () => clearTimeout(timer);
    }, []);

    // Toast on page load — show once per session if there are critical alerts
    useEffect(() => {
        const shown = sessionStorage.getItem('nova_toast_shown');
        if (shown) return;

        const checkAlerts = async () => {
            try {
                const data = await fetchApi('/admin/nova/health-check');
                if (data?.checks) {
                    const alerts = data.checks.filter((c: NovaCheck) => c.type === 'alert');
                    if (alerts.length > 0) {
                        setToastMessage(`Nova: ${alerts[0].message}`);
                        setToastVisible(true);
                        sessionStorage.setItem('nova_toast_shown', 'true');
                        setTimeout(() => setToastVisible(false), 8000);
                    }
                }
            } catch (e) {
                // Non-blocking
            }
        };
        const timer = setTimeout(checkAlerts, 2000);
        return () => clearTimeout(timer);
    }, []);

    const fetchContext = async () => {
        try {
            const data = await fetchApi(`/admin/nova/context?page=${currentPage}`);
            setContext(data);
            if (data?.greeting && messages.length === 0) {
                setMessages([{ role: 'assistant', content: data.greeting }]);
            } else if (data?.greeting && messages.length > 0) {
                const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
                if (lastAssistant?.content !== data.greeting) {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.greeting }]);
                }
            }
        } catch (e) { /* Non-blocking */ }
    };

    const fetchHealth = async () => {
        try {
            const data = await fetchApi('/admin/nova/health-check');
            setHealthData(data);
        } catch (e) { /* Non-blocking */ }
    };

    const fetchDailyAnalysis = async () => {
        try {
            const data = await fetchApi('/admin/nova/daily-analysis');
            setDailyData(data);
        } catch (e) { /* Non-blocking */ }
    };

    const sendMessage = async () => {
        if (!input.trim()) return;
        const msg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setLoading(true);

        try {
            const novaPrompt = `Sos Nova, la asistente inteligente de Future Platform. Hablas en espanol argentino con voseo. Sos proactiva y directa. Estas en la pagina: ${currentPage}.

Contexto actual:
${context ? JSON.stringify(context.stats) : 'Sin datos'}

Health Score: ${healthData?.score ?? '?'}/100
Checks pendientes:
${healthData?.checks?.map((c: NovaCheck) => c.message).join('\n') || 'Ninguno'}

Responde de forma breve (max 3 oraciones). Termina con una sugerencia o accion concreta.`;

            const res = await fetchApi('/admin/onboarding-wizard/test-agent', {
                method: 'POST',
                body: { message: msg, system_prompt: novaPrompt }
            });
            if (res?.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Ups, tuve un error. Intenta de nuevo.' }]);
        }
        setLoading(false);
    };

    const handleAction = (action: string) => {
        const route = ACTION_ROUTES[action];
        if (route) {
            navigate(route);
            setIsOpen(false);
        }
    };

    const applySuggestion = async (suggestion: { titulo: string; detalle: string }, idx: number) => {
        setApplyingIdx(idx);
        try {
            const res = await fetchApi('/admin/onboarding-wizard/test-agent', {
                method: 'POST',
                body: {
                    message: `Agrega esta regla al prompt del agente: "${suggestion.titulo}: ${suggestion.detalle}"`,
                    system_prompt: `Sos Nova. Ejecuta la tool agregar_regla con el contenido que te piden. Responde confirmando que se agrego.`
                }
            });
            setAppliedIdxs(prev => [...prev, idx]);
            if (res?.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
            }
        } catch (e) {
            // Fallback
        }
        setApplyingIdx(null);
    };

    // Score color
    const scoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-red-400';
    };

    const scoreBarColor = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const scoreGreeting = (score: number) => {
        if (score >= 80) return 'Tu negocio esta al dia!';
        if (score >= 50) return 'Vas bien, pero podes mejorar';
        return 'Tu negocio necesita atencion';
    };

    return (
        <>
            {/* Toast Notification */}
            {toastVisible && (
                <div className="fixed bottom-24 left-6 z-[9999] max-w-sm animate-fade-in">
                    <div className="bg-[#1a1a2e] border border-violet-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-violet-600/20 flex items-start gap-3">
                        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-white">{toastMessage}</p>
                            <button
                                onClick={() => { setToastVisible(false); setIsOpen(true); }}
                                className="text-[10px] text-violet-400 hover:text-violet-300 mt-1"
                            >
                                Ver detalles
                            </button>
                        </div>
                        <button onClick={() => setToastVisible(false)} className="text-slate-500 hover:text-white">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={`fixed bottom-6 right-6 z-[9998] w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full shadow-2xl shadow-violet-600/30 flex items-center justify-center text-white hover:scale-110 transition-all active:scale-95 ${pulse ? 'animate-pulse' : ''}`}
                >
                    <Sparkles size={24} />
                    {/* Badge for alerts */}
                    {healthData?.checks?.filter((c: NovaCheck) => c.type === 'alert').length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                            {healthData.checks.filter((c: NovaCheck) => c.type === 'alert').length}
                        </span>
                    )}
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-80 lg:w-[420px] h-[560px] z-[9998] bg-[#0f0f17] rounded-2xl border border-violet-500/20 shadow-2xl shadow-violet-600/10 flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Nova</p>
                                <p className="text-[9px] text-slate-500">{PAGE_NAMES[currentPage] || 'Asistente'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {healthData && (
                                <span className={`text-xs font-bold ${scoreColor(healthData.score)}`}>
                                    {healthData.score}/100
                                </span>
                            )}
                            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors ml-2">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/5 shrink-0">
                        {[
                            { key: 'chat' as const, label: 'Chat', icon: <MessageCircle size={12} /> },
                            { key: 'health' as const, label: 'Salud', icon: <TrendingUp size={12} /> },
                            { key: 'insights' as const, label: 'Insights', icon: <BarChart2 size={12} /> },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2 text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
                                    activeTab === tab.key
                                        ? 'text-violet-400 border-b-2 border-violet-500'
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* CHAT TAB */}
                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full">
                                {/* Quick checks (top 3) */}
                                {context?.checks && context.checks.length > 0 && (
                                    <div className="px-3 py-2 space-y-1.5 max-h-28 overflow-y-auto border-b border-white/5 shrink-0">
                                        {context.checks.slice(0, 2).map((check: NovaCheck, i: number) => (
                                            <button key={i} onClick={() => handleAction(check.action)}
                                                className={`w-full p-2 rounded-lg text-left text-[10px] flex items-start gap-2 transition-all active:scale-[0.98] ${
                                                    check.type === 'alert' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                                                    check.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' :
                                                    'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                                                }`}>
                                                <span className="shrink-0 mt-0.5">{ICON_MAP[check.icon] || <Lightbulb size={14} />}</span>
                                                <span className="flex-1">{check.message}</span>
                                                <ArrowRight size={12} className="shrink-0 mt-0.5 opacity-50" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap ${
                                                msg.role === 'user'
                                                    ? 'bg-violet-600 text-white rounded-br-sm'
                                                    : 'bg-white/5 border border-white/5 text-slate-200 rounded-bl-sm'
                                            }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white/5 rounded-2xl px-3 py-2 text-xs text-slate-500 animate-pulse">
                                                Nova pensando...
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                        )}

                        {/* HEALTH TAB */}
                        {activeTab === 'health' && healthData && (
                            <div className="p-4 space-y-4">
                                {/* Score */}
                                <div className="text-center">
                                    <div className={`text-4xl font-black ${scoreColor(healthData.score)}`}>
                                        {healthData.score}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{scoreGreeting(healthData.score)}</p>
                                    <div className="w-full h-2 bg-white/5 rounded-full mt-3 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${scoreBarColor(healthData.score)}`}
                                            style={{ width: `${healthData.score}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Completed items */}
                                {healthData.completed?.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Completado</p>
                                        {healthData.completed.map((item: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-[11px] text-emerald-400">
                                                <Check size={12} /> {item}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pending checks */}
                                {healthData.checks?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Pendiente</p>
                                        {(showAllChecks ? healthData.checks : healthData.checks.slice(0, 4)).map((check: NovaCheck, i: number) => (
                                            <button key={i} onClick={() => handleAction(check.action)}
                                                className={`w-full p-2.5 rounded-lg text-left text-[11px] flex items-start gap-2 transition-all active:scale-[0.98] ${
                                                    check.type === 'alert' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                                                    check.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' :
                                                    check.type === 'info' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' :
                                                    'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                                                }`}>
                                                <span className="shrink-0 mt-0.5">{ICON_MAP[check.icon] || <Lightbulb size={14} />}</span>
                                                <span className="flex-1">{check.message}</span>
                                                <ArrowRight size={12} className="shrink-0 mt-0.5 opacity-50" />
                                            </button>
                                        ))}
                                        {healthData.checks.length > 4 && (
                                            <button
                                                onClick={() => setShowAllChecks(!showAllChecks)}
                                                className="w-full text-center text-[10px] text-slate-500 hover:text-slate-300 py-1 flex items-center justify-center gap-1"
                                            >
                                                {showAllChecks ? <><ChevronUp size={12} /> Menos</> : <><ChevronDown size={12} /> Ver {healthData.checks.length - 4} mas</>}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Stats */}
                                {healthData.stats && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="bg-white/5 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-white">{healthData.stats.products || 0}</p>
                                            <p className="text-[9px] text-slate-500">Productos</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-white">{healthData.stats.documents || 0}</p>
                                            <p className="text-[9px] text-slate-500">Documentos</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-white">{healthData.stats.conversations_week || 0}</p>
                                            <p className="text-[9px] text-slate-500">Convs (7d)</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-2 text-center">
                                            <p className="text-lg font-bold text-white">{healthData.stats.derivations_today || 0}</p>
                                            <p className="text-[9px] text-slate-500">Derivaciones hoy</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* INSIGHTS TAB */}
                        {activeTab === 'insights' && (
                            <div className="p-4 space-y-4">
                                {dailyData?.available && dailyData.analysis ? (
                                    <>
                                        {/* Summary */}
                                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
                                            <p className="text-[11px] text-violet-300">{dailyData.analysis.resumen}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] text-slate-500">{dailyData.analysis.conversations_count} conversaciones</span>
                                                {dailyData.analysis.satisfaccion_estimada && (
                                                    <span className="text-[10px] text-amber-400">Satisfaccion: {dailyData.analysis.satisfaccion_estimada}/10</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Frequent topics */}
                                        {dailyData.analysis.temas_frecuentes && dailyData.analysis.temas_frecuentes.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">Temas frecuentes</p>
                                                <div className="space-y-1">
                                                    {dailyData.analysis.temas_frecuentes.map((t, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
                                                            <span className="text-[11px] text-white">{t.tema}</span>
                                                            {t.cantidad_aprox && (
                                                                <span className="text-[10px] text-slate-500">{t.cantidad_aprox}x</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Problems */}
                                        {dailyData.analysis.problemas && dailyData.analysis.problemas.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">Problemas detectados</p>
                                                <div className="space-y-1">
                                                    {dailyData.analysis.problemas.map((p, i) => (
                                                        <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[11px] text-red-300">
                                                            {p}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Uncovered topics */}
                                        {dailyData.analysis.temas_sin_cobertura && dailyData.analysis.temas_sin_cobertura.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">Sin cobertura</p>
                                                <div className="space-y-1">
                                                    {dailyData.analysis.temas_sin_cobertura.map((t, i) => (
                                                        <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[11px] text-amber-300">
                                                            {t}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Suggestions with Apply button */}
                                        {dailyData.analysis.sugerencias && dailyData.analysis.sugerencias.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">Sugerencias de mejora</p>
                                                <div className="space-y-2">
                                                    {dailyData.analysis.sugerencias.map((s, i) => (
                                                        <div key={i} className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                                                            <p className="text-[11px] text-cyan-300 font-medium">{s.titulo}</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">{s.detalle}</p>
                                                            {appliedIdxs.includes(i) ? (
                                                                <div className="flex items-center gap-1 text-emerald-400 text-[10px] mt-2">
                                                                    <Check size={12} /> Aplicada
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => applySuggestion(s, i)}
                                                                    disabled={applyingIdx === i}
                                                                    className="mt-2 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-[10px] text-cyan-300 transition-all disabled:opacity-50"
                                                                >
                                                                    {applyingIdx === i ? 'Aplicando...' : 'Aplicar sugerencia'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <BarChart2 size={32} className="text-slate-600 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">Sin datos de hoy</p>
                                        <p className="text-[10px] text-slate-600 mt-1">
                                            Nova analiza tus conversaciones automaticamente cada 12 horas.
                                            Los insights aparecen aca cuando haya actividad.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input — only on chat tab */}
                    {activeTab === 'chat' && (
                        <div className="px-3 py-2 border-t border-white/5 shrink-0">
                            <div className="flex gap-2">
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder="Preguntale a Nova..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 outline-none"
                                />
                                <button onClick={sendMessage} disabled={loading || !input.trim()}
                                    className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0">
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
