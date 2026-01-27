
import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { Send, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
    role: 'assistant' | 'user';
    content: string;
}

export const OnboardingChat: React.FC = () => {
    const navigate = useNavigate();
    const { fetchApi, loading } = useApi();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [isTyping, setIsTyping] = useState(false);
    const [configReady, setConfigReady] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial Greeting
    useEffect(() => {
        const initChat = async () => {
            setIsTyping(true);
            try {
                // We trigger the first interaction with reset=true
                const res = await fetchApi('/admin/onboarding/interview', {
                    method: 'POST',
                    body: {
                        session_id: sessionId,
                        user_message: "HOLA_INIT", // Special trigger
                        tenant_id: 1, // TODO: Dynamic Tenant
                        reset: true
                    }
                });

                if (res.ai_message) {
                    setMessages([{ role: 'assistant', content: res.ai_message }]);
                }
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
                body: {
                    session_id: sessionId,
                    user_message: currentMsg,
                    tenant_id: 1 // TODO: Dynamic
                }
            });

            if (res.ai_message) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.ai_message }]);
            }

            if (res.config_ready && res.extracted_data) {
                setConfigReady(true);
                setExtractedData(res.extracted_data);
            }

        } catch (err) {
            console.error(err);
            // Fallback UI
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Hubo un error de conexión. Intenta de nuevo." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCreateAgent = async () => {
        if (!extractedData) return;

        // Call Draft Endpoint
        try {
            const res = await fetchApi('/admin/onboarding/draft', {
                method: 'POST',
                body: {
                    tenant_id: 1, // TODO
                    final_config: extractedData
                }
            });

            if (res.status === 'draft_saved') {
                // Redirect to Wizard with Draft ID
                navigate(`/agents/new?draft_id=${res.draft_id}`);
            }
        } catch (err) {
            alert("Error creating draft: " + err);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 max-w-4xl mx-auto shadow-xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">Nexus Architect</h1>
                        <p className="text-xs opacity-80">Diseñando tu Agente ✦ Modo Entrevista</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                            }`}>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-gray-200 rounded-full px-4 py-2 text-xs text-gray-500">
                            Escribiendo...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer / Input */}
            <div className="p-4 bg-white border-t border-gray-200">
                {configReady ? (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center justify-between animate-fade-in-up">
                        <div>
                            <h3 className="text-green-800 font-bold flex items-center gap-2">
                                <CheckCircle size={20} /> ¡Configuración Lista!
                            </h3>
                            <p className="text-green-700 text-sm mt-1">
                                He recolectado todo lo necesario para crear a "{extractedData?.agent_name}".
                            </p>
                        </div>
                        <button
                            onClick={handleCreateAgent}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-green-500/30"
                        >
                            Generar Agente <ArrowRight size={18} />
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
                            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            disabled={isTyping}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!userInput.trim() || isTyping}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
