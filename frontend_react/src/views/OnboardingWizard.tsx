import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, ArrowRight, ArrowLeft, Store, Facebook, Mic, MicOff, Send,
    Check, CheckCircle, AlertCircle, Copy, ChevronDown, Phone, Zap,
    BarChart2, MessageCircle, Globe, CreditCard, X, Volume2, Star
} from 'lucide-react';

// --- Constants ---

const STEP_LABELS = ['Bienvenida', 'Tienda Nube', 'Meta', 'Identidad', 'Reglas', 'Diccionario', 'Revision', 'Plan'];

const TIPS: Record<number, string[]> = {
    0: ["Future potencia tu tienda con IA de ultima generacion", "Miles de comercios ya usan agentes IA para vender mas"],
    1: ["Tu agente podra buscar productos y crear ordenes automaticamente", "La conexion con Tienda Nube sincroniza tu catalogo completo"],
    2: ["Con Meta conectado, atendes WhatsApp, Instagram y Facebook simultaneamente", "Tu agente responde 24/7 sin que tengas que estar conectado"],
    3: ["Los agentes con personalidad definida tienen 40% mas engagement", "Un tono autentico genera confianza y cierra mas ventas"],
    4: ["Las reglas claras reducen 60% las consultas repetitivas", "Tu agente nunca va a prometer algo que no puedas cumplir"],
    5: ["Con el diccionario, tu agente entiende 'remera', 'playera' o 'franela'", "La jerga local hace que tus clientes se sientan entendidos"],
    6: ["Prueba tu agente antes de activarlo — asegurate de que suene perfecto", "Podes editar cualquier seccion antes de activar"],
    7: ["Los comercios con IA venden 3x mas en los primeros 30 dias", "Tu agente nunca duerme — atiende los 365 dias del ano"]
};

const TN_DEV_MESSAGE = `Hola! Estoy configurando un asistente de IA para nuestra tienda.
Necesito que me compartas el Store ID y Access Token de Tienda Nube.

Como obtenerlo:
1. Ingresa al admin de Tienda Nube
2. Ve a Configuracion > Aplicaciones > Mis aplicaciones
3. Crea una app o usa una existente
4. Copia el Store ID y el Access Token

Solo necesito esos dos datos. Gracias!`;

const selectClass = "w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 outline-none";
const inputClass = "w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 outline-none";

// --- Main Component ---

