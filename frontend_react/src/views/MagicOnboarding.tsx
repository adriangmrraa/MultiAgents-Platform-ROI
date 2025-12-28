import React, { useState, useEffect, useRef } from 'react';
import { useApi, ADMIN_TOKEN } from '../hooks/useApi';
import { ArrowRight, Loader2, Sparkles, Activity, Brain, Image as ImageIcon, FileText, BarChart3, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Skeleton Components ---

const SkeletonAssetCard = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="asset-card skeleton-pulse" style={{
        background: 'rgba(0, 20, 40, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '24px',
        height: '280px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px'
    }}>
        <div style={{ opacity: 0.2 }}>
            <Icon size={48} />
        </div>
        <div style={{ height: '16px', background: 'rgba(255,255,255,0.1)', width: '120px', borderRadius: '4px' }}></div>
        <div className="text-xs text-slate-600 font-bold tracking-widest">{title} PENDING...</div>
    </div>
);

// --- Asset Components ---

const BrandingBlock = ({ data }: { data: any }) => (
    <div className="space-y-4 animate-fade-in-up">
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
                <p className="text-cyan-400 font-mono text-sm">{data.identity?.archetype}</p>
            </div>
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase">Fonts</h4>
                <p className="text-white font-mono text-xs">{data.typography?.primary} / {data.typography?.secondary}</p>
            </div>
        </div>
    </div>
);

const ScriptBlock = ({ data }: { data: any }) => (
    <div className="space-y-3 font-mono text-xs text-slate-300 animate-fade-in-up">
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
    <div className="grid grid-cols-2 gap-2 animate-fade-in-up">
        {data.social_posts?.map((post: any, i: number) => (
            <div key={i} className="bg-slate-800 rounded p-2 text-xs relative overflow-hidden group">
                <div className="aspect-square bg-slate-700 flex items-center justify-center mb-2 overflow-hidden rounded relative">
                    {post.base_image ? (
                        <>
                            <img src={post.base_image} alt={post.caption} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                            <div className="absolute top-1 right-1 bg-black/60 px-1 rounded text-[8px] text-green-400">AI ENHANCED</div>
                        </>
                    ) : (
                        <ImageIcon size={24} className="text-slate-500" />
                    )}
                </div>
                <p className="font-bold text-white truncate">{post.caption}</p>
                <p className="text-slate-400 text-[10px] italic">{post.type || 'Flyer'}</p>
            </div>
        ))}
    </div>
);

