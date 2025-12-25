import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { ArrowRight, CheckCircle, Smartphone, Globe, Terminal, Loader2, Sparkles, BarChart3, Palette, FileText, Image } from 'lucide-react';

// --- Components (Minimalist for MVP) ---

const FuturisticLoader = ({ message, percent }: { message: string, percent: number }) => (
    <div className="futuristic-loader fade-in">
        <div className="relative flex items-center justify-center">
            <Loader2 className="animate-spin text-cyan-400" size={64} style={{ opacity: 0.5 }} />
            <div className="absolute text-white font-bold text-sm">{Math.round(percent)}%</div>
        </div>
        <p className="mt-6 text-cyan-400 font-mono tracking-widest text-lg">{message}</p>

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
        // Note: We use the hook which uses the updated base URL (BFF:3000)
        // But for SSE we need the raw URL.

        try {
            // A. Trigger Ignition (Fire and Forget)
            const payload = { ...formData, tenant_id: formData.bot_phone_number }; // Using phone as temporary tenant_id
            await fetchApi('/api/engine/ignite', { method: 'POST', body: payload });

            // B. Connect to Stream (BFF)
            // We need to resolve the ABSOLUTE URL for EventSource because it doesn't support relative paths well with headers (though standard EventSource does support relative).
            // Since we updated useApi to return absolute 'http://localhost:3000', we can try to reuse that logic or just rely on the API_BASE if exported.
            // For now, let's assume relative path works if served from same domain, OR construct it.
            // Let's assume localhost:3000 for development as per useApi.

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
            });
            evtSource.addEventListener("script", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
            });
            evtSource.addEventListener("visuals", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
            });
            evtSource.addEventListener("roi", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
            });

            // Transition to dashboard view after a few seconds or immediately?
            // "The Awakening" implies watching the process.
            setTimeout(() => setStep('dashboard'), 1500);

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

                    const [percent, setPercent] = useState(0);

    // ... (inside handleConnect, update event listeners)
            evtSource.addEventListener("branding", (e: any) => {
                const asset = JSON.parse(e.data);
                setAssets(prev => [...prev, asset]);
                setLogs(prev => [...prev, ">> ASSET: Branding Manual Completed."]);
                setPercent(prev => Math.min(prev + 25, 100)); // 4 Steps approx
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

                    // ...

                    {/* Left Panel: Assets Dashboard */}
                    <div className="dashboard-content fade-in">
                        <h1 className="text-2xl font-bold mb-6 flex items-center">
                            <Globe className="mr-3 text-cyan-400" />
                            Mission Control: {formData.store_name}
                        </h1>

                        {assets.length < 4 ? (
                            <FuturisticLoader message={`HYDRATING SYSTEM...`} percent={percent} />
                        ) : (
                            <div className="grid gap-4">
                                {/* ... map assets ... */}
                                {assets.map((asset, i) => (
                                    <AssetCard key={i} title={asset.asset_type?.toUpperCase() || 'ASSET'} icon={CheckCircle}>
                                        <pre style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            overflowX: 'auto',
                                            fontSize: '12px',
                                            color: '#94a3b8'
                                        }}>
                                            {JSON.stringify(asset.content || asset.data, null, 2)}
                                        </pre>
                                    </AssetCard>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Thinking Logs (Matrix Style) */}
                    <div className="logs-panel" style={{
                        background: '#0f172a',
                        borderLeft: '1px solid #1e293b',
                        padding: '20px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div className="flex items-center mb-4 text-emerald-400">
                            <Terminal size={18} className="mr-2" />
                            <span className="font-bold tracking-wider">SYSTEM LOGS</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {logs.map((log, i) => (
                                <div key={i} className="text-xs border-l-2 border-emerald-500/30 pl-2 py-1">
                                    <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>
                                    <span className="text-emerald-400 ml-2">{log}</span>
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
