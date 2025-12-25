import React from 'react';
import { Server, Database, Activity, Cpu, HardDrive } from 'lucide-react';

interface SystemStatusProps {
    health: any;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ health }) => {
    // Determine status colors based on health check properties
    const getStatusColor = (status: string) => {
        if (status === 'OK' || status === 'healthy') return 'text-green-400';
        if (status === 'WARN') return 'text-yellow-400';
        return 'text-red-400';
    };

    // Mock CPU/RAM for effect if not provided by backend yet
    const cpuLoad = 12;
    const ramUsage = 45;

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
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">PostgreSQL</span>
                            <span className={`text-xs font-bold ${getStatusColor('OK')}`}>CONNECTED</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">5ms</div>
                </div>

                {/* Redis Metrics */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HardDrive size={16} className="text-red-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Redis Stack</span>
                            <span className={`text-xs font-bold ${getStatusColor('OK')}`}>READY</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">TTL:300s</div>
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
                    <div className="w-12 h-4 bg-slate-800 rounded-sm overflow-hidden flex items-end gap-[1px]">
                        {[1, 2, 3, 4, 5, 4, 3, 2, 5, 6].map((h, i) => (
                            <div key={i} className="bg-purple-500/50 w-1" style={{ height: `${h * 10}%` }}></div>
                        ))}
                    </div>
                </div>

                {/* CPU/Memory (Mocked Vitals) */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-cyan-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase">Core Vitals</span>
                            <span className="text-xs font-bold text-white">CPU: {cpuLoad}%</span>
                        </div>
                    </div>
                    <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${ramUsage}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
