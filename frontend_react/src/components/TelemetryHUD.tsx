import React from 'react';
import { Server, Database, Shield, Globe, Cpu, Radio } from 'lucide-react';

interface HealthCheck {
    name: string;
    status: 'OK' | 'FAIL' | 'WARN';
}

interface TelemetryHUDProps {
    health: { status: string; checks: HealthCheck[] } | null;
}

/**
 * Tactical HUD: Visualizes the "Protocol Omega" Neural Network
 * Shows real-time connectivity between microservices.
 */
export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ health }) => {

    const getStatus = (name: string) => {
        const check = health?.checks?.find(c => c.name.includes(name));
        return check?.status === 'OK' ? 'active' : check?.status === 'WARN' ? 'warn' : 'error';
    };

    const isFlowing = health?.status === 'healthy';

    return (
        <div className="glass hud-grid-bg relative overflow-hidden rounded-2xl p-6 mb-8 border border-cyan-900/30">
            {/* Holographic Scanline */}
            <div className="scan-line"></div>

            <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Radio className="text-cyan-400 animate-pulse" size={20} />
                        SYSTEM TOPOLOGY
                    </h2>
                    <p className="text-xs text-cyan-500/60 font-mono tracking-widest mt-1">LIVE TELEMETRY FEED // PROTOCOL OMEGA</p>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-bold font-mono ${health?.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                        {health?.status?.toUpperCase() || 'SYNCING...'}
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase">Global Health Status</p>
                </div>
            </div>

            {/* Network Map */}
            <div className="topology-map">

                {/* 1. Gateway (Nginx) */}
                <abbr title="Nginx Reverse Proxy (Emergency Gateway)" className="no-underline">
                    <div className="net-node active">
                        <Globe size={24} className="text-cyan-400 node-icon" />
                        <span className="node-label">GATEWAY</span>
                    </div>
                </abbr>

                {/* Link */}
                <div className="net-link flex items-center">
                    {isFlowing && <div className="data-packet" style={{ animationDelay: '0s' }}></div>}
                </div>

                {/* 2. BFF (Node) */}
                <abbr title="BFF Service (Stream Manager)" className="no-underline">
                    <div className={`net-node active`}>
                        <Shield size={24} className="text-purple-400 node-icon" />
                        <span className="node-label">BFF CORE</span>
                    </div>
                </abbr>

                {/* Link */}
                <div className="net-link flex items-center">
                    {isFlowing && <div className="data-packet" style={{ animationDelay: '0.5s' }}></div>}
                    {isFlowing && <div className="data-packet reverse" style={{ animationDelay: '1.5s', background: '#a855f7' }}></div>}
                </div>

                {/* 3. Orchestrator (Python) */}
                <abbr title="Orchestrator Service (Business Engine)" className="no-underline">
                    <div className={`net-node ${getStatus('orchestrator')}`}>
                        <Cpu size={24} className="text-emerald-400 node-icon" />
                        <span className="node-label">ENGINE</span>
                    </div>
                </abbr>

                {/* Link */}
                <div className="net-link flex items-center">
                    {isFlowing && <div className="data-packet" style={{ animationDelay: '1s', background: '#10b981' }}></div>}
                </div>

                {/* 4. Persistence (DB) */}
                <abbr title="PostgreSQL + Redis (Memory Bank)" className="no-underline">
                    <div className={`net-node ${getStatus('database')}`}>
                        <Database size={24} className="text-slate-400 node-icon" />
                        <span className="node-label">MEMORY</span>
                    </div>
                </abbr>

            </div>

            <div className="mt-4 flex justify-between text-[10px] text-slate-600 font-mono">
                <span>LATENCY: 12ms</span>
                <span>UPTIME: 99.9%</span>
                <span>SECURE TUNNEL: ACTIVE</span>
            </div>
        </div>
    );
};
