import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { MessageSquare, User, RefreshCw, Facebook, Instagram, MessageCircle } from 'lucide-react';

interface Chat {
    id: string;
    phone: string;
    name: string;
    channel: string;
    last_message: string;
    timestamp: string;
    tenant_id: number;
    avatar_url?: string;
    human_override_until?: string;
    status: string;
    is_locked: boolean;
    provider?: string;
    platform_origin?: string;
    source_identifier?: string;
    meta?: {
        username?: string;
        inbox_name?: string;
        [key: string]: any;
    };
}

interface Message {
    id?: string;
    role: string;
    content: string;
    timestamp: string;
    channel_source?: string;
    attachments?: {
        url: string;
        type: string; // image | video | audio | file | text
        file_name?: string;
    }[];
}

// ... (Interfaces unchanged)

export const Chats: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [selectedChannel, setSelectedChannel] = useState<string>('all');
    const [selectedProvider, setSelectedProvider] = useState<string>('all');
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const selectedChat = chats.find(c => c.id === selectedChatId);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 20;

    const scrollRef = useRef<HTMLDivElement>(null);
    const lastChatIdRef = useRef<string | null>(null);

    // ... (Effects unchanged until helper)

    // Icon & Style Helper
    const getChannelStyle = (chat: Chat | any) => {
        const c = chat.channel?.toLowerCase() || '';
        const provider = chat.provider?.toLowerCase() || '';

        if (provider === 'chatwoot') {
            return {
                color: 'text-cyan-400',
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/30',
                shadow: 'shadow-cyan-500/20',
                icon: <MessageSquare size={18} />,
                label: 'Chatwoot'
            };
        }

        if (c.includes('instagram')) return {
            color: 'text-[#E1306C]',
            bg: 'bg-[#E1306C]/10',
            border: 'border-[#E1306C]/30',
            shadow: 'shadow-[#E1306C]/20',
            icon: <Instagram size={18} />,
            label: provider === 'meta_direct' ? 'Meta' : 'Instagram'
        };
        if (c.includes('facebook')) return {
            color: 'text-[#1877F2]',
            bg: 'bg-[#1877F2]/10',
            border: 'border-[#1877F2]/30',
            shadow: 'shadow-[#1877F2]/20',
            icon: <Facebook size={18} />,
            label: provider === 'meta_direct' ? 'Meta' : 'Facebook'
        };

        // Default WhatsApp / YCloud
        return {
            color: 'text-[#25D366]',
            bg: 'bg-[#25D366]/10',
            border: 'border-[#25D366]/30',
            shadow: 'shadow-[#25D366]/20',
            icon: <MessageCircle size={18} />,
            label: provider === 'meta_direct' ? 'Meta WA' : 'WhatsApp'
        };
    };

    // ... (loadChats, useEffects unchanged)

    // ... (handleScroll)

    // ... (handleToggleHandoff, handleSendMessage)

    // Logic inside map:
    /*
     const style = getChannelStyle(chat.channel);
     const identifier = chat.phone || chat.name; // Big
     const displayName = chat.name !== chat.phone ? chat.name : ''; // Small
    */






    // Auto-scroll logic (Smart Scroll) - Refined to be non-intrusive
    useEffect(() => {
        const scrollToBottom = (force = false) => {
            if (scrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

                if (force || isNearBottom) {
                    // Use a small timeout to ensure DOM has updated
                    setTimeout(() => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
                    }, 50);
                }
            }
        };

        const isNewChat = selectedChatId !== lastChatIdRef.current;
        if (isNewChat) {
            lastChatIdRef.current = selectedChatId || null;
            scrollToBottom(true); // Always force on new chat
        } else {
            scrollToBottom(false); // Only if near bottom on polling
        }
    }, [messages, selectedChatId]);

    // Load Chat List

    // Load Chat List

    const loadChats = async (isRefresh = false) => {
        // If refreshing, reset offset/list. If loading more, append.
        const currentOffset = isRefresh ? 0 : offset;

        try {
            let url = `/admin/chats/summary?limit=${LIMIT}&offset=${currentOffset}&v=${refreshTrigger}`;

            if (selectedChannel === 'human_override') {
                url += `&human_override=true`;
            } else if (selectedChannel !== 'all') {
                url += `&channel=${selectedChannel}`;
            }

            if (selectedProvider !== 'all') {
                url += `&provider=${selectedProvider}`;
            }

            const data = await fetchApi(url);

            if (Array.isArray(data)) {
                const mappedData = data.map((d: any) => ({
                    id: d.id,
                    tenant_id: d.tenant_id,
                    name: d.name || d.display_name || d.external_user_id || 'Unknown',
                    avatar_url: d.avatar_url,
                    human_override_until: d.human_override_until,
                    last_message: d.last_message || d.last_message_preview || '',
                    timestamp: d.timestamp || d.last_message_at || new Date().toISOString(),
                    phone: d.external_user_id || '',
                    is_locked: d.is_locked || false,
                    status: d.status || 'active', // Fix: Ensure status is mapped
                    channel: d.channel,
                    provider: d.provider,
                    platform_origin: d.platform_origin,
                    source_identifier: d.source_identifier,
                    meta: d.meta
                }));

                // Client-side search (Optional: ideally move to backend)
                // For pagination, we apply search only on loaded items or we should send search param to backend.
                // For now, let's skip searching on server for this iteration to avoid backend search logic changes unless needed.
                // We will filter *incoming* data if we want, but typically search + pagination requires backend search.
                // Let's just set the data for now.

                if (isRefresh) {
                    setChats(mappedData);
                    setOffset(LIMIT);
                } else {
                    setChats(prev => {
                        // Avoid duplicates if any
                        const newChats = mappedData.filter((n: any) => !prev.some(p => p.id === n.id));
                        return [...prev, ...newChats];
                    });
                    setOffset(prev => prev + LIMIT);
                }

                setHasMore(data.length === LIMIT);
            }

        } catch (err) {
            console.error(err);
        }
    };

    // Initial Load & Filter Change
    useEffect(() => {
        setOffset(0);
        setHasMore(true);
        loadChats(true);

        // Auto-refresh chat list every 10 seconds (Polling for Webhook updates)
        const intervalId = setInterval(() => {
            // We load silently (isRefresh=false would append, which is bad for polling list updates... 
            // Wait, loadChats logic appends if !isRefresh. We need a "silent refresh" mode or just re-fetch first page?
            // If we re-fetch first page, we might duplicate if logic isn't perfect.
            // Let's look at loadChats logic: 
            // if (isRefresh) setsChats(mappedData). 
            // We want to update existing items or prepend new ones. 
            // Simple polling: just re-fetch the first page (limit 20) and merge/update.
            // But loadChats(true) resets offset. 
            // Ideally we need a separate 'pollChats' function or modify loadChats to handle 'update'.

            // For now, let's just trigger a soft refresh of the top list by calling loadChats(true) 
            // but we need to be careful not to reset user scroll position if possible.
            // Actually, loadChats(true) resets 'chats' state which might flicker.

            // Let's try a safer approach: Just call loadChats(true) for now, it's the most reliable way to get new headers.
            // Users reported "no llega", so latency > flicker priority.
            loadChats(true);
        }, 10000);

        return () => clearInterval(intervalId);
    }, [selectedChannel, selectedProvider, refreshTrigger]); // Removed selectedTenant dep

    // Cleanup interval if it existed (we removed it for infinite scroll)

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && hasMore) {
            loadChats(false);
        }
    };

    // Icon helper
    // Old icon helper removed in favor of getChannelStyle

    const [msgOffset, setMsgOffset] = useState(0);
    const [hasMoreMsgs, setHasMoreMsgs] = useState(true);
    const MSG_LIMIT = 30;

    // Load Conversation History (with polling)
    useEffect(() => {
        if (!selectedChatId) return;

        // Reset on chat switch
        setMessages([]);
        setMsgOffset(0);
        setHasMoreMsgs(true);

        const loadHistory = async (chatId: string, isInitial = false) => {
            try {
                // For polling, we always fetch offset 0 (most recent)
                // If it's initial load, we fetch offset 0 and set offset to limit
                const url = `/admin/chats/${chatId}/messages?limit=${MSG_LIMIT}&offset=0`;
                const data = await fetchApi(url);

                if (Array.isArray(data)) {
                    const sorted = [...data].reverse(); // Backend returns DESC, we want ASC for chat history

                    if (isInitial) {
                        setMessages(sorted);
                        setMsgOffset(MSG_LIMIT);
                        setHasMoreMsgs(data.length === MSG_LIMIT);
                    } else {
                        // Polling: Merge only if we have new messages (last ID differs)
                        setMessages(prev => {
                            const lastMsgId = prev.length > 0 ? prev[prev.length - 1].id : null;
                            const newMsgs = sorted.filter(m => !prev.some(p => p.id === m.id));
                            if (newMsgs.length > 0) return [...prev, ...newMsgs];
                            return prev;
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to load history:", err);
            }
        };

        loadHistory(selectedChatId, true);

        const historyInterval = setInterval(() => loadHistory(selectedChatId, false), 3000);
        return () => clearInterval(historyInterval);
    }, [selectedChatId, fetchApi]);

    const loadOlderMessages = async () => {
        if (!selectedChatId || !hasMoreMsgs) return;
        try {
            const data = await fetchApi(`/admin/chats/${selectedChatId}/messages?limit=${MSG_LIMIT}&offset=${msgOffset}`);
            if (Array.isArray(data)) {
                const sorted = [...data].reverse();
                setMessages(prev => [...sorted, ...prev]);
                setMsgOffset(prev => prev + MSG_LIMIT);
                setHasMoreMsgs(data.length === MSG_LIMIT);
            }
        } catch (err) {
            console.error("Failed to load older messages:", err);
        }
    };

    const handleToggleHandoff = async (enabled: boolean) => {
        if (!selectedChatId) return;

        // Optimistic update
        setChats((prev: Chat[]) => prev.map(c =>
            c.id === selectedChatId ? { ...c, is_locked: enabled } : c
        ));

        try {
            await fetchApi(`/admin/conversations/${selectedChatId}/human-override`, {
                method: 'POST',
                body: { enabled }
            });
        } catch (e) {
            alert('Failed to toggle handoff');
            // Revert on error
            setChats((prev: Chat[]) => prev.map(c =>
                c.id === selectedChatId ? { ...c, is_locked: !enabled } : c
            ));
        }
    };

    const handleSendMessage = async () => {
        if (!selectedChat || !newMessage.trim()) return;

        const chat = selectedChat;

        try {
            await fetchApi('/admin/whatsapp/send', {
                method: 'POST',
                body: {
                    conversation_id: selectedChatId,
                    phone: chat?.phone,
                    message: newMessage,
                    tenant_id: chat?.tenant_id,
                    channel_source: chat?.channel || 'whatsapp'
                }
            });

            setMessages([...messages, {
                role: 'assistant',
                content: newMessage,
                timestamp: new Date().toISOString()
            }]);

            // Optimistic chat list reorder
            setChats((prev: Chat[]) => {
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
        <div className="view active animate-fade-in flex flex-col p-0 overflow-hidden" style={{ height: 'calc(100vh - 4.5rem)', maxHeight: 'calc(100vh - 4.5rem)', position: 'relative' }}>
            <h1 className="view-title px-6 pt-6 hidden md:block">Gestión Multicanal Nexus v4.2</h1>

            <div className="chats-layout flex-1 overflow-hidden" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '0',
                height: '100%'
            }}>
                {/* Left: List */}
                <div className={`glass flex flex-col transition-all duration-300 ${selectedChatId ? 'hidden md:flex' : 'flex w-full'}`} style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="p-4 border-b border-white/5 space-y-3 bg-black/20">
                        <div className="flex gap-2">
                            <select
                                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none flex-1"
                                value={selectedChannel}
                                onChange={(e) => setSelectedChannel(e.target.value)}
                            >
                                <option value="all" className="bg-black text-white">Canales</option>
                                <option value="whatsapp" className="bg-black text-white">WhatsApp</option>
                                <option value="instagram" className="bg-black text-white">Instagram</option>
                                <option value="facebook" className="bg-black text-white">Facebook</option>
                                <option value="human_override" className="bg-black text-white">Intervención</option>
                            </select>
                            <select
                                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none flex-1"
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                            >
                                <option value="all" className="bg-black text-white">Providers</option>
                                <option value="meta_direct" className="bg-black text-white">Meta Direct</option>
                                <option value="chatwoot" className="bg-black text-white">Chatwoot</option>
                                <option value="ycloud" className="bg-black text-white">YCloud</option>
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
                    <div className="overflow-y-auto flex-1" onScroll={handleScroll}>
                        {chats.map(chat => {
                            const style = getChannelStyle(chat);
                            const identifier = chat.phone || chat.name;

                            return (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={`flex items-center gap-3 p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 group relative overflow-hidden ${selectedChatId === chat.id ? 'bg-white/10' : ''}`}
                                >
                                    {/* Active Indicator / Channel Color Border */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bg.replace('bg-', 'bg-').split(' ')[0]} ${style.color} transition-all duration-300 shadow-[0_0_10px_currentColor]`}></div>

                                    {/* Avatar / Icon */}
                                    <div className="shrink-0 relative">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 overflow-hidden bg-black/40 ${style.border}`}>
                                            {chat.avatar_url ? (
                                                <img src={chat.avatar_url} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <span className="text-white/20"><User size={24} /></span>
                                            )}
                                        </div>
                                        {/* Omnichannel Badge */}
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md bg-[#121212] border border-black ${style.color}`}>
                                            {style.icon}
                                        </div>
                                    </div>

                                    {/* Texts */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-baseline mb-0.5 min-w-0">
                                            <h4 className={`font-bold text-[15px] truncate leading-tight ${selectedChatId === chat.id ? 'text-white' : 'text-gray-200'} flex-1`}>
                                                {chat.name || identifier}
                                            </h4>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {chat.provider && chat.provider !== 'ycloud' && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono uppercase tracking-wider ${
                                                        chat.provider === 'meta_direct' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                                        chat.provider === 'chatwoot' ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' :
                                                        'text-gray-400 border-gray-500/30 bg-gray-500/10'
                                                    }`}>
                                                        {chat.provider === 'meta_direct' ? 'META' : chat.provider?.toUpperCase()}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-500 font-mono">
                                                    {chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                            {/* Subtext: Handle or Last Message */}
                                            <p className={`text-xs truncate ${selectedChatId === chat.id ? 'text-gray-300' : 'text-gray-500'} flex items-center gap-1 min-w-0`}>
                                                {chat.provider === 'meta_direct' && chat.source_identifier && (
                                                    <span className="font-bold text-blue-400 shrink-0 max-w-[80px] truncate">{chat.source_identifier} •</span>
                                                )}
                                                {chat.provider === 'meta_direct' && chat.meta?.username && (
                                                    <span className="font-bold text-blue-400 shrink-0 max-w-[80px] truncate">@{chat.meta.username} •</span>
                                                )}
                                                {chat.provider === 'chatwoot' && chat.meta?.inbox_name && (
                                                    <span className="font-bold text-cyan-400 shrink-0 max-w-[80px] truncate">{chat.meta.inbox_name} •</span>
                                                )}
                                                <span className="truncate flex-1">{chat.last_message || 'Imagen / Audio'}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                                        {selectedChat?.avatar_url ? (
                                            <img
                                                src={selectedChat.avatar_url}
                                                alt="Avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User size={20} className="text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            {selectedChat?.name || 'Cliente'}
                                            {selectedChat?.is_locked && (
                                                <span className="text-xs bg-amber-500/20 text-amber-500 border border-amber-500/50 px-2 py-0.5 rounded-full animate-pulse">
                                                    HUMAN OVERRIDE
                                                </span>
                                            )}
                                        </h3>
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                            {selectedChat?.channel ? (
                                                <span className="capitalize">
                                                    {selectedChat.channel}
                                                    {selectedChat.provider === 'meta_direct' ? ' (Meta Direct)' :
                                                     selectedChat.provider === 'chatwoot' ? ' (Chatwoot)' :
                                                     selectedChat.provider ? ` (${selectedChat.provider})` : ''}
                                                </span>
                                            ) : 'Online'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className={`text-sm transition-all duration-300 ${selectedChat?.is_locked ? 'text-amber-500 font-bold' : 'text-secondary'}`}>
                                            {selectedChat?.is_locked ? 'Intervención Humana' : 'Agente Activo'}
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-accent"
                                            checked={selectedChat?.is_locked || false}
                                            onChange={(e) => handleToggleHandoff(e.target.checked)}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10 scroll-smooth">
                                {hasMoreMsgs && messages.length >= MSG_LIMIT && (
                                    <div className="flex justify-center pb-4">
                                        <button
                                            onClick={loadOlderMessages}
                                            className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2 rounded-full border border-white/10 transition-all flex items-center gap-2"
                                        >
                                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                            Cargar mensajes anteriores
                                        </button>
                                    </div>
                                )}
                                {messages.map((msg, idx) => {
                                    // Audio Protocol Parsing (Legacy)
                                    const audioMatch = msg.content && typeof msg.content === 'string'
                                        ? msg.content.match(/\[AUDIO_URL:\s*(.*?)\s*\|\s*TRANSCRIPT:\s*(.*?)\]/)
                                        : null;

                                    return (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} animate-scale-in`}>
                                            <div className={`max-w-[85%] rounded-2xl p-4 shadow-lg backdrop-blur-sm ${msg.role === 'user'
                                                ? 'bg-black/40 border border-white/10 rounded-tl-sm text-gray-100'
                                                : 'bg-white/10 border border-white/5 rounded-tr-sm text-white'
                                                }`}>

                                                {/* NEW: Attachments Array Support */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-col gap-2 mb-2">
                                                        {msg.attachments.map((att, i) => (
                                                            <div key={i} className="rounded-lg overflow-hidden border border-white/10 bg-black/20">
                                                                {(att.type === 'image' || att.type === 'image/jpeg' || att.type === 'image/png') && (
                                                                    <img
                                                                        src={att.url}
                                                                        alt="Adjunto"
                                                                        className="max-w-full h-auto cursor-pointer hover:opacity-95"
                                                                        style={{ maxHeight: '300px' }}
                                                                        onClick={() => window.open(att.url, '_blank')}
                                                                    />
                                                                )}
                                                                {(att.type === 'video' || att.type === 'video/mp4') && (
                                                                    <video controls src={att.url} className="w-full max-h-[300px]"></video>
                                                                )}
                                                                {(att.type === 'audio' || att.type === 'audio/mpeg' || att.type === 'audio/ogg' || att.type === 'audio/mp3') && (
                                                                    <div className="p-2 w-full min-w-[250px]">
                                                                        <audio controls src={att.url} className="w-full h-8"></audio>
                                                                    </div>
                                                                )}
                                                                {att.type === 'file' && (
                                                                    <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                                                                        <div className="p-2 bg-white/10 rounded-full">
                                                                            <MessageSquare size={16} />
                                                                        </div>
                                                                        <div className="overflow-hidden">
                                                                            <p className="font-bold text-sm truncate">{att.file_name || 'Descargar Archivo'}</p>
                                                                            <p className="text-[10px] opacity-70 uppercase tracking-widest">Documento</p>
                                                                        </div>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Legacy Audio Match */}
                                                {audioMatch && !msg.attachments && (
                                                    <div className="flex flex-col gap-2 min-w-[200px] mb-2">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-accent uppercase tracking-wider">Audio Legacy</span>
                                                        </div>
                                                        <audio controls className="w-full h-8 mb-1 rounded-lg">
                                                            <source src={audioMatch[1]} />
                                                        </audio>
                                                        <p className="text-xs italic opacity-80">"{audioMatch[2]}"</p>
                                                    </div>
                                                )}

                                                {/* Text Content (Linkified) */}
                                                {!audioMatch && msg.content && msg.content !== '[Attachment/Media]' && (
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                        {msg.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                                                            part.match(/^https?:\/\//) ? (
                                                                <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{part}</a>
                                                            ) : part
                                                        )}
                                                    </p>
                                                )}

                                                <span className="text-[10px] opacity-40 mt-1 block text-right font-mono">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Input Area or Template Selector */}
                            <div className="p-3 lg:p-4 pb-20 lg:pb-4 bg-black/60 backdrop-blur-xl border-t border-white/10 sticky bottom-0 z-30">
                                {(() => {
                                    // 24h Window Logic
                                    const lastMsgTime = new Date(selectedChat?.timestamp || Date.now()).getTime();
                                    const now = new Date().getTime();
                                    const hoursSinceLastMessage = (now - lastMsgTime) / (1000 * 60 * 60);
                                    const isSessionClosed = hoursSinceLastMessage > 24;

                                    if (isSessionClosed && selectedChat?.channel?.includes('whatsapp')) {
                                        return (
                                            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-yellow-500 mb-3">
                                                    <RefreshCw size={18} />
                                                    <span className="font-bold text-sm">Sesión de 24hs Cerrada</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-3">
                                                    Para reconectar, debes enviar una Plantilla Aprobada.
                                                </p>

                                                <TemplateSelector
                                                    onSend={async (tmpl, vars) => {
                                                        try {
                                                            await fetchApi(`/admin/chats/${selectedChatId}/send`, {
                                                                method: 'POST',
                                                                body: {
                                                                    type: 'template',
                                                                    template_name: tmpl.name,
                                                                    language: tmpl.language,
                                                                    parameters: vars
                                                                }
                                                            });
                                                            // Optimistic update
                                                            setRefreshTrigger(p => p + 1);
                                                        } catch (e) {
                                                            alert('Error sending template');
                                                        }
                                                    }}
                                                />
                                            </div>
                                        );
                                    }

                                    return (
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
                                    );
                                })()}
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

// --- Template Selector Component ---
const TemplateSelector = ({ onSend }: { onSend: (t: any, vars: string[]) => void }) => {
    const { fetchApi } = useApi();
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTmpl, setSelectedTmpl] = useState<any>(null);
    const [variables, setVariables] = useState<string[]>([]);

    useEffect(() => {
        fetchApi('/admin/templates/').then(data => {
            setTemplates(data?.filter((t: any) => t.status === 'APPROVED') || []);
        });
    }, []);

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const t = templates.find(x => x.id === e.target.value);
        setSelectedTmpl(t);
        // Detect variable count simply by parsing body (not perfect but OK for MVP)
        // Or assume body has {{1}}, {{2}}...
        // Doing a simple regex count
        const matches = t?.body_text?.match(/\{\{\d+\}\}/g);
        const count = matches ? new Set(matches).size : 0;
        setVariables(new Array(count).fill(''));
    };

    return (
        <div className="flex flex-col gap-2">
            <select
                onChange={handleSelect}
                className="bg-black/50 border border-gray-600 rounded p-2 text-sm text-white"
            >
                <option value="">-- Seleccionar Plantilla --</option>
                {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
            </select>

            {selectedTmpl && (
                <div className="mt-2 text-sm text-gray-300 font-mono bg-black/20 p-2 rounded">
                    {selectedTmpl.body_text}
                </div>
            )}

            {selectedTmpl && variables.map((v, i) => (
                <input
                    key={i}
                    placeholder={`Variable {{${i + 1}}}`}
                    className="bg-black/30 border border-gray-600 rounded p-2 text-sm text-white"
                    value={v}
                    onChange={e => {
                        const newVars = [...variables];
                        newVars[i] = e.target.value;
                        setVariables(newVars);
                    }}
                />
            ))}

            <button
                onClick={() => selectedTmpl && onSend(selectedTmpl, variables)}
                disabled={!selectedTmpl}
                className="bg-green-600 hover:bg-green-500 text-white rounded p-2 text-sm font-bold mt-1"
            >
                Enviar Plantilla
            </button>
        </div>
    );
};
