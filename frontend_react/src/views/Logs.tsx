import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ScrollText, RefreshCw, AlertCircle, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    source: string;
}

export const Logs: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const loadLogs = async () => {
        try {
            const data = await fetchApi('/admin/logs?limit=50');
            if (Array.isArray(data)) setLogs(data);
            else if (data.logs) setLogs(data.logs);
        } catch (e) {
            console.error("Failed to load logs", e);
        }
    };

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'ERROR': return <AlertCircle size={14} className="text-red-400" />;
            case 'WARN': return <AlertTriangle size={14} className="text-amber-400" />;
            default: return <CheckCircle size={14} className="text-emerald-400" />;
        }
    };

    const getLevelStyle = (level: string) => {
        switch (level) {
            case 'ERROR': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'WARN': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        }
    };

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                        <ScrollText size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">System Logs</h1>
                        <p className="text-xs text-gray-500">Registros del sistema en tiempo real</p>
                    </div>
                </div>
                <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                    <div className="text-2xl font-black text-white">{logs.length}</div>
                    <div className="text-xs text-gray-500">Total registros</div>
                </div>
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                    <div className="text-2xl font-black text-red-400">{logs.filter(l => l.level === 'ERROR').length}</div>
                    <div className="text-xs text-gray-500">Errores</div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                    <div className="text-2xl font-black text-amber-400">{logs.filter(l => l.level === 'WARN').length}</div>
                    <div className="text-xs text-gray-500">Warnings</div>
                </div>
            </div>

            {/* Log entries */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="hidden md:grid grid-cols-[140px_80px_120px_1fr] gap-4 px-5 py-3 border-b border-white/10 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <span>Timestamp</span>
                    <span>Nivel</span>
                    <span>Origen</span>
                    <span>Mensaje</span>
                </div>

                {/* Rows */}
                <div className="max-h-[500px] overflow-y-auto">
                    {logs.map((log, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-[140px_80px_120px_1fr] gap-2 md:gap-4 px-5 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                <Clock size={10} className="text-gray-600 hidden md:block" />
                                {new Date(log.timestamp).toLocaleString()}
                            </div>
                            <div>
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLevelStyle(log.level)}`}>
                                    {getLevelIcon(log.level)}
                                    {log.level}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400">{log.source || 'Orchestrator'}</div>
                            <div className="text-xs text-gray-300 font-mono leading-relaxed break-all">{log.message}</div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                            <ScrollText size={32} className="mb-3 opacity-30" />
                            <p className="text-sm">No hay registros recientes.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Live indicator */}
            <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Actualizacion automatica cada 5 segundos</span>
            </div>
        </div>
    );
};
