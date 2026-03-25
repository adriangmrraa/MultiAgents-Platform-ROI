import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useFacebookSdk } from '../hooks/useFacebookSdk';
import MetaOnboardingWizard from './settings/MetaOnboardingWizard';
import {
    Sparkles, ArrowRight, ArrowLeft, Store, Facebook, Mic, MicOff, Send,
    Check, CheckCircle, AlertCircle, Copy, ChevronDown, Phone, Zap,
    BarChart2, MessageCircle, Globe, CreditCard, X, Volume2, Star, Instagram
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

    // Step 1 (Web research)
    const [webUrl, setWebUrl] = useState('');
    const [webResearching, setWebResearching] = useState(false);
    const [webResearchDone, setWebResearchDone] = useState(false);
    const [webResearchContext, setWebResearchContext] = useState('');

    // Step 2 (Meta + WhatsApp provider)
    const [waProvider, setWaProvider] = useState<'meta' | 'ycloud' | null>(null);
    const [metaConnected, setMetaConnected] = useState(false);
    const [metaStatus, setMetaStatus] = useState<'idle' | 'loading' | 'wizard' | 'connected'>('idle');
    const [metaAssets, setMetaAssets] = useState<any>(null);
    const [metaConnectedAssets, setMetaConnectedAssets] = useState<Record<string, boolean>>({});
    const isFbSdkReady = useFacebookSdk();
    // YCloud
    const [ycloudKey, setYcloudKey] = useState('');
    const [ycloudSecret, setYcloudSecret] = useState('');
    const [ycloudSaved, setYcloudSaved] = useState(false);

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

    // Voice Architect
    const [voiceMode, setVoiceMode] = useState(false);
    const [voiceConsent, setVoiceConsent] = useState(false);
    const [voiceState, setVoiceState] = useState<'idle' | 'speaking' | 'listening' | 'processing'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [chatHistories, setChatHistories] = useState<Record<number, { role: string; content: string; confirmSection?: string }[]>>({});
    const [confirmedSections, setConfirmedSections] = useState<Record<string, boolean>>({});
    // Realtime WebSocket
    const realtimeWsRef = useRef<WebSocket | null>(null);
    const realtimeAudioCtxRef = useRef<AudioContext | null>(null);
    const realtimeStreamRef = useRef<MediaStream | null>(null);
    const realtimeProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const pendingTranscriptRef = useRef<string>('');
    const nextPlayTimeRef = useRef(0);
    // Research cards cascade
    const [researchCards, setResearchCards] = useState<{tipo: string, titulo: string, valor: string, icono: string}[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showingResearch, setShowingResearch] = useState(false);
    // Section badges + dynamic UI from tools
    const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
    const [activeSectionTitle, setActiveSectionTitle] = useState('');
    const [activeSectionDesc, setActiveSectionDesc] = useState('');
    const [activeSectionButtons, setActiveSectionButtons] = useState<{label: string, accion: string, estilo: string}[]>([]);
    const [dynamicCards, setDynamicCards] = useState<{tipo: string, titulo: string, valor: string, icono?: string}[]>([]);
    const [micPaused, setMicPaused] = useState(false);
    const micPausedRef = useRef(false);

    // Step 6 (Test)
    const [testMessage, setTestMessage] = useState('');
    // Knowledge collections
    const [knowledgeCollections, setKnowledgeCollections] = useState<string[]>([]);
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [knowledgeFiles, setKnowledgeFiles] = useState<{id: string, filename: string, status: string, collection: string}[]>([]);
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
                // Never redirect away — user can always access the wizard
                // The wizard is both for onboarding AND for editing agent config later
                const sd = data.step_data || {};
                let draft = data.system_prompt_draft || '';
                setStepData(sd);
                setTenantId(data.tenant_id);

                // If draft is empty/short, reconstruct from chat histories in step_data
                if ((!draft || draft.length < 100)) {
                    const chatParts: string[] = [];
                    for (const s of [3, 4, 5]) {
                        const stepChat = sd[`step_${s}`]?.chat_history;
                        if (stepChat && Array.isArray(stepChat)) {
                            for (const msg of stepChat) {
                                if (msg.role === 'assistant' && msg.content) {
                                    chatParts.push(msg.content);
                                } else if (msg.role === 'user' && msg.content) {
                                    chatParts.push(`USUARIO: ${msg.content}`);
                                }
                            }
                        }
                        // Also check for section drafts
                        const toneDraft = sd[`step_${s}`]?.tone_draft;
                        const rulesDraft = sd[`step_${s}`]?.rules_draft;
                        const dictDraft = sd[`step_${s}`]?.dictionary_draft;
                        if (toneDraft) chatParts.push(toneDraft);
                        if (rulesDraft) chatParts.push(rulesDraft);
                        if (dictDraft) chatParts.push(dictDraft);
                    }
                    if (chatParts.length > 0) {
                        draft = chatParts.join('\n\n');
                    }
                }
                setSystemPrompt(draft);

                // URL param ?step=6 to jump to review
                const urlParams = new URLSearchParams(window.location.search);
                const forceStep = urlParams.get('step');
                if (forceStep && parseInt(forceStep) >= 0) {
                    setStep(parseInt(forceStep));
                }
                // If user has a draft and is past step 5, go to review
                else if (draft && draft.length > 100 && (data.current_step || 0) >= 5) {
                    setStep(6);
                }
                else {
                    setStep(data.current_step || 0);
                }

                // Restore step 1 state
                if (sd.step_1?.tiendanube_connected) {
                    setTnConnected(true);
                    setTnStoreName(sd.step_1.store_id || '');
                }
                // Restore web research
                if (sd.web_research?.url) { setWebUrl(sd.web_research.url); setWebResearchDone(true); }
                if (sd.web_research?.full_context) setWebResearchContext(sd.web_research.full_context);
                // Restore step 2 state
                if (sd.step_2?.wa_provider) setWaProvider(sd.step_2.wa_provider);
                if (sd.step_2?.ycloud_connected) setYcloudSaved(true);
                if (sd.step_2?.meta_connected) { setMetaConnected(true); setMetaStatus('connected'); }
                // Restore chat histories for steps 3-4-5
                const restored: Record<number, any[]> = {};
                for (const s of [3, 4, 5]) {
                    if (sd[`step_${s}`]?.chat_history && sd[`step_${s}`].chat_history.length > 0) {
                        restored[s] = sd[`step_${s}`].chat_history;
                    }
                }
                if (Object.keys(restored).length > 0) setChatHistories(restored);
                // Restore confirmed sections
                if (sd.confirmed_sections) setConfirmedSections(sd.confirmed_sections);
                // Set voice consent if user already accepted before
                if (sd.voice_consent) setVoiceConsent(true);
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
        // ALWAYS stop realtime before advancing
        stopRealtimeAudio();
        // Save current chat history before moving
        if (step >= 3 && step <= 5 && chatMessages.length > 0) {
            setChatHistories(prev => ({ ...prev, [step]: chatMessages }));
        }
        const next = step + 1;
        await saveProgress(next);
        setStep(next);
        if (next >= 3 && next <= 5) {
            setSectionDraft('');
            setSectionComplete(false);
            // Load history if exists, otherwise fresh start
            if (chatHistories[next] && chatHistories[next].length > 0) {
                setChatMessages(chatHistories[next]);
            } else {
                setChatMessages([]);
                if (voiceConsent) {
                    initChatWithVoice(next);
                } else {
                    initChat(next);
                }
            }
        }
    };

    const goBack = () => {
        if (step > 1) {
            // Save current chat history
            if (step >= 3 && step <= 5 && chatMessages.length > 0) {
                setChatHistories(prev => ({ ...prev, [step]: chatMessages }));
            }
            const prev = step - 1;
            setStep(prev);
            setSectionDraft('');
            setSectionComplete(false);
            // Restore history if going back to a chat step
            if (prev >= 3 && prev <= 5 && chatHistories[prev]) {
                setChatMessages(chatHistories[prev]);
            } else {
                setChatMessages([]);
            }
        }
    };

    const goToStep = (targetStep: number) => {
        if (targetStep < step && targetStep >= 1) {
            if (step >= 3 && step <= 5 && chatMessages.length > 0) {
                setChatHistories(prev => ({ ...prev, [step]: chatMessages }));
            }
            setStep(targetStep);
            setSectionDraft('');
            setSectionComplete(false);
            if (targetStep >= 3 && targetStep <= 5 && chatHistories[targetStep]) {
                setChatMessages(chatHistories[targetStep]);
            } else {
                setChatMessages([]);
            }
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

    // --- Step 2: Meta (reuses same FB.login flow as MetaSettings) ---
    const connectMeta = () => {
        if (!isFbSdkReady || !(window as any).FB) {
            setError('Facebook SDK no cargado. Recarga la pagina.');
            return;
        }
        setMetaStatus('loading');
        const loginParams: any = {
            config_id: import.meta.env.VITE_META_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
        };
        if (import.meta.env.VITE_META_EMBEDDED_SIGNUP === 'true') {
            loginParams.extras = { feature: 'whatsapp_embedded_signup', setup: {} };
        }
        (window as any).FB.login((response: any) => {
            const code = response.authResponse?.code || response.code;
            const accessToken = response.authResponse?.accessToken;
            if (accessToken) {
                connectMetaBackend(accessToken, 'token');
            } else if (code) {
                connectMetaBackend(code, 'code');
            } else {
                setMetaStatus('idle');
                if (response.status !== 'connected' && response.status !== 'unknown') {
                    setError('No se recibio autorizacion de Meta.');
                }
            }
        }, loginParams);
    };

    const connectMetaBackend = async (credential: string, type: 'code' | 'token') => {
        try {
            const redirectUri = window.location.origin + '/settings/meta';
            const res = await fetchApi('/admin/meta/connect', {
                method: 'POST',
                body: { ...(type === 'code' ? { code: credential } : { access_token: credential }), redirect_uri: redirectUri }
            });
            if (res.status === 'success') {
                const safeAssets = res.assets || { pages: [], instagram: [], whatsapp: [] };
                setMetaAssets(safeAssets);
                setMetaConnectedAssets(res.connected || {});
                setMetaStatus('wizard');
            } else {
                setMetaStatus('idle');
                setError(res.message || 'Conexion con Meta no completada.');
            }
        } catch (e: any) {
            setMetaStatus('idle');
            setError(e.message || 'Error conectando con Meta.');
        }
    };

    const handleMetaWizardComplete = () => {
        setMetaStatus('connected');
        setMetaConnected(true);
        saveProgress(2, { step_2: { completed: true, meta_connected: true, wa_provider: waProvider } });
        setTimeout(() => goNext(), 10000);
    };

    const saveYcloudCredentials = async () => {
        if (!ycloudKey.trim()) { setError('Ingresa tu YCloud API Key'); return; }
        setLoading(true);
        try {
            await fetchApi('/admin/credentials', { method: 'POST', body: { name: 'YCloud API Key', value: ycloudKey.trim(), category: 'whatsapp_cloud', scope: 'tenant' } });
            if (ycloudSecret.trim()) {
                await fetchApi('/admin/credentials', { method: 'POST', body: { name: 'YCloud Webhook Secret', value: ycloudSecret.trim(), category: 'whatsapp_cloud', scope: 'tenant' } });
            }
            setYcloudSaved(true);
            saveProgress(2, { step_2: { completed: true, wa_provider: 'ycloud', ycloud_connected: true } });
        } catch (e: any) {
            setError(e.message || 'Error al guardar credenciales');
        }
        setLoading(false);
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
        // Chat init is now handled by consent card (acceptVoice/declineVoice) or goNext
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
            if (res?.ai_message) {
                const newMsg: any = { role: 'assistant', content: res.ai_message };
                if (res.confirm_section) newMsg.confirmSection = res.confirm_section;
                setChatMessages(prev => [...prev, newMsg]);
            }
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
        // STOP all audio before advancing
        stopRealtimeAudio();
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

    // --- Voice Architect: TTS + Auto-cycle ---

    const getApiBase = () => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000';
        if (hostname.includes('platform-ui')) return window.location.protocol + '//' + hostname.replace('platform-ui', 'orchestrator-service');
        return '/api';
    };

    const playTTS = async (text: string): Promise<void> => {
        if (!text || text.length < 2) return;
        setVoiceState('speaking');
        try {
            const { ADMIN_TOKEN } = await import('../hooks/useApi');
            const res = await fetch(`${getApiBase()}/admin/onboarding/tts`, {
                method: 'POST',
                headers: { 'x-admin-token': ADMIN_TOKEN || '', 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
                credentials: 'include'
            });
            if (!res.ok) { setVoiceState('idle'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            await new Promise<void>((resolve) => {
                audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                audio.play().catch(() => resolve());
            });
        } catch (e) {
            console.warn('[VoiceArchitect] TTS failed:', e);
        }
        setVoiceState('idle');
    };

    const startAutoListen = () => {
        if (!voiceMode) return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[VoiceArchitect] SpeechRecognition not available');
            setVoiceState('idle');
            return;
        }

        // Stop any existing recognition first
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch(e) {}
            recognitionRef.current = null;
        }

        setVoiceState('listening');
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        // Safari doesn't support continuous well — use false and restart on end
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        recognition.continuous = !isSafari;
        recognition.interimResults = true; // Show partial results for better UX

        let accumulated = '';
        let finalTranscript = '';

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }
            accumulated = (finalTranscript + interimTranscript).trim();

            // Reset silence timer on any speech
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                const toSend = finalTranscript.trim() || accumulated.trim();
                if (toSend) {
                    try { recognition.stop(); } catch(e) {}
                    recognitionRef.current = null;
                    setIsRecording(false);
                    setVoiceState('processing');
                    finalTranscript = '';
                    accumulated = '';
                    sendAndSpeak(toSend);
                }
            }, 3000); // 3s silence → send (balanced between fluidity and premature cut)
        };

        // 15s total silence → stop mic
        const totalSilenceTimer = setTimeout(() => {
            if (recognitionRef.current) {
                try { recognition.stop(); } catch(e) {}
                recognitionRef.current = null;
                setIsRecording(false);
                setVoiceState('idle');
            }
        }, 15000);

        recognition.onend = () => {
            clearTimeout(totalSilenceTimer);
            // On Safari, recognition ends after each utterance — restart if still in listening mode
            if (isSafari && voiceMode && !finalTranscript.trim()) {
                try {
                    recognition.start();
                    return;
                } catch(e) {
                    // Can't restart — user needs to tap mic button
                }
            }
            // If we have accumulated text, send it
            if (finalTranscript.trim()) {
                const toSend = finalTranscript.trim();
                finalTranscript = '';
                setIsRecording(false);
                setVoiceState('processing');
                sendAndSpeak(toSend);
                return;
            }
            setIsRecording(false);
            if (voiceState === 'listening') setVoiceState('idle');
        };

        recognition.onerror = (event: any) => {
            console.warn('[VoiceArchitect] STT error:', event.error);
            clearTimeout(totalSilenceTimer);
            clearTimeout(silenceTimerRef.current);
            // 'not-allowed' means mic permission denied
            // 'no-speech' means no speech detected — this is normal
            if (event.error === 'no-speech') {
                // Restart on Safari, ignore on Chrome
                if (isSafari && voiceMode) {
                    try { recognition.start(); return; } catch(e) {}
                }
            }
            setIsRecording(false);
            setVoiceState('idle');
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setIsRecording(true);
            console.log('[VoiceArchitect] STT started, lang=es-AR, continuous=' + !isSafari);
        } catch(e) {
            console.error('[VoiceArchitect] Failed to start STT:', e);
            setVoiceState('idle');
        }
    };

    // Auto-save chat history to DB (non-blocking)
    const saveChatToDb = (msgs: any[]) => {
        try {
            fetchApi('/admin/onboarding-wizard/progress', {
                method: 'PUT',
                body: {
                    step,
                    step_data: {
                        [`step_${step}`]: { chat_history: msgs, completed: false },
                        confirmed_sections: confirmedSections,
                        voice_consent: voiceConsent,
                    }
                }
            }).catch(() => {});
        } catch(e) {}
    };

    const sendAndSpeak = async (text: string) => {
        if (!text.trim()) return;
        const userMsg = { role: 'user', content: text };
        setChatMessages(prev => {
            const updated = [...prev, userMsg];
            return updated;
        });
        setChatLoading(true);
        setVoiceState('processing');
        try {
            const res = await fetchApi('/admin/onboarding/interview-step', {
                method: 'POST',
                body: { session_id: chatSessionId + `_s${step}`, user_message: text, step, tenant_id: tenantId || 0 }
            });
            if (res?.ai_message) {
                const assistantMsg: any = { role: 'assistant', content: res.ai_message };
                if (res.confirm_section) assistantMsg.confirmSection = res.confirm_section;

                setChatMessages(prev => {
                    const updated = [...prev, assistantMsg];
                    // Auto-save to DB after each exchange
                    saveChatToDb(updated);
                    return updated;
                });

                if (res.section_complete && res.extracted_draft) {
                    setSectionComplete(true);
                    setSectionDraft(res.extracted_draft);
                }

                // Play TTS and then auto-listen
                if (voiceMode && !res.section_complete) {
                    setChatLoading(false);
                    await playTTS(res.ai_message);
                    startAutoListen();
                    return;
                }
            }
        } catch (e) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexion. Intenta de nuevo.' }]);
        }
        setChatLoading(false);
        setVoiceState('idle');
    };

    // Extract Meta data before starting chat (context for architect)
    const [metaContext, setMetaContext] = useState('');

    const extractMetaData = async () => {
        if (metaContext) return metaContext;
        // Include web research if available
        let webContext = webResearchContext;
        if (!webContext) {
            // Try to load from DB step_data
            try {
                const prog = await fetchApi('/admin/onboarding-wizard/progress');
                if (prog?.step_data?.web_research?.full_context) {
                    webContext = prog.step_data.web_research.full_context;
                    setWebResearchContext(webContext);
                    setWebResearchDone(true);
                }
            } catch(e) {}
        }
        let tid = tenantId;
        if (!tid) {
            try {
                const prog = await fetchApi('/admin/onboarding-wizard/progress');
                if (prog?.tenant_id) { tid = prog.tenant_id; setTenantId(prog.tenant_id); }
            } catch(e) {}
        }
        try {
            const res = await fetchApi('/admin/onboarding/extract-meta-data', {
                method: 'POST', body: { tenant_id: tid || 0 }
            });
            if (res?.context) {
                // Combine meta context + web research context
                const combined = [res.context, webContext].filter(Boolean).join('\n\n');
                setMetaContext(combined);
                // Build research cards from assets
                const cards: {tipo: string, titulo: string, valor: string, icono: string}[] = [];
                if (res.assets) {
                    for (const a of res.assets) {
                        if (a.type === 'instagram_profile') cards.push({ tipo: 'instagram', titulo: `@${a.username || a.name}`, valor: `${a.followers || 0} seguidores · ${a.bio || ''}`, icono: 'instagram' });
                        if (a.type === 'facebook_page') cards.push({ tipo: 'facebook', titulo: a.name, valor: `${a.fans || 0} fans · ${a.category || ''}`, icono: 'facebook' });
                        if (a.type === 'instagram_posts' && a.posts?.length) cards.push({ tipo: 'post', titulo: 'Ultimo post IG', valor: a.posts[0].substring(0, 120) + '...', icono: 'instagram' });
                        if (a.type === 'facebook_posts' && a.posts?.length) cards.push({ tipo: 'post', titulo: 'Ultimo post FB', valor: a.posts[0].substring(0, 120) + '...', icono: 'facebook' });
                    }
                }
                if (cards.length > 0) {
                    setResearchCards(cards);
                    setShowingResearch(true);
                    setCurrentCardIndex(0);
                }
                return res.context;
            }
        } catch(e) { console.warn('Meta extraction failed:', e); }
        return '';
    };

    const connectRealtime = async (chatStep: number) => {
        // GUARD: never have two sessions
        if (realtimeWsRef.current && realtimeWsRef.current.readyState === WebSocket.OPEN) {
            console.warn('[Realtime] Session already active');
            return;
        }
        // CLEANUP any residual
        stopRealtimeAudio();

        // 1. Get mic permission
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            realtimeStreamRef.current = stream;
        } catch(e) {
            console.error('[Realtime] Mic denied:', e);
            setError('Necesitamos acceso al microfono. Toca el candado en la barra de direccion, permite el microfono, y recarga la pagina.');
            setVoiceMode(false);
            setVoiceConsent(false);
            return;
        }

        // 2. Extract Meta + Web context (WAIT for it before connecting)
        let context = metaContext;
        if (!context) {
            context = await extractMetaData();
        }
        // Also include web research if available
        if (!context && webResearchContext) {
            context = webResearchContext;
        }
        console.log('[Realtime] Context for Nova:', context ? `${context.length} chars` : 'EMPTY');

        // 3. Create realtime session
        try {
            // Include chat history for context restoration
            const savedHistory = chatHistories[chatStep] || [];
            const sessionRes = await fetchApi('/admin/onboarding/realtime-session', {
                method: 'POST',
                body: { step: chatStep, tenant_id: tenantId || 0, meta_context: context, chat_history: savedHistory.map((m: any) => ({ role: m.role, content: m.content })) }
            });
            if (!sessionRes?.session_id) throw new Error('No session');

            // 4. Connect WebSocket via nginx proxy
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const hostname = window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';
            let wsUrl = '';
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                wsUrl = `ws://localhost:3000/public/onboarding/realtime-ws/${sessionRes.session_id}`;
            } else {
                wsUrl = `${proto}//${hostname}${port}/api/public/onboarding/realtime-ws/${sessionRes.session_id}`;
            }
            console.log('[Realtime] Connecting WS:', wsUrl);

            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';
            realtimeWsRef.current = ws;

            ws.onopen = () => {
                console.log('[Realtime] WebSocket connected');
                setRealtimeConnected(true);
                setShowingResearch(false); // Stop research cards, Nova takes over
                setVoiceState('speaking');
                startRealtimeAudioCapture(stream, ws);
            };

            ws.onmessage = (evt) => {
                if (evt.data instanceof ArrayBuffer) {
                    setVoiceState('speaking');
                    playRealtimeAudio(evt.data);
                } else {
                    try {
                        const msg = JSON.parse(evt.data);

                        if (msg.type === 'transcript') {
                            if (msg.role === 'assistant') {
                                setVoiceState('speaking');
                                pendingTranscriptRef.current += msg.text;
                            } else if (msg.role === 'user') {
                                // BARGE-IN: user is speaking → cancel all Nova audio
                                cancelPlayback();
                                setVoiceState('processing');
                                setChatMessages(prev => [...prev, { role: 'user', content: msg.text }]);
                            }
                        } else if (msg.type === 'response_done') {
                            if (pendingTranscriptRef.current) {
                                const fullText = pendingTranscriptRef.current;
                                pendingTranscriptRef.current = '';
                                setChatMessages(prev => {
                                    const updated = [...prev, { role: 'assistant', content: fullText }];
                                    saveChatToDb(updated);
                                    return updated;
                                });
                            }
                            setVoiceState('listening');

                        // TOOL CALLS from Nova
                        } else if (msg.type === 'tool_call') {
                            const { name, args } = msg;
                            console.log('[Realtime] Tool call:', name, args);

                            // Save section → badge verde
                            if (name.startsWith('guardar_')) {
                                setSavedSections(prev => ({ ...prev, [name]: true }));
                            }
                            // Change UI section
                            if (name === 'cambiar_seccion') {
                                setActiveSectionTitle(args.titulo || '');
                                setActiveSectionDesc(args.descripcion || '');
                                if (args.botones) setActiveSectionButtons(args.botones);
                            }
                            // Show data card
                            if (name === 'mostrar_dato_extraido') {
                                setDynamicCards(prev => [...prev, { tipo: args.tipo || '', titulo: args.titulo || '', valor: args.valor || '', icono: args.icono || '' }]);
                            }
                            // Finalize → close WS, show summary
                            if (name === 'finalizar_configuracion') {
                                stopRealtimeAudio();
                                setSectionComplete(true);
                            }
                        }
                    } catch(e) {}
                }
            };

            ws.onclose = () => {
                setRealtimeConnected(false);
                setVoiceState('idle');
                stopRealtimeAudio();
            };

            ws.onerror = () => {
                setRealtimeConnected(false);
                setVoiceState('idle');
                stopRealtimeAudio();
            };

        } catch(e) {
            console.error('[Realtime] Connection failed, falling back to text+TTS:', e);
            // Fallback to text+TTS mode (still uses voice output via TTS)
            await initChatWithVoice(chatStep);
        }
    };

    // Separate ref for capture AudioContext (different from playback)
    const captureAudioCtxRef = useRef<AudioContext | null>(null);

    const startRealtimeAudioCapture = (stream: MediaStream, ws: WebSocket) => {
        // Use native sample rate for capture (browser default, usually 48000)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        captureAudioCtxRef.current = audioCtx;
        const nativeSampleRate = audioCtx.sampleRate;
        const targetSampleRate = 24000; // OpenAI Realtime expects 24kHz PCM16
        console.log(`[Realtime] Capture: native=${nativeSampleRate}Hz, target=${targetSampleRate}Hz`);

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        realtimeProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (micPausedRef.current) return;
            if (ws.readyState !== WebSocket.OPEN) return;

            const input = e.inputBuffer.getChannelData(0);

            // Resample from native rate to 24kHz
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

            // Convert to PCM16
            const pcm16 = new Int16Array(resampled.length);
            for (let i = 0; i < resampled.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768));
            }
            ws.send(pcm16.buffer);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
    };

    // Cancel all currently playing/scheduled audio (barge-in)
    const cancelPlayback = () => {
        if (realtimeAudioCtxRef.current && realtimeAudioCtxRef.current.state !== 'closed') {
            try { realtimeAudioCtxRef.current.close(); } catch(e) {}
        }
        realtimeAudioCtxRef.current = null;
        nextPlayTimeRef.current = 0;
    };

    // Audio playback — sequential queue with barge-in support
    const playRealtimeAudio = (arrayBuffer: ArrayBuffer) => {
        // Create fresh AudioContext if needed (after cancel or first time)
        if (!realtimeAudioCtxRef.current || realtimeAudioCtxRef.current.state === 'closed') {
            realtimeAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextPlayTimeRef.current = 0;
        }
        const ctx = realtimeAudioCtxRef.current;
        const pcm16 = new Int16Array(arrayBuffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768;
        }
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

    const stopRealtimeAudio = () => {
        console.log('[Realtime] Stopping ALL audio + WS + TTS');
        // 0. Stop TTS Audio element (from playTTS fallback)
        if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch(e) {} audioRef.current = null; }
        // 1. Close WS
        if (realtimeWsRef.current) { try { realtimeWsRef.current.close(); } catch(e) {} realtimeWsRef.current = null; }
        // 2. Stop mic
        if (realtimeStreamRef.current) { realtimeStreamRef.current.getTracks().forEach(t => t.stop()); realtimeStreamRef.current = null; }
        // 3. Disconnect processor
        if (realtimeProcessorRef.current) { try { realtimeProcessorRef.current.disconnect(); } catch(e) {} realtimeProcessorRef.current = null; }
        // 4. Close capture AudioContext
        if (captureAudioCtxRef.current) { try { captureAudioCtxRef.current.close(); } catch(e) {} captureAudioCtxRef.current = null; }
        // 5. Cancel all playback (closes playback AudioContext + resets queue)
        cancelPlayback();
        pendingTranscriptRef.current = '';
        // 6. Reset states
        setRealtimeConnected(false);
        setVoiceState('idle');
        setMicPaused(false);
        micPausedRef.current = false;
    };

    const pauseMic = () => {
        const newPaused = !micPaused;
        setMicPaused(newPaused);
        micPausedRef.current = newPaused;
        // Mute audio tracks as visual indicator
        if (realtimeStreamRef.current) {
            realtimeStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !newPaused; });
        }
        // The processor checks micPausedRef and skips sending when paused
        // No disconnect/reconnect needed — simpler and more reliable
    };

    const forceFinish = async () => {
        stopRealtimeAudio();
        // Generate summary via text endpoint
        const allMessages = chatMessages.map((m: any) => ({ role: m.role, content: m.content }));
        try {
            const res = await fetchApi('/admin/onboarding/interview-step', {
                method: 'POST',
                body: { session_id: chatSessionId + `_s${step}`, user_message: 'GENERA EL RESUMEN FINAL con toda la info de la conversacion.', step, tenant_id: tenantId || 0, reset: true, chat_history: allMessages }
            });
            if (res?.extracted_draft) { setSectionDraft(res.extracted_draft); setSectionComplete(true); }
            else if (res?.ai_message) { setSectionDraft(res.ai_message); setSectionComplete(true); }
        } catch(e) { console.error('[ForceFinish] Error:', e); }
    };

    const acceptVoice = async () => {
        setVoiceConsent(true);
        setVoiceMode(true);
        saveProgress(step, { voice_consent: true });
        await connectRealtime(step);
    };

    const declineVoice = () => {
        setVoiceConsent(true);
        setVoiceMode(false);
        initChatWithVoice(step); // Uses history-aware path even in text mode
    };

    // Cleanup realtime on step change or unmount
    useEffect(() => {
        return () => { stopRealtimeAudio(); };
    }, [step]);

    // Load knowledge collections when reaching step 6
    useEffect(() => {
        if (step === 6) {
            fetchApi('/admin/knowledge/collections').then(cols => {
                if (Array.isArray(cols)) setKnowledgeCollections(cols);
            }).catch(() => {});
            fetchApi('/admin/knowledge/list').then(files => {
                if (Array.isArray(files)) setKnowledgeFiles(files.filter((f: any) => f.status === 'active'));
            }).catch(() => {});
        }
    }, [step]);

    // Research cards cascade timer (3 sec each)
    useEffect(() => {
        if (!showingResearch || researchCards.length === 0) return;
        const timer = setInterval(() => {
            setCurrentCardIndex(prev => {
                if (prev >= researchCards.length - 1) {
                    // Keep last card showing until WS connects
                    return prev;
                }
                return prev + 1;
            });
        }, 3000);
        return () => clearInterval(timer);
    }, [showingResearch, researchCards.length]);

    const initChatWithVoice = async (chatStep: number) => {
        const savedHistory = chatHistories[chatStep];
        const hasHistory = savedHistory && savedHistory.length > 0;
        // Always play TTS if user accepted voice (voiceConsent=true means they want voice)
        const shouldSpeak = voiceConsent;

        if (hasHistory) {
            setChatMessages(savedHistory);
            setChatLoading(true);
            try {
                const res = await fetchApi('/admin/onboarding/interview-step', {
                    method: 'POST',
                    body: {
                        session_id: chatSessionId + `_s${chatStep}`,
                        user_message: 'Retomo donde lo dejamos.',
                        step: chatStep,
                        tenant_id: tenantId || 0,
                        reset: true,
                        chat_history: savedHistory.map((m: any) => ({ role: m.role, content: m.content }))
                    }
                });
                if (res?.ai_message) {
                    const msg: any = { role: 'assistant', content: res.ai_message };
                    if (res.confirm_section) msg.confirmSection = res.confirm_section;
                    setChatMessages(prev => [...prev, msg]);
                    setChatLoading(false);
                    if (shouldSpeak) {
                        await playTTS(res.ai_message);
                        startAutoListen();
                    }
                    return;
                }
            } catch(e) {}
            setChatLoading(false);
            return;
        }

        // Fresh start — include Meta context
        setChatLoading(true);
        const ctx = metaContext || await extractMetaData();
        const initMessage = ctx
            ? `INIT. CONTEXTO EXTRAIDO DE LAS REDES SOCIALES DEL NEGOCIO:\n${ctx}\n\nUsa esta informacion para personalizar tus preguntas y demostrar que ya conoces el negocio.`
            : 'INIT';
        try {
            const res = await fetchApi('/admin/onboarding/interview-step', {
                method: 'POST',
                body: { session_id: chatSessionId + `_s${chatStep}`, user_message: initMessage, step: chatStep, tenant_id: tenantId || 0, reset: true }
            });
            if (res?.ai_message) {
                setChatMessages([{ role: 'assistant', content: res.ai_message }]);
                setChatLoading(false);
                // ALWAYS play TTS for the first message — this is the "wow moment"
                if (shouldSpeak) {
                    await playTTS(res.ai_message);
                    startAutoListen();
                }
                return;
            }
        } catch (e) { console.error('[initChatWithVoice] Error:', e); }
        setChatLoading(false);
    };

    const handleConfirm = (section: string) => {
        setConfirmedSections(prev => ({ ...prev, [section]: true }));
        if (voiceMode) {
            sendAndSpeak(`CONFIRMADO: ${section}`);
        }
    };

    // Save chat history when leaving a step
    useEffect(() => {
        return () => {
            if (step >= 3 && step <= 5 && chatMessages.length > 0) {
                setChatHistories(prev => ({ ...prev, [step]: chatMessages }));
            }
        };
    }, [step, chatMessages]);

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
        if (!systemPrompt || systemPrompt.trim().length < 20) {
            setError('El system prompt esta vacio. Conversa con Nova o escribe el prompt antes de activar.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Save the latest system prompt + knowledge collections FIRST
            await fetchApi('/admin/onboarding-wizard/progress', {
                method: 'PUT',
                body: {
                    step: 6,
                    system_prompt_draft: systemPrompt,
                    step_data: { knowledge_sources: selectedCollections }
                }
            });
            // Create/update agent + mark wizard completed
            const res = await fetchApi('/admin/onboarding-wizard/complete', { method: 'POST' });
            if (res?.agent_id) {
                // Update agent with knowledge sources if selected
                if (selectedCollections.length > 0) {
                    await fetchApi(`/admin/agents/${res.agent_id}`, {
                        method: 'PUT',
                        body: { knowledge_sources: selectedCollections, system_prompt_template: systemPrompt, name: 'Agente IA', role: 'sales', model_provider: 'openai', model_version: 'gpt-4o', temperature: 0.3, enabled_tools: ['search_specific_products', 'search_by_category', 'browse_general_storefront', 'orders', 'derivhumano'], channels: ['whatsapp', 'instagram', 'facebook', 'web'], is_active: true }
                    }).catch(() => {});
                }
                setStep(7); // Show pricing
            } else {
                setError('Error al activar el agente');
            }
        } catch (e: any) { setError(e.message || 'Error al activar'); }
        setLoading(false);
    };

    // --- Step 7: Pricing ---
    const startTrial = async () => {
        try {
            // Ensure wizard is marked complete (completed_at set)
            await fetchApi('/admin/onboarding-wizard/complete', { method: 'POST' }).catch(() => {});
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

                            {/* Web URL for research */}
                            <div className="glass p-5 rounded-xl border border-white/5 space-y-3">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Globe size={16} className="text-cyan-400" /> URL de tu Tienda
                                </h3>
                                <p className="text-[10px] text-slate-500">Pega la URL publica de tu tienda para que Nova investigue tu negocio antes de la conversacion.</p>
                                <input value={webUrl} onChange={e => setWebUrl(e.target.value)}
                                    placeholder="https://www.mitienda.com" className={inputClass} />
                                <button onClick={async () => {
                                    if (!webUrl.trim()) return;
                                    setWebResearching(true);
                                    try {
                                        const res = await fetchApi('/admin/onboarding/research-web', {
                                            method: 'POST', body: { url: webUrl.trim(), tenant_id: tenantId || 0 }
                                        });
                                        if (res?.context) {
                                            setWebResearchContext(res.context);
                                            setWebResearchDone(true);
                                        } else {
                                            setError(res?.error || 'No se pudo analizar la web');
                                        }
                                    } catch(e: any) { setError(e.message || 'Error al investigar'); }
                                    setWebResearching(false);
                                }} disabled={webResearching || !webUrl.trim() || webResearchDone}
                                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                                    {webResearching ? (
                                        <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Investigando...</>
                                    ) : webResearchDone ? (
                                        <><CheckCircle size={14} /> Web analizada</>
                                    ) : (
                                        <><Globe size={14} /> Analizar mi web</>
                                    )}
                                </button>
                                {webResearchDone && (
                                    <p className="text-[9px] text-cyan-400">Nova usara esta info en la conversacion del paso 3.</p>
                                )}
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

                    {/* === STEP 2: WhatsApp Provider + Meta Connection === */}
                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center mb-4">
                                <div className="w-14 h-14 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <MessageCircle size={28} className="text-[#25D366]" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Conecta tus Canales</h2>
                                <p className="text-slate-400 text-sm mt-1">WhatsApp, Instagram y Facebook</p>
                            </div>

                            {/* Step 2a: Choose WhatsApp provider (if not chosen yet) */}
                            {!waProvider && !metaConnected && !ycloudSaved && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-400 text-center mb-2">Como conectas WhatsApp?</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setWaProvider('meta')}
                                            className="p-4 rounded-xl border border-white/5 hover:border-[#1877F2]/30 hover:bg-[#1877F2]/5 transition-all active:scale-[0.98] text-center">
                                            <Facebook size={24} className="text-[#1877F2] mx-auto mb-2" />
                                            <p className="text-sm font-bold text-white">Meta Directo</p>
                                            <p className="text-[10px] text-slate-500 mt-1">WhatsApp + Instagram + Facebook en un solo paso</p>
                                            <span className="inline-block mt-2 text-[9px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">RECOMENDADO</span>
                                        </button>
                                        <button onClick={() => setWaProvider('ycloud')}
                                            className="p-4 rounded-xl border border-white/5 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all active:scale-[0.98] text-center">
                                            <MessageCircle size={24} className="text-[#25D366] mx-auto mb-2" />
                                            <p className="text-sm font-bold text-white">YCloud</p>
                                            <p className="text-[10px] text-slate-500 mt-1">WhatsApp via YCloud API. Luego podes agregar Meta</p>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2b: YCloud credentials */}
                            {waProvider === 'ycloud' && !ycloudSaved && (
                                <div className="glass p-5 rounded-xl border border-white/5 space-y-3 animate-fade-in">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <MessageCircle size={16} className="text-[#25D366]" /> YCloud API
                                    </h3>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">API Key</label>
                                        <input value={ycloudKey} onChange={e => setYcloudKey(e.target.value)} placeholder="Tu YCloud API Key" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">Webhook Secret (opcional)</label>
                                        <input value={ycloudSecret} onChange={e => setYcloudSecret(e.target.value)} placeholder="Secret para validar webhooks" className={inputClass} />
                                    </div>
                                    <button onClick={saveYcloudCredentials} disabled={loading}
                                        className="w-full py-3 bg-[#25D366] hover:bg-[#1da851] disabled:opacity-50 text-white font-bold rounded-xl transition-all active:scale-[0.98]">
                                        Guardar YCloud
                                    </button>
                                    <button onClick={() => setWaProvider(null)} className="w-full text-xs text-slate-500 hover:text-slate-300 py-1">
                                        Cambiar proveedor
                                    </button>
                                </div>
                            )}

                            {/* YCloud saved — offer to also connect Meta */}
                            {ycloudSaved && !metaConnected && metaStatus !== 'wizard' && metaStatus !== 'connected' && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2 text-green-400 text-sm">
                                        <CheckCircle size={16} /> YCloud conectado
                                    </div>
                                    <div className="glass p-4 rounded-xl border border-white/5 text-center space-y-3">
                                        <p className="text-xs text-slate-400">Tambien podes conectar Meta para Instagram y Facebook Messenger</p>
                                        <button onClick={connectMeta} disabled={!isFbSdkReady}
                                            className="w-full py-2.5 bg-[#1877F2] hover:bg-[#1565C0] disabled:opacity-50 text-white font-bold rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                                            <Facebook size={16} /> Conectar Meta tambien
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Meta provider flow (same as before) */}
                            {waProvider === 'meta' && metaStatus !== 'connected' && metaStatus !== 'wizard' && !metaConnected && (
                                <div className="glass p-5 rounded-xl border border-white/5 text-center space-y-4 animate-fade-in">
                                    <button onClick={connectMeta} disabled={metaStatus === 'loading' || !isFbSdkReady}
                                        className="w-full py-3 bg-[#1877F2] hover:bg-[#1565C0] disabled:opacity-50 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                        {metaStatus === 'loading' ? (
                                            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Conectando...</>
                                        ) : (
                                            <><Facebook size={18} /> Conectar con Meta</>
                                        )}
                                    </button>
                                    {!isFbSdkReady && <p className="text-[10px] text-amber-400">Cargando SDK de Facebook...</p>}
                                    <button onClick={() => setWaProvider(null)} className="text-xs text-slate-500 hover:text-slate-300">
                                        Cambiar proveedor
                                    </button>
                                </div>
                            )}

                            {/* Meta Wizard — asset selection */}
                            {metaStatus === 'wizard' && metaAssets && (
                                <MetaOnboardingWizard
                                    assets={metaAssets}
                                    onComplete={handleMetaWizardComplete}
                                    onCancel={() => { setMetaStatus('idle'); }}
                                />
                            )}

                            {/* Connected — show assets for 10s then auto-advance */}
                            {metaStatus === 'connected' && (
                                <div className="glass p-5 rounded-xl border border-green-500/20 space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                        <CheckCircle size={20} /> <span className="font-bold">Canales conectados</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 ${metaConnectedAssets.facebook ? 'bg-[#1877F2]/10 border-[#1877F2]/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                            <Facebook size={20} className={metaConnectedAssets.facebook ? 'text-[#1877F2]' : 'text-slate-600'} />
                                            <span className="text-[10px] font-bold text-white">Facebook</span>
                                            {metaConnectedAssets.facebook && <Check size={10} className="text-green-400" />}
                                        </div>
                                        <div className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 ${metaConnectedAssets.instagram ? 'bg-[#E1306C]/10 border-[#E1306C]/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                            <Instagram size={20} className={metaConnectedAssets.instagram ? 'text-[#E1306C]' : 'text-slate-600'} />
                                            <span className="text-[10px] font-bold text-white">Instagram</span>
                                            {metaConnectedAssets.instagram && <Check size={10} className="text-green-400" />}
                                        </div>
                                        <div className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 ${metaConnectedAssets.whatsapp || ycloudSaved ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                            <MessageCircle size={20} className={metaConnectedAssets.whatsapp || ycloudSaved ? 'text-[#25D366]' : 'text-slate-600'} />
                                            <span className="text-[10px] font-bold text-white">WhatsApp</span>
                                            {(metaConnectedAssets.whatsapp || ycloudSaved) && <Check size={10} className="text-green-400" />}
                                        </div>
                                    </div>
                                    {ycloudSaved && <p className="text-[10px] text-slate-500 text-center">WhatsApp via YCloud + Meta conectado</p>}
                                    <p className="text-[10px] text-slate-500 text-center">Avanzando en 10 segundos...</p>
                                    <button onClick={goNext} className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                                        Continuar ahora <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Navigation (only when not in wizard) */}
                            {metaStatus !== 'wizard' && metaStatus !== 'connected' && (
                                <div className="flex gap-2">
                                    <button onClick={goBack} className="flex-1 py-3 bg-white/5 text-slate-400 font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                        <ArrowLeft size={16} /> Atras
                                    </button>
                                    <button onClick={() => { if (ycloudSaved) { saveProgress(2, { step_2: { completed: true, wa_provider: 'ycloud', ycloud_connected: true } }); goNext(); } else { goNext(); } }}
                                        className="flex-[2] py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                        {ycloudSaved || metaConnected ? 'Siguiente' : 'Configurar despues'} <ArrowRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === STEPS 3-4-5: Voice Architect Chat === */}
                    {step >= 3 && step <= 5 && (
                        <div className="flex flex-col h-[calc(100vh-160px)] animate-fade-in">
                            {/* Header with voice toggle */}
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-lg font-bold text-white">
                                        {step === 3 ? 'Identidad de tu Negocio' : step === 4 ? 'Reglas de Negocio' : 'Diccionario de Sinonimos'}
                                    </h2>
                                    <p className="text-slate-500 text-xs mt-0.5">Conversa con la arquitecta de tu agente</p>
                                </div>
                                {voiceConsent && (
                                    <button onClick={() => { setVoiceMode(!voiceMode); if (voiceMode) stopRecording(); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                                            voiceMode ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'
                                        }`}>
                                        {voiceMode ? <Volume2 size={12} /> : <Mic size={12} />}
                                        {voiceMode ? 'Voz activa' : 'Modo texto'}
                                    </button>
                                )}
                            </div>

                            {/* Consent Card (first time only) */}
                            {!voiceConsent ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="glass p-6 rounded-2xl border border-violet-500/20 max-w-sm text-center space-y-4">
                                        <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto">
                                            <Mic size={28} className="text-violet-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">Experiencia de voz</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            Vamos a conversar por voz con tu arquitecta de IA para crear la personalidad perfecta de tu agente.
                                        </p>
                                        <p className="text-slate-600 text-[10px]">
                                            Los datos de voz se usan exclusivamente para configurar tu agente.
                                        </p>
                                        <button onClick={acceptVoice}
                                            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2">
                                            <Mic size={16} /> Iniciar experiencia de voz
                                        </button>
                                        <button onClick={declineVoice}
                                            className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                            Prefiero escribir
                                        </button>
                                    </div>
                                </div>
                            ) : !sectionComplete ? (
                                <>
                                    {/* Research Cards Cascade */}
                                    {showingResearch && researchCards.length > 0 && (
                                        <div className="mb-4 flex items-center justify-center min-h-[120px]">
                                            {researchCards[currentCardIndex] && (
                                                <div key={currentCardIndex} className="glass p-5 rounded-2xl border border-violet-500/20 text-center max-w-sm animate-fade-in">
                                                    <div className="mb-2">
                                                        {researchCards[currentCardIndex].icono === 'instagram' && <Instagram size={24} className="text-[#E1306C] mx-auto" />}
                                                        {researchCards[currentCardIndex].icono === 'facebook' && <Facebook size={24} className="text-[#1877F2] mx-auto" />}
                                                    </div>
                                                    <p className="text-sm font-bold text-white">{researchCards[currentCardIndex].titulo}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{researchCards[currentCardIndex].valor}</p>
                                                    <p className="text-[9px] text-violet-400 mt-2">Investigando redes sociales...</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Section Badges */}
                                    {Object.keys(savedSections).length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap mb-3">
                                            {[
                                                { key: 'guardar_identidad', label: 'Identidad' },
                                                { key: 'guardar_tono', label: 'Tono' },
                                                { key: 'guardar_reglas', label: 'Reglas' },
                                                { key: 'guardar_diccionario', label: 'Diccionario' },
                                            ].map(s => (
                                                <span key={s.key} className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                                    savedSections[s.key] ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-600'
                                                }`}>
                                                    {savedSections[s.key] && <Check size={10} />} {s.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Dynamic Section Title from Nova */}
                                    {activeSectionTitle && (
                                        <div className="glass p-3 rounded-xl border border-white/5 mb-3">
                                            <h3 className="text-sm font-bold text-white">{activeSectionTitle}</h3>
                                            {activeSectionDesc && <p className="text-[10px] text-slate-400 mt-0.5">{activeSectionDesc}</p>}
                                            {activeSectionButtons.length > 0 && (
                                                <div className="flex gap-2 mt-2">
                                                    {activeSectionButtons.map((btn: any, i: number) => (
                                                        <button key={i} onClick={() => btn.accion === 'confirmar' ? forceFinish() : null}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                                                btn.estilo === 'primary' ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400'
                                                            }`}>{btn.label}</button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Dynamic Data Cards from Nova tools */}
                                    {dynamicCards.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                                            {dynamicCards.map((card, i) => (
                                                <div key={i} className="glass p-3 rounded-xl border border-white/5 min-w-[140px] shrink-0 text-center">
                                                    <p className="text-[10px] font-bold text-violet-300">{card.titulo}</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">{card.valor}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Voice State Indicator — prominent, always visible when voice active */}
                                    {(voiceConsent && (voiceState !== 'idle' || realtimeConnected)) && (
                                        <div className="mb-4">
                                            {(voiceState === 'speaking' || (realtimeConnected && voiceState !== 'listening' && voiceState !== 'processing')) && (
                                                <div className="flex flex-col items-center gap-3 py-4 px-6 bg-violet-500/10 border border-violet-500/20 rounded-2xl animate-fade-in">
                                                    <div className="flex gap-1 items-end h-8">
                                                        {[1,2,3,4,5,6,7].map(i => (
                                                            <div key={i} className="w-1.5 bg-gradient-to-t from-violet-600 to-violet-400 rounded-full" style={{
                                                                animation: `pulse ${0.5 + i * 0.15}s ease-in-out infinite alternate`,
                                                                height: `${10 + Math.sin(i * 1.2) * 18}px`,
                                                            }} />
                                                        ))}
                                                    </div>
                                                    <span className="text-sm font-bold text-violet-300">Nova hablando...</span>
                                                </div>
                                            )}
                                            {voiceState === 'listening' && (
                                                <div className="flex flex-col items-center gap-3 py-4 px-6 bg-red-500/10 border border-red-500/20 rounded-2xl animate-fade-in">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                                                            <Mic size={20} className="text-white" />
                                                        </div>
                                                        <div className="absolute inset-0 w-10 h-10 bg-red-500/30 rounded-full animate-ping" />
                                                    </div>
                                                    <span className="text-sm font-bold text-red-300">Nova esta escuchando...</span>
                                                    <span className="text-[10px] text-red-400/60">15 seg de silencio para pausar</span>
                                                </div>
                                            )}
                                            {voiceState === 'processing' && (
                                                <div className="flex flex-col items-center gap-3 py-4 px-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-fade-in">
                                                    <svg className="animate-spin h-8 w-8 text-amber-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                                    <span className="text-sm font-bold text-amber-300">Nova procesando...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Chat Messages with inline confirm buttons */}
                                    <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1">
                                        {chatMessages.map((msg: any, i: number) => (
                                            <div key={i}>
                                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                                                        msg.role === 'user'
                                                            ? 'bg-violet-600 text-white rounded-br-sm'
                                                            : 'bg-white/5 border border-white/5 text-slate-200 rounded-bl-sm'
                                                    }`}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                                {/* Inline confirm button */}
                                                {msg.confirmSection && (
                                                    <div className="flex justify-start mt-1.5 ml-2">
                                                        {confirmedSections[msg.confirmSection] ? (
                                                            <div className="flex items-center gap-1.5 text-green-400 text-xs px-3 py-1.5 bg-green-500/10 rounded-lg">
                                                                <CheckCircle size={12} /> {msg.confirmSection} confirmado
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleConfirm(msg.confirmSection)}
                                                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all active:scale-95">
                                                                    <Check size={12} /> Confirmar {msg.confirmSection}
                                                                </button>
                                                                <button onClick={() => { if (voiceMode) sendAndSpeak('Quiero cambiar algo de esto'); else sendChatMessage('Quiero cambiar algo de esto'); }}
                                                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-all active:scale-95">
                                                                    Cambiar algo
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-white/5 rounded-2xl px-4 py-3 text-sm text-slate-500 animate-pulse">
                                                    Pensando...
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <div className="flex gap-2 shrink-0 pb-2">
                                        <button onClick={() => { if (voiceMode && voiceState === 'idle') startAutoListen(); else if (isRecording) stopRecording(); else toggleRecording(); }}
                                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                                                isRecording || voiceState === 'listening' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                            }`}>
                                            {isRecording || voiceState === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
                                        </button>
                                        <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { voiceMode ? sendAndSpeak(chatInput) : sendChatMessage(); setChatInput(''); } }}
                                            placeholder={voiceMode ? 'Habla o escribe...' : 'Escribe tu respuesta...'}
                                            className={`${inputClass} flex-1`} />
                                        <button onClick={() => { const t = chatInput.trim(); setChatInput(''); if (t) { voiceMode ? sendAndSpeak(t) : sendChatMessage(t); } }}
                                            disabled={chatLoading || !chatInput.trim()}
                                            className="w-11 h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0">
                                            <Send size={16} />
                                        </button>
                                    </div>

                                    {/* Bottom actions */}
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={goBack}
                                            className="flex-1 py-2 text-xs text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1">
                                            <ArrowLeft size={12} /> Atras
                                        </button>
                                        {realtimeConnected && (
                                            <button onClick={pauseMic}
                                                className={`flex-1 py-2 text-xs transition-colors flex items-center justify-center gap-1 ${micPaused ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-white'}`}>
                                                {micPaused ? <><Mic size={12} /> Activar mic</> : <><MicOff size={12} /> Pausar mic</>}
                                            </button>
                                        )}
                                        <button onClick={forceFinish}
                                            className="flex-1 py-2 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                                            Ya termine
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
                                    <p className="text-xs text-white truncate flex items-center gap-1">
                                        {tnConnected || stepData.step_1?.tiendanube_connected ? <><Check size={10} className="text-green-400" /> Conectada</> : 'Pendiente'}
                                    </p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Facebook size={14} className="text-[#1877F2] mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Meta</p>
                                    <p className="text-xs text-white truncate flex items-center gap-1">
                                        {metaConnected || ycloudSaved || stepData.step_2?.meta_connected || stepData.step_2?.ycloud_connected ? <><Check size={10} className="text-green-400" /> Conectado</> : 'Pendiente'}
                                    </p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Volume2 size={14} className="text-violet-400 mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Tono</p>
                                    <p className="text-xs text-white truncate flex items-center gap-1">
                                        {step >= 4 || stepData.step_3?.completed || savedSections.guardar_tono ? <><Check size={10} className="text-green-400" /> Configurado</> : 'Pendiente'}
                                    </p>
                                </div>
                                <div className="glass p-3 rounded-xl border border-white/5">
                                    <Zap size={14} className="text-amber-400 mb-1" />
                                    <p className="text-[10px] font-bold text-slate-400">Reglas</p>
                                    <p className="text-xs text-white truncate flex items-center gap-1">
                                        {step >= 5 || stepData.step_4?.completed || savedSections.guardar_reglas ? <><Check size={10} className="text-green-400" /> Configuradas</> : 'Pendiente'}
                                    </p>
                                </div>
                            </div>

                            {/* Knowledge Collections Selector */}
                            {/* Knowledge Collections — always visible */}
                            <div className="glass p-4 rounded-xl border border-white/5 space-y-3">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Globe size={14} className="text-cyan-400" /> Base de Conocimiento (RAG)
                                </h3>
                                <p className="text-[10px] text-slate-500">Selecciona las colecciones que tu agente debe consultar. Subi documentos para entrenar al agente con info de tu negocio.</p>

                                {/* Default categories + dynamic collections */}
                                <div className="space-y-1.5">
                                    {['General', 'ADN Personal', 'Legal / Reglas', 'Catalogo', ...knowledgeCollections.filter(c => !['General', 'ADN Personal', 'Legal / Reglas', 'Catalogo'].includes(c))].map(col => (
                                        <label key={col} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-white/5">
                                            <input type="checkbox" checked={selectedCollections.includes(col)}
                                                onChange={() => setSelectedCollections(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500" />
                                            <span className="text-xs text-white flex-1">{col}</span>
                                            <span className="text-[9px] text-slate-500">{knowledgeFiles.filter((f: any) => f.collection === col).length} docs</span>
                                        </label>
                                    ))}
                                </div>

                                {/* Upload document inline */}
                                <div className="pt-2 border-t border-white/5">
                                    <label className="w-full py-2.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/20 text-cyan-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                                        <Plus size={14} /> Subir documento
                                        <input type="file" className="hidden" accept=".pdf,.txt,.doc,.docx,.csv"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                formData.append('collection', 'General');
                                                try {
                                                    await fetchApi('/admin/knowledge/upload', { method: 'POST', body: formData });
                                                    // Reload collections
                                                    const cols = await fetchApi('/admin/knowledge/collections');
                                                    if (Array.isArray(cols)) setKnowledgeCollections(cols);
                                                    const files = await fetchApi('/admin/knowledge/list');
                                                    if (Array.isArray(files)) setKnowledgeFiles(files.filter((f: any) => f.status === 'active'));
                                                } catch(err: any) { setError(err.message || 'Error al subir'); }
                                            }} />
                                    </label>
                                    <p className="text-[9px] text-slate-600 mt-1 text-center">PDF, TXT, DOC, CSV — se vectoriza automaticamente</p>
                                </div>

                                {selectedCollections.length > 0 && (
                                    <p className="text-[9px] text-cyan-400">{selectedCollections.length} coleccion(es) seleccionada(s)</p>
                                )}
                            </div>

                            {/* System Prompt + Refine Button */}
                            <div className="glass p-4 rounded-xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-400">System Prompt</label>
                                    <button onClick={async () => {
                                        setTestLoading(true);
                                        try {
                                            // Use test-agent endpoint (no session, no reset) to refine
                                            const res = await fetchApi('/admin/onboarding-wizard/test-agent', {
                                                method: 'POST',
                                                body: {
                                                    message: `Sos un experto en ingenieria de prompts. Toma el siguiente texto que es una conversacion/draft de configuracion de un agente de ventas para WhatsApp/Instagram/Facebook. Tu trabajo es TRANSFORMARLO en un system prompt PROFESIONAL para el agente.

REGLAS ABSOLUTAS:
1. USA SOLO la informacion que esta en el draft. NUNCA inventes datos, nombres, politicas ni reglas que no esten en el texto.
2. Si el draft menciona un nombre de negocio, usalo. Si menciona productos especificos, usalos. Si menciona reglas, transcribi las exactas.
3. Si hay informacion que falta (como plazos de cambio, metodos de envio), NO los inventes. Escribi "[COMPLETAR]" en su lugar.
4. El resultado debe ser un SYSTEM PROMPT directo, escrito como instrucciones para un agente de IA que atendera clientes por chat.
5. Formato: texto plano con secciones ## y listas con *. No uses codigo, no uses JSON.

ESTRUCTURA OBLIGATORIA:

## IDENTIDAD
(nombre del negocio, que vende, cliente ideal, diferencial — TODO sacado del draft)

## TONO Y PERSONALIDAD
(pronombres, formalidad, emojis, muletillas, frases prohibidas — TODO sacado del draft)

## REGLAS DE NEGOCIO
(reglas numeradas como imperativos: 1. ENVIOS: ... 2. CAMBIOS: ... etc — TODO sacado del draft)

## DICCIONARIO DE SINONIMOS
(productos con sinonimos especificos del rubro del negocio — sacados del draft, NO genericos)

## HERRAMIENTAS OBLIGATORIAS (TOOLS)
El agente TIENE estas tools y DEBE usarlas. NUNCA responder de memoria.

1. search_specific_products: SIEMPRE usar cuando el cliente pregunte por un producto. Busca en el catalogo REAL. NUNCA inventar productos.
   Ejemplo: Cliente: "tenes zapatillas?" → USAR search_specific_products("zapatillas") → responder con resultados REALES.
2. search_by_category: Buscar por categoria. Cliente: "que camperas tienen?" → USAR search_by_category("camperas").
3. browse_general_storefront: Mostrar productos destacados. Cliente: "que productos tienen?" → USAR browse_general_storefront.
4. orders: Consultar pedidos. Cliente: "donde esta mi pedido?" → USAR orders.
5. derivhumano: Derivar a humano si el cliente esta enojado o pide hablar con persona.

REGLA CRITICA: Cuando pregunten "que productos tenes?" → SIEMPRE usar browse_general_storefront. JAMAS inventar lista de productos.

## REGLAS DE SEGURIDAD
1. VERACIDAD ABSOLUTA: PROHIBIDO inventar precios, stock, variantes o productos. TODO viene de las tools.
2. DERIVACION: Usar derivhumano si el cliente esta enojado o pide hablar con persona.
3. ANTI-REPETICION: No repetir productos ya mostrados.
4. ALCANCE: Solo responder sobre la tienda y proceso de compra.
5. SI NO SABES: Deci "dejame buscar eso" y usa la tool. Si no hay resultados: "en este momento no tenemos eso disponible".

DRAFT/CONVERSACION DEL NEGOCIO:
${systemPrompt}`,
                                                    system_prompt: `Sos un ingeniero de prompts experto. Tu trabajo es transformar una conversacion/draft en un SYSTEM PROMPT listo para produccion.

El prompt resultante sera usado por un agente de IA que atiende WhatsApp, Instagram y Facebook de un negocio real. El agente recibe mensajes de clientes y responde.

FORMATO DEL RESULTADO:
- Escrito en SEGUNDA PERSONA dirigido al agente: "Sos el asistente de...", "Cuando un cliente pregunte...", "NUNCA digas..."
- NO es un resumen del negocio. SON INSTRUCCIONES OPERATIVAS para el agente.
- Cada regla es un IMPERATIVO: "SIEMPRE explicá...", "NUNCA inventes...", "Si el cliente pide X, respondé Y"
- El diccionario tiene sinonimos del RUBRO ESPECIFICO (no genericos como "articulos, mercancias")

USA SOLO datos del draft. NUNCA inventes. Si falta info, escribe [COMPLETAR].
Responde SOLO con el prompt, sin explicaciones ni comentarios.`
                                                }
                                            });
                                            if (res?.response) { setSystemPrompt(res.response); }
                                        } catch(e) { console.error('Refine error:', e); }
                                        setTestLoading(false);
                                    }} disabled={testLoading || !systemPrompt}
                                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1">
                                        <Sparkles size={10} /> {testLoading ? 'Refinando...' : 'Refinar con IA'}
                                    </button>
                                </div>
                                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={10}
                                    className={`${inputClass} resize-y font-mono text-[10px] leading-relaxed`} />
                                <p className="text-[9px] text-slate-600">Toca "Refinar con IA" para transformar el draft en un prompt profesional estilo Pointe Coach.</p>
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
