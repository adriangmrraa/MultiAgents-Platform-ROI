import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { MessageSquare, User, Bot, AlertCircle, RefreshCw } from 'lucide-react';

interface ChatSummary {
    phone: string;
    last_message: string;
    timestamp: string;
    status: string;
}

interface Message {
    role: string;
    content: string;
    timestamp: string;
}

export const Chats: React.FC = () => {
    const { fetchApi, loading, error } = useApi();
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Load Chat List
    useEffect(() => {
        const loadChats = async () => {
            try {
                const data = await fetchApi('/admin/chats/summary'); // Matches newly created endpoint
                if (Array.isArray(data)) {
                    setChats(data);
                }
            } catch (err) {
                console.error("Failed to load chats:", err);
            }
        };
        loadChats();

        // Auto-refresh every 10s
        const interval = setInterval(loadChats, 10000);
        return () => clearInterval(interval);
    }, [fetchApi, refreshTrigger]);

    // Load Conversation History
    useEffect(() => {
        if (!selectedPhone) return;

        const loadHistory = async () => {
            try {
                const data = await fetchApi(`/admin/chats/${selectedPhone}/history`);
                if (Array.isArray(data)) {
                    setMessages(data);
                }
            } catch (err) {
                console.error("Failed to load history:", err);
            }
        };
        loadHistory();
    }, [selectedPhone, fetchApi]);

    const handleToggleHandoff = async (enabled: boolean) => {
        if (!selectedPhone) return;
        try {
            await fetchApi('/admin/handoff/toggle', {
                method: 'POST',
                body: { phone: selectedPhone, enabled }
            });
            alert(`Human Override ${enabled ? 'Enabled' : 'Disabled'}`);
        } catch (e) {
            alert('Failed to toggle handoff');
        }
    };

    const handleSendMessage = async () => {
        if (!selectedPhone || !newMessage.trim()) return;

        try {
            await fetchApi('/admin/whatsapp/send', {
                method: 'POST',
                body: {
                    phone: selectedPhone,
                    message: newMessage
                }
            });

            // Optimistic update
            setMessages([...messages, {
                role: 'assistant',
                content: newMessage,
                timestamp: new Date().toISOString()
            }]);
            setNewMessage('');
        } catch (e) {
            alert('Error sending message');
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">Gestión de Conversaciones (Human Handoff)</h1>

            <div className="chats-layout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 150px)' }}>
                {/* Left: List */}
                <div className="glass" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="bg-black/20 border border-white/10 rounded px-3 py-1 text-sm w-full"
                        />
                        <button onClick={() => setRefreshTrigger(p => p + 1)} className="ml-2 text-white/50 hover:text-white">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {chats.map(chat => (
                            <div
                                key={chat.phone}
                                onClick={() => setSelectedPhone(chat.phone)}
                                className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedPhone === chat.phone ? 'bg-white/10 border-l-4 border-accent' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-white">{chat.phone}</span>
                                    <span className="text-xs text-secondary opacity-70">{new Date(chat.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-secondary truncate opacity-80">{chat.last_message}</p>
                            </div>
                        ))}
                        {chats.length === 0 && !loading && (
                            <div className="p-8 text-center text-secondary opacity-50">
                                No hay conversaciones recientes.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Chat Window */}
                <div className="glass flex flex-col overflow-hidden relative">
                    {selectedPhone ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                        <User size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{selectedPhone}</h3>
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                            Online
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-sm text-secondary">Agente Activo</span>
                                        <input type="checkbox" className="toggle" defaultChecked onChange={(e) => handleToggleHandoff(!e.target.checked)} />
                                    </label>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-4 ${msg.role === 'user'
                                            ? 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                                            : 'bg-accent/20 border border-accent/30 text-white rounded-tr-none'
                                            }`}>
                                            <p className="text-sm">{msg.content}</p>
                                            <span className="text-[10px] opacity-50 mt-2 block text-right">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-black/20 border-t border-white/5">
                                <div className="flex gap-2">
                                    <textarea
                                        className="flex-1 bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-accent outline-none resize-none h-[50px]"
                                        placeholder="Escribir mensaje manual..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    ></textarea>
                                    <button
                                        onClick={handleSendMessage}
                                        className="bg-accent hover:bg-accent-hover text-white rounded-xl px-6 font-semibold transition-all">
                                        Enviar
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                            <MessageSquare size={64} className="mb-4" />
                            <h2 className="text-2xl font-bold">Selecciona una conversación</h2>
                            <p>El historial de chat aparecerá aquí.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
