import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { Store, ShoppingBag, Plus, Trash2, Edit2, CheckCircle, XCircle, Sparkles, HelpCircle, BookOpen, Wrench, Save } from 'lucide-react';

interface Tenant {
    id?: number;
    store_name: string;
    bot_phone_number: string;
    tiendanube_store_id?: string;
    tiendanube_access_token?: string;
    owner_email?: string;
    store_website?: string;
    store_description?: string;
    store_catalog_knowledge?: string;
    handoff_enabled?: boolean;
    handoff_target_email?: string;
}

export const Stores: React.FC = () => {
    const { fetchApi } = useApi();
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
        store_website: '',
        store_description: '',
        store_catalog_knowledge: ''
    });

    const [improving, setImproving] = useState<string | null>(null);

    const handleImprovePrompt = async (field: 'description' | 'catalog') => {
        const text = field === 'description' ? formData.store_description : formData.store_catalog_knowledge;
        if (!text) return;
        setImproving(field);
        try {
            const res = await fetchApi('/admin/ai/improve-prompt', { method: 'POST', body: { text, context: 'catalog' } });
            if (res.refined_text) {
                if (field === 'description') setFormData({ ...formData, store_description: res.refined_text });
                else setFormData({ ...formData, store_catalog_knowledge: res.refined_text });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setImproving(null);
        }
    };

    const loadTenants = async () => {
        try {
            const data = await fetchApi('/admin/tenants');
            if (Array.isArray(data)) {
                setTenants(data);
            } else {
                console.error("Invalid tenants data received:", data);
                setTenants([]); // Safe fallback to empty array
            }
        } catch (e) {
            console.error("Failed to load tenants", e);
            setTenants([]); // Safe fallback
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
            store_website: ''
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
                            <input required value={formData.bot_phone_number} onChange={e => setFormData({ ...formData, bot_phone_number: e.target.value })} placeholder="Ej: 54911..." />
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

                    <div className="form-group">
                        <label>Website URL</label>
                        <input value={formData.store_website} onChange={e => setFormData({ ...formData, store_website: e.target.value })} placeholder="https://..." />
                    </div>

                    <h4 style={{ color: 'var(--accent)', margin: '20px 0 10px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} /> Base de Conocimiento (IA/RAG)
                    </h4>

                    <div className="p-3 mb-4 rounded border border-accent/20 bg-accent/5 text-xs text-secondary-foreground leading-relaxed">
                        <strong className="text-accent underline">Guía Maestra:</strong> Para que el robot venda correctamente, usa las <strong>Categorías</strong> y <strong>Marcas</strong> exactas de tu tienda.
                        Ejemplo: "Vendo <em>Zapatillas</em> de marca <em>Adidas</em> y <em>Nike</em>". Esto permite que la IA construya búsquedas precisas (<code>q=Zapatillas Adidas</code>) en lugar de inventar términos.
                    </div>

                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Descripción del Negocio</label>
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '10px', height: 'auto' }}
                                onClick={() => handleImprovePrompt('description')}
                                disabled={improving !== null || !formData.store_description}
                            >
                                <Sparkles size={10} style={{ marginRight: '4px' }} />
                                {improving === 'description' ? 'Mejorando...' : 'IA: Refinar'}
                            </button>
                        </div>
                        <textarea
                            className="bg-black/40 border border-white/10 rounded p-2 text-sm text-white w-full h-24 outline-none"
                            value={formData.store_description}
                            onChange={e => setFormData({ ...formData, store_description: e.target.value })}
                            placeholder="Ej: Somos una tienda de moda sustentable..."
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Catálogo y Estructura Técnica
                                <HelpCircle size={14} style={{ opacity: 0.5 }} title="Lista aquí tipos de productos y marcas. Crucial para búsquedas precisas." />
                            </label>
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '10px', height: 'auto' }}
                                onClick={() => handleImprovePrompt('catalog')}
                                disabled={improving !== null || !formData.store_catalog_knowledge}
                            >
                                <Sparkles size={10} style={{ marginRight: '4px' }} />
                                {improving === 'catalog' ? 'Mejorando...' : 'IA: Refinar'}
                            </button>
                        </div>
                        <textarea
                            className="bg-black/40 border border-white/10 rounded p-2 text-sm text-white w-full h-32 outline-none"
                            value={formData.store_catalog_knowledge}
                            onChange={e => setFormData({ ...formData, store_catalog_knowledge: e.target.value })}
                            placeholder="Ej: Tenemos Botas, Sandalias y Zapatillas. Marcas: Nike, Adidas, Timberland."
                        />
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
                                <span className="text-accent/80">Nota: Configura el Host/Password SMTP desde el botón de herramientas <Wrench size={10} style={{ display: 'inline' }} /> en la lista de tiendas.</span>
                            </p>
                            <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs text-yellow-200">
                                <strong>Nota:</strong> Asegúrate de que las credenciales SMTP estén configuradas en las variables de entorno del servidor (TIENDANUBE_SERVICE_URL).
                            </div>
                        </div>
                    )}

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
