import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Cpu, Activity } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface LogEntry {
    id: number;
    event_type: string;
    message: string;
    severity: string;
    payload?: any;
    occurred_at: string;
}

export const GlobalStreamLog: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { fetchApi } = useApi(); // Just for getting baseURL if needed, but we use relative for SSE

    useEffect(() => {
        // RESILIENCE FIX: Switch from EventSource (no auth headers) to Polling (Authenticated)
        // This resolves the 401 error on /api/admin/console/stream
        setIsConnected(true);

        const pollLogs = async () => {
            try {
                const data = await fetchApi('/admin/logs?limit=5');
                if (Array.isArray(data)) {
                    const newEvents = data.map((d: any) => ({
                        id: Math.random(),
                        event_type: d.source || 'SYS',
                        message: d.message,
                        severity: d.level === 'ERROR' ? 'error' : 'info',
                        occurred_at: d.timestamp,
                        payload: d.payload
                    })).reverse();

                    setLogs(prev => {
                        // Simple deduplication strategy or just append for "Stream Feel"
                        // For now, just show the latest batch to avoid infinite growth duplication in this demo
                        return newEvents;
                    });
                }
            } catch (e) {
                // Silent fail on poll
            }
        };

        const interval = setInterval(pollLogs, 3000); // 3s Pulse
        pollLogs(); // Initial

        return () => clearInterval(interval);
    }, [fetchApi]);

    // Auto-scroll
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="glass w-full rounded-2xl overflow-hidden flex flex-col h-[400px] border border-cyan-900/30 shadow-2xl mt-8">
            <div className="bg-slate-900/90 p-3 border-b border-cyan-900/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-cyan-400" />
                    <span className="text-xs font-mono text-cyan-400 tracking-wider">GLOBAL_EVENT_BUS // LISTENING</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Cpu size={14} className="text-purple-400" />
                        <span className="text-[10px] text-purple-400">CORE: ACTIVE</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-black/40 relative">
                {/* Background Grid */}
                <div className="absolute inset-0 hud-grid-bg opacity-10 pointer-events-none"></div>

                {logs.length === 0 && (
                    <div className="text-center mt-20 opacity-50">
                        <Activity className="mx-auto mb-2 animate-pulse text-cyan-800" />
                        <span className="text-cyan-900">Waiting for telemetry...</span>
                    </div>
                )}

                {logs.map((log, idx) => {
                    // Didactic Parsing Logic
                    let icon = <Activity size={12} className="text-slate-500" />; // Default
                    let borderColor = 'border-slate-800';
                    let label = 'SYSTEM';

                    if (log.message.includes('Planning') || log.message.includes('Reasoning')) {
                        icon = <span className="text-lg">🦉</span>;
                        borderColor = 'border-purple-500/50';
                        label = 'COGNITION';
                    } else if (log.message.includes('Tool') || log.message.includes('Executing')) {
                        icon = <span className="text-lg">🛠️</span>;
                        borderColor = 'border-cyan-500/50';
                        label = 'TOOL USE';
                    } else if (log.message.includes('RAG') || log.message.includes('Retrieving')) {
                        icon = <span className="text-lg">🐢</span>;
                        borderColor = 'border-emerald-500/50';
                        label = 'MEMORY';
                    } else if (log.message.includes('Response') || log.message.includes('Speaking')) {
                        icon = <span className="text-lg">🗣️</span>;
                        borderColor = 'border-pink-500/50';
                        label = 'RESPONSE';
                    }

                    return (
                        <div key={idx} className={`mb-3 p-3 rounded-lg border bg-slate-900/50 backdrop-blur-sm ${borderColor} border-l-4 transition-all hover:translate-x-1 duration-300`}>
                            <div className="flex items-start gap-3">
                                <div className="mt-1 w-6 h-6 flex items-center justify-center bg-black/30 rounded-full shadow-inner">
                                    {icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[9px] font-bold tracking-widest opacity-70 ${borderColor.replace('border-', 'text-').replace('/50', '')}`}>
                                            {label}
                                        </span>
                                        <span className="text-[9px] text-slate-600 font-mono">
                                            {new Date(log.occurred_at).toLocaleTimeString().split(' ')[0]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium leading-relaxed font-sans">
                                        {log.message}
                                    </p>

                                    {/* Payload Inspector (Didactic Detail) */}
                                    {log.payload && Object.keys(log.payload).length > 0 && (
                                        <div className="mt-2 text-[10px] bg-black/40 p-2 rounded border border-slate-800/50 font-mono text-slate-400 overflow-x-auto">
                                            {JSON.stringify(log.payload, null, 2).slice(0, 150)}
                                            {JSON.stringify(log.payload).length > 150 && "..."}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
