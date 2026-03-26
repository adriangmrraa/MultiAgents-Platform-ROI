import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Sparkles, X, Mic, MicOff, Send, AlertTriangle, Lightbulb,
    Package, Image, Bot, Link, Database, Clock, ArrowRight, Check
} from 'lucide-react';

interface NovaCheck {
    type: 'warning' | 'suggestion' | 'alert';
    icon: string;
    message: string;
    action: string;
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
};

const ACTION_ROUTES: Record<string, string> = {
    'cargar_productos': '/products',
    'agregar_fotos': '/products',
    'actualizar_stock': '/products',
    'crear_agente': '/onboarding-wizard?step=3',
    'mejorar_prompt': '/onboarding-wizard?step=6',
    'conectar_canales': '/settings/meta',
    'subir_docs': '/knowledge',
    'ver_planes': '/billing',
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
    const [context, setContext] = useState<any>(null);
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [pulse, setPulse] = useState(true);
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

    // Don't show on onboarding wizard (it has its own Nova)
    if (location.pathname.includes('onboarding-wizard')) return null;

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Fetch context when opening or changing page
    useEffect(() => {
        if (isOpen) {
            fetchContext();
        }
    }, [isOpen, currentPage]);

    // Stop pulse after 10 seconds
    useEffect(() => {
        const timer = setTimeout(() => setPulse(false), 10000);
        return () => clearTimeout(timer);
    }, []);

    const fetchContext = async () => {
        try {
            const data = await fetchApi(`/admin/nova/context?page=${currentPage}`);
            setContext(data);
            if (data?.greeting && messages.length === 0) {
                setMessages([{ role: 'assistant', content: data.greeting }]);
            } else if (data?.greeting && messages.length > 0) {
                // Page changed — add new context message
                const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
                if (lastAssistant?.content !== data.greeting) {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.greeting }]);
                }
            }
        } catch (e) {
            // Non-blocking
        }
    };

    const sendMessage = async () => {
        if (!input.trim()) return;
        const msg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setLoading(true);

        try {
            // Use test-agent endpoint with Nova's context as system prompt
            const novaPrompt = `Sos Nova, la asistente inteligente de Future Platform. Hablas en espanol argentino con voseo. Sos proactiva y directa. Estas en la pagina: ${currentPage}.

Contexto actual:
${context ? JSON.stringify(context.stats) : 'Sin datos'}

Checks pendientes:
${context?.checks?.map((c: NovaCheck) => c.message).join('\n') || 'Ninguno'}

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

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={`fixed bottom-6 right-6 z-[9998] w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full shadow-2xl shadow-violet-600/30 flex items-center justify-center text-white hover:scale-110 transition-all active:scale-95 ${pulse ? 'animate-pulse' : ''}`}
                >
                    <Sparkles size={24} />
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-80 lg:w-96 h-[520px] z-[9998] bg-[#0f0f17] rounded-2xl border border-violet-500/20 shadow-2xl shadow-violet-600/10 flex flex-col overflow-hidden animate-fade-in">
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
                        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Checks Cards */}
                    {context?.checks && context.checks.length > 0 && (
                        <div className="px-3 py-2 space-y-1.5 max-h-32 overflow-y-auto border-b border-white/5 shrink-0">
                            {context.checks.slice(0, 3).map((check: NovaCheck, i: number) => (
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

                    {/* Input */}
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
                </div>
            )}
        </>
    );
};