const RoiBlock = ({ data }: { data: any }) => (
    <div className="grid grid-cols-2 gap-4 text-center animate-fade-in-up">
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

const AssetCard = ({ title, icon: Icon, children }: any) => (
    <div className="asset-card magic-appear" style={{
        background: 'rgba(0, 20, 40, 0.6)',
        border: '1px solid rgba(0, 255, 200, 0.2)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '16px',
        backdropFilter: 'blur(10px)',
        minHeight: '200px'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', color: '#22d3ee' }}>
            <Icon size={20} style={{ marginRight: '8px' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{title}</h3>
        </div>
        <div>{children}</div>
    </div>
);

const renderAssetContent = (assetLink: any) => {
    const type = assetLink.type || assetLink.asset_type;
    const data = assetLink.content || assetLink.data;

    switch (type) {
        case 'branding': return <BrandingBlock data={data} />;
        case 'scripts': return <ScriptBlock data={data} />;
        case 'visuals': return <VisualGrid data={data} />;
        case 'roi': return <RoiBlock data={data} />;
        default: return <pre className="text-[10px] text-slate-500 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
};

export const MagicOnboarding: React.FC = () => {
    const { fetchApi } = useApi();
    const navigate = useNavigate();
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

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            if (isNearBottom) {
                scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            }
        }
    }, [logs]);

    const handleConnect = async () => {
        setStep('igniting');
        setAssets([]);
        setPercent(0);

        try {
            // A. Trigger Ignition
            const payload = { ...formData, tenant_id: formData.bot_phone_number };
            await fetchApi('/admin/onboarding/magic', { method: 'POST', body: payload });

            // B. Protocol Omega Stream Connection
            const streamUrl = `/api/admin/engine/stream/${formData.bot_phone_number}?token=${ADMIN_TOKEN}`;
            const evtSource = new EventSource(streamUrl);

            evtSource.onopen = () => {
                setLogs(prev => [...prev, ">> SYSTEM: Secure Protocol Omega Link Established."]);
            };

            // 1. Handle Spec-Compliant 'asset_generated' Event
            evtSource.addEventListener("asset_generated", (e: any) => {
                try {
                    const payload = JSON.parse(e.data);
                    // Payload: { asset_id: "...", asset_type: "visuals", content: {...} }
                    const type = payload.asset_type;
                    const content = payload.content;

                    setAssets(prev => {
                        // Idempotency check
                        if (prev.some(a => a.type === type)) return prev;
                        // Normalize for UI
                        return [...prev, { type, content }];
                    });

                    setLogs(prev => [...prev, `>> ASSET: ${type.toUpperCase()} Materialized.`]);
                    setPercent(prev => Math.min(prev + 20, 95));

                } catch (err) { console.error("Stream Parse Error", err); }
            });

            // 2. Handle Task Completion & Redirect
            evtSource.addEventListener("task_completed", (e: any) => {
                setLogs(prev => [...prev, ">> SYSTEM: Design Tasks Completed. Initializing Forge..."]);
                setPercent(100);

                // Magic Delay before Redirect
                setTimeout(() => {
                    evtSource.close();
                    navigate('/forge');
                }, 2000);
            });

            // 3. Fallback/Legacy Logging
            evtSource.addEventListener("log", (e: any) => {
                try {
                    const log = JSON.parse(e.data);
                    setLogs(prev => [...prev, `[${log.event_type}] ${log.message}`]);
                } catch { }
            });

            evtSource.onerror = (e) => {
                // EventSource doesn't give error details, but connection lost
                // We rely on Keep-Alive to maintain it, or manual retry
                console.error("Stream Error", e);
            };

        } catch (error: any) {
            console.error(error);
            setLogs(prev => [...prev, `>> CRITICAL ERROR: ${error.message}`]);
        }
    };

    const handleDashboardRedirect = () => {
        navigate('/forge');
    };

    return (
        <div className="view active" style={{ background: '#020617', color: '#f8fafc', minHeight: '100vh', padding: '20px' }}>

            {step === 'connect' && (
                <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
                    <div className="mb-8 animate-fade-in-up">
                        <Sparkles size={48} className="mx-auto text-cyan-400 mb-4" />
                        <h1 className="text-3xl font-bold mb-2">Nexus Business Forge</h1>
                        <p className="text-slate-400">Initialize your autonomous enterprise.</p>
                    </div>

                    <div className="space-y-4 text-left animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
                                        value={formData.tiendanube_access_token}
                                        onChange={e => setFormData({ ...formData, tiendanube_access_token: e.target.value })}
                                        placeholder="Key..."
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleConnect}
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 rounded mt-6 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            Hacer Magia <Sparkles size={18} />
                        </button>
                    </div>
                </div>
            )}

            {(step === 'igniting' || step === 'dashboard') && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 400px', gap: '20px', maxWidth: '1600px', margin: '0 auto', minHeight: '800px'
                }}>

                    {/* Left Canvas (Assets) */}
                    <div className="glass rounded-xl p-8 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <Activity className="text-cyan-400" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                                    Business Canvas
                                </span>
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="text-xs font-mono text-cyan-400 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-400/20">
                                    STATUS: {percent >= 100 ? 'SYSTEM ONLINE' : `GENERATING ${Math.round(percent)}%`}
                                </div>
                                {percent >= 100 && (
                                    <button
                                        onClick={handleDashboardRedirect}
                                        className="bg-green-500 hover:bg-green-600 text-black font-bold py-2 px-6 rounded-full text-sm flex items-center gap-2 animate-bounce-in shadow-lg shadow-green-500/20"
                                    >
                                        Go to Dashboard <ArrowRight size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar (Top) */}
                        <div className="w-full h-1 bg-slate-800 rounded-full mb-8 overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 ease-out shadow-[0_0_10px_#22d3ee]" style={{ width: `${percent}%` }}></div>
                        </div>

                        {/* Asset Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

                            {/* 1. BRANDING - Real or Skeleton */}
                            {assets.find(a => a.type === 'branding') ? (
                                <AssetCard title="IDENTITY" icon={Palette}>
                                    {renderAssetContent(assets.find(a => a.type === 'branding'))}
                                </AssetCard>
                            ) : (
                                <SkeletonAssetCard title="IDENTITY" icon={Palette} />
                            )}

                            {/* 2. SCRIPTS - Real or Skeleton */}
                            {assets.find(a => a.type === 'scripts') ? (
                                <AssetCard title="SALES SCRIPTS" icon={FileText}>
                                    {renderAssetContent(assets.find(a => a.type === 'scripts'))}
                                </AssetCard>
                            ) : (
                                <SkeletonAssetCard title="SALES SCRIPTS" icon={FileText} />
                            )}

                            {/* 3. VISUALS - Real or Skeleton */}
                            {assets.find(a => a.type === 'visuals') ? (
                                <AssetCard title="AD CAMPAIGNS" icon={ImageIcon}>
                                    {renderAssetContent(assets.find(a => a.type === 'visuals'))}
                                </AssetCard>
                            ) : (
                                <SkeletonAssetCard title="AD CAMPAIGNS" icon={ImageIcon} />
                            )}

                            {/* 4. ROI - Real or Skeleton */}
                            {assets.find(a => a.type === 'roi') ? (
                                <AssetCard title="PROJECTIONS" icon={BarChart3}>
                                    {renderAssetContent(assets.find(a => a.type === 'roi'))}
                                </AssetCard>
                            ) : (
                                <SkeletonAssetCard title="PROJECTIONS" icon={BarChart3} />
                            )}

                        </div>
                    </div>

                    {/* Right Panel (Thinking Log) */}
                    <div className="glass rounded-xl border border-indigo-500/20 flex flex-col h-[calc(100vh-40px)] sticky top-5 overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-indigo-500/20 bg-indigo-950/20 backdrop-blur flex justify-between items-center">
                            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                <Brain size={16} className={percent < 100 ? "animate-pulse" : ""} />
                                Cortex Process
                            </h3>
                            {percent < 100 && <Loader2 size={14} className="animate-spin text-indigo-400" />}
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[10px] text-slate-400 space-y-3 custom-scrollbar bg-black/40">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 animate-fade-in-left">
                                    <span className="text-indigo-500 shrink-0">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                    <span className={log.includes(">>") ? "text-cyan-300 font-bold" : "text-slate-300"}>
                                        {log.replace(">>", "")}
                                    </span>
                                </div>
                            ))}
                            {percent < 100 && (
                                <div className="flex gap-2 animate-pulse opacity-50">
                                    <span className="text-indigo-900">...</span>
                                    <span className="text-indigo-400">Thinking...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .skeleton-pulse { animation: skeleton-loading 1.5s infinite ease-in-out; }
                @keyframes skeleton-loading {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
