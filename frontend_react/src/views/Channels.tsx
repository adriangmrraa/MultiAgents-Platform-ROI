import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Plus, Trash2, Edit2, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';

interface ChannelBinding {
    id: number;
    provider: string;
    channel_id: string;
    label: string;
    tenant_id: number;
    tenant_name?: string;
    external_account_id?: string;
    created_at: string;
}

interface Tenant {
    id: number;
    store_name: string;
}

export const Channels = () => {
    const { fetchApi } = useApi();
    const [bindings, setBindings] = useState<ChannelBinding[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingBinding, setEditingBinding] = useState<ChannelBinding | null>(null);
    const [formData, setFormData] = useState({ provider: 'ycloud', channel_id: '', label: '', tenant_id: 0, external_account_id: '' });
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

    const loadTenants = async () => {
        try {
            const data = await fetchApi('/admin/tenants');
            const list = Array.isArray(data) ? data : (data.tenants || []);
            setTenants(list);
            if (list.length > 0 && formData.tenant_id === 0) {
                setFormData(prev => ({ ...prev, tenant_id: list[0].id }));
            }
        } catch (err: any) {
            console.error("Error loading tenants", err);
        }
    };

    useEffect(() => {
        loadBindings();
        loadTenants();
    }, []);

    const handleBind = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (editingBinding) {
                // Edit mode
                await fetchApi(`/admin/channels/edit/${editingBinding.id}`, {
                    method: 'PUT',
                    body: {
                        channel_id: formData.channel_id,
                        label: formData.label,
                        tenant_id: formData.tenant_id,
                        external_account_id: formData.external_account_id
                    }
                });
            } else {
                // Create mode
                await fetchApi('/admin/channels/bind', { method: 'POST', body: formData });
            }
            setShowModal(false);
            setEditingBinding(null);
            setFormData({ provider: 'ycloud', channel_id: '', label: '', tenant_id: tenants[0]?.id || 0, external_account_id: '' });
            loadBindings();
        } catch (err: any) {
            setError(err.message || 'Error al vincular canal');
        } finally {
            setLoading(false);
        }
    };

    const handleUnbind = async (id: number) => {
        if (!confirm('¿Desvincular este canal? Esta acción no se puede deshacer.')) return;
        try {
            await fetchApi(`/admin/channels/unbind/${id}`, { method: 'DELETE' });
            loadBindings();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const openEditModal = (binding: ChannelBinding) => {
        setEditingBinding(binding);
        setFormData({
            provider: binding.provider,
            channel_id: binding.channel_id,
            label: binding.label,
            tenant_id: binding.tenant_id,
            external_account_id: binding.external_account_id || ''
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingBinding(null);
        setFormData({
            provider: 'ycloud',
            channel_id: '',
            label: '',
            tenant_id: tenants[0]?.id || 0,
            external_account_id: ''
        });
        setShowModal(true);
    };

    const providerStatus = {
        ycloud: bindings.find(b => b.provider === 'ycloud'),
        chatwoot: bindings.find(b => b.provider === 'chatwoot'),
        meta: bindings.find(b => b.provider === 'meta')
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Canales Vinculados</h1>
                    <p className="text-sm text-gray-400 mt-1">Gestión Multi-Tenant de Canales (v7.0.2)</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-accent/20"
                >
                    <Plus size={16} /> Vincular Canal
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Provider Status Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatusCard
                    provider="YCloud"
                    status={providerStatus.ycloud ? 'configured' : 'pending'}
                    channelId={providerStatus.ycloud?.channel_id}
                />
                <StatusCard
                    provider="Chatwoot"
                    status={providerStatus.chatwoot ? 'configured' : 'pending'}
                    channelId={providerStatus.chatwoot?.channel_id}
                />
                <StatusCard
                    provider="Meta"
                    status={providerStatus.meta ? 'configured' : 'pending'}
                    channelId={providerStatus.meta?.channel_id}
                />
            </div>

            {/* Individual Channel Cards */}
            <div className="space-y-4">
                {bindings.map(b => (
                    <div key={b.id} className="glass p-5 rounded-2xl border border-white/10 hover:border-accent/30 transition-all">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-accent/20 rounded-xl">
                                    <LinkIcon size={20} className="text-accent" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-white">{b.label || 'Sin etiqueta'}</span>
                                        <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px] text-white/60 uppercase font-bold">
                                            {b.provider}
                                        </span>
                                        {b.tenant_name && (
                                            <span className="px-2 py-0.5 bg-accent/20 rounded-full text-[10px] text-accent font-bold">
                                                Tienda: {b.tenant_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono">
                                        Channel ID: <span className="text-white">{b.channel_id}</span>
                                        {b.external_account_id && (
                                            <span className="ml-3">
                                                Account ID: <span className="text-white">{b.external_account_id}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Creado: {new Date(b.created_at).toLocaleDateString('es-AR', {
                                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openEditModal(b)}
                                    className="p-2 hover:bg-blue-500/20 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                                    title="Editar canal"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleUnbind(b.id)}
                                    className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                    title="Desvincular canal"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {bindings.length === 0 && (
                    <div className="text-center text-gray-500 py-16 glass rounded-2xl border border-white/5">
                        <LinkIcon size={48} className="mx-auto mb-4 text-gray-600" />
                        <p className="text-lg font-bold text-gray-400">No hay canales vinculados</p>
                        <p className="text-sm text-gray-500 mt-2">Agrega tu primer canal para comenzar</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50" onClick={() => setShowModal(false)}>
                    <div className="glass max-w-md w-full p-6 rounded-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingBinding ? 'Editar Canal' : 'Vincular Nuevo Canal'}
                        </h2>
                        <form onSubmit={handleBind} className="space-y-4">
                            {!editingBinding && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Proveedor</label>
                                        <select
                                            value={formData.provider}
                                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                        >
                                            <option value="ycloud">YCloud (WhatsApp)</option>
                                            <option value="chatwoot">Chatwoot</option>
                                            <option value="meta">Meta (IG/FB)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Tienda Destino</label>
                                        <select
                                            value={formData.tenant_id}
                                            onChange={(e) => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                        >
                                            {tenants.map(t => (
                                                <option key={t.id} value={t.id}>{t.store_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {editingBinding && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-500/10 border border-blue-500/30 px-4 py-3 rounded-xl text-xs text-blue-300">
                                        Provider: <strong>{editingBinding.provider.toUpperCase()}</strong>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Tienda Destino</label>
                                        <select
                                            value={formData.tenant_id}
                                            onChange={(e) => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
                                        >
                                            {tenants.map(t => (
                                                <option key={t.id} value={t.id}>{t.store_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Channel ID {formData.provider === 'ycloud' && '(WABA ID)'}
                                    {formData.provider === 'chatwoot' && '(Inbox ID)'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.channel_id}
                                    onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                                    placeholder={
                                        formData.provider === 'ycloud' ? 'Ej: 1234567890' :
                                            formData.provider === 'chatwoot' ? 'Ej: 5' :
                                                'Ej: 123456'
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                                />
                            </div>

                            {formData.provider === 'chatwoot' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Account ID (Chatwoot)</label>
                                    <input
                                        type="text"
                                        value={formData.external_account_id}
                                        onChange={(e) => setFormData({ ...formData, external_account_id: e.target.value })}
                                        placeholder="Ej: 1"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                                        required
                                    />
                                </div>
                            )}

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
                                    {loading ? 'Procesando...' : editingBinding ? 'Guardar Cambios' : 'Vincular'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Status Card Component
const StatusCard = ({ provider, status, channelId }: { provider: string, status: 'configured' | 'pending', channelId?: string }) => (
    <div className={`glass p-4 rounded-xl border ${status === 'configured' ? 'border-green-500/30 bg-green-500/5' : 'border-white/10'}`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">{provider}</span>
            {status === 'configured' ? (
                <CheckCircle size={16} className="text-green-400" />
            ) : (
                <AlertCircle size={16} className="text-yellow-400" />
            )}
        </div>
        {status === 'configured' && channelId && (
            <div className="text-[10px] text-gray-400 font-mono truncate">
                {channelId}
            </div>
        )}
        <div className={`text-xs mt-1 ${status === 'configured' ? 'text-green-400' : 'text-yellow-400'}`}>
            {status === 'configured' ? '✅ Configurado' : '⚠️ Pendiente'}
        </div>
    </div>
);
