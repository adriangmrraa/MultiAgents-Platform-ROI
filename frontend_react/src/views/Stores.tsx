import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/Modal';
import { ShoppingBag, Plus, Trash2, Edit2, CheckCircle, XCircle, Wrench, Save } from 'lucide-react';

interface Tenant {
    id?: number;
    store_name: string;
    bot_phone_number: string;
    tiendanube_store_id?: string;
    tiendanube_access_token?: string;
    owner_email?: string;
    handoff_enabled?: boolean;
    handoff_target_email?: string;
}

export const Stores: React.FC = () => {
    const { fetchApi } = useApi();
    const { user, refreshProfile } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

    // Tool Config State
    const [isToolModalOpen, setIsToolModalOpen] = useState(false);
    const [selectedTenantTools, setSelectedTenantTools] = useState<Tenant | null>(null);
    const [availableTools, setAvailableTools] = useState<any[]>([]);
    const [toolConfigs, setToolConfigs] = useState<Record<string, any>>({});
    const [loadingTools, setLoadingTools] = useState(false);

    const [formData, setFormData] = useState<Tenant>({
        store_name: '',
        bot_phone_number: '',
        tiendanube_store_id: '',
        tiendanube_access_token: '',
        owner_email: '',
        handoff_enabled: false,
        handoff_target_email: ''
    });

    const loadTenants = async () => {
        try {
            const data = await fetchApi('/admin/tenants');
            if (Array.isArray(data)) {
                setTenants(data);
            } else {
                console.error("Invalid tenants data received:", data);
                setTenants([]);
            }
        } catch (e) {
            console.error("Failed to load tenants", e);
            setTenants([]);
        }
    };

    useEffect(() => {
        loadTenants();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTenant && editingTenant.id) {
                // UPDATE (PUT)
                await fetchApi(`/admin/tenants/${editingTenant.id}`, { method: 'PUT', body: formData });
            } else {
                // CREATE (POST)
                await fetchApi('/admin/tenants', { method: 'POST', body: formData });
            }
            setIsModalOpen(false);
            loadTenants();
        } catch (e: any) {
            alert('Error al guardar tienda: ' + e.message);
        }
    };

    const handleDelete = async (tenantId: number) => {
        if (!confirm('¿Eliminar tienda y todos sus datos?')) return;
        try {
            await fetchApi(`/admin/tenants/${tenantId}`, { method: 'DELETE' });

            if (user?.tenant_id === tenantId) {
                console.log("Deleted active tenant. Refreshing profile...");
                await refreshProfile();
            }

            loadTenants();
        } catch (e: any) {
            alert('Error al eliminar: ' + e.message);
        }
    }

    const openEdit = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setFormData(tenant);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingTenant(null);
        setFormData({
            store_name: '',
            bot_phone_number: '',
            tiendanube_store_id: '',
            tiendanube_access_token: '',
            owner_email: '',
            handoff_enabled: false,
            handoff_target_email: ''
        });
        setIsModalOpen(true);
    };

    const openToolConfig = async (tenant: Tenant) => {
        setSelectedTenantTools(tenant);
        setLoadingTools(true);
        setIsToolModalOpen(true);
        try {
            const [toolsData, configData] = await Promise.all([
                fetchApi('/admin/tools'),
                fetchApi(`/admin/tenants/${tenant.id}/tools/config`)
            ]);
            setAvailableTools(toolsData || []);
            setToolConfigs(configData || {});
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingTools(false);
        }
    };

    const handleSaveToolConfig = async () => {
        if (!selectedTenantTools) return;
        try {
            await fetchApi(`/admin/tenants/${selectedTenantTools.id}/tools/config`, {
                method: 'POST',
                body: toolConfigs
            });
            setIsToolModalOpen(false);
        } catch (e) {
            alert('Error al guardar configuración de herramientas');
        }
    };


    return (
        <div className="view active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="view-title" style={{ margin: 0 }}>Hangar: Deployment Deck</h1>
                <button className="btn-primary" onClick={openNew}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nueva Tienda
                </button>
            </div>

            <div className="glass">
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tienda / Dueño</th>
                                <th>WhatsApp Bot</th>
                                <th>Tienda Nube ID</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => (
                                <tr key={t.id || t.bot_phone_number}>
                                    <td>
                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ShoppingBag size={14} color="var(--accent)" /> {t.store_name}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#a1a1aa', marginLeft: '22px' }}>{t.owner_email || 'Sin email'}</div>
                                    </td>
                                    <td>{t.bot_phone_number}</td>
                                    <td>{t.tiendanube_store_id || 'N/A'}</td>
                                    <td>
                                        {t.tiendanube_store_id ? (
                                            <span className="service-pill ok"><CheckCircle size={10} /> Conectado</span>
                                        ) : (
                                            <span className="service-pill error"><XCircle size={10} /> Sin Configurar</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => openEdit(t)} title="Editar"><Edit2 size={14} /></button>
                                            <button className="btn-secondary" style={{ padding: '6px', color: 'var(--accent)' }} onClick={() => openToolConfig(t)} title="Configurar Herramientas">
                                                <Wrench size={14} />
                                            </button>
                                            <button className="btn-delete" style={{ padding: '6px' }} onClick={() => handleDelete(t.id!)} title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {tenants.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                        No tienes tiendas configuradas. ¡Agrega la primera!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTenant ? 'Editar Tienda' : 'Nueva Tienda'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Nombre de la Tienda</label>
                            <input required value={formData.store_name} onChange={e => setFormData({ ...formData, store_name: e.target.value })} placeholder="Ej: Mi E-commerce" />
                        </div>
                        <div className="form-group">
                            <label>Teléfono del Bot (WhatsApp)</label>
                            <input required value={formData.bot_phone_number} onChange={e => setFormData({ ...formData, bot_phone_number: e.target.value })} placeholder="Ej: 5493704..." />
                            <p className="text-[10px] text-gray-500 mt-1">Usa el número real de WhatsApp (con código de país, sin el +). Este ID vincula tus registros locales.</p>
                        </div>
                    </div>

                    <h4 style={{ color: 'var(--accent)', margin: '20px 0 10px', fontSize: '14px' }}>Integración Tienda Nube</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Store ID</label>
                            <input type="number" value={formData.tiendanube_store_id} onChange={e => setFormData({ ...formData, tiendanube_store_id: e.target.value })} placeholder="123456" />
                        </div>
                        <div className="form-group">
                            <label>Access Token</label>
                            <input type="password" value={formData.tiendanube_access_token} onChange={e => setFormData({ ...formData, tiendanube_access_token: e.target.value })} placeholder="Token de API" />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <label>Email del Dueño</label>
                        <input value={formData.owner_email} onChange={e => setFormData({ ...formData, owner_email: e.target.value })} placeholder="admin@store.com" />
                    </div>

                    <h4 style={{ color: 'var(--accent)', margin: '20px 0 10px', fontSize: '14px' }}>Derivación a Humano (Gmail)</h4>
                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            checked={formData.handoff_enabled}
                            onChange={e => setFormData({ ...formData, handoff_enabled: e.target.checked })}
                        />
                        <label className="text-sm">Habilitar Handoff por Email</label>
                    </div>
                    {formData.handoff_enabled && (
                        <div className="form-group">
                            <label>Email de Destino (Gmail)</label>
                            <input
                                type="email"
                                value={formData.handoff_target_email || ''}
                                onChange={e => setFormData({ ...formData, handoff_target_email: e.target.value })}
                                placeholder="humano@mitienda.com"
                            />
                            <p className="text-xs text-secondary mt-1">
                                Se enviará un correo cuando el agente active la tool <code>derivhumano</code>.
                                <br />
                                <span className="text-accent/80 font-bold">Importante:</span> El sistema ahora es Soberano. Recuerda también vincular tu WABA ID en la sección de <strong>Canales</strong> para que el bot pueda responder.
                            </p>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-300">
                        ℹ️ <strong>Nota v7.0.4:</strong> La <strong>Descripción del Negocio</strong>, <strong>Catálogo</strong> y <strong>Website URL</strong> ahora se configuran directamente en el <strong>Agent Wizard</strong> para cada agente individual.
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar Tienda</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isToolModalOpen} onClose={() => setIsToolModalOpen(false)} title={`Configurar Herramientas: ${selectedTenantTools?.store_name}`}>
                <div style={{ marginBottom: '20px' }}>
                    <p className="text-secondary text-sm mb-4">
                        Aquí puedes personalizar cómo cada herramienta se comporta para esta tienda específica.
                        Estas instrucciones tienen prioridad sobre las globales.
                    </p>

                    {loadingTools ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>Cargando herramientas...</div>
                    ) : (
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }} className="custom-scrollbar">
                            {availableTools.map(tool => (
                                <div key={tool.name} className="glass p-4 mb-4 border-l-2 border-accent/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="font-bold text-accent">{tool.name}</h5>
                                        <span className="badge text-[10px]">{tool.type}</span>
                                    </div>
                                    <div className="form-group mb-3">
                                        <label className="text-[10px] uppercase opacity-60">Táctica Personalizada</label>
                                        <textarea
                                            rows={2}
                                            className="text-xs bg-black/20 border border-white/5 w-full p-2 rounded"
                                            value={toolConfigs[tool.name]?.tactical || ''}
                                            onChange={e => setToolConfigs({
                                                ...toolConfigs,
                                                [tool.name]: { ...toolConfigs[tool.name], tactical: e.target.value }
                                            })}
                                            placeholder="Ej: Para esta tienda, pide siempre el talle antes de buscar..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="text-[10px] uppercase opacity-60">Guía de Respuesta Personalizada</label>
                                        <textarea
                                            rows={2}
                                            className="text-xs bg-black/20 border border-white/5 w-full p-2 rounded"
                                            value={toolConfigs[tool.name]?.response_guide || ''}
                                            onChange={e => setToolConfigs({
                                                ...toolConfigs,
                                                [tool.name]: { ...toolConfigs[tool.name], response_guide: e.target.value }
                                            })}
                                            placeholder="Ej: Muestra el precio en cuotas sin interés si es posible..."
                                        />
                                    </div>

                                    {tool.name === 'derivhumano' && (
                                        <div className="mt-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-200">
                                            <strong>Nota:</strong> Para configurar el envío de correos (SMTP), crea una credencial tipo <code>SMTP</code> en la sección de Credenciales y asígnala a esta tienda.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setIsToolModalOpen(false)}>Cancelar</button>
                    <button type="button" className="btn-primary" onClick={handleSaveToolConfig}>
                        <Save size={14} className="mr-2" /> Guardar Configuración
                    </button>
                </div>
            </Modal>
        </div>
    );
};
