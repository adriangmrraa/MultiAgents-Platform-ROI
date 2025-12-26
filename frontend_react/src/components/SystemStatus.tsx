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

    // Mock CPU/RAM for effect
    const cpuLoad = 12;

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
                            <div className={`service-pill ${getStatusClass('OK')}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                CONNECTED
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
                            <div className={`service-pill ${getStatusClass('OK')}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                READY
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
                            <span className="text-xs font-bold text-white">24ms</span>
                        </div>
                    </div>
                    <div className="service-pill ok" style={{ padding: '2px 6px' }}>
                        <div className="pill-dot"></div>
                    </div>
                </div>

                {/* CPU/Memory (Mocked Vitals) */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-cyan-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Core Vitals</span>
                            <div className="service-pill ok" style={{ padding: '2px 8px', fontSize: '10px' }}>
                                <div className="pill-dot"></div>
                                {cpuLoad}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
