import React from 'react';
import { Server, Database, Activity, Cpu, HardDrive } from 'lucide-react';

interface SystemStatusProps {
    health: any;
}

// ... imports ...

export const SystemStatus: React.FC<SystemStatusProps> = ({ health }) => {

    // Mapping helper
    const getStatusClass = (status: string) => {
        if (status === 'OK' || status === 'healthy') return 'ok';
        if (status === 'WARN') return 'warning';
        return 'error';
    };

    // Derive status from health prop when available
    const dbStatus = health?.database?.status || health?.db || null;
    const redisStatus = health?.redis?.status || health?.cache || null;
    const latency = health?.latency_ms ?? health?.gateway_latency ?? null;
    const overallStatus = health?.status || null;

    const dbStatusLabel = dbStatus ? (dbStatus === 'OK' || dbStatus === 'healthy' ? 'CONNECTED' : dbStatus) : null;
    const redisStatusLabel = redisStatus ? (redisStatus === 'OK' || redisStatus === 'healthy' ? 'READY' : redisStatus) : null;

    if (!health) {
        return (
            <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col gap-4">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Server size={14} /> Infrastructure Status
                </h3>
                <div className="text-sm text-slate-500 text-center py-4">Loading...</div>
            </div>
        );
    }

    return (
        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col gap-4">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Server size={14} /> Infrastructure Status
            </h3>

            <div className="grid grid-cols-2 gap-4">
                {/* Database Metrics */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database size={16} className="text-blue-400" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 uppercase">PostgreSQL</span>
                            <div className={`service-pill ${getStatusClass(dbStatus || 'OK')}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                {dbStatusLabel || 'CONNECTED'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Redis Metrics */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HardDrive size={16} className="text-red-400" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 uppercase">Redis Stack</span>
                            <div className={`service-pill ${getStatusClass(redisStatus || 'OK')}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                {redisStatusLabel || 'READY'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* API Latency */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-purple-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Gateway Latency</span>
                            <span className="text-xs font-bold text-white">{latency != null ? `${latency}ms` : '--'}</span>
                        </div>
                    </div>
                    <div className={`service-pill ${latency != null ? (latency < 500 ? 'ok' : 'warning') : getStatusClass(overallStatus || 'OK')}`} style={{ padding: '2px 6px' }}>
                        <div className="pill-dot"></div>
                    </div>
                </div>

                {/* Overall Health Status */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-cyan-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Core Vitals</span>
                            <div className={`service-pill ${getStatusClass(overallStatus || 'OK')}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                {overallStatus === 'OK' || overallStatus === 'healthy' ? 'NOMINAL' : (overallStatus || '--')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
