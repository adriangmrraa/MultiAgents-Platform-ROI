import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import {
    LayoutDashboard, ShoppingBag, Package, Search,
    Palette, FileText, Image as ImageIcon,
    BarChart3, RefreshCw, Layers, Sparkles, Wand2, Loader2
} from 'lucide-react';

// --- Types ---
interface Asset {
    id: string;
    asset_type: string;
    content: any;
    created_at: string;
}

interface Product {
    id: number;
    name: { es: string };
    images: { src: string }[];
    categories: { id: number, name: { es: string } }[];
    price: string;
}

// --- Components ---

const ForgeHeader = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (t: string) => void }) => (
    <div className="mb-8 fade-in">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            The Business Forge
        </h1>
        <p className="text-slate-400 mb-6 font-light">
            Command Center for Autonomous Brand Identity & Commerce.
        </p>

        <div className="flex border-b border-white/10">
            <button
                onClick={() => onTabChange('canvas')}
                className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'canvas' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-white'}`}
            >
                <LayoutDashboard size={18} /> Business Canvas
            </button>
            <button
                onClick={() => onTabChange('catalog')}
                className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'catalog' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-white'}`}
            >
                <ShoppingBag size={18} /> Smart Catalog
            </button>
        </div>
    </div>
);

// New Component: Fusion Card for Visuals
const FusionItem = ({ item, onFuse }: { item: any, onFuse: (prompt: string, img: string) => Promise<string> }) => {
    const [generating, setGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(item.generated_url || null);
    const [mode, setMode] = useState<'dream' | 'reality'>('reality'); // Default to Reality (Overlay)

    const handleClick = async () => {
        if (generating || resultUrl) return;
        setGenerating(true);
        try {
            const url = await onFuse(item.prompt, item.base_image);
            setResultUrl(url);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="bg-black/40 rounded-lg p-3 mb-3 border border-white/5 transition-all hover:bg-black/60">
            <div className="flex gap-3 mb-3">
                {item.base_image && (
                    <div className="w-16 h-16 rounded overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                        <img src={item.base_image} className="w-full h-full object-cover" alt="Base" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm truncate">{item.title || item.type}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{item.prompt}</p>

                    {/* Mode Toggle */}
                    {resultUrl && (
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => setMode('dream')}
                                className={`text-[10px] px-2 py-0.5 rounded border ${mode === 'dream' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-slate-700 text-slate-500'}`}
                            >
                                AI Re-Creation
                            </button>
                            <button
                                onClick={() => setMode('reality')}
                                className={`text-[10px] px-2 py-0.5 rounded border ${mode === 'reality' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'border-slate-700 text-slate-500'}`}
                            >
                                Product Overlay
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {resultUrl ? (
                <div className="w-full aspect-square rounded overflow-hidden border border-cyan-500/30 relative group bg-slate-900">
                    {/* 1. Background (AI Generated) */}
                    <img src={resultUrl} className="w-full h-full object-cover" alt="Generated Ad" />

                    {/* 2. Product Overlay (The 'Hard Embedding') */}
                    {mode === 'reality' && item.base_image && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="relative w-3/4 h-3/4 filter drop-shadow-2xl transition-transform duration-500 hover:scale-105">
                                <img
                                    src={item.base_image}
                                    className="w-full h-full object-contain"
                                    alt="Product Layer"
                                />
                                {/* Lighting Hack */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 mix-blend-overlay rounded-xl"></div>
                            </div>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a href={resultUrl} target="_blank" rel="noreferrer" className="px-3 py-1 bg-white text-black text-xs font-bold rounded hover:bg-cyan-50">Save Image</a>
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleClick}
                    disabled={generating}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 rounded text-xs text-white font-bold flex items-center justify-center gap-2 transition-all"
                >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {generating ? 'FUSING...' : 'IGNITE FUSION'}
                </button>
            )}
        </div>
    );
};

const AssetCard = ({ asset, onFuse }: { asset: Asset, onFuse: (p: string, i: string) => Promise<string> }) => {
    let Icon = Layers;
    let color = "text-slate-400";
    let title = asset.asset_type.toUpperCase();

    if (asset.asset_type === 'branding') { Icon = Palette; color = "text-pink-400"; }
    else if (asset.asset_type === 'scripts') { Icon = FileText; color = "text-yellow-400"; }
    else if (asset.asset_type === 'visuals') { Icon = ImageIcon; color = "text-cyan-400"; }
    else if (asset.asset_type === 'roi') { Icon = BarChart3; color = "text-green-400"; }

    const isVisuals = asset.asset_type === 'visuals' && asset.content.social_posts;

    return (
        <div className="glass p-6 rounded-xl hover:bg-white/5 transition-all group animate-fade-in-up border border-white/5 hover:border-white/10 relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon size={120} />
            </div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className={`p-2 rounded bg-black/40 ${color}`}>
                    <Icon size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-white">{title}</h3>
                    <p className="text-xs text-slate-500 font-mono">{new Date(asset.created_at).toLocaleDateString()}</p>
                </div>
            </div>

            <div className="relative z-10 text-sm text-slate-300 max-h-96 overflow-y-auto custom-scrollbar">
                {isVisuals ? (
                    asset.content.social_posts.map((post: any, idx: number) => (
                        <FusionItem key={idx} item={post} onFuse={onFuse} />
                    ))
                ) : (
                    typeof asset.content === 'object' ? (
                        <pre className="text-[10px] bg-black/40 p-2 rounded whitespace-pre-wrap">{JSON.stringify(asset.content, null, 2)}</pre>
                    ) : (
                        <p>{String(asset.content).substring(0, 150)}...</p>
                    )
                )}
            </div>

            {!isVisuals && (
                <button className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-white font-bold transition-colors">
                    VIEW DETAILS
                </button>
            )}
        </div>
    );
};

const ProductCard = ({ product, onFuse }: { product: Product, onFuse: (p: string, i: string) => Promise<string> }) => {
    const [generating, setGenerating] = useState(false);

    const handleQuickFuse = async () => {
        if (generating) return;
        setGenerating(true);
        // Quick fusion for catalog items
        const prompt = `Professional advertising shot of ${product.name.es}, cinematic lighting, luxury product photography style, 8k resolution.`;
        const img = product.images[0]?.src;
        if (img) {
            try {
                const url = await onFuse(prompt, img);
                window.open(url, '_blank');
            } catch (e) { console.error(e); }
        }
        setGenerating(false);
    };

    return (
        <div className="glass p-4 rounded-xl hover:bg-white/5 transition-all animate-fade-in-up border border-white/5 hover:border-white/10">
            <div className="aspect-square bg-slate-800 rounded mb-4 overflow-hidden relative group">
                <img
                    src={product.images[0]?.src || 'https://via.placeholder.com/300?text=No+Image'}
                    alt={product.name.es}
                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-mono text-white">
                    ${product.price}
                </div>
            </div>
            <h3 className="font-bold text-white mb-1 truncate">{product.name.es}</h3>
            <p className="text-xs text-slate-500 mb-2">{product.categories[0]?.name.es || 'Uncategorized'}</p>

            <div className="flex gap-2">
                <button
                    onClick={handleQuickFuse}
                    disabled={generating}
                    className="flex-1 py-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded text-xs transition-colors flex items-center justify-center gap-1"
                >
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generating ? 'Fusing...' : 'Generate Ad'}
                </button>
                <button className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-white transition-colors">
                    Details
                </button>
            </div>
        </div>
    );
};

export const BusinessForge = () => {
    const { fetchApi } = useApi();

    const [activeTab, setActiveTab] = useState<'canvas' | 'catalog'>('canvas');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [assetFilter, setAssetFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'canvas') {
                const data = await fetchApi('/admin/assets');
                setAssets(data);
            } else {
                // Assuming we want products for a specific tenant or user based context
                // For MVP fetch all or mock
                // TODO: Pass actual tenant ID if context available
                const data = await fetchApi('/admin/products?tenant_id=54911');
                setProducts(data);
            }
        } catch (e) {
            console.error("Error loading forge data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFusion = async (prompt: string, image_url: string): Promise<string> => {
        try {
            const res = await fetchApi('/admin/generate-image', {
                method: 'POST',
                body: { prompt, image_url }
            });
            if (res.status === 'success') return res.url;
            throw new Error("Generation failed");
        } catch (e) {
            console.error(e);
            throw e;
        }
    };

    const filteredAssets = assets.filter(a => assetFilter === 'all' || a.asset_type === assetFilter);
    const filteredProducts = products.filter(p => categoryFilter === 'all' || (p.categories && p.categories.some(c => c.name.es === categoryFilter))); // Simple text match

    // Extract unique categories
    const categories = Array.from(new Set(products.flatMap(p => p.categories?.map(c => c.name.es) || [])));

    return (
        <div className="p-8 min-h-screen bg-[#020617] text-white">
            <ForgeHeader activeTab={activeTab} onTabChange={(t) => setActiveTab(t as 'canvas' | 'catalog')} />

            {/* Filters Bar */}
            <div className="flex justify-between items-center mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-4">
                    <div className="glass px-3 py-2 rounded-lg flex items-center gap-2 text-slate-400 border border-white/5">
                        <Search size={16} />
                        <input className="bg-transparent border-none outline-none text-sm w-40" placeholder="Search..." />
                    </div>

                    {activeTab === 'canvas' && (
                        <select
                            className="glass px-3 py-2 rounded-lg bg-[#0f172a] border border-white/5 text-sm text-slate-300 outline-none"
                            value={assetFilter}
                            onChange={(e) => setAssetFilter(e.target.value)}
                        >
                            <option value="all">All Assets</option>
                            <option value="branding">Identity</option>
                            <option value="scripts">Scripts</option>
                            <option value="visuals">Visuals</option>
                            <option value="roi">Analytic Projections</option>
                        </select>
                    )}

                    {activeTab === 'catalog' && (
                        <select
                            className="glass px-3 py-2 rounded-lg bg-[#0f172a] border border-white/5 text-sm text-slate-300 outline-none"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                </div>

                <button
                    onClick={loadData}
                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 transition-all hover:rotate-180"
                    title="Refresh Data"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="animate-spin text-cyan-400" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {activeTab === 'canvas' && (
                        filteredAssets.length > 0 ? (
                            filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} onFuse={handleFusion} />)
                        ) : (
                            <div className="col-span-full text-center py-20 text-slate-500">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No assets forged yet. Ignite the engine!</p>
                            </div>
                        )
                    )}

                    {activeTab === 'catalog' && (
                        filteredProducts.length > 0 ? (
                            filteredProducts.map(product => <ProductCard key={product.id} product={product} onFuse={handleFusion} />)
                        ) : (
                            <div className="col-span-full text-center py-20 text-slate-500">
                                <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No products found in the catalog.</p>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};
