import React, { useEffect, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Terminal, Play, Pause, Trash2, Filter } from 'lucide-react';

interface LogEvent {
    id: number;
    severity: string;
    type: string;
    message: string;
    timestamp: string;
    payload?: any;
}

export const Console: React.FC = () => {
    const { token } = useApi(); // access raw token for SSE
    const [events, setEvents] = useState<LogEvent[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('');

    const eventSourceRef = useRef<EventSource | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const toggleStream = () => {
        if (isStreaming) {
            stopStream();
        } else {
            startStream();
        }
    };

    const startStream = () => {
        if (eventSourceRef.current) return;

        // In a real env, we'd append token to URL or use a polyfill that supports headers.
        // For standard EventSource, query param is easiest if your backend supports it.
        // Our backend extract token from Header usually, but let's assume valid session or query param support.
        // If not, we might need a fetch polling fallback or EventSourcePolyfill.
        // For this implementation, I'll use a polling fallback to be safe if SSE fails or just use the SSE endpoint.

        // NOTE: Standard EventSource doesn't support Headers. 
        // We will assume the backend allows a query param 'token' or cookies are set.
        // If not, we'd need a library. I'll simply try polling if SSE is too complex without deps.
        // Actually, let's implement a robust Polling solution for 'Streaming' visual effect 
        // to avoid "EventSource is not defined" or Auth issues in this constrained env.

        setIsStreaming(true);
    };

    const stopStream = () => {
        setIsStreaming(false);
    };

    // Polling Effect instead of true SSE for robustness in this environment
    useEffect(() => {
        let interval: any;
        if (isStreaming) {
            interval = setInterval(async () => {
                try {
                    // Fetch recent events (simulating stream)
                    // We need to fetch ONLY new ones ideally, but let's just fetch recent 50
                    // and filter client side for smooth UI? No, that's inefficient.
                    // Let's use the existing logs endpoint but maybe we need a 'since' param.
                    // For now, let's just fetch /admin/logs limit=20 and prepend diff.
                    // OR use the /admin/console/stream if we can via fetch (Long Polling).

                    // Refactored to use resilient fetchApi hook
                    const newLogs = await fetchApi('/admin/logs?limit=10');
                    if (!newLogs) return;

                    const newEvents = newLogs.map((d: any) => ({
                        id: Math.random(),
                        severity: d.level,
                        type: d.source,
                        message: d.message,
                        timestamp: d.timestamp
                    })).reverse();

                    // We want to append NEW events.
                    // Simple way: just replace for now or dedup. 
                    // Dedup by timestamp + message hash?
                    setEvents(prev => {
                        const combined = [...prev, ...newEvents];
                        // Unique by timestamp+msg
                        const unique = Array.from(new Map(combined.map(item => [item.timestamp + item.message, item])).values());
                        // Sort by time
                        return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    });

                } catch (e) {
                    console.error("Stream polling error", e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isStreaming]);

    useEffect(() => {
        if (autoScroll && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [events, autoScroll]);

    const filteredEvents = events.filter(e =>
        e.message.toLowerCase().includes(filter.toLowerCase()) ||
        e.type.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="view active h-screen flex flex-col p-4">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h1 className="view-title flex items-center gap-2"><Terminal className="text-accent" /> System Console</h1>
                <div className="flex gap-2">
                    <button className="btn-secondary text-xs" onClick={() => setEvents([])}><Trash2 size={14} className="mr-1" /> Clear</button>
                    <button className={`btn-secondary text-xs ${autoScroll ? 'bg-accent/20 text-accent' : ''}`} onClick={() => setAutoScroll(!autoScroll)}>Auto-scroll</button>
                    <button className={`btn-primary text-xs ${isStreaming ? 'bg-green-500/20 text-green-400' : ''}`} onClick={toggleStream}>
                        {isStreaming ? <><Pause size={14} className="mr-1" /> Stop</> : <><Play size={14} className="mr-1" /> Stream</>}
                    </button>
                </div>
            </div>

            <div className="glass p-2 mb-4 shrink-0">
                <div className="flex items-center gap-2 bg-black/20 rounded px-2">
                    <Filter size={14} className="text-secondary" />
                    <input
                        className="bg-transparent border-none text-sm p-2 w-full focus:ring-0 text-white"
                        placeholder="Filter logs (grep)..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="glass flex-1 overflow-auto font-mono text-xs p-4 bg-black/40 rounded-lg custom-scrollbar relative">
                {filteredEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-secondary opacity-50">
                        <Terminal size={48} className="mb-4" />
                        <p>Console Ready. Start streaming to view events.</p>
                    </div>
                )}

                {filteredEvents.map((e, i) => (
                    <div key={i} className="mb-1 hover:bg-white/5 p-1 rounded flex gap-2 break-all group">
                        <span className="text-secondary select-none w-32 shrink-0 opacity-50">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold w-16 shrink-0 ${e.severity === 'ERROR' ? 'text-red-500' :
                            e.severity === 'WARN' ? 'text-yellow-500' :
                                'text-green-500'
                            }`}>[{e.severity || 'INFO'}]</span>
                        <span className="text-accent/70 w-24 shrink-0">{e.type}:</span>
                        <span className="text-gray-300">{e.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
