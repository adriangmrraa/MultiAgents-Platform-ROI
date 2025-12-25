import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { ArrowRight, CheckCircle, Smartphone, Globe, Terminal, Loader2, Sparkles, BarChart3, Palette, FileText, Image, Activity, Brain } from 'lucide-react';

// --- Components (Minimalist for MVP) ---

const FuturisticLoader = ({ message, percent, status }: { message?: string, percent: number, status?: string }) => (
    <div className="futuristic-loader fade-in">
        <div className="relative flex items-center justify-center">
            <Loader2 className="animate-spin text-cyan-400" size={64} style={{ opacity: 0.5 }} />
            <div className="absolute text-white font-bold text-sm">{Math.round(percent)}%</div>
        </div>
        <p className="mt-6 text-cyan-400 font-mono tracking-widest text-lg">{message || status || "LOADING..."}</p>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-slate-800 rounded mt-4 overflow-hidden relative">
            <div
                className="h-full bg-cyan-400 absolute top-0 left-0 transition-all duration-500 ease-out"
                style={{ width: `${percent}%`, boxShadow: '0 0 10px #22d3ee' }}
            />
        </div>

        <style>{`
            .futuristic-loader { display: flex; flex-direction: column; alignItems: center; justifyContent: center; height: 400px; }
            .text-cyan-400 { color: #22d3ee; }
            .font-mono { font-family: 'Courier New', monospace; }
            .tracking-widest { letter-spacing: 0.2em; }
        `}</style>
    </div>
);

const AssetCard = ({ title, icon: Icon, children }: any) => (
    <div className="asset-card fade-in" style={{
        background: 'rgba(0, 20, 40, 0.6)',
        border: '1px solid rgba(0, 255, 200, 0.2)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '16px',
        backdropFilter: 'blur(10px)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#22d3ee' }}>
            <Icon size={20} style={{ marginRight: '8px' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h3>
        </div>
        <div>{children}</div>
    </div>
);

export const SetupExperience: React.FC = () => {
    const { fetchApi } = useApi();
    const [step, setStep] = useState<'connect' | 'igniting' | 'dashboard'>('connect');
    const [logs, setLogs] = useState<string[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [percent, setPercent] = useState(0);

    // Form State
    const [formData, setFormData] = useState({
        store_name: '',
        bot_phone_number: '',
        tiendanube_store_id: ''
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleConnect = async () => {
        setStep('igniting');

        // 1. Ignite the Engine
        try {
            // A. Trigger Ignition (Fire and Forget)
            const payload = { ...formData, tenant_id: formData.bot_phone_number }; // Using phone as temporary tenant_id
            await fetchApi('/api/engine/ignite', { method: 'POST', body: payload });

            // B. Connect to Stream (BFF)
            const streamUrl = `http://localhost:3000/api/engine/stream/${formData.bot_phone_number}`;
            const evtSource = new EventSource(streamUrl);

            evtSource.onopen = () => {
                setLogs(prev => [...prev, ">> SYSTEM: Secure Link Established. Protocol Omega Active."]);
            };

            evtSource.onmessage = (event) => {
                // Heartbeat or generic
            };

            evtSource.addEventListener("log", (e: any) => {
                const log = JSON.parse(e.data);
                setLogs(prev => [...prev, `[${log.event_type}] ${log.message}`]);
            });

            evtSource.addEventListener("branding", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
                setLogs(prev => [...prev, ">> ASSET: Branding Manual Generated."]);
                setPercent(prev => Math.min(prev + 25, 100));
            });
            evtSource.addEventListener("script", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
                setLogs(prev => [...prev, ">> ASSET: Sales Scripts Hydrated."]);
                setPercent(prev => Math.min(prev + 25, 100));
            });
            evtSource.addEventListener("visuals", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
                setLogs(prev => [...prev, ">> ASSET: Visual Concepts Rendered."]);
                setPercent(prev => Math.min(prev + 25, 100));
            });
            evtSource.addEventListener("roi", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
                setLogs(prev => [...prev, ">> ASSET: ROI Analysis Verified."]);
                setPercent(prev => Math.min(prev + 25, 100));
            });

            // Auto transition to dashboard logic if needed, but staying in igniting to show progress is better.
            // setStep('dashboard'); // Optional later

        } catch (e: any) {
            console.error(e);
            setLogs(prev => [...prev, `>> CRITICAL ERROR: ${e.message}`]);
        }
    };

    return (
        <div className="view active" style={{ background: '#020617', color: '#f8fafc', minHeight: '100vh', padding: '20px' }}>

            {step === 'connect' && (
                <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
                    <div className="mb-8">
                        <Sparkles size={48} className="mx-auto text-cyan-400 mb-4" />
                        <h1 className="text-3xl font-bold mb-2">Nexus Business Engine</h1>
                        <p className="text-slate-400">Initialize your autonomous enterprise.</p>
                    </div>

                    <div className="space-y-4 text-left">
                        <div className="form-group">
                            <label className="text-sm text-slate-400">Project Name</label>
                            <input
                                className="w-full bg-slate-800 border-none rounded p-3 text-white"
                                value={formData.store_name}
                                onChange={e => setFormData({ ...formData, store_name: e.target.value })}
                                placeholder="E.g. CyberStore 2077"
                            />
                        </div>
                        <div className="form-group">
                            <label className="text-sm text-slate-400">Tenant ID (Phone)</label>
                            <input
                                className="w-full bg-slate-800 border-none rounded p-3 text-white"
                                value={formData.bot_phone_number}
                                onChange={e => setFormData({ ...formData, bot_phone_number: e.target.value })}
                                placeholder="54911..."
                            />
                        </div>
                        <button
                            onClick={handleConnect}
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 rounded mt-6 transition-all"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            Initialize System <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {(step === 'igniting' || step === 'dashboard') && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 400px', gap: '20px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 40px)' }}>

                    {/* Left Canvas (Assets) */}
                    <div className="bg-slate-900/50 rounded-lg p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Activity className="text-cyan-400" />
                                Business Canvas
                            </h2>
                            <div className="text-sm text-cyan-400/60 font-mono">
                                STATUS: {step === 'igniting' ? 'GENERATING...' : 'ONLINE'}
                            </div>
                        </div>

                        {/* Loader with Percentage */}
                        {step === 'igniting' && (assets.length < 4) && (
                            <FuturisticLoader percent={percent} status={logs[logs.length - 1] || "Initializing..."} />
                        )}

                        {/* Asset Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mt-8">
                            {/* Render Assets */}
                            {assets.map((a, i) => (
                                <AssetCard key={i} title={a.asset_type?.toUpperCase() || 'ASSET'} icon={CheckCircle}>
                                    <pre style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        overflowX: 'auto',
                                        fontSize: '12px',
                                        color: '#94a3b8'
                                    }}>
                                        {JSON.stringify(a.content || a, null, 2)}
                                    </pre>
                                </AssetCard>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel (Logs) */}
                    <div className="bg-black border-l border-white/10 flex flex-col">
                        <div className="p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Brain size={16} /> Thinking Process
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-400 space-y-2">
                            {logs.map((log, i) => (
                                <div key={i} className="border-l-2 border-cyan-500/20 pl-2">
                                    <span className="text-cyan-600">[{new Date().toLocaleTimeString()}]</span> {log}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
