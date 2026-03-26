import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Sparkles, X, Send, AlertTriangle, Lightbulb, Shield, BookOpen,
    Package, Image, Bot, Link, Database, Clock, ArrowRight, Check,
    MessageCircle, BarChart2, TrendingUp, ChevronDown, ChevronUp,
    Mic, MicOff, Volume2, Loader
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

    // UI state
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
    const inputRef = useRef<HTMLInputElement>(null);

    // Voice state
    const [voiceState, setVoiceState] = useState<'idle' | 'connecting' | 'listening' | 'processing' | 'speaking'>('idle');
    const wsRef = useRef<WebSocket | null>(null);
    const playbackCtxRef = useRef<AudioContext | null>(null);
    const captureCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const nextPlayTimeRef = useRef(0);
    const novaPlayingRef = useRef(false);
    const micPausedRef = useRef(false);
    const pendingTranscriptRef = useRef('');

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

    // Lock body scroll when panel is open on mobile
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Fetch context + health when opening, then auto-start voice
    useEffect(() => {
        if (isOpen) {
            fetchContext();
            fetchHealth();
            fetchDailyAnalysis();
            // Auto-start voice when widget opens
            if (voiceState === 'idle') {
                // Small delay to let context load first
                const t = setTimeout(() => startVoice(), 500);
                return () => clearTimeout(t);
            }
        } else {
            stopVoice();
        }
    }, [isOpen]);

    // Stop pulse after 10 seconds
    useEffect(() => {
        const timer = setTimeout(() => setPulse(false), 10000);
        return () => clearTimeout(timer);
    }, []);

    // Toast on page load
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
            } catch (e) { /* Non-blocking */ }
        };
        const timer = setTimeout(checkAlerts, 2000);
        return () => clearTimeout(timer);
    }, []);

    // ===================== DATA FETCHING =====================

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

    // ===================== TEXT CHAT =====================

    const sendMessage = async () => {
        if (!input.trim()) return;
        const msg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setLoading(true);
        inputRef.current?.blur();
        try {
            const novaPrompt = `Sos Nova, la asistente inteligente de Future Platform. Hablas en espanol argentino con voseo. Sos proactiva y directa. Estas en la pagina: ${currentPage}.
Contexto: ${context ? JSON.stringify(context.stats) : 'Sin datos'}
Health Score: ${healthData?.score ?? '?'}/100
Checks: ${healthData?.checks?.map((c: NovaCheck) => c.message).join('; ') || 'Ninguno'}
Responde breve (max 3 oraciones). Termina con una sugerencia concreta.`;
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

    // ===================== VOICE PIPELINE =====================

    const startVoice = async () => {
        if (voiceState !== 'idle') return;
        setVoiceState('connecting');

        try {
            // 1. Get mic permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 2. Create Nova session
            const contextSummary = context
                ? `Score: ${healthData?.score}/100. ${context.greeting || ''} Stats: ${JSON.stringify(context.stats || {})}`
                : 'Sin contexto cargado';

            const sessionRes = await fetchApi('/admin/nova/session', {
                method: 'POST',
                body: { page: currentPage, context_summary: contextSummary }
            });

            if (!sessionRes?.session_id) {
                throw new Error('No session_id');
            }

            // 3. Connect WebSocket
            const hostname = window.location.hostname;
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = (hostname === 'localhost' || hostname === '127.0.0.1') ? ':3000' : '';
            const wsUrl = `${proto}//${hostname}${port}/api/public/nova/ws/${sessionRes.session_id}`;

            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            ws.onopen = () => {
                setVoiceState('listening');
                startAudioCapture(stream, ws);
            };

            ws.onmessage = (evt) => {
                if (evt.data instanceof ArrayBuffer) {
                    // Nova audio chunk — mute mic to prevent echo
                    if (!novaPlayingRef.current) {
                        novaPlayingRef.current = true;
                        micPausedRef.current = true;
                    }
                    setVoiceState('speaking');
                    playAudio(evt.data);
                } else {
                    try {
                        const msg = JSON.parse(evt.data);

                        if (msg.type === 'transcript') {
                            if (msg.role === 'assistant') {
                                setVoiceState('speaking');
                                pendingTranscriptRef.current += msg.text;
                            } else if (msg.role === 'user') {
                                // Barge-in
                                novaPlayingRef.current = false;
                                micPausedRef.current = false;
                                cancelPlayback();
                                setVoiceState('processing');
                                setMessages(prev => [...prev, { role: 'user', content: msg.text }]);
                            }
                        } else if (msg.type === 'user_speech_started') {
                            novaPlayingRef.current = false;
                            micPausedRef.current = false;
                            cancelPlayback();
                            setVoiceState('processing');
                        } else if (msg.type === 'nova_audio_done') {
                            // Unmute after playback finishes
                            const ctx = playbackCtxRef.current;
                            const remainingMs = ctx
                                ? Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000)
                                : 0;
                            setTimeout(() => {
                                novaPlayingRef.current = false;
                                micPausedRef.current = false;
                            }, remainingMs + 300);
                        } else if (msg.type === 'response_done') {
                            if (pendingTranscriptRef.current) {
                                const fullText = pendingTranscriptRef.current;
                                pendingTranscriptRef.current = '';
                                setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
                            }
                            setTimeout(() => {
                                novaPlayingRef.current = false;
                                micPausedRef.current = false;
                            }, 500);
                            setVoiceState('listening');
                        } else if (msg.type === 'tool_call') {
                            // Tool executed — could update UI
                            const { name } = msg;
                            if (name === 'ir_a_pagina' && msg.args?.page) {
                                const route = ACTION_ROUTES[msg.args.page] || `/${msg.args.page}`;
                                navigate(route);
                            }
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
            };

            ws.onclose = () => {
                setVoiceState('idle');
                cleanupAudio();
            };

            ws.onerror = () => {
                setVoiceState('idle');
                cleanupAudio();
            };

        } catch (e) {
            console.error('[Nova Voice] Failed:', e);
            setVoiceState('idle');
            cleanupAudio();
        }
    };

    const stopVoice = () => {
        if (wsRef.current) { try { wsRef.current.close(); } catch (e) {} wsRef.current = null; }
        cleanupAudio();
        setVoiceState('idle');
    };

    const cleanupAudio = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (processorRef.current) { try { processorRef.current.disconnect(); } catch (e) {} processorRef.current = null; }
        if (captureCtxRef.current) { try { captureCtxRef.current.close(); } catch (e) {} captureCtxRef.current = null; }
        cancelPlayback();
        pendingTranscriptRef.current = '';
        novaPlayingRef.current = false;
        micPausedRef.current = false;
    };

    const startAudioCapture = (stream: MediaStream, ws: WebSocket) => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        captureCtxRef.current = audioCtx;
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

        const nativeSampleRate = audioCtx.sampleRate;
        const targetSampleRate = 24000;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (micPausedRef.current || novaPlayingRef.current) return;
            if (ws.readyState !== WebSocket.OPEN) return;

            const input = e.inputBuffer.getChannelData(0);
            let resampled: Float32Array;
            if (nativeSampleRate === targetSampleRate) {
                resampled = input;
            } else {
                const ratio = nativeSampleRate / targetSampleRate;
                const newLength = Math.floor(input.length / ratio);
                resampled = new Float32Array(newLength);
                for (let i = 0; i < newLength; i++) {
                    resampled[i] = input[Math.floor(i * ratio)];
                }
            }

            const pcm16 = new Int16Array(resampled.length);
            for (let i = 0; i < resampled.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768));
            }
            ws.send(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
    };

    const playAudio = (arrayBuffer: ArrayBuffer) => {
        if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
            playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextPlayTimeRef.current = 0;
        }
        const ctx = playbackCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        const pcm16 = new Int16Array(arrayBuffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);

        const now = ctx.currentTime;
        const startTime = Math.max(now, nextPlayTimeRef.current);
        src.start(startTime);
        nextPlayTimeRef.current = startTime + buffer.duration;
    };

    const cancelPlayback = () => {
        if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
            try { playbackCtxRef.current.close(); } catch (e) {}
        }
        playbackCtxRef.current = null;
        nextPlayTimeRef.current = 0;
        novaPlayingRef.current = false;
        micPausedRef.current = false;
    };

    // ===================== HELPERS =====================

    const handleAction = (action: string) => {
        const route = ACTION_ROUTES[action];
        if (route) { navigate(route); setIsOpen(false); }
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
            if (res?.response) setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
        } catch (e) { /* Fallback */ }
        setApplyingIdx(null);
    };

    const scoreColor = (score: number) => score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
    const scoreBarColor = (score: number) => score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
    const scoreGreeting = (score: number) => score >= 80 ? 'Tu negocio esta al dia!' : score >= 50 ? 'Vas bien, pero podes mejorar' : 'Tu negocio necesita atencion';

    const voiceLabel = {
        idle: 'Activar voz',
        connecting: 'Conectando...',
        listening: 'Escuchando...',
        processing: 'Procesando...',
        speaking: 'Nova hablando...',
    };

    // ===================== RENDER =====================

    return (
        <>
            {/* Toast */}
            {toastVisible && (
                <div className="fixed bottom-36 lg:bottom-24 left-3 right-3 lg:left-6 lg:right-auto z-[9999] lg:max-w-sm animate-fade-in">
                    <div className="bg-[#1a1a2e] border border-violet-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-violet-600/20 flex items-start gap-3">
                        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white leading-relaxed">{toastMessage}</p>
                            <button onClick={() => { setToastVisible(false); setIsOpen(true); }} className="text-[11px] text-violet-400 hover:text-violet-300 mt-1 py-1">
                                Ver detalles
                            </button>
                        </div>
                        <button onClick={() => setToastVisible(false)} className="text-slate-500 hover:text-white p-1 -mr-1"><X size={16} /></button>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={`fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[9998] w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full shadow-2xl shadow-violet-600/30 flex items-center justify-center text-white hover:scale-110 transition-all active:scale-95 ${pulse ? 'animate-pulse' : ''}`}
                >
                    <Sparkles size={24} />
                    {healthData?.checks?.filter((c: NovaCheck) => c.type === 'alert').length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                            {healthData.checks.filter((c: NovaCheck) => c.type === 'alert').length}
                        </span>
                    )}
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <>
                    <div className="lg:hidden fixed inset-0 bg-black/60 z-[9997] backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div
                        className="fixed z-[9998] bg-[#0f0f17] flex flex-col overflow-hidden inset-0 lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:h-[560px] lg:rounded-2xl lg:border lg:border-violet-500/20 lg:shadow-2xl lg:shadow-violet-600/10"
                        style={{ maxHeight: '-webkit-fill-available' }}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-white/5 flex items-center justify-between shrink-0 safe-top">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 lg:w-7 lg:h-7 bg-violet-600 rounded-lg flex items-center justify-center">
                                    <Sparkles size={16} className="text-white lg:w-[14px] lg:h-[14px]" />
                                </div>
                                <div>
                                    <p className="text-base lg:text-sm font-bold text-white">Nova</p>
                                    <p className="text-[10px] lg:text-[9px] text-slate-500">{PAGE_NAMES[currentPage] || 'Asistente'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {healthData && (
                                    <span className={`text-sm lg:text-xs font-bold ${scoreColor(healthData.score)}`}>
                                        {healthData.score}/100
                                    </span>
                                )}
                                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1.5 -mr-1 rounded-lg active:bg-white/10">
                                    <X size={20} className="lg:w-4 lg:h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/5 shrink-0">
                            {([
                                { key: 'chat' as const, label: 'Chat', icon: <MessageCircle size={14} /> },
                                { key: 'health' as const, label: 'Salud', icon: <TrendingUp size={14} /> },
                                { key: 'insights' as const, label: 'Insights', icon: <BarChart2 size={14} /> },
                            ]).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 py-3 lg:py-2 text-xs lg:text-[10px] font-medium flex items-center justify-center gap-1.5 transition-all active:bg-white/5 ${
                                        activeTab === tab.key ? 'text-violet-400 border-b-2 border-violet-500' : 'text-slate-500'
                                    }`}
                                >{tab.icon} {tab.label}</button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {/* CHAT TAB */}
                            {activeTab === 'chat' && (
                                <div className="flex flex-col h-full">
                                    {/* Voice status bar */}
                                    {voiceState !== 'idle' && (
                                        <div className={`px-4 py-2.5 flex items-center justify-between shrink-0 border-b border-white/5 ${
                                            voiceState === 'speaking' ? 'bg-violet-600/10' :
                                            voiceState === 'listening' ? 'bg-emerald-600/10' :
                                            'bg-white/5'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                {voiceState === 'listening' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                                {voiceState === 'speaking' && <Volume2 size={14} className="text-violet-400 animate-pulse" />}
                                                {voiceState === 'processing' && <Loader size={14} className="text-amber-400 animate-spin" />}
                                                {voiceState === 'connecting' && <Loader size={14} className="text-slate-400 animate-spin" />}
                                                <span className="text-xs text-slate-300">{voiceLabel[voiceState]}</span>
                                            </div>
                                            <button
                                                onClick={stopVoice}
                                                className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 active:bg-red-500/20"
                                            >
                                                Detener
                                            </button>
                                        </div>
                                    )}

                                    {/* Quick checks */}
                                    {context?.checks && context.checks.length > 0 && (
                                        <div className="px-3 py-2 space-y-1.5 max-h-32 overflow-y-auto border-b border-white/5 shrink-0">
                                            {context.checks.slice(0, 2).map((check: NovaCheck, i: number) => (
                                                <button key={i} onClick={() => handleAction(check.action)}
                                                    className={`w-full p-2.5 lg:p-2 rounded-xl lg:rounded-lg text-left text-xs lg:text-[10px] flex items-start gap-2.5 transition-all active:scale-[0.98] ${
                                                        check.type === 'alert' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                                                        check.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' :
                                                        'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                                                    }`}>
                                                    <span className="shrink-0 mt-0.5">{ICON_MAP[check.icon] || <Lightbulb size={14} />}</span>
                                                    <span className="flex-1 leading-relaxed">{check.message}</span>
                                                    <ArrowRight size={14} className="shrink-0 mt-0.5 opacity-50" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5 lg:space-y-2">
                                        {messages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 lg:px-3 lg:py-2 text-sm lg:text-xs leading-relaxed whitespace-pre-wrap ${
                                                    msg.role === 'user'
                                                        ? 'bg-violet-600 text-white rounded-br-sm'
                                                        : 'bg-white/5 border border-white/5 text-slate-200 rounded-bl-sm'
                                                }`}>{msg.content}</div>
                                            </div>
                                        ))}
                                        {loading && (
                                            <div className="flex justify-start">
                                                <div className="bg-white/5 rounded-2xl px-3.5 py-2.5 lg:px-3 lg:py-2 text-sm lg:text-xs text-slate-500 animate-pulse">
                                                    Nova pensando...
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>
                            )}

                            {/* HEALTH TAB — same as before */}
                            {activeTab === 'health' && healthData && (
                                <div className="p-4 space-y-5 lg:space-y-4">
                                    <div className="text-center">
                                        <div className={`text-5xl lg:text-4xl font-black ${scoreColor(healthData.score)}`}>{healthData.score}</div>
                                        <p className="text-xs lg:text-[10px] text-slate-500 mt-1">{scoreGreeting(healthData.score)}</p>
                                        <div className="w-full h-2.5 lg:h-2 bg-white/5 rounded-full mt-3 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${scoreBarColor(healthData.score)}`} style={{ width: `${healthData.score}%` }} />
                                        </div>
                                    </div>
                                    {healthData.completed?.length > 0 && (
                                        <div className="space-y-1.5 lg:space-y-1">
                                            <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider">Completado</p>
                                            {healthData.completed.map((item: string, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-sm lg:text-[11px] text-emerald-400 py-0.5">
                                                    <Check size={14} className="shrink-0" /> <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {healthData.checks?.length > 0 && (
                                        <div className="space-y-2 lg:space-y-1.5">
                                            <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider">Pendiente</p>
                                            {(showAllChecks ? healthData.checks : healthData.checks.slice(0, 4)).map((check: NovaCheck, i: number) => (
                                                <button key={i} onClick={() => handleAction(check.action)}
                                                    className={`w-full p-3 lg:p-2.5 rounded-xl lg:rounded-lg text-left text-sm lg:text-[11px] flex items-start gap-2.5 transition-all active:scale-[0.98] active:bg-white/5 ${
                                                        check.type === 'alert' ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                                                        check.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' :
                                                        check.type === 'info' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' :
                                                        'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                                                    }`}>
                                                    <span className="shrink-0 mt-0.5">{ICON_MAP[check.icon] || <Lightbulb size={14} />}</span>
                                                    <span className="flex-1 leading-relaxed">{check.message}</span>
                                                    <ArrowRight size={14} className="shrink-0 mt-0.5 opacity-50" />
                                                </button>
                                            ))}
                                            {healthData.checks.length > 4 && (
                                                <button onClick={() => setShowAllChecks(!showAllChecks)}
                                                    className="w-full text-center text-xs lg:text-[10px] text-slate-500 hover:text-slate-300 py-2 flex items-center justify-center gap-1 active:bg-white/5 rounded-lg">
                                                    {showAllChecks ? <><ChevronUp size={14} /> Menos</> : <><ChevronDown size={14} /> Ver {healthData.checks.length - 4} mas</>}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {healthData.stats && (
                                        <div className="grid grid-cols-2 gap-2.5 lg:gap-2 mt-2">
                                            {[
                                                { val: healthData.stats.products || 0, label: 'Productos' },
                                                { val: healthData.stats.documents || 0, label: 'Documentos' },
                                                { val: healthData.stats.conversations_week || 0, label: 'Convs (7d)' },
                                                { val: healthData.stats.derivations_today || 0, label: 'Derivaciones hoy' },
                                            ].map((s, i) => (
                                                <div key={i} className="bg-white/5 rounded-xl lg:rounded-lg p-3 lg:p-2 text-center">
                                                    <p className="text-xl lg:text-lg font-bold text-white">{s.val}</p>
                                                    <p className="text-[10px] lg:text-[9px] text-slate-500">{s.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* INSIGHTS TAB — same as before */}
                            {activeTab === 'insights' && (
                                <div className="p-4 space-y-5 lg:space-y-4">
                                    {dailyData?.available && dailyData.analysis ? (
                                        <>
                                            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl lg:rounded-lg p-3.5 lg:p-3">
                                                <p className="text-sm lg:text-[11px] text-violet-300 leading-relaxed">{dailyData.analysis.resumen}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs lg:text-[10px] text-slate-500">{dailyData.analysis.conversations_count} conversaciones</span>
                                                    {dailyData.analysis.satisfaccion_estimada && (
                                                        <span className="text-xs lg:text-[10px] text-amber-400">Satisfaccion: {dailyData.analysis.satisfaccion_estimada}/10</span>
                                                    )}
                                                </div>
                                            </div>
                                            {dailyData.analysis.temas_frecuentes && dailyData.analysis.temas_frecuentes.length > 0 && (
                                                <div>
                                                    <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2 lg:mb-1.5">Temas frecuentes</p>
                                                    <div className="space-y-1.5 lg:space-y-1">
                                                        {dailyData.analysis.temas_frecuentes.map((t, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl lg:rounded-lg px-3.5 py-2.5 lg:px-3 lg:py-1.5">
                                                                <span className="text-sm lg:text-[11px] text-white">{t.tema}</span>
                                                                {t.cantidad_aprox && <span className="text-xs lg:text-[10px] text-slate-500 ml-2 shrink-0">{t.cantidad_aprox}x</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {dailyData.analysis.problemas && dailyData.analysis.problemas.length > 0 && (
                                                <div>
                                                    <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2 lg:mb-1.5">Problemas detectados</p>
                                                    <div className="space-y-1.5 lg:space-y-1">
                                                        {dailyData.analysis.problemas.map((p, i) => (
                                                            <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-xl lg:rounded-lg px-3.5 py-2.5 lg:px-3 lg:py-2 text-sm lg:text-[11px] text-red-300 leading-relaxed">{p}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {dailyData.analysis.temas_sin_cobertura && dailyData.analysis.temas_sin_cobertura.length > 0 && (
                                                <div>
                                                    <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2 lg:mb-1.5">Sin cobertura</p>
                                                    <div className="space-y-1.5 lg:space-y-1">
                                                        {dailyData.analysis.temas_sin_cobertura.map((t, i) => (
                                                            <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl lg:rounded-lg px-3.5 py-2.5 lg:px-3 lg:py-2 text-sm lg:text-[11px] text-amber-300 leading-relaxed">{t}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {dailyData.analysis.sugerencias && dailyData.analysis.sugerencias.length > 0 && (
                                                <div>
                                                    <p className="text-xs lg:text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2 lg:mb-1.5">Sugerencias de mejora</p>
                                                    <div className="space-y-2.5 lg:space-y-2">
                                                        {dailyData.analysis.sugerencias.map((s, i) => (
                                                            <div key={i} className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl lg:rounded-lg p-3.5 lg:p-3">
                                                                <p className="text-sm lg:text-[11px] text-cyan-300 font-medium">{s.titulo}</p>
                                                                <p className="text-xs lg:text-[10px] text-slate-400 mt-1 leading-relaxed">{s.detalle}</p>
                                                                {appliedIdxs.includes(i) ? (
                                                                    <div className="flex items-center gap-1 text-emerald-400 text-xs lg:text-[10px] mt-2"><Check size={14} /> Aplicada</div>
                                                                ) : (
                                                                    <button onClick={() => applySuggestion(s, i)} disabled={applyingIdx === i}
                                                                        className="mt-2.5 lg:mt-2 px-4 py-2 lg:px-3 lg:py-1 bg-cyan-500/20 hover:bg-cyan-500/30 active:bg-cyan-500/40 border border-cyan-500/30 rounded-xl lg:rounded-lg text-xs lg:text-[10px] text-cyan-300 transition-all disabled:opacity-50">
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
                                        <div className="text-center py-12 lg:py-8">
                                            <BarChart2 size={40} className="text-slate-600 mx-auto mb-3 lg:w-8 lg:h-8" />
                                            <p className="text-base lg:text-sm text-slate-500">Sin datos de hoy</p>
                                            <p className="text-xs lg:text-[10px] text-slate-600 mt-1 px-4 leading-relaxed">
                                                Nova analiza tus conversaciones automaticamente cada 12 horas.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input bar — only on chat tab */}
                        {activeTab === 'chat' && (
                            <div className="px-3 py-3 lg:py-2 border-t border-white/5 shrink-0 safe-bottom bg-[#0f0f17]">
                                <div className="flex gap-2">
                                    {/* Mic button */}
                                    <button
                                        onClick={() => voiceState === 'idle' ? startVoice() : stopVoice()}
                                        className={`w-11 h-11 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                                            voiceState !== 'idle'
                                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                                : 'bg-white/5 hover:bg-white/10 text-violet-400 border border-white/10'
                                        }`}
                                    >
                                        {voiceState !== 'idle' ? <MicOff size={16} /> : <Mic size={16} />}
                                    </button>

                                    <input
                                        ref={inputRef}
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                        placeholder="Escribi o habla..."
                                        inputMode="text"
                                        enterKeyHint="send"
                                        autoComplete="off"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:px-3 lg:py-2 text-sm lg:text-xs text-white placeholder-slate-500 focus:border-violet-500 outline-none"
                                    />
                                    <button onClick={sendMessage} disabled={loading || !input.trim()}
                                        className="w-11 h-11 lg:w-9 lg:h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0">
                                        <Send size={16} className="lg:w-[14px] lg:h-[14px]" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
};
