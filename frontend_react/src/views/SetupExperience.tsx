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

// --- Specialized Asset Blocks ---

const BrandingBlock = ({ data }: { data: any }) => (
    <div className="space-y-4">
        <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Palette</h4>
            <div className="flex gap-2">
                {data.colors?.map((c: string, i: number) => (
                    <div key={i} className="w-12 h-12 rounded-full border border-white/10 shadow-lg transition-transform hover:scale-110" style={{ backgroundColor: c }} title={c} />
                ))}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase">Archetype</h4>
                <p className="text-cyan-400 font-mono">{data.identity?.archetype}</p>
            </div>
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase">Fonts</h4>
                <p className="text-white font-mono text-xs">{data.typography?.primary} / {data.typography?.secondary}</p>
            </div>
        </div>
    </div>
);

const ScriptBlock = ({ data }: { data: any }) => (
    <div className="space-y-3 font-mono text-xs text-slate-300">
        <div className="bg-slate-900/50 p-3 rounded border-l-2 border-cyan-500">
            <h4 className="font-bold text-cyan-400 mb-1">Welcome Message</h4>
            <p>"{data.welcome_message}"</p>
        </div>
        <div className="bg-slate-900/50 p-3 rounded border-l-2 border-purple-500">
            <h4 className="font-bold text-purple-400 mb-1">Closing Hook</h4>
            <p>"{data.closing_hook}"</p>
        </div>
    </div>
);

const VisualGrid = ({ data }: { data: any }) => (
    <div className="grid grid-cols-2 gap-2">
        {data.social_posts?.map((post: any, i: number) => (
            <div key={i} className="bg-slate-800 rounded p-2 text-xs relative overflow-hidden group">
                <div className="aspect-square bg-slate-700 flex items-center justify-center mb-2 overflow-hidden rounded">
                    {post.base_image ? (
                        <img src={post.base_image} alt={post.caption} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                    ) : (
                        <Image size={24} className="text-slate-500" />
                    )}
                </div>
                <p className="font-bold text-white truncate">{post.caption}</p>
                <p className="text-slate-400 text-[10px] italic">{post.type || 'Flyer'}</p>
                <p className="text-slate-500 text-[9px] line-clamp-1">{post.prompt}</p>
            </div>
        ))}
    </div>
);

const RoiBlock = ({ data }: { data: any }) => (
    <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-slate-800/50 p-2 rounded">
            <div className="text-xs text-slate-500">Revenue (30d)</div>
            <div className="text-green-400 font-bold text-lg">{data.projected_revenue_30d}</div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded">
            <div className="text-xs text-slate-500">Growth</div>
            <div className="text-purple-400 font-bold text-lg">{data.growth_factor}</div>
        </div>
        <div className="col-span-2 text-xs text-slate-400 font-mono">
            Break Even: {data.break_even_point}
        </div>
    </div>
);

const renderAssetContent = (asset: any) => {
    const type = asset.type || asset.asset_type;
    const data = asset.content || asset.data;

    switch (type) {
        case 'branding': return <BrandingBlock data={data} />;
        case 'scripts': return <ScriptBlock data={data} />;
        case 'visuals': return <VisualGrid data={data} />;
        case 'roi': return <RoiBlock data={data} />;
        default: return <pre className="text-[10px] text-slate-500 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
};

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
        tiendanube_store_id: '',
        tiendanube_access_token: ''
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs (Smart Scroll)
    useEffect(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (isNearBottom) {
                scrollRef.current.scrollTo({
                    top: scrollHeight,
                    behavior: 'smooth'
                });
            }
        }
    }, [logs]);

    const handleConnect = async () => {
        setStep('igniting');

        try {
            // A. Trigger Ignition
            const payload = { ...formData, tenant_id: formData.bot_phone_number };
            await fetchApi('/engine/ignite', { method: 'POST', body: payload });

            // B. Connect to Stream (BFF)
            // Use API_BASE logic from detectApiBase or relative fallback
            let base = window.location.origin;
            // If we are in frontend-xxx.easypanel.host, target orchestrator-xxx.easypanel.host
            if (base.includes('frontend')) {
                base = base.replace('frontend', 'orchestrator');
            } else if (base.includes('localhost')) {
                base = 'http://localhost:8000';
            }

            const streamUrl = `${base}/api/engine/stream/${formData.bot_phone_number}`;
            const evtSource = new EventSource(streamUrl);

            evtSource.onopen = () => {
                setLogs(prev => [...prev, ">> SYSTEM: Secure Link Established. Protocol Omega Active."]);
            };

            const handleAsset = (e: any, type: string) => {
                try {
                    const content = JSON.parse(e.data);
                    // Use functional update to check for duplicates based on asset_type
                    setAssets(prev => {
                        // Avoid adding duplicates if strict mode fires twice or re-renders
                        if (prev.some(a => a.type === type || a.asset_type === type)) return prev;
                        // Normalize structure
                        const normalized = { type: type, content: content.content || content.data || content };
                        return [...prev, normalized];
                    });
                    setLogs(prev => [...prev, `>> ASSET: ${type.toUpperCase()} Generated Successfully.`]);
                    setPercent(prev => Math.min(prev + 25, 100));
                } catch (err) { console.error(err); }
            };

            evtSource.addEventListener("log", (e: any) => {
                const log = JSON.parse(e.data);
                setLogs(prev => [...prev, `[${log.event_type}] ${log.message}`]);
            });

            evtSource.addEventListener("branding", (e: any) => handleAsset(e, "branding"));
            evtSource.addEventListener("scripts", (e: any) => handleAsset(e, "scripts"));
            evtSource.addEventListener("visuals", (e: any) => handleAsset(e, "visuals"));
            evtSource.addEventListener("roi", (e: any) => handleAsset(e, "roi"));
            evtSource.addEventListener("rag", (e: any) => {
                setLogs(prev => [...prev, ">> RAG: Knowledge Base Vectorized."]);
                setPercent(prev => 100);
            });

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

                        {/* Tienda Nube Credentials (Consolidation Phase) */}
                        <div className="form-group border-t border-slate-800 pt-4 mt-4">
                            <label className="text-sm text-cyan-400 font-bold mb-2 block">Tienda Nube Connection</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500">Store ID</label>
                                    <input
                                        className="w-full bg-slate-800 border-none rounded p-3 text-white text-sm"
                                        value={formData.tiendanube_store_id}
                                        onChange={e => setFormData({ ...formData, tiendanube_store_id: e.target.value })}
                                        placeholder="123456"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Access Token</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-800 border-none rounded p-3 text-white text-sm"
                                        value={formData['tiendanube_access_token'] || ''}
                                        onChange={e => setFormData({ ...formData, tiendanube_access_token: e.target.value } as any)}
                                        placeholder="Key..."
                                    />
                                </div>
                            </div>
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
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(300px, 1fr) 400px',
                    gap: '20px',
                    maxWidth: '1400px',
                    margin: '0 auto',
                    minHeight: '800px'
                }}>

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
                                <AssetCard key={i} title={(a.type || a.asset_type)?.toUpperCase() || 'ASSET'} icon={CheckCircle}>
                                    {renderAssetContent(a)}
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
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-400 space-y-2">
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
