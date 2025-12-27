import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { MessageSquare, User, RefreshCw } from 'lucide-react';

interface Chat {
    id: string;
    phone: string;
    name: string;
    channel: string;
    last_message: string;
    timestamp: string;
    tenant_id: number;
    avatar_url?: string; // New: Protocol Omega Avatar
    human_override_until?: string; // New: Lockout Timer
    status: string;
    is_locked: boolean;
}
// Removed legacy fields: cw_id, account_id, external_chatwoot_id (Protocol Omega Cleanup)

interface Message {
    role: string;
    content: string;
    timestamp: string;
    channel_source?: string;
    media?: {
        url: string;
        type: string; // image | video | audio | document
        mime: string;
        name?: string;
    };
}

export const Chats: React.FC = () => {
    const { fetchApi, loading, error } = useApi();
    const [selectedTenant, setSelectedTenant] = useState<number | null>(9); // 9 is current active
    const [selectedChannel, setSelectedChannel] = useState<string>('all');
    const [tenants, setTenants] = useState<{ id: number, store: string }[]>([]);
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    // const [loadingChats, setLoadingChats] = useState(false); // Removed unused, creating lint noise
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-select first tenant if none selected
    useEffect(() => {
        if (!selectedTenant && tenants.length > 0) {
            setSelectedTenant(tenants[0].id);
        }
    }, [tenants]);

    // Load Tenants for filter
    useEffect(() => {
        const loadTenants = async () => {
            try {
                const data = await fetchApi('/admin/tenants');
                if (Array.isArray(data)) setTenants(data);
            } catch (e) { }
        };
        loadTenants();
    }, [fetchApi]);

    // Load Chat List
    useEffect(() => {
        const loadChats = async () => {
            if (!selectedTenant) return;
            try {
                let url = `/admin/chats/summary?limit=100`; // Increased limit for scrolling
                if (selectedTenant) url += `&tenant_id=${selectedTenant}`;
                if (selectedChannel !== 'all') url += `&channel=${selectedChannel}`;

                const data = await fetchApi(url);
                if (Array.isArray(data)) {
                    // Map Backend keys to Frontend Interface
                    // Backend: id, name (or display_name), last_message, timestamp, external_user_id
                    const mappedData = data.map((d: any) => {
                        console.log("Raw Chat Item:", d); // DEBUG RESTORED
                        return {
                            ...d,
                            id: d.id, // Explicitly preserve ID
                            name: d.name || d.display_name || d.external_user_id || 'Unknown',
                            avatar_url: d.avatar_url, // Map Avatar
                            human_override_until: d.human_override_until, // Map Timer
                            last_message: d.last_message || d.last_message_preview || '',
                            timestamp: d.timestamp || d.last_message_at || new Date().toISOString(),
                            phone: d.external_user_id || '',
                            is_locked: d.is_locked || false
                        };
                    });

                    // Client-side search if backend search missing
                    let filtered = mappedData;
                    if (searchTerm) {
                        const lower = searchTerm.toLowerCase();
                        filtered = mappedData.filter((c: any) =>
                            (c.phone && c.phone.toLowerCase().includes(lower)) ||
                            (c.name && c.name.toLowerCase().includes(lower))
                        );
                    }
                    setChats(filtered);
                }
            } catch (err) {
                console.error("Failed to load chats:", err);
            }
        };
        loadChats();

        const interval = setInterval(loadChats, 3000);
        return () => clearInterval(interval);
    }, [fetchApi, refreshTrigger, selectedTenant, selectedChannel, searchTerm]);

    // Icon helper
    const getChannelIcon = (channel: string) => {
        switch (channel?.toLowerCase()) {
            case 'instagram': return <span className="text-pink-500 text-xs font-bold border border-pink-500/30 px-1 rounded">IG</span>;
            case 'facebook': return <span className="text-blue-500 text-xs font-bold border border-blue-500/30 px-1 rounded">FB</span>;
            default: return <span className="text-green-500 text-xs font-bold border border-green-500/30 px-1 rounded">WA</span>;
        }
    };

    // Load Conversation History (with polling)
    useEffect(() => {
        if (!selectedChatId) return;

        const loadHistory = async (chatId: string) => {
            console.log("Loading history for:", chatId); // DEBUG
            try {
                const data = await fetchApi(`/admin/chats/${chatId}/messages`);
                console.log("History Data Received:", data); // DEBUG
                if (Array.isArray(data)) {
                    setMessages(data);
                }
            } catch (err) {
                console.error("Failed to load history:", err);
            }
        };
        loadHistory(selectedChatId);

        const historyInterval = setInterval(() => loadHistory(selectedChatId), 3000);
        return () => clearInterval(historyInterval);
    }, [selectedChatId, fetchApi]);

    const handleToggleHandoff = async (enabled: boolean) => {
        if (!selectedChatId) return;
        try {
            await fetchApi(`/admin/conversations/${selectedChatId}/human-override`, {
                method: 'POST',
                body: { enabled }
            });
            alert(`Human Override ${enabled ? 'Enabled' : 'Disabled'}`);
        } catch (e) {
            alert('Failed to toggle handoff');
        }
    };

    const handleSendMessage = async () => {
        if (!selectedChatId || !newMessage.trim()) return;

        const chat = chats.find(c => c.id === selectedChatId);

        try {
            await fetchApi('/admin/whatsapp/send', {
                method: 'POST',
                body: {
                    phone: chat?.phone, // Keep phone for legacy send endpoint if needed, or update send endpoint to use conv_id later
                    message: newMessage,
                    tenant_id: chat?.tenant_id,
                    channel_source: chat?.channel || 'whatsapp',
                    external_chatwoot_id: chat?.cw_id || chat?.external_chatwoot_id,
                    external_account_id: chat?.account_id || chat?.external_account_id
                }
            });

            setMessages([...messages, {
                role: 'assistant',
                content: newMessage,
                timestamp: new Date().toISOString()
            }]);

            // Optimistic chat list reorder
            setChats(prev => {
                const existing = prev.find(c => c.id === selectedChatId);
                if (existing) {
                    const updated = { ...existing, last_message: newMessage, timestamp: new Date().toISOString() };
                    return [updated, ...prev.filter(c => c.id !== selectedChatId)];
                }
                return prev;
            });

            setNewMessage('');
        } catch (e) {
            alert('Error sending message');
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">Gestión Multicanal Nexus v4.2</h1>

            <div className="chats-layout" style={{
                display: 'grid',
                gridTemplateColumns: selectedChatId ? '350px 1fr' : '350px 1fr', // Maintain generic layout on desktop
                gap: '20px',
                height: 'calc(100vh - 120px)', // Fixed full height
                overflow: 'hidden'
            }}>
                {/* Left: List */}
                <div className={`glass flex flex-col transition-all duration-300 ${selectedChatId ? 'hidden md:flex' : 'flex w-full'}`} style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="p-4 border-b border-white/5 space-y-3 bg-black/20">
                        <div className="flex gap-2">
                            <select
                                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none flex-1"
                                value={selectedTenant || ''}
                                onChange={(e) => setSelectedTenant(Number(e.target.value))}
                            >
                                <option value="">Todas las tiendas</option>
                                {tenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.store}</option>
                                ))}
                            </select>
                            <select
                                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
                                value={selectedChannel}
                                onChange={(e) => setSelectedChannel(e.target.value)}
                            >
                                <option value="all">Canales</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="instagram">Instagram</option>
                                <option value="facebook">Facebook</option>
                            </select>
                        </div>
                        <div className="flex justify-between items-center">
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full focus:border-accent outline-none"
                            />
                            <button onClick={() => setRefreshTrigger(p => p + 1)} className="ml-2 text-white/50 hover:text-white">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => {
                                    console.log("CLICK DETECTED. Chat ID:", chat.id); // DEBUG
                                    // alert("Click! ID: " + chat.id); // VISUAL DEBUG
                                    setSelectedChatId(chat.id);
                                }}
                                className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedChatId === chat.id ? 'bg-white/10 border-l-4 border-accent' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        {getChannelIcon(chat.channel)}
                                        <span className="font-semibold text-white">{chat.name || chat.phone}</span>
                                        {chat.is_locked && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-amber-500 text-[10px] border border-amber-500/50 px-1 rounded bg-amber-500/10">HUMAN</span>
                                                {chat.human_override_until && <span className="text-[9px] text-amber-500/80">{new Date(chat.human_override_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-secondary opacity-70 uppercase font-mono">{new Date(chat.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-secondary truncate opacity-80 pl-8">{chat.last_message}</p>
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
                <div className={`glass flex flex-col overflow-hidden relative ${!selectedChatId ? 'hidden md:flex' : 'flex w-full h-full'}`}>
                    {selectedChatId ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                                <div className="flex items-center gap-3">
                                    {/* Mobile Back Button */}
                                    <button onClick={() => setSelectedChatId(null)} className="md:hidden text-white/70 hover:text-white mr-2">
                                        ←
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden border border-white/20">
                                        {chats.find((c: Chat) => c.id === selectedChatId)?.avatar_url ? (
                                            <img
                                                src={chats.find((c: Chat) => c.id === selectedChatId)?.avatar_url}
                                                alt="Avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User size={20} className="text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            {chats.find((c: Chat) => c.id === selectedChatId)?.name || 'Cliente'}
                                            {chats.find((c: Chat) => c.id === selectedChatId)?.is_locked && (
                                                <span className="text-xs bg-amber-500/20 text-amber-500 border border-amber-500/50 px-2 py-0.5 rounded-full animate-pulse">
                                                    HUMAN OVERRIDE
                                                </span>
                                            )}
                                        </h3>
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                            {chats.find((c: Chat) => c.id === selectedChatId)?.channel ? (
                                                <span className="capitalize">{chats.find((c: Chat) => c.id === selectedChatId)?.channel} User</span>
                                            ) : 'Online'}
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
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10 scroll-smooth">
                                {messages.map((msg, idx) => {
                                    // Audio Protocol Parsing
                                    const audioMatch = (msg.content || '').match(/\[AUDIO_URL:\s*(.*?)\s*\|\s*TRANSCRIPT:\s*(.*?)\]/);
                                    let contentCmp = <p className="text-sm">{msg.content}</p>;

                                    if (audioMatch) {
                                        const [_, url, transcript] = audioMatch;
                                        contentCmp = (
                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-accent uppercase tracking-wider">Audio Message</span>
                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                                </div>
                                                <audio controls className="w-full h-8 mb-1 rounded-lg">
                                                    <source src={url} type="audio/ogg" />
                                                    <source src={url} type="audio/mpeg" />
                                                    Your browser does not support the audio element.
                                                </audio>
                                                <div className="bg-black/20 p-2 rounded border-l-2 border-accent/50">
                                                    <p className="text-xs italic opacity-80">"{transcript}"</p>
                                                </div>
                                            </div>
                                        );
                                    } else if (msg.media) {
                                        // Standard Media Rendering (Chatwoot/WhatsApp)
                                        if (msg.media.type && msg.media.type.startsWith('image')) {
                                            contentCmp = (
                                                <div className="flex flex-col gap-1">
                                                    <img src={msg.media.url} alt="Media" className="max-w-[250px] rounded-lg border border-white/10" />
                                                    {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
                                                </div>
                                            );
                                        } else if (msg.media.type && msg.media.type.startsWith('video')) {
                                            contentCmp = (
                                                <div className="flex flex-col gap-1">
                                                    <video controls className="max-w-[250px] rounded-lg border border-white/10">
                                                        <source src={msg.media.url} type={msg.media.mime} />
                                                        Your browser does not support video.
                                                    </video>
                                                    {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
                                                </div>
                                            );
                                        } else if (msg.media.type && msg.media.type.startsWith('audio')) {
                                            contentCmp = (
                                                <div className="flex flex-col gap-2 min-w-[200px]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-bold text-accent uppercase tracking-wider">Audio Clip</span>
                                                    </div>
                                                    <audio controls className="w-full h-8 mb-1 rounded-lg">
                                                        <source src={msg.media.url} type={msg.media.mime} />
                                                        Your browser does not support audio.
                                                    </audio>
                                                    {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
                                                </div>
                                            );
                                        }
                                    }

                                    return (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[70%] rounded-2xl p-4 ${msg.role === 'user'
                                                ? 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                                                : 'bg-accent/20 border border-accent/30 text-white rounded-tr-none'
                                                }`}>
                                                {contentCmp}
                                                <span className="text-[10px] opacity-50 mt-2 block text-right">
                                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
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
        </div >
    );
};
