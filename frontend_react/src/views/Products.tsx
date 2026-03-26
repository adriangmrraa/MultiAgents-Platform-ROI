import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import {
    Package, Plus, Trash2, Edit2, Search, Download, Upload, X,
    Image, DollarSign, Tag, Check, AlertCircle
} from 'lucide-react';

interface Product {
    id: number;
    name: string;
    description: string;
    category: string;
    price: number;
    compare_at_price: number | null;
    currency: string;
    stock: number;
    variants: any[];
    images: string[];
    tags: string[];
    is_active: boolean;
    sku: string | null;
}

const inputClass = "w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 outline-none";

export const Products: React.FC = () => {
    const { fetchApi } = useApi();
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        name: '', description: '', category: 'General', price: 0,
        compare_at_price: null as number | null, stock: 0, sku: '',
        variants: [] as any[], images: [] as string[], tags: [] as string[],
    });

    useEffect(() => { loadProducts(); loadCategories(); }, [selectedCategory, searchQuery]);

    const loadProducts = async () => {
        let url = '/admin/products?limit=50';
        if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
        if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
        const data = await fetchApi(url);
        if (data?.products) { setProducts(data.products); setTotal(data.total); }
    };

    const loadCategories = async () => {
        const cats = await fetchApi('/admin/products/categories');
        if (Array.isArray(cats)) setCategories(cats);
    };

    const openCreate = () => {
        setEditingProduct(null);
        setForm({ name: '', description: '', category: 'General', price: 0, compare_at_price: null, stock: 0, sku: '', variants: [], images: [], tags: [] });
        setShowModal(true);
    };

    const openEdit = (p: Product) => {
        setEditingProduct(p);
        setForm({
            name: p.name, description: p.description, category: p.category,
            price: p.price, compare_at_price: p.compare_at_price,
            stock: p.stock, sku: p.sku || '',
            variants: Array.isArray(p.variants) ? p.variants : [],
            images: Array.isArray(p.images) ? p.images : [],
            tags: Array.isArray(p.tags) ? p.tags : [],
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            if (editingProduct) {
                await fetchApi(`/admin/products/${editingProduct.id}`, { method: 'PUT', body: form });
            } else {
                await fetchApi('/admin/products', { method: 'POST', body: form });
            }
            setShowModal(false);
            loadProducts();
            loadCategories();
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Eliminar este producto?')) return;
        await fetchApi(`/admin/products/${id}`, { method: 'DELETE' });
        loadProducts();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetchApi('/admin/products/import', { method: 'POST', body: formData });
            setShowImport(false);
            loadProducts();
            loadCategories();
            alert(`${res?.imported || 0} productos importados`);
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    };

    const downloadTemplate = () => {
        window.open('/api/admin/products/export-template', '_blank');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 lg:px-0 pb-20 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-600 p-3 rounded-xl shadow-lg">
                            <Package size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Mis Productos</h2>
                            <p className="text-slate-300 text-sm">{total} productos</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowImport(true)} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                            <Upload size={14} /> Importar
                        </button>
                        <button onClick={openCreate} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                            <Plus size={14} /> Agregar
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar productos..." className={`${inputClass} pl-9`} />
                </div>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                    <option value="" className="bg-[#1a1a2e]">Todas las categorias</option>
                    {categories.map(c => <option key={c} value={c} className="bg-[#1a1a2e]">{c}</option>)}
                </select>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
                <div className="text-center py-16">
                    <Package size={48} className="text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">No tenes productos cargados</p>
                    <p className="text-slate-600 text-sm mb-4">Agrega productos manualmente o importa un CSV</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={openCreate} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2">
                            <Plus size={14} /> Agregar Producto
                        </button>
                        <button onClick={downloadTemplate} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-xl transition-all flex items-center gap-2">
                            <Download size={14} /> Descargar Template CSV
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {products.map(p => {
                        const imgs = Array.isArray(p.images) ? p.images : [];
                        const firstImg = imgs[0] && typeof imgs[0] === 'string' ? imgs[0] : (imgs[0] as any)?.src;
                        return (
                            <div key={p.id} className="glass rounded-xl border border-white/5 overflow-hidden hover:border-white/10 transition-all">
                                <div className="h-36 bg-white/5 flex items-center justify-center">
                                    {firstImg ? (
                                        <img src={firstImg} alt={p.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <Image size={32} className="text-slate-600" />
                                    )}
                                </div>
                                <div className="p-3 space-y-1">
                                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.category}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-cyan-400">${p.price}</p>
                                        <p className="text-[10px] text-slate-500">{p.stock} unid.</p>
                                    </div>
                                    <div className="flex gap-1 pt-1">
                                        <button onClick={() => openEdit(p)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1">
                                            <Edit2 size={10} /> Editar
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="py-1.5 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] rounded-lg transition-all">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
                    <div className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Importar Productos</h3>
                            <button onClick={() => setShowImport(false)}><X size={16} className="text-slate-500" /></button>
                        </div>
                        <button onClick={downloadTemplate} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                            <Download size={14} /> Descargar Template CSV
                        </button>
                        <label className="w-full py-8 border-2 border-dashed border-white/10 hover:border-cyan-500/30 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                            <Upload size={24} className="text-slate-500 mb-2" />
                            <p className="text-sm text-slate-400">Arrastra o selecciona tu CSV</p>
                            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
                        </label>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="glass w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 p-6 space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-white">{editingProduct ? 'Editar' : 'Agregar'} Producto</h3>
                            <button onClick={() => setShowModal(false)}><X size={16} className="text-slate-500" /></button>
                        </div>

                        {error && (
                            <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                                <AlertCircle size={12} /> {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Nombre</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Descripcion</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Categoria</label>
                                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">SKU</label>
                                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className={inputClass} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Precio</label>
                                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Precio anterior</label>
                                <input type="number" value={form.compare_at_price || ''} onChange={e => setForm({ ...form, compare_at_price: parseFloat(e.target.value) || null })} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Stock</label>
                                <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className={inputClass} />
                            </div>
                        </div>

                        <button onClick={handleSave} disabled={loading || !form.name}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all active:scale-[0.98]">
                            {loading ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear Producto'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
