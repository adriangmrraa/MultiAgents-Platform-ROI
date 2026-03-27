import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Send, Sparkles, CheckCircle, ArrowRight, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
    role: 'assistant' | 'user';
    content: string;
}

export const OnboardingChat: React.FC = () => {
    const navigate = useNavigate();
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [isTyping, setIsTyping] = useState(false);
    const [configReady, setConfigReady] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => {
        const initChat = async () => {
            setIsTyping(true);
            try {
                const res = await fetchApi('/admin/onboarding/interview', {
                    method: 'POST',
                    body: { session_id: sessionId, user_message: "HOLA_INIT", tenant_id: user?.tenant_id, reset: true }
                });
                if (res.ai_message) setMessages([{ role: 'assistant', content: res.ai_message }]);
            } catch (err) {
                console.error("Failed to start onboarding", err);
            } finally {
                setIsTyping(false);
            }
        };
        initChat();
    }, []);

    const handleSend = async () => {
        if (!userInput.trim()) return;
        const currentMsg = userInput;
        setUserInput('');
        setMessages(prev => [...prev, { role: 'user', content: currentMsg }]);
        setIsTyping(true);
        try {
            const res = await fetchApi('/admin/onboarding/interview', {
                method: 'POST',
                body: { session_id: sessionId, user_message: currentMsg, tenant_id: user?.tenant_id }
            });
            if (res.ai_message) setMessages(prev => [...prev, { role: 'assistant', content: res.ai_message }]);
            if (res.config_ready && res.extracted_data) { setConfigReady(true); setExtractedData(res.extracted_data); }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: "Hubo un error de conexion. Intenta de nuevo." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCreateAgent = async () => {
        if (!extractedData) return;
        try {
            const res = await fetchApi('/admin/onboarding/draft', {
                method: 'POST',
                body: { tenant_id: user?.tenant_id, final_config: extractedData }
            });
            if (res.status === 'draft_saved') navigate(`/admin/agents/new?draft_id=${res.draft_id}`);
        } catch (err) {
            alert("Error creating draft: " + err);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#09090b] max-w-4xl mx-auto relative overflow-hidden">
            {/* Glow orbs */}
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-glow-pulse" />
            <div className="absolute bottom-0 right-1/4 w-[250px] h-[250px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none animate-glow-pulse" />

            {/* Header */}
            <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-lg">Nexus Architect</h1>
                        <p className="text-xs text-gray-500">Disenando tu Agente — Modo Entrevista</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{isTyping ? 'Pensando' : 'Online'}</span>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative z-10">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mr-2 mt-1 shrink-0">
                                <Bot size={14} className="text-white" />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-sm shadow-lg shadow-purple-900/20'
                            : 'bg-white/5 backdrop-blur-xl border border-white/10 text-gray-200 rounded-bl-sm'
                            }`}>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mr-2 shrink-0">
                            <Bot size={14} className="text-white" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer / Input */}
            <div className="p-4 bg-white/5 backdrop-blur-xl border-t border-white/10 relative z-10">
                {configReady ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between animate-slide-up">
                        <div>
                            <h3 className="text-emerald-400 font-bold flex items-center gap-2 text-sm">
                                <CheckCircle size={18} /> Configuracion Lista
                            </h3>
                            <p className="text-emerald-300/70 text-xs mt-1">
                                Todo listo para crear a "{extractedData?.agent_name}".
                            </p>
                        </div>
                        <button
                            onClick={handleCreateAgent}
                            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 text-sm"
                        >
                            Generar Agente <ArrowRight size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                            disabled={isTyping}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!userInput.trim() || isTyping}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-30 text-white p-3 rounded-xl transition-all shadow-lg shadow-purple-900/30"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
