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
        // Connect to Global Stream (BFF)
        // We use relative path assuming BFF proxies /api
        // But for EventSource, we need full URL usually if separate domain? 
        // In EasyPanel, frontend and BFF are same domain usually via ingress, or we use relative.
        // Let's try relative '/api...' assuming Nginx proxies /api to BFF.

        // Use relative path which goes through Nginx -> BFF
        const streamUrl = `/api/engine/stream/global`;

        const evtSource = new EventSource(streamUrl);

        evtSource.onopen = () => {
            setIsConnected(true);
            setLogs(prev => [...prev, {
                id: Date.now(),
                event_type: 'system',
                message: 'Global Telemetry Uplink Established... listening for signals.',
                severity: 'success',
                occurred_at: new Date().toISOString()
            }]);
        };

        evtSource.addEventListener('log', (event: MessageEvent) => {
            try {
                const newLog = JSON.parse(event.data);
                setLogs(prev => {
                    const updated = [...prev, newLog];
                    if (updated.length > 50) return updated.slice(updated.length - 50); // Keep last 50
                    return updated;
                });
            } catch (e) {
                console.error("Parse error", e);
            }
        });

        evtSource.onerror = (err) => {
            // setIsConnected(false); // Don't flicker on minor retry
        };

        return () => {
            evtSource.close();
        };
    }, []);

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

                {logs.map((log, idx) => (
                    <div key={idx} className="mb-2 pl-3 border-l-2 border-transparent hover:border-cyan-500/50 transition-all group">
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] text-slate-500">{new Date(log.occurred_at).toLocaleTimeString()}</span>
                            <span className={`font-bold ${log.severity === 'error' ? 'text-red-400' :
                                log.severity === 'warning' ? 'text-yellow-400' :
                                    log.event_type === 'engine' ? 'text-purple-400' : 'text-cyan-300'
                                }`}>
                                [{log.event_type.toUpperCase()}]
                            </span>
                            <span className="text-slate-300 group-hover:text-white">{log.message}</span>
                        </div>
                        {log.payload && Object.keys(log.payload).length > 0 && (
                            <pre className="mt-1 ml-12 text-[10px] text-slate-500 overflow-x-auto">
                                {JSON.stringify(log.payload, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
