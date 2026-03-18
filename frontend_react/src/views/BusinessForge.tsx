import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    Palette, Camera, Megaphone, Pencil, Image, Type, Grid,
    Sparkles, Download, Trash2, RefreshCw, ChevronRight,
    Eye, Layers, Zap, Search, X, Send, Plus, Check,
    Layout, Smartphone, Mail, MessageSquare, Globe, Star
} from 'lucide-react';

type Tab = 'brand-dna' | 'photoshoot' | 'campaigns' | 'gallery';

interface Asset {
    id: string;
    asset_type: string;
    content: any;
    created_at: string;
    updated_at?: string;
}

export const BusinessForge: React.FC = () => {
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('brand-dna');
    const [brandDNA, setBrandDNA] = useState<any>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Google API Key gate
    const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupError, setSetupError] = useState('');

    useEffect(() => {
        fetchApi('/gallery/setup-status').then(d => setGoogleConnected(d?.google_connected ?? false)).catch(() => setGoogleConnected(false));
    }, [fetchApi]);

    const handleConnectKey = async () => {
        if (!apiKeyInput.trim()) return;
        setSetupLoading(true);
        setSetupError('');
        try {
            await fetchApi('/gallery/setup-google', { method: 'POST', body: { api_key: apiKeyInput.trim() } });
            setGoogleConnected(true);
        } catch (e: any) { setSetupError(e.message || 'Error al validar la API Key'); }
        finally { setSetupLoading(false); }
    };

    const handleDisconnect = async () => {
        if (!confirm('Desconectar Google API Key?')) return;
        await fetchApi('/gallery/setup-google', { method: 'DELETE' });
        setGoogleConnected(false);
    };

    const loadBrandDNA = useCallback(async () => {
        try {
            const data = await fetchApi('/gallery/brand-dna');
            setBrandDNA(data?.brand_dna);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadAssets = useCallback(async (type?: string) => {
        try {
            const params = type ? `?asset_type=${type}&limit=100` : '?limit=100';
            const data = await fetchApi(`/gallery/assets${params}`);
            setAssets(data?.assets || []);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadProducts = useCallback(async () => {
        try {
            const data = await fetchApi('/admin/products');
            setProducts(Array.isArray(data) ? data : data?.products || []);
        } catch (e) { console.error(e); setProducts([]); }
    }, [fetchApi]);

    useEffect(() => {
        loadBrandDNA();
        loadProducts();
    }, [loadBrandDNA, loadProducts]);

    useEffect(() => {
        if (activeTab === 'gallery') loadAssets();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const tabs = [
        { id: 'brand-dna' as Tab, label: 'Brand DNA', icon: <Palette size={16} />, desc: 'Identidad de marca' },
        { id: 'photoshoot' as Tab, label: 'Photoshoot', icon: <Camera size={16} />, desc: 'Fotos de estudio IA' },
        { id: 'campaigns' as Tab, label: 'Campanas', icon: <Megaphone size={16} />, desc: 'Multi-canal' },
        { id: 'gallery' as Tab, label: 'Galeria', icon: <Grid size={16} />, desc: 'Todos los assets' }
    ];

    const [setupStep, setSetupStep] = useState(1);

    // Loading state
    if (googleConnected === null) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <Sparkles size={32} className="text-purple-400 animate-pulse mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-mono">Iniciando Creative Studio...</p>
                </div>
            </div>
        );
    }

    // Onboarding gate
    if (!googleConnected) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
                <div className="max-w-2xl mx-auto pt-8">
                    {/* Hero */}
                    <div className="text-center mb-10">
                        <div className="inline-flex p-5 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-3xl mb-5 border border-purple-500/10">
                            <Sparkles size={40} className="text-purple-400" />
                        </div>
                        <h1 className="text-4xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">Creative Studio</h1>
                        <p className="text-slate-400 text-lg max-w-md mx-auto">Fotos de producto profesionales, campanas multi-canal y Brand DNA — todo generado con IA</p>
                    </div>

                    {/* Feature Preview */}
                    <div className="grid grid-cols-3 gap-3 mb-10">
                        {[
                            { icon: <Camera size={20} />, label: 'Photoshoot IA', desc: 'Fotos de estudio sin fotografo' },
                            { icon: <Megaphone size={20} />, label: 'Campanas', desc: 'Ads para todos los canales' },
                            { icon: <Palette size={20} />, label: 'Brand DNA', desc: 'Identidad visual automatica' }
                        ].map((f, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                                <div className="text-purple-400 mb-2 flex justify-center">{f.icon}</div>
                                <div className="text-xs font-bold text-white mb-1">{f.label}</div>
                                <div className="text-[10px] text-slate-500">{f.desc}</div>
                            </div>
                        ))}
                    </div>

                    {/* Setup Card */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                        {/* Stepper */}
                        <div className="flex border-b border-white/5">
                            {[
                                { n: 1, label: 'Obtener API Key' },
                                { n: 2, label: 'Pegar y conectar' }
                            ].map(s => (
                                <button
                                    key={s.n}
                                    onClick={() => setSetupStep(s.n)}
                                    className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                                        setupStep === s.n
                                            ? 'text-purple-400 bg-purple-500/5 border-b-2 border-purple-500'
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                                        setupStep === s.n ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-500'
                                    }`}>{s.n}</span>
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {setupStep === 1 ? (
                                <div className="space-y-5">
                                    <p className="text-slate-300 text-sm">El Creative Studio usa <strong className="text-white">Google AI</strong> para generar imagenes. Necesitas una API Key gratuita (tarda 30 segundos).</p>

                                    <div className="space-y-4">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="text-blue-400 text-xs font-black">1</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-white font-medium">Abre Google AI Studio</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Inicia sesion con tu cuenta de Google (la misma que usas para Gmail)</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="text-emerald-400 text-xs font-black">2</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-white font-medium">Crea tu API Key</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Click en <strong className="text-slate-300">"Create API Key"</strong> → selecciona cualquier proyecto → listo</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="text-purple-400 text-xs font-black">3</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-white font-medium">Copia la key</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Empieza con <code className="text-purple-400 bg-purple-500/10 px-1 rounded">AIzaSy...</code> — copiala al portapapeles</p>
                                            </div>
                                        </div>
                                    </div>

                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-3 w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all shadow-lg shadow-white/5"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                        Abrir Google AI Studio
                                        <ChevronRight size={16} />
                                    </a>

                                    <button onClick={() => setSetupStep(2)} className="w-full text-sm text-purple-400 hover:text-purple-300 font-medium py-2 transition-colors">
                                        Ya tengo mi API Key →
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-slate-300 text-sm">Pega tu API Key de Google AI Studio. La validaremos automaticamente.</p>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={apiKeyInput}
                                            onChange={e => setApiKeyInput(e.target.value)}
                                            placeholder="AIzaSy..."
                                            autoFocus
                                            className="w-full bg-black/60 border-2 border-white/10 rounded-xl px-4 py-4 text-white placeholder-slate-600 outline-none focus:border-purple-500/50 font-mono text-sm tracking-wider pr-12"
                                        />
                                        {apiKeyInput && (
                                            <button onClick={() => setApiKeyInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {setupError && (
                                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <X size={14} className="text-red-400 mt-0.5 shrink-0" />
                                            <p className="text-red-400 text-xs">{setupError}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleConnectKey}
                                        disabled={setupLoading || !apiKeyInput.trim() || !apiKeyInput.startsWith('AIza')}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10"
                                    >
                                        {setupLoading ? (
                                            <><RefreshCw size={16} className="animate-spin" /> Validando con Google...</>
                                        ) : (
                                            <><Zap size={16} /> Activar Creative Studio</>
                                        )}
                                    </button>

                                    <button onClick={() => setSetupStep(1)} className="w-full text-xs text-slate-500 hover:text-slate-300 py-1 transition-colors">
                                        ← Volver a las instrucciones
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-white/[0.01] border-t border-white/5">
                            <div className="flex items-center justify-between text-[10px] text-slate-600">
                                <span>Tier gratuito: ~50 imagenes/dia sin costo</span>
                                <span>Despues: ~$0.03/imagen</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-center text-[10px] text-slate-600 mt-6">Tu API Key se almacena encriptada y solo se usa para generar tus imagenes. Podes desconectarla en cualquier momento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <div className="view active p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-3">
                            <Sparkles className="text-purple-400" /> Creative Studio
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Genera y edita assets de marketing con IA</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleDisconnect} className="text-[10px] text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/30 px-2 py-1 rounded transition-colors" title="Desconectar Google API Key">
                            <svg width="14" height="14" viewBox="0 0 24 24" className="inline mr-1"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            Conectado
                        </button>
                    {brandDNA && (
                        <div className="flex items-center gap-2">
                            {brandDNA.colors?.primary?.map((c: string, i: number) => (
                                <div key={i} className="w-6 h-6 rounded-full border border-white/20" style={{ background: c }} title={c} />
                            ))}
                            {brandDNA.colors?.secondary?.slice(0, 3).map((c: string, i: number) => (
                                <div key={`s${i}`} className="w-4 h-4 rounded-full border border-white/10" style={{ background: c }} title={c} />
                            ))}
                        </div>
                    )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-black/40 p-1 rounded-xl w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.icon}
                            <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'brand-dna' && <BrandDNATab brandDNA={brandDNA} fetchApi={fetchApi} onRefresh={loadBrandDNA} />}
                {activeTab === 'photoshoot' && <PhotoshootTab products={products} fetchApi={fetchApi} brandDNA={brandDNA} onAssetCreated={() => loadAssets()} />}
                {activeTab === 'campaigns' && <CampaignsTab products={products} fetchApi={fetchApi} brandDNA={brandDNA} onAssetCreated={() => loadAssets()} />}
                {activeTab === 'gallery' && <GalleryTab assets={assets} fetchApi={fetchApi} onRefresh={loadAssets} brandDNA={brandDNA} />}
            </div>
        </div>
    );
};

// ==================== BRAND DNA TAB ====================
const BrandDNATab = ({ brandDNA, fetchApi, onRefresh }: any) => {
    const [extracting, setExtracting] = useState(false);
    const [websiteUrl, setWebsiteUrl] = useState('');

    const handleExtract = async (force = false) => {
        setExtracting(true);
        try {
            const body: any = { force_refresh: force };
            if (websiteUrl) body.website_url = websiteUrl;
            await fetchApi('/gallery/brand-dna/extract', { method: 'POST', body });
            onRefresh();
        } catch (e: any) { alert(e.message); }
        finally { setExtracting(false); }
    };

    return (
        <div className="space-y-6">
            <div className="glass p-6 rounded-xl border border-purple-500/20">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Palette className="text-purple-400" /> Extraer Brand DNA</h3>
                <p className="text-sm text-slate-400 mb-4">Escaneamos tu tienda online y TiendaNube para extraer colores, tipografias, tono de voz y estilo visual.</p>
                <div className="flex gap-3">
                    <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="URL de tu tienda (opcional)" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50" />
                    <button onClick={() => handleExtract(true)} disabled={extracting} className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                        {extracting ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {extracting ? 'Analizando...' : 'Extraer DNA'}
                    </button>
                </div>
            </div>

            {brandDNA ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Palette size={14} /> Paleta de Colores</h4>
                        <div className="space-y-2">
                            <div><span className="text-[10px] text-slate-500 uppercase">Primarios</span>
                                <div className="flex gap-2 mt-1">{(brandDNA.colors?.primary || []).map((c: string, i: number) => (<div key={i} className="flex items-center gap-1"><div className="w-8 h-8 rounded-lg border border-white/20" style={{ background: c }} /><span className="text-[10px] text-slate-400 font-mono">{c}</span></div>))}</div>
                            </div>
                            <div><span className="text-[10px] text-slate-500 uppercase">Secundarios</span>
                                <div className="flex gap-2 mt-1">{(brandDNA.colors?.secondary || []).map((c: string, i: number) => (<div key={i} className="flex items-center gap-1"><div className="w-6 h-6 rounded border border-white/10" style={{ background: c }} /><span className="text-[10px] text-slate-500 font-mono">{c}</span></div>))}</div>
                            </div>
                        </div>
                    </div>
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Type size={14} /> Tipografia</h4>
                        {brandDNA.typography?.heading_font && <div><span className="text-[10px] text-slate-500 uppercase">Heading</span><p className="text-lg font-bold">{brandDNA.typography.heading_font}</p></div>}
                        {brandDNA.typography?.body_font && <div className="mt-1"><span className="text-[10px] text-slate-500 uppercase">Body</span><p>{brandDNA.typography.body_font}</p></div>}
                        {brandDNA.typography?.fonts?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{brandDNA.typography.fonts.map((f: string, i: number) => (<span key={i} className="text-[10px] bg-white/5 px-2 py-0.5 rounded">{f}</span>))}</div>}
                    </div>
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><MessageSquare size={14} /> Tono de Voz</h4>
                        <p className="text-sm text-white mb-2">{brandDNA.tone_of_voice?.style || 'No analizado'}</p>
                        <div className="flex items-center gap-2 mb-2"><span className="text-[10px] text-slate-500">Formalidad:</span><span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded capitalize">{brandDNA.tone_of_voice?.formality || 'neutral'}</span></div>
                        <div className="flex flex-wrap gap-1">{(brandDNA.tone_of_voice?.keywords || []).map((k: string, i: number) => (<span key={i} className="text-[10px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded">{k}</span>))}</div>
                    </div>
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Image size={14} /> Estilo Visual</h4>
                        <p className="text-sm text-white mb-2">{brandDNA.visual_style?.photography_style || 'No analizado'}</p>
                        <div className="flex flex-wrap gap-1">{(brandDNA.visual_style?.imagery_patterns || []).map((p: string, i: number) => (<span key={i} className="text-[10px] bg-emerald-900/20 text-emerald-400 px-2 py-0.5 rounded">{p}</span>))}</div>
                        {brandDNA.brand_personality && <div className="mt-3 text-center"><span className="text-[10px] text-slate-500 uppercase block">Personalidad</span><span className="text-lg font-black text-purple-400 capitalize">{brandDNA.brand_personality}</span></div>}
                    </div>
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><Megaphone size={14} /> Messaging</h4>
                        {brandDNA.messaging?.tagline && <p className="text-sm italic text-amber-400 mb-2">"{brandDNA.messaging.tagline}"</p>}
                        {brandDNA.messaging?.value_proposition && <p className="text-xs text-slate-400 mb-2">{brandDNA.messaging.value_proposition}</p>}
                        <div className="space-y-1">{(brandDNA.messaging?.key_messages || []).slice(0, 5).map((m: string, i: number) => (<div key={i} className="text-xs text-slate-300 flex items-center gap-1"><ChevronRight size={10} className="text-purple-400" /> {m}</div>))}</div>
                    </div>
                    <div className="glass p-5 rounded-xl">
                        <h4 className="text-sm font-bold text-slate-300 mb-3">Logo & Redes</h4>
                        {brandDNA.logo?.url && <img src={brandDNA.logo.url} alt="Logo" className="h-12 mb-3 object-contain bg-white/5 rounded p-1" />}
                        <div className="space-y-1">{Object.entries(brandDNA.social_links || {}).map(([p, h]: [string, any]) => (<div key={p} className="flex items-center gap-2 text-xs"><span className="text-slate-500 capitalize">{p}:</span><span className="text-blue-400">@{h}</span></div>))}</div>
                    </div>
                </div>
            ) : (
                <div className="glass p-12 rounded-xl text-center"><Palette size={48} className="mx-auto mb-4 text-slate-600" /><p className="text-slate-500">No hay Brand DNA extraido aun.</p><p className="text-xs text-slate-600 mt-1">Hace click en "Extraer DNA" para escanear tu tienda.</p></div>
            )}
        </div>
    );
};

// ==================== PHOTOSHOOT TAB ====================
// ==================== MODEL SELECTOR ====================
const ModelSelector = ({ value, onChange, models }: { value: string; onChange: (v: string) => void; models: any[] }) => {
    const speedIcons: Record<string, string> = { fast: '⚡', medium: '🎯', slow: '💎' };
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Modelo IA</label>
            <div className="flex gap-1.5">
                {models.map((m: any) => (
                    <button key={m.key} onClick={() => onChange(m.key)} className={`flex-1 p-2 rounded-lg text-left transition-all border ${value === m.key ? 'bg-purple-900/30 border-purple-500/40' : 'bg-black/20 border-white/5 hover:border-white/15'}`}>
                        <div className="text-[10px] font-bold text-white flex items-center gap-1">{speedIcons[m.speed] || ''} {m.name}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{m.cost_label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const PhotoshootTab = ({ products, fetchApi, brandDNA, onAssetCreated }: any) => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedTemplate, setSelectedTemplate] = useState('studio');
    const [customPrompt, setCustomPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [models, setModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState('nano-banana');

    const handleEnhancePrompt = async () => {
        if (!customPrompt.trim()) return;
        setEnhancing(true);
        try {
            const name = selectedProduct ? (selectedProduct.name?.es || selectedProduct.name?.en || selectedProduct.name || '') : '';
            const data = await fetchApi('/gallery/enhance-prompt', { method: 'POST', body: { prompt: customPrompt, product_name: name, template: selectedTemplate, context: 'photoshoot' } });
            if (data?.enhanced) setCustomPrompt(data.enhanced);
        } catch (e: any) { alert(e.message); }
        finally { setEnhancing(false); }
    };

    useEffect(() => {
        fetchApi('/gallery/photoshoot/templates').then(setTemplates).catch(() => {});
        fetchApi('/gallery/models').then(setModels).catch(() => {});
    }, [fetchApi]);

    const filteredProducts = products.filter((p: any) => { const name = p.name?.es || p.name?.en || p.name || ''; return name.toLowerCase().includes(searchQuery.toLowerCase()); });

    const handleGenerate = async () => {
        if (!selectedProduct) return;
        setGenerating(true); setResult(null);
        try {
            const imageUrl = selectedProduct.images?.[0]?.src || selectedProduct.image_url;
            const name = selectedProduct.name?.es || selectedProduct.name?.en || selectedProduct.name || 'Producto';
            const data = await fetchApi('/gallery/photoshoot/generate', { method: 'POST', body: { product_image_url: imageUrl, product_name: name, template: selectedTemplate, custom_prompt: customPrompt || undefined, model: selectedModel } });
            setResult(data); onAssetCreated();
        } catch (e: any) { alert(e.message); } finally { setGenerating(false); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass p-5 rounded-xl">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Camera size={14} className="text-blue-400" /> 1. Selecciona Producto</h3>
                <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none" /></div>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {filteredProducts.map((p: any) => {
                        const name = p.name?.es || p.name?.en || p.name || 'Producto'; const img = p.images?.[0]?.src || p.image_url; const sel = selectedProduct?.id === p.id;
                        return (<button key={p.id} onClick={() => setSelectedProduct(p)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${sel ? 'bg-blue-900/30 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                            {img && <img src={img} alt="" className="w-12 h-12 rounded object-cover bg-white/5" />}
                            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{name}</div>{p.variants?.[0]?.price && <div className="text-xs text-slate-500">${p.variants[0].price}</div>}</div>
                            {sel && <Check size={16} className="text-blue-400" />}
                        </button>);
                    })}
                </div>
            </div>
            <div className="glass p-5 rounded-xl">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Layout size={14} className="text-purple-400" /> 2. Template & Prompt</h3>
                <div className="space-y-2 mb-4">
                    {templates.map((t: any) => (<button key={t.id} onClick={() => setSelectedTemplate(t.id)} className={`w-full p-3 rounded-lg text-left transition-all ${selectedTemplate === t.id ? 'bg-purple-900/30 border border-purple-500/30' : 'bg-black/20 border border-white/5 hover:border-white/20'}`}><div className="text-sm font-bold">{t.name}</div><div className="text-xs text-slate-500">{t.description}</div></button>))}
                </div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-slate-500 uppercase">Prompt personalizado</label>
                    {customPrompt.trim() && (
                        <button onClick={handleEnhancePrompt} disabled={enhancing} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50">
                            {enhancing ? <><RefreshCw size={10} className="animate-spin" /> Mejorando...</> : <><Sparkles size={10} /> Mejorar prompt</>}
                        </button>
                    )}
                </div>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="ej: con fondo de playa tropical, iluminacion dramatica..." className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none resize-none h-24 mb-3" />
                {models.length > 0 && <div className="mb-3"><ModelSelector value={selectedModel} onChange={setSelectedModel} models={models} /></div>}
                <button onClick={handleGenerate} disabled={!selectedProduct || generating} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                    {generating ? <><RefreshCw size={16} className="animate-spin" /> Generando...</> : <><Camera size={16} /> Generar Photoshoot</>}
                </button>
            </div>
            <div className="glass p-5 rounded-xl">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Image size={14} className="text-emerald-400" /> 3. Resultado</h3>
                {result ? (
                    <div className="space-y-3">
                        <img src={result.image_url} alt={result.product_name} className="w-full rounded-lg border border-white/10" />
                        <div className="text-xs text-slate-500"><span className="text-emerald-400 font-bold">{result.template_name}</span> | {result.product_name} | <span className="text-purple-400">{result.model_tier || selectedModel}</span></div>
                        <div className="flex gap-2">
                            <a href={result.image_url} download className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-center flex items-center justify-center gap-1"><Download size={12} /> Descargar</a>
                            <InlineEditButton assetId={result.asset_id} imageUrl={result.image_url} fetchApi={fetchApi} onEdited={(r: any) => setResult({ ...result, ...r })} />
                        </div>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-slate-600 border border-dashed border-white/10 rounded-lg"><div className="text-center"><Camera size={32} className="mx-auto mb-2 opacity-30" /><p className="text-xs">Selecciona un producto y template</p></div></div>
                )}
            </div>
        </div>
    );
};

// ==================== CAMPAIGNS TAB ====================
const CampaignsTab = ({ products, fetchApi, brandDNA, onAssetCreated }: any) => {
    const [channels, setChannels] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['instagram_post', 'whatsapp_promo']);
    const [campaignGoal, setCampaignGoal] = useState('vender');
    const [customPrompt, setCustomPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [models, setModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState('nano-banana');

    const handleEnhancePrompt = async () => {
        if (!customPrompt.trim()) return;
        setEnhancing(true);
        try {
            const name = selectedProduct ? (selectedProduct.name?.es || selectedProduct.name?.en || selectedProduct.name || '') : '';
            const data = await fetchApi('/gallery/enhance-prompt', { method: 'POST', body: { prompt: customPrompt, product_name: name, context: 'campaign' } });
            if (data?.enhanced) setCustomPrompt(data.enhanced);
        } catch (e: any) { alert(e.message); }
        finally { setEnhancing(false); }
    };

    useEffect(() => {
        fetchApi('/gallery/campaigns/channels').then(setChannels).catch(() => {});
        fetchApi('/gallery/models').then(setModels).catch(() => {});
    }, [fetchApi]);

    const channelIcons: Record<string, React.ReactNode> = { instagram_post: <Smartphone size={14} />, instagram_story: <Smartphone size={14} />, facebook_ad: <Globe size={14} />, whatsapp_promo: <MessageSquare size={14} />, email_banner: <Mail size={14} />, web_hero: <Layout size={14} /> };

    const handleGenerate = async () => {
        if (!selectedProduct) return;
        setGenerating(true); setResult(null);
        try {
            const name = selectedProduct.name?.es || selectedProduct.name?.en || selectedProduct.name || 'Producto';
            const img = selectedProduct.images?.[0]?.src || selectedProduct.image_url;
            const data = await fetchApi('/gallery/campaigns/generate', { method: 'POST', body: { product_name: name, product_image_url: img, campaign_goal: campaignGoal, channels: selectedChannels, custom_prompt: customPrompt || undefined, num_variations: 3, model: selectedModel } });
            setResult(data); onAssetCreated();
        } catch (e: any) { alert(e.message); } finally { setGenerating(false); }
    };

    return (
        <div className="space-y-6">
            <div className="glass p-6 rounded-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Megaphone className="text-orange-400" /> Generar Campana</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Producto</label><select value={selectedProduct?.id || ''} onChange={(e) => setSelectedProduct(products.find((p: any) => String(p.id) === e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none"><option value="">Seleccionar...</option>{products.map((p: any) => (<option key={p.id} value={p.id}>{p.name?.es || p.name?.en || p.name}</option>))}</select></div>
                    <div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Objetivo</label><select value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none"><option value="vender">Vender</option><option value="promocion">Promocion</option><option value="lanzamiento">Lanzamiento</option><option value="engagement">Engagement</option><option value="branding">Branding</option></select></div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-slate-500 uppercase">Instrucciones</label>
                            {customPrompt.trim() && (
                                <button onClick={handleEnhancePrompt} disabled={enhancing} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50">
                                    {enhancing ? <><RefreshCw size={10} className="animate-spin" /> Mejorando...</> : <><Sparkles size={10} /> Mejorar</>}
                                </button>
                            )}
                        </div>
                        <input type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="ej: enfocate en el precio, tono urgente..." className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none" />
                    </div>
                </div>
                <div className="mt-4"><label className="text-[10px] text-slate-500 uppercase mb-2 block">Canales</label><div className="flex flex-wrap gap-2">{channels.map((ch: any) => { const sel = selectedChannels.includes(ch.id); return (<button key={ch.id} onClick={() => setSelectedChannels(prev => sel ? prev.filter(c => c !== ch.id) : [...prev, ch.id])} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${sel ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' : 'bg-black/20 text-slate-500 border border-white/5'}`}>{channelIcons[ch.id]}{ch.name}</button>); })}</div></div>
                {models.length > 0 && <div className="mt-4"><ModelSelector value={selectedModel} onChange={setSelectedModel} models={models} /></div>}
                <button onClick={handleGenerate} disabled={!selectedProduct || generating || selectedChannels.length === 0} className="mt-4 px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-40">
                    {generating ? <><RefreshCw size={16} className="animate-spin" /> Generando...</> : <><Zap size={16} /> Generar Campana</>}
                </button>
            </div>
            {result?.channels?.map((ch: any) => (
                <div key={ch.channel} className="glass p-5 rounded-xl">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2">{channelIcons[ch.channel]}{ch.channel_name}<span className="text-[10px] text-slate-500 ml-2">{ch.aspect_ratio}</span></h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ch.image_url && (<div><img src={ch.image_url} alt="" className="w-full rounded-lg border border-white/10" /><div className="flex gap-2 mt-2"><a href={ch.image_url} download className="text-xs text-blue-400 flex items-center gap-1"><Download size={12} /> Descargar</a>{ch.asset_id && <InlineEditButton assetId={ch.asset_id} imageUrl={ch.image_url} fetchApi={fetchApi} />}</div></div>)}
                        <div className="space-y-3">{ch.texts?.map((t: any, i: number) => (<div key={i} className="bg-black/30 p-3 rounded-lg border border-white/5"><div className="text-sm font-bold text-white mb-1">{t.headline}</div><p className="text-xs text-slate-300 mb-2">{t.body}</p><div className="flex items-center justify-between"><span className="text-[10px] bg-orange-900/20 text-orange-400 px-2 py-0.5 rounded">{t.cta}</span><div className="flex gap-1">{t.hashtags?.map((h: string, hi: number) => (<span key={hi} className="text-[10px] text-blue-400">{h}</span>))}</div></div></div>))}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ==================== GALLERY TAB ====================
const GalleryTab = ({ assets, fetchApi, onRefresh, brandDNA }: any) => {
    const [filter, setFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [editing, setEditing] = useState(false);

    const assetTypes = [...new Set(assets.map((a: Asset) => a.asset_type))];
    const filteredAssets = assets.filter((a: Asset) => {
        if (filter && a.asset_type !== filter) return false;
        if (searchQuery) return JSON.stringify(a.content).toLowerCase().includes(searchQuery.toLowerCase());
        return true;
    });

    const isImg = (a: Asset) => a.content?.image_url && !a.content.image_url.includes('placehold.co');

    const handleEdit = async () => {
        if (!selectedAsset || !editPrompt.trim()) return;
        setEditing(true);
        try {
            const endpoint = isImg(selectedAsset) ? '/gallery/assets/edit-image' : '/gallery/assets/edit-text';
            const body: any = { asset_id: selectedAsset.id, edit_prompt: editPrompt };
            if (isImg(selectedAsset)) body.original_image_url = selectedAsset.content?.image_url;
            else { const c = selectedAsset.content; body.original_text = c.text || c.body || c.script || c.headline || JSON.stringify(c); }
            const result = await fetchApi(endpoint, { method: 'POST', body });
            setEditPrompt(''); onRefresh();
            setSelectedAsset({ ...selectedAsset, id: result.asset_id, content: { ...selectedAsset.content, ...(isImg(selectedAsset) ? { image_url: result.image_url } : { text: result.text }), edit_prompt: editPrompt } });
        } catch (e: any) { alert(e.message); } finally { setEditing(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar?')) return;
        try {
            await fetchApi(`/gallery/assets/${id}`, { method: 'DELETE' });
            if (selectedAsset?.id === id) setSelectedAsset(null);
            onRefresh();
        } catch (e: any) { alert(e.message || 'Error al eliminar'); }
    };

    return (
        <div className="flex gap-6">
            <div className={selectedAsset ? 'flex-1' : 'w-full'}>
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm outline-none" /></div>
                    <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded text-xs font-medium ${!filter ? 'bg-purple-900/30 text-purple-400' : 'text-slate-500'}`}>Todos ({assets.length})</button>
                        {assetTypes.map((t: string) => (<button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded text-xs font-medium capitalize ${filter === t ? 'bg-purple-900/30 text-purple-400' : 'text-slate-500'}`}>{t.replace(/_/g, ' ')}</button>))}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredAssets.map((a: Asset) => {
                        const hasImg = isImg(a);
                        const title = a.content?.product_name || a.content?.headline || a.content?.channel_name || a.content?.texts?.[0]?.headline || a.asset_type;
                        const sub = a.content?.template_name || a.content?.campaign_goal || a.content?.body?.substring(0, 60) || '';
                        return (<button key={a.id} onClick={() => setSelectedAsset(a)} className={`glass rounded-xl overflow-hidden text-left transition-all hover:ring-2 hover:ring-purple-500/30 ${selectedAsset?.id === a.id ? 'ring-2 ring-purple-500/50' : ''}`}>
                            {hasImg ? <img src={a.content.image_url} alt="" className="w-full h-32 object-cover" /> : <div className="h-32 p-3 flex flex-col justify-center bg-gradient-to-br from-slate-800/50 to-black/50"><p className="text-sm font-medium line-clamp-2">{title}</p><p className="text-[10px] text-slate-500 mt-1 truncate">{sub}</p></div>}
                            <div className="p-2 flex items-center justify-between"><span className="text-[10px] text-purple-400 capitalize">{a.asset_type.replace(/_/g, ' ')}</span><span className="text-[10px] text-slate-600">{new Date(a.created_at).toLocaleDateString()}</span></div>
                        </button>);
                    })}
                </div>
                {filteredAssets.length === 0 && <div className="glass p-12 rounded-xl text-center"><Grid size={48} className="mx-auto mb-4 text-slate-600" /><p className="text-slate-500">No hay assets.</p></div>}
            </div>

            {selectedAsset && (
                <div className="w-96 glass p-4 rounded-xl max-h-[80vh] overflow-y-auto flex-shrink-0">
                    <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold">Detalle</h3><button onClick={() => setSelectedAsset(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
                    {isImg(selectedAsset) && <img src={selectedAsset.content.image_url} alt="" className="w-full rounded-lg mb-3" />}
                    {!isImg(selectedAsset) && <div className="bg-black/30 p-3 rounded-lg mb-3 text-sm text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{selectedAsset.content?.text || selectedAsset.content?.body || selectedAsset.content?.headline || selectedAsset.content?.texts?.[0]?.body || JSON.stringify(selectedAsset.content, null, 2).substring(0, 500)}</div>}
                    <div className="space-y-1 mb-4 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">Tipo:</span><span className="text-purple-400 capitalize">{selectedAsset.asset_type.replace(/_/g, ' ')}</span></div>
                        {selectedAsset.content?.product_name && <div className="flex justify-between"><span className="text-slate-500">Producto:</span><span>{selectedAsset.content.product_name}</span></div>}
                        {selectedAsset.content?.template_name && <div className="flex justify-between"><span className="text-slate-500">Template:</span><span className="text-blue-400">{selectedAsset.content.template_name}</span></div>}
                        {selectedAsset.content?.channel_name && <div className="flex justify-between"><span className="text-slate-500">Canal:</span><span className="text-orange-400">{selectedAsset.content.channel_name}</span></div>}
                    </div>
                    <div className="border-t border-white/10 pt-3">
                        <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1"><Pencil size={12} /> Editar con Prompt</h4>
                        <div className="flex gap-2">
                            <input type="text" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder={isImg(selectedAsset) ? "ej: cambia el fondo..." : "ej: mas informal..."} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none" onKeyDown={(e) => e.key === 'Enter' && editPrompt.trim() && handleEdit()} />
                            <button onClick={handleEdit} disabled={editing || !editPrompt.trim()} className="p-2 bg-purple-600/30 hover:bg-purple-600/50 rounded-lg disabled:opacity-40">{editing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}</button>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">{isImg(selectedAsset) ? 'Describe cambios a la imagen' : 'Describe correcciones al texto'}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                        {isImg(selectedAsset) && <a href={selectedAsset.content.image_url} download className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-center flex items-center justify-center gap-1"><Download size={12} /> Descargar</a>}
                        <button onClick={() => handleDelete(selectedAsset.id)} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg text-xs flex items-center gap-1"><Trash2 size={12} /> Eliminar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== INLINE EDIT BUTTON ====================
const InlineEditButton = ({ assetId, imageUrl, fetchApi, onEdited }: any) => {
    const [show, setShow] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const handleEdit = async () => {
        if (!prompt.trim()) return; setLoading(true);
        try { const r = await fetchApi('/gallery/assets/edit-image', { method: 'POST', body: { asset_id: assetId, edit_prompt: prompt, original_image_url: imageUrl } }); setPrompt(''); setShow(false); onEdited?.(r); } catch (e: any) { alert(e.message); } finally { setLoading(false); }
    };
    if (!show) return <button onClick={() => setShow(true)} className="flex-1 py-2 bg-purple-900/20 hover:bg-purple-900/30 text-purple-400 rounded text-xs text-center flex items-center justify-center gap-1"><Pencil size={12} /> Editar</button>;
    return (<div className="flex-1 flex gap-1"><input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Cambiar fondo..." className="flex-1 bg-black/40 border border-purple-500/30 rounded px-2 py-1 text-[10px] outline-none" onKeyDown={(e) => e.key === 'Enter' && handleEdit()} autoFocus /><button onClick={handleEdit} disabled={loading} className="p-1 bg-purple-600/30 rounded disabled:opacity-50">{loading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}</button><button onClick={() => setShow(false)} className="p-1 text-slate-500"><X size={12} /></button></div>);
};
