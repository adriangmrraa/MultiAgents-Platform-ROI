import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Plus, Trash2, Link as LinkIcon } from 'lucide-react';

interface ChannelBinding {
    id: number;
    provider: string;
    channel_id: string;
    label: string;
    created_at: string;
}

export const Channels = () => {
    const { fetchApi } = useApi();
    const [bindings, setBindings] = useState<ChannelBinding[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ provider: 'ycloud', channel_id: '', label: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadBindings = async () => {
        try {
            const data = await fetchApi('/admin/channels/bindings');
            setBindings(data.bindings || []);
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        loadBindings();
    }, []);

    const handleBind = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await fetchApi('/admin/channels/bind', { method: 'POST', body: formData });
            setShowModal(false);
            setFormData({ provider: 'ycloud', channel_id: '', label: '' });
            loadBindings();
        } catch (err: any) {
            setError(err.message || 'Error al vincular canal');
        } finally {
            setLoading(false);
        }
    };

    const handleUnbind = async (id: number) => {
        if (!confirm('¿Desvincular este canal?')) return;
        try {
            await fetchApi(`/admin/channels/unbind/${id}`, { method: 'DELETE' });
            loadBindings();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Canales Vinculados</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl transition-colors"
                >
                    <Plus size={16} /> Vincular Canal
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-xl mb-4">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {bindings.map(b => (
                    <div key={b.id} className="glass p-4 rounded-xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/20 rounded-lg">
                                <LinkIcon size={18} className="text-accent" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">{b.label}</div>
                                <div className="text-xs text-gray-400">
                                    {b.provider.toUpperCase()} · {b.channel_id}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleUnbind(b.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                {bindings.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                        No hay canales vinculados. Agrega uno para comenzar.
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
                    <div className="glass max-w-md w-full p-6 rounded-2xl border border-white/10">
                        <h2 className="text-xl font-bold text-white mb-4">Vincular Nuevo Canal</h2>
                        <form onSubmit={handleBind} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Proveedor</label>
                                <select
                                    value={formData.provider}
                                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                                >
                                    <option value="ycloud">YCloud (WhatsApp)</option>
                                    <option value="meta">Meta (IG/FB)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Channel ID</label>
                                <input
                                    type="text"
                                    value={formData.channel_id}
                                    onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                                    placeholder="Ej: 123456789"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Etiqueta (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    placeholder="Ej: WhatsApp Principal"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Vinculando...' : 'Vincular'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
