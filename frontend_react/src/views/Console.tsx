import React, { useEffect, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Terminal, Play, Pause, Trash2, Filter, Wifi, WifiOff } from 'lucide-react';

interface LogEvent {
    id: number;
    severity: string;
    type: string;
    message: string;
    timestamp: string;
    payload?: any;
}

export const Console: React.FC = () => {
    const { fetchApi } = useApi();
    const [events, setEvents] = useState<LogEvent[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('');
    const eventSourceRef = useRef<EventSource | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const toggleStream = () => { if (isStreaming) stopStream(); else startStream(); };
    const startStream = () => { if (eventSourceRef.current) return; setIsStreaming(true); };
    const stopStream = () => { setIsStreaming(false); };

    useEffect(() => {
        if (isStreaming) {
            const apiBase = (window as any).env?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';
            const es = new EventSource(`${apiBase}/admin/console/stream`);
            eventSourceRef.current = es;
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const logEntry: LogEvent = {
                        id: data.id || Math.random(), severity: data.severity || 'INFO',
                        type: data.type || 'SYS', message: data.message,
                        timestamp: data.timestamp || new Date().toISOString(), payload: data.payload
                    };
                    setEvents(prev => [...prev, logEntry].slice(-200));
                } catch (err) { console.error("Error parsing stream data:", err); }
            };
            es.onerror = () => { setIsStreaming(false); es.close(); };
            return () => { es.close(); eventSourceRef.current = null; };
        }
    }, [isStreaming]);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight < 100) {
                scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            }
        }
    }, [events, autoScroll]);

    const filteredEvents = events.filter(e =>
        e.message.toLowerCase().includes(filter.toLowerCase()) || e.type.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="view active h-screen flex flex-col p-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                        <Terminal size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">System Console</h1>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{isStreaming ? 'Streaming' : 'Detenido'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEvents([])}
                        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-all">
                        <Trash2 size={12} /> Clear
                    </button>
                    <button onClick={() => setAutoScroll(!autoScroll)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                            autoScroll ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}>
                        Auto-scroll
                    </button>
                    <button onClick={toggleStream}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
                            isStreaming
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-900/20'
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-900/30'
                        }`}>
                        {isStreaming ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Stream</>}
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 mb-4 shrink-0">
                <div className="flex items-center gap-2 px-3">
                    <Filter size={14} className="text-gray-600" />
                    <input
                        className="bg-transparent border-none text-sm py-2 w-full focus:outline-none text-white placeholder-gray-600"
                        placeholder="Filtrar logs (grep)..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && <span className="text-[10px] text-gray-500 shrink-0">{filteredEvents.length} resultados</span>}
                </div>
            </div>

            {/* Log viewer */}
            <div ref={scrollRef} className="bg-black/40 backdrop-blur-xl border border-white/10 flex-1 overflow-auto font-mono text-xs p-4 rounded-2xl relative">
                {filteredEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                        <Terminal size={40} className="mb-4 opacity-20" />
                        <p className="text-sm">Console Ready. Start streaming to view events.</p>
                    </div>
                )}

                {filteredEvents.map((e, i) => (
                    <div key={i} className="mb-0.5 hover:bg-white/[0.03] px-2 py-1 rounded flex gap-2 break-all group transition-colors">
                        <span className="text-gray-600 select-none w-20 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold w-14 shrink-0 ${
                            e.severity === 'ERROR' ? 'text-red-400' :
                            e.severity === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>[{e.severity || 'INFO'}]</span>
                        <span className="text-purple-400/60 w-20 shrink-0">{e.type}:</span>
                        <span className="text-gray-300">{e.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