export const OnboardingWizard: React.FC = () => {
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(0);
    const [stepData, setStepData] = useState<Record<string, any>>({});
    const [systemPrompt, setSystemPrompt] = useState('');
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Step 1 (TN)
    const [tnStoreId, setTnStoreId] = useState('');
    const [tnToken, setTnToken] = useState('');
    const [tnConnected, setTnConnected] = useState(false);
    const [tnStoreName, setTnStoreName] = useState('');
    const [showTnHelp, setShowTnHelp] = useState(false);
    const [tnCopied, setTnCopied] = useState(false);

    // Step 2 (Meta)
    const [metaConnected, setMetaConnected] = useState(false);

    // Steps 3-4-5 (Chat)
    const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatSessionId] = useState(() => Math.random().toString(36).substring(7));
    const [sectionDraft, setSectionDraft] = useState('');
    const [sectionComplete, setSectionComplete] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Audio STT
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<any>(null);

    // Step 6 (Test)
    const [testMessage, setTestMessage] = useState('');
    const [testResponse, setTestResponse] = useState('');
    const [testLoading, setTestLoading] = useState(false);

    // Notifications
    const [notification, setNotification] = useState<string | null>(null);
    const notifTimerRef = useRef<any>(null);

    // --- Init ---
    useEffect(() => {
        loadProgress();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Notification system
    useEffect(() => {
        const showTip = () => {
            const tips = TIPS[step] || [];
            if (tips.length === 0) return;
            const tip = tips[Math.floor(Math.random() * tips.length)];
            setNotification(tip);
            setTimeout(() => setNotification(null), 8000);
        };
        notifTimerRef.current = setInterval(showTip, 30000);
        // Show first tip after 5 sec
        const first = setTimeout(showTip, 5000);
        return () => { clearInterval(notifTimerRef.current); clearTimeout(first); };
    }, [step]);

    const loadProgress = async () => {
        try {
            const data = await fetchApi('/admin/onboarding-wizard/progress');
            if (data && !data.detail) {
                if (data.should_show_wizard === false) {
                    navigate('/', { replace: true });
                    return;
                }
                setStep(data.current_step || 0);
                setStepData(data.step_data || {});
                setSystemPrompt(data.system_prompt_draft || '');
                setTenantId(data.tenant_id);
            }
        } catch (e) { /* first time */ }
        setLoading(false);
    };

    const saveProgress = async (newStep: number, extraData?: Record<string, any>, promptDraft?: string) => {
        const merged = { ...stepData, ...extraData };
        setStepData(merged);
        if (promptDraft !== undefined) setSystemPrompt(promptDraft);
        try {
            await fetchApi('/admin/onboarding-wizard/progress', {
                method: 'PUT',
                body: { step: newStep, step_data: extraData, system_prompt_draft: promptDraft }
            });
        } catch (e) { /* non-blocking */ }
    };

    const goNext = async () => {
        const next = step + 1;
        await saveProgress(next);
        setStep(next);
        // Reset chat for new step
        if (next >= 3 && next <= 5) {
            setChatMessages([]);
            setSectionDraft('');
            setSectionComplete(false);
            initChat(next);
        }
    };

    const goBack = () => {
        if (step > 1) {
            setStep(step - 1);
            // Reset chat state when going back to a chat step
            setChatMessages([]);
            setSectionDraft('');
            setSectionComplete(false);
        }
    };

    const goToStep = (targetStep: number) => {
        // Can only go to completed steps or current step
        if (targetStep < step && targetStep >= 1) {
            setStep(targetStep);
            setChatMessages([]);
            setSectionDraft('');
            setSectionComplete(false);
        }
    };

    // --- Step 0: Welcome + Create Tenant ---
    useEffect(() => {
        if (step === 0 && !tenantId) {
            const timer = setTimeout(async () => {
                try {
                    const res = await fetchApi('/admin/onboarding-wizard/create-tenant', {
                        method: 'POST', body: {}
                    });
                    if (res?.tenant_id) setTenantId(res.tenant_id);
                } catch (e) { /* tenant might already exist */ }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    // Auto-advance step 0
    useEffect(() => {
        if (step === 0) {
            const timer = setTimeout(() => goNext(), 5000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    // --- Step 1: Tienda Nube ---
    const connectTN = async () => {
        if (!tnStoreId.trim() || !tnToken.trim()) { setError('Ingresa Store ID y Access Token'); return; }
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/admin/credentials', { method: 'POST', body: { name: 'TIENDANUBE_ACCESS_TOKEN', value: tnToken.trim(), category: 'tiendanube', scope: 'tenant' } });
            await fetchApi('/admin/credentials', { method: 'POST', body: { name: 'TIENDANUBE_STORE_ID', value: tnStoreId.trim(), category: 'tiendanube', scope: 'tenant' } });
            setTnConnected(true);
            setTnStoreName(tnStoreId);
            await saveProgress(1, { step_1: { completed: true, store_id: tnStoreId, tiendanube_connected: true } });
        } catch (e: any) {
            setError(e.message || 'Error al conectar');
        } finally { setLoading(false); }
    };

    // --- Step 2: Meta ---
    const connectMeta = () => {
        const clientId = (import.meta as any).env?.VITE_META_APP_ID || '';
        const redirectUri = encodeURIComponent(window.location.origin + '/settings/meta');
        const scope = 'pages_show_list,pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,business_management';
        const url = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
        window.open(url, 'meta_oauth', 'width=600,height=700');
        // User will come back and mark as done
    };

    // --- Steps 3-4-5: Chat ---
    const initChat = async (chatStep: number) => {
        setChatLoading(true);
        try {
            const res = await fetchApi('/admin/onboarding/interview-step', {
                method: 'POST',
                body: { session_id: chatSessionId + `_s${chatStep}`, user_message: 'INIT', step: chatStep, tenant_id: tenantId || 0, reset: true }
            });
            if (res?.ai_message) setChatMessages([{ role: 'assistant', content: res.ai_message }]);
        } catch (e) { /* fallback */ }
        setChatLoading(false);
    };

    useEffect(() => {
        if (step >= 3 && step <= 5 && chatMessages.length === 0) {
            initChat(step);
        }
    }, [step]);

    const sendChatMessage = async (text?: string) => {
        const msg = text || chatInput.trim();
        if (!msg) return;
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
        setChatLoading(true);
        try {
            const res = await fetchApi('/admin/onboarding/interview-step', {
                method: 'POST',
                body: { session_id: chatSessionId + `_s${step}`, user_message: msg, step, tenant_id: tenantId || 0 }
            });
            if (res?.ai_message) setChatMessages(prev => [...prev, { role: 'assistant', content: res.ai_message }]);
            if (res?.section_complete && res?.extracted_draft) {
                setSectionComplete(true);
                setSectionDraft(res.extracted_draft);
            }
        } catch (e) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.' }]);
        }
        setChatLoading(false);
    };

    const confirmSection = async () => {
        const sectionKey = { 3: 'tone', 4: 'rules', 5: 'dictionary' }[step] || 'unknown';
        const newPrompt = systemPrompt + '\n\n' + sectionDraft;
        setSystemPrompt(newPrompt);
        await saveProgress(step, { [`step_${step}`]: { completed: true, [`${sectionKey}_draft`]: sectionDraft } }, newPrompt);
        goNext();
    };

    // --- Audio STT ---
    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const startRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            const text = event.results[event.results.length - 1][0].transcript;
            sendChatMessage(text);
            // Reset silence timer
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => stopRecording(), 15000);
        };

        recognition.onerror = () => stopRecording();
        recognition.onend = () => setIsRecording(false);

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);

        // 15s silence cutoff
        silenceTimerRef.current = setTimeout(() => stopRecording(), 15000);
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        clearTimeout(silenceTimerRef.current);
        setIsRecording(false);
    };

    // --- Step 6: Test Agent ---
    const testAgent = async () => {
        if (!testMessage.trim()) return;
        setTestLoading(true);
        try {
            const res = await fetchApi('/admin/onboarding-wizard/test-agent', {
                method: 'POST',
                body: { message: testMessage, system_prompt: systemPrompt }
            });
            setTestResponse(res?.response || 'Sin respuesta');
        } catch (e) { setTestResponse('Error al probar el agente'); }
        setTestLoading(false);
    };

    const activateAgent = async () => {
        setLoading(true);
        try {
            const res = await fetchApi('/admin/onboarding-wizard/complete', { method: 'POST' });
            if (res?.agent_id) {
                await saveProgress(7);
                setStep(7);
            }
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    };

    // --- Step 7: Pricing ---
    const startTrial = async () => {
        try {
            // Mark wizard as complete — trial starts automatically from existing logic
            await saveProgress(7);
            navigate('/', { replace: true });
        } catch (e) { navigate('/'); }
    };

    const goToCheckout = async (plan: string) => {
        try {
            const res = await fetchApi('/billing/checkout', {
                method: 'POST',
                body: { plan_name: plan, provider: 'stripe', billing_period: 'monthly', currency: 'USD' }
            });
            if (res?.checkout_url) window.location.href = res.checkout_url;
        } catch (e) { setError('Error al procesar pago'); }
    };

    // --- Render Helpers ---
    const hasSpeechAPI = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    if (loading && step === 0) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#09090b] flex items-center justify-center">
                <Sparkles size={32} className="text-violet-400 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-[#09090b] flex flex-col overflow-hidden">
            {/* Step Bar */}
            {step > 0 && (
                <div className="px-4 py-3 lg:px-8 lg:py-4 border-b border-white/5 bg-black/40 shrink-0">
                    <div className="flex items-center justify-center gap-1 lg:gap-2 max-w-2xl mx-auto">
                        {STEP_LABELS.map((label, i) => (
                            <div key={i} className="flex items-center gap-1 lg:gap-2">
                                <div
                                    onClick={() => i < step && i >= 1 ? goToStep(i) : null}
                                    className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[9px] lg:text-xs font-bold transition-all ${
                                    i < step ? 'bg-violet-600 text-white cursor-pointer hover:bg-violet-500 active:scale-90' :
                                    i === step ? 'bg-violet-500 text-white ring-2 ring-violet-400/50 scale-110' :
                                    'bg-white/5 text-slate-600'
                                }`}>
                                    {i < step ? <Check size={12} /> : i}
                                </div>
                                {i < 7 && <div className={`w-3 lg:w-6 h-0.5 ${i < step ? 'bg-violet-600' : 'bg-white/5'}`} />}
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-[10px] lg:text-xs text-slate-500 mt-1">{STEP_LABELS[step]}</p>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10">

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-sm">
                            <AlertCircle size={14} /> {error}
                            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
                        </div>
                    )}

                    {/* === STEP 0: Welcome === */}
                    {step === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
                            <div className="w-20 h-20 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-violet-600/30">
                                <Sparkles size={36} className="text-white" />
                            </div>
                            <h1 className="text-2xl lg:text-4xl font-black text-white mb-3">
                                Bienvenido a Future{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                            </h1>
                            <p className="text-slate-400 text-sm lg:text-base max-w-md mb-8">
                                En los proximos minutos vamos a crear tu asistente de IA perfecto para tu negocio.
                            </p>
                            <button onClick={goNext} className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-violet-600/30">
                                Comenzar <ArrowRight size={18} />
                            </button>
                            <p className="text-[10px] text-slate-600 mt-4">Avanza automaticamente en 5 segundos</p>
                        </div>
                    )}

                    {/* === STEP 1: Tienda Nube === */}
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Store size={28} className="text-blue-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Conecta tu Tienda Nube</h2>
                                <p className="text-slate-400 text-sm mt-1">Necesitamos tu Store ID y Access Token</p>
                            </div>

                            <div className="glass p-5 rounded-xl border border-white/5 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Store ID</label>
                                    <input value={tnStoreId} onChange={e => setTnStoreId(e.target.value)} placeholder="Ej: 1234567" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Access Token</label>
                                    <input type="password" value={tnToken} onChange={e => setTnToken(e.target.value)} placeholder="Token de API" className={inputClass} />
                                </div>
                                <button onClick={connectTN} disabled={loading || tnConnected}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all active:scale-[0.98]">
                                    {tnConnected ? <span className="flex items-center justify-center gap-2"><CheckCircle size={16} /> Conectada: {tnStoreName}</span> : 'Conectar Tienda'}
                                </button>
                            </div>

                            {/* Help Section */}
                            <button onClick={() => setShowTnHelp(!showTnHelp)}
                                className="w-full p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl text-left transition-all hover:bg-amber-500/10 active:scale-[0.99]">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-300">Necesito ayuda para conectar</span>
                                    <ChevronDown size={14} className={`text-amber-400 transition-transform ${showTnHelp ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {showTnHelp && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                        <p className="text-[11px] font-bold text-blue-300 mb-2">Pasos para obtener tus datos:</p>
                                        <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
                                            <li>Ingresa al admin de Tienda Nube</li>
                                            <li>Ve a <span className="text-white">Configuracion &gt; Aplicaciones</span></li>
                                            <li>Crea una app o usa una existente</li>
                                            <li>Copia el Store ID y Access Token</li>
                                        </ol>
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(TN_DEV_MESSAGE); setTnCopied(true); setTimeout(() => setTnCopied(false), 2000); }}
                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                                            tnCopied ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                                        }`}>
                                        {tnCopied ? <><Check size={16} /> Mensaje copiado!</> : <><Copy size={16} /> Copiar mensaje para tu dev</>}
                                    </button>
                                </div>
                            )}

                            {(tnConnected) && (
                                <button onClick={goNext} className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    Siguiente <ArrowRight size={16} />
                                </button>
                            )}

                            <button onClick={() => { saveProgress(1, { step_1: { completed: true, tiendanube_connected: false } }); goNext(); }}
                                className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 transition-colors py-2">
                                No uso Tienda Nube (funciones limitadas)
                            </button>
                        </div>
                    )}

                    {/* === STEP 2: Meta === */}
                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-[#1877F2]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Facebook size={28} className="text-[#1877F2]" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Conecta Meta</h2>
                                <p className="text-slate-400 text-sm mt-1">WhatsApp, Instagram y Facebook Messenger</p>
                            </div>

                            <div className="glass p-5 rounded-xl border border-white/5 text-center space-y-4">
                                {metaConnected ? (
                                    <div className="flex items-center justify-center gap-2 text-green-400">
                                        <CheckCircle size={20} /> <span className="font-bold">Conectado</span>
                                    </div>
                                ) : (
                                    <button onClick={connectMeta}
                                        className="w-full py-3 bg-[#1877F2] hover:bg-[#1565C0] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                        <Facebook size={18} /> Conectar con Meta
                                    </button>
                                )}
                                <button onClick={() => setMetaConnected(true)} className="text-[10px] text-slate-600 hover:text-slate-400">
                                    Ya conecte mi cuenta ✓
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={goBack} className="flex-1 py-3 bg-white/5 text-slate-400 font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    <ArrowLeft size={16} /> Atras
                                </button>
                                <button onClick={goNext} className="flex-[2] py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    {metaConnected ? 'Siguiente' : 'Configurar despues'} <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === STEPS 3-4-5: Chat === */}
                    {step >= 3 && step <= 5 && (
                        <div className="flex flex-col h-[calc(100vh-160px)] animate-fade-in">
                            <div className="text-center mb-4">
                                <h2 className="text-lg font-bold text-white">
                                    {step === 3 ? 'Identidad de tu Negocio' : step === 4 ? 'Reglas de Negocio' : 'Diccionario de Sinonimos'}
                                </h2>
                                <p className="text-slate-500 text-xs mt-1">Conversa con el arquitecto para configurar esta seccion</p>
                            </div>

                            {!sectionComplete ? (
                                <>
                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1">
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                                                    msg.role === 'user'
                                                        ? 'bg-violet-600 text-white rounded-br-sm'
                                                        : 'bg-white/5 border border-white/5 text-slate-200 rounded-bl-sm'
                                                }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-white/5 rounded-2xl px-4 py-3 text-sm text-slate-500 animate-pulse">
                                                    Escribiendo...
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <div className="flex gap-2 shrink-0 pb-2">
                                        {hasSpeechAPI && (
                                            <button onClick={toggleRecording}
                                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                                                    isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                }`}>
                                                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                                            </button>
                                        )}
                                        <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                                            placeholder="Escribe o habla..."
                                            className={`${inputClass} flex-1`} />
                                        <button onClick={() => sendChatMessage()} disabled={chatLoading || !chatInput.trim()}
                                            className="w-11 h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0">
                                            <Send size={16} />
                                        </button>
                                    </div>

                                    {/* Manual "Listo" button */}
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={goBack}
                                            className="flex-1 py-2 text-xs text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1">
                                            <ArrowLeft size={12} /> Atras
                                        </button>
                                        <button onClick={() => sendChatMessage('Ya tengo todo listo, genera el resumen.')}
                                            className="flex-1 py-2 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                                            Ya termine esta seccion →
                                        </button>
                                    </div>
                                </>
                            ) : (
                                /* Section Complete — Editable Summary */
                                <div className="space-y-4">
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm">
                                        <CheckCircle size={16} /> Seccion completada
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Resumen (editable)</label>
                                        <textarea value={sectionDraft} onChange={e => setSectionDraft(e.target.value)} rows={8}
                                            className={`${inputClass} resize-none font-mono text-xs`} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setSectionComplete(false); setSectionDraft(''); }}
                                            className="flex-1 py-3 bg-white/5 text-slate-400 font-bold rounded-xl transition-all active:scale-[0.98]">
                                            Volver al chat
                                        </button>
                                        <button onClick={confirmSection}
                                            className="flex-[2] py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                            Confirmar y seguir <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === STEP 6: Review === */}
                    {step === 6 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center mb-4">
                                <h2 className="text-xl font-bold text-white">Revision Final</h2>
                                <p className="text-slate-400 text-sm mt-1">Revisa y prueba tu agente antes de activarlo</p>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Store size={14} className="text-blue-400 mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Tienda</p>
                                    <p className="text-xs text-white truncate">{stepData.step_1?.tiendanube_connected ? 'Conectada' : 'Pendiente'}</p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Facebook size={14} className="text-[#1877F2] mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Meta</p>
                                    <p className="text-xs text-white truncate">{stepData.step_2?.meta_connected || metaConnected ? 'Conectado' : 'Pendiente'}</p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Volume2 size={14} className="text-violet-400 mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Tono</p>
                                    <p className="text-xs text-white truncate">{stepData.step_3?.completed ? 'Configurado' : 'Pendiente'}</p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Zap size={14} className="text-amber-400 mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Reglas</p>
                                    <p className="text-xs text-white truncate">{stepData.step_4?.completed ? 'Configuradas' : 'Pendiente'}</p>
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div className="glass p-4 rounded-xl border border-white/5">
                                <label className="block text-xs font-bold text-slate-400 mb-2">System Prompt Completo</label>
                                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={6}
                                    className={`${inputClass} resize-none font-mono text-[10px] leading-relaxed`} />
                            </div>

                            {/* Test Agent */}
                            <div className="glass p-4 rounded-xl border border-white/5 space-y-3">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <MessageCircle size={14} className="text-green-400" /> Probar Agente
                                </h3>
                                <div className="flex gap-2">
                                    <input value={testMessage} onChange={e => setTestMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && testAgent()}
                                        placeholder="Ej: Hola, tienen zapatillas?" className={`${inputClass} flex-1`} />
                                    <button onClick={testAgent} disabled={testLoading}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all active:scale-95">
                                        {testLoading ? '...' : 'Probar'}
                                    </button>
                                </div>
                                {testResponse && (
                                    <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg text-sm text-slate-200 whitespace-pre-wrap">
                                        {testResponse}
                                    </div>
                                )}
                            </div>

                            <button onClick={activateAgent} disabled={loading}
                                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2">
                                <Sparkles size={16} /> Activar Agente
                            </button>

                            <button onClick={goBack}
                                className="w-full py-2.5 text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]">
                                <ArrowLeft size={14} /> Volver al paso anterior
                            </button>
                        </div>
                    )}

                    {/* === STEP 7: Pricing === */}
                    {step === 7 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="text-center mb-4">
                                <div className="text-4xl mb-3">🎉</div>
                                <h2 className="text-2xl font-black text-white">Tu agente esta listo!</h2>
                                <p className="text-slate-400 text-sm mt-2">Elige como quieres continuar</p>
                            </div>

                            <div className="space-y-3">
                                {/* Pro */}
                                <div className="glass p-5 rounded-xl border border-violet-500/30 relative">
                                    <span className="absolute -top-2 right-4 bg-violet-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Pro</h3>
                                            <p className="text-slate-500 text-xs">Para negocios en crecimiento</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-white">$49</p>
                                            <p className="text-[10px] text-slate-500">USD/mes</p>
                                        </div>
                                    </div>
                                    <ul className="text-xs text-slate-400 space-y-1 mb-4">
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" /> 5,000 mensajes/mes</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" /> 3 agentes, 5 tiendas</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" /> Voice Widget (60 min/mes)</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-violet-400" /> Analytics y ROI</li>
                                    </ul>
                                    <button onClick={() => goToCheckout('pro')}
                                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]">
                                        Suscribirme al Pro
                                    </button>
                                </div>

                                {/* Enterprise */}
                                <div className="glass p-5 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Enterprise</h3>
                                            <p className="text-slate-500 text-xs">Para grandes equipos</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-white">$199</p>
                                            <p className="text-[10px] text-slate-500">USD/mes</p>
                                        </div>
                                    </div>
                                    <ul className="text-xs text-slate-400 space-y-1 mb-4">
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> Mensajes ilimitados</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> Agentes y tiendas ilimitados</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> Voice Widget (300 min/mes)</li>
                                        <li className="flex items-center gap-1.5"><Check size={12} className="text-indigo-400" /> Soporte prioritario + SLA</li>
                                    </ul>
                                    <button onClick={() => goToCheckout('enterprise')}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all active:scale-[0.98] border border-white/10">
                                        Suscribirme al Enterprise
                                    </button>
                                </div>

                                {/* Free Trial */}
                                <button onClick={startTrial}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all active:scale-[0.98] border border-white/5 text-center">
                                    <p className="text-sm">Probar Gratis</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">10 dias · 50 mensajes · 1 agente</p>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div className="fixed bottom-4 left-4 right-4 lg:left-auto lg:right-auto lg:bottom-6 lg:left-6 max-w-sm z-[10000] animate-fade-in">
                    <div className="bg-violet-600/90 backdrop-blur-lg text-white px-4 py-3 rounded-xl shadow-2xl shadow-violet-600/20 flex items-start gap-3">
                        <Sparkles size={16} className="shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed flex-1">{notification}</p>
                        <button onClick={() => setNotification(null)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};
