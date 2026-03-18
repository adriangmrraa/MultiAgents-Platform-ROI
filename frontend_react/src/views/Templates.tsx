import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import {
    FileText,
    Plus,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Copy,
    LayoutGrid,
    MessageSquare,
    Trash2
} from 'lucide-react';

interface Template {
    id: string;
    meta_id?: string;
    name: string;
    category: string;
    status: string;
    body_text: string;
    language: string;
}

export default function Templates() {
    const { fetchApi } = useApi();
    const [activeTab, setActiveTab] = useState<'library' | 'create'>('library');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Form State
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('MARKETING');
    const [newBody, setNewBody] = useState('');
    const [newLang, setNewLang] = useState('es');
    const [error, setError] = useState('');

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/admin/templates/');
            setTemplates(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await fetchApi('/admin/templates/sync', { method: 'POST' });
            await loadTemplates();
        } catch (err) {
            alert('Sync Failed');
        } finally {
            setSyncing(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Lowercase & Snake Case
        const nameRegex = /^[a-z0-9_]+$/;
        if (!nameRegex.test(newName)) {
            setError('Name must be lowercase alphanumeric with underscores only (e.g., promo_winter_2024).');
            return;
        }

        if (newBody.endsWith('\n')) {
            setError('Body text cannot end with a newline (Meta Rule).');
            return;
        }
        setError('');

        try {
            await fetchApi('/admin/templates/create', {
                method: 'POST',
                body: {
                    name: newName,
                    category: newCategory,
                    body_text: newBody,
                    language: newLang
                }
            });
            setNewName('');
            setNewBody('');
            setActiveTab('library');
            loadTemplates();
        } catch (err) {
            setError('Failed to create template.');
        }
    };

    // Helper to render body with highlighted variables
    const renderPreviewBody = (text: string) => {
        if (!text) return <span className="text-gray-400 italic">Tu mensaje aparecerá aquí...</span>;

        const parts = text.split(/(\{\{\d+\}\})/g);
        return parts.map((part, i) => {
            if (part.match(/\{\{\d+\}\}/)) {
                return <span key={i} className="bg-green-200 text-green-800 px-1 rounded font-bold text-xs mx-0.5">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const getStatusParams = (status: string) => {
        switch (status) {
            case 'APPROVED': return { color: 'text-green-400', bg: 'bg-green-400/10', icon: <CheckCircle size={14} /> };
            case 'REJECTED': return { color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertCircle size={14} /> };
            default: return { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: <Clock size={14} /> };
        }
    };

    return (
        <div className="p-4 sm:p-8 bg-[#0B0E14] min-h-screen text-gray-100 flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center gap-3">
                        <FileText className="text-emerald-400" />
                        Gestor de Plantillas
                    </h1>
                    <p className="text-gray-500 mt-1">Sincroniza, crea y gestiona tus mensajes aprobados por Meta.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-gray-300"
                    >
                        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Meta'}
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20 transition"
                    >
                        <Plus size={18} />
                        Nueva Plantilla
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 sm:gap-8 border-b border-gray-800 mb-6 shrink-0 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('library')}
                    className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === 'library' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <LayoutGrid size={18} /> Librería
                    </span>
                    {activeTab === 'library' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={`pb-4 px-2 text-sm font-medium transition-all relative ${activeTab === 'create' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <MessageSquare size={18} /> Composer
                    </span>
                    {activeTab === 'create' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">

                {/* LIBRARY TAB */}
                {activeTab === 'library' && (
                    <div className="h-full overflow-y-auto pr-2 pb-20">
                        {loading && templates.length === 0 ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                                <FileText size={48} className="mx-auto text-gray-700 mb-4" />
                                <h3 className="text-xl font-bold text-gray-400">No hay plantillas</h3>
                                <p className="text-gray-600 mb-6">Crea tu primera plantilla o sincroniza con Meta.</p>
                                <button onClick={() => setActiveTab('create')} className="text-emerald-500 hover:underline">Crear ahora</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {templates.map(t => {
                                    const status = getStatusParams(t.status);
                                    return (
                                        <div key={t.id} className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all hover:shadow-xl hover:shadow-black/40 flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-200 truncate font-mono text-sm" title={t.name}>{t.name}</h3>
                                                    <span className="text-xs text-gray-500 uppercase tracking-wider block">{t.category}</span>
                                                    {t.meta_id && <span className="text-[10px] text-gray-600 font-mono block mt-0.5">ID: {t.meta_id}</span>}
                                                </div>
                                                <div className={`px-2 py-1 rounded-full text-[10px] font-bold border border-white/5 flex items-center gap-1.5 ${status.bg} ${status.color}`}>
                                                    {status.icon}
                                                    {t.status}
                                                </div>
                                            </div>

                                            <div className="flex-1 bg-black/30 rounded-lg p-3 mb-4 min-h-[80px]">
                                                <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed whitespace-pre-wrap font-mono">
                                                    {t.body_text}
                                                </p>
                                            </div>

                                            <div className="border-t border-gray-800 pt-3 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(t.body_text)}
                                                    className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition"
                                                    title="Copiar Texto"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button className="p-1.5 hover:bg-red-500/10 rounded text-gray-600 hover:text-red-400 transition" title="Eliminar (No implementado)">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* CREATE TAB */}
                {activeTab === 'create' && (
                    <div className="h-full overflow-y-auto pb-20">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">

                            {/* Left: Form */}
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">1</div>
                                        Configuración
                                    </h2>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre de la Plantilla</label>
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={e => setNewName(e.target.value.toLowerCase().replace(/ /g, '_'))}
                                                placeholder="ej: oferta_verano_2024"
                                                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm transition-colors"
                                                required
                                            />
                                            <p className="text-xs text-gray-600 mt-1.5">Solo minúsculas y guiones bajos (snake_case).</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Categoría</label>
                                                <div className="relative">
                                                    <select
                                                        value={newCategory}
                                                        onChange={e => setNewCategory(e.target.value)}
                                                        className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
                                                    >
                                                        <option value="MARKETING">Marketing</option>
                                                        <option value="UTILITY">Utility</option>
                                                        <option value="AUTHENTICATION">Authentication</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Idioma</label>
                                                <select
                                                    value={newLang}
                                                    onChange={e => setNewLang(e.target.value)}
                                                    className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="es">Español (es)</option>
                                                    <option value="es_AR">Español Argentina (es_AR)</option>
                                                    <option value="es_ES">Español España (es_ES)</option>
                                                    <option value="en_US">English (en_US)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">2</div>
                                        Contenido
                                    </h2>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Cuerpo del Mensaje</label>
                                        <textarea
                                            value={newBody}
                                            onChange={e => setNewBody(e.target.value)}
                                            placeholder="Hola {{1}}, gracias por tu compra de {{2}}..."
                                            rows={6}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm leading-relaxed"
                                            required
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <p className="text-xs text-gray-500">Variables: Usa <code>{'{{1}}'}, {'{{2}}'}</code>...</p>
                                            <p className="text-xs text-yellow-500/80">Evita saltos de línea al final.</p>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                                        <AlertCircle size={20} />
                                        <span className="text-sm font-medium">{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl font-bold text-white shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-600 transition transform active:scale-[0.98]"
                                >
                                    Enviar a Revisión de Meta
                                </button>
                            </form>

                            {/* Right: Preview */}
                            <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-gray-400 mb-6 uppercase tracking-wider text-xs">Vista Previa</h3>
                                <div className="flex-1 bg-[#0d0d0d] rounded-[3rem] border-8 border-gray-800 shadow-2xl relative overflow-hidden max-w-sm mx-auto w-full aspect-[9/19]">
                                    {/* Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-20"></div>

                                    {/* Valid Screen Area */}
                                    <div className="w-full h-full bg-[#E5DDD5] relative flex flex-col pt-12">
                                        {/* Status Bar Mock */}
                                        <div className="bg-[#075E54] h-12 flex items-center px-4 gap-3 text-white shadow-md z-10">
                                            <div className="w-8 h-8 rounded-full bg-white/20"></div>
                                            <div className="flex-1">
                                                <div className="h-2 w-24 bg-white/40 rounded mb-1"></div>
                                                <div className="h-1.5 w-16 bg-white/20 rounded"></div>
                                            </div>
                                        </div>

                                        {/* Chat Area */}
                                        <div className="flex-1 p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90">
                                            {newBody ? (
                                                <div className="bg-white rounded-tr-none rounded-xl p-3 shadow-sm max-w-[90%] self-end ml-auto relative">
                                                    <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">
                                                        {renderPreviewBody(newBody)}
                                                    </p>
                                                    <span className="text-[10px] text-gray-400 block text-right mt-1">10:42 AM</span>

                                                    {/* Triangle */}
                                                    <div className="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-white border-r-[10px] border-r-transparent"></div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center mt-10 opacity-50">
                                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded shadow-sm">Vista Previa</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer Mock */}
                                        <div className="h-14 bg-[#f0f0f0] flex items-center px-2 gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                                            <div className="flex-1 h-9 bg-white rounded-full"></div>
                                            <div className="w-8 h-8 rounded-full bg-emerald-600"></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-xs text-gray-500 mt-6">
                                    Simulación aproximada. El renderizado final depende del dispositivo del usuario.
                                </p>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
