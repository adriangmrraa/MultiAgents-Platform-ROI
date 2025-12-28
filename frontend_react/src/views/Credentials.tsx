import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { Key, Globe, Store, Trash2, Edit2, Plus } from 'lucide-react';

interface Credential {
    id?: number;
    name: string;
    value: string;
    category: string;
    description: string;
    scope: 'global' | 'tenant';
    tenant_id?: number | null;
}

interface Tenant {
    id: number;
    store_name: string;
}

export const Credentials: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCred, setEditingCred] = useState<Credential | null>(null);

    // Form State
    const [formData, setFormData] = useState<Credential>({
        name: '',
        value: '',
        category: 'openai',
        description: '',
        scope: 'global',
        tenant_id: null
    });

    // SMTP Form State
    const [smtpData, setSmtpData] = useState({ host: '', port: '587', user: '', pass: '' });

    const loadData = async () => {
        try {
            const [credsData, tenantsData] = await Promise.all([
                fetchApi('/admin/credentials'),
                fetchApi('/admin/tenants')
            ]);

            if (Array.isArray(credsData)) {
                setCredentials(credsData);
            } else {
                console.error("Invalid credentials data:", credsData);
                setCredentials([]);
            }

            if (Array.isArray(tenantsData)) {
                setTenants(tenantsData);
            } else {
                console.error("Invalid tenants data:", tenantsData);
                setTenants([]);
            }
        } catch (e) {
            console.error("Failed to load credentials/tenants", e);
            // Don't crash the UI, use empty
            setCredentials([]);
            setTenants([]);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCred?.id) {
                // Update logic would go here if backend supported PUT /credentials/{id}
                // For now assuming the backend might only have POST/DELETE or I need to check admin_routes
                // Based on app.js, it seems we might just recreate or update.
                // Actually app.js didn't have explicit update for credentials, just create/delete?
                // Wait, editCredential in app.js fetches data but where does it save?
                // Ah, it populates the form which submits to /admin/credentials (POST).
                // So POST handles both create and update (upsert) or just create?
                // Logic in app.js: "const res = await adminFetch('/admin/credentials', 'POST', data);"
                // So it's a POST.
                // If SMTP, pack into value
                let submissionData = { ...formData };
                if (formData.category === 'smtp') {
                    submissionData.value = JSON.stringify(smtpData);
                }
                await fetchApi('/admin/credentials', { method: 'POST', body: submissionData });
            } else {
                let submissionData = { ...formData };
                if (formData.category === 'smtp') {
                    submissionData.value = JSON.stringify(smtpData);
                }
                await fetchApi('/admin/credentials', { method: 'POST', body: submissionData });
            }
            setIsModalOpen(false);
            loadData();
        } catch (e) {
            alert('Error al guardar credencial: ' + e.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar credencial?')) return;
        try {
            await fetchApi(`/admin/credentials/${id}`, { method: 'DELETE' });
            loadData();
        } catch (e) {
            alert('Error al eliminar: ' + e.message);
        }
    };

    const openEdit = (cred: Credential) => {
        setEditingCred(cred);
        setFormData(cred);

        if (cred.category === 'smtp') {
            try {
                const parsed = JSON.parse(cred.value);
                setSmtpData({
                    host: parsed.host || '',
                    port: parsed.port || '587',
                    user: parsed.user || '',
                    pass: parsed.pass || ''
                });
            } catch {
                setSmtpData({ host: '', port: '587', user: '', pass: '' });
            }
        }

        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingCred(null);
        setFormData({
            name: '',
            value: '',
            category: 'openai',
            description: '',
            scope: 'global',
            tenant_id: null
        });
        setIsModalOpen(true);
    };

    return (
        <div className="view active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="view-title" style={{ margin: 0 }}>Gestión de Credenciales</h1>
                <button className="btn-primary" onClick={openNew}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nueva Credencial
                </button>
            </div>

            <div className="glass" style={{ padding: '20px' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Globe size={18} color="var(--accent)" /> Globales (Heredadas)
                </h3>
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {credentials.filter(c => c.scope === 'global').map(cred => (
                        <div key={cred.id} className="stat-card" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ fontWeight: 600 }}>{cred.name}</span>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>{cred.category}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '15px', fontFamily: 'monospace' }}>
                                ••••••••••••••••
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(cred)}><Edit2 size={12} /></button>
                                <button className="btn-delete" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(cred.id!)}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '20px', marginTop: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Store size={18} color="var(--success)" /> Específicas por Tienda
                </h3>
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {credentials.filter(c => c.scope === 'tenant').map(cred => (
                        <div key={cred.id} className="stat-card" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ fontWeight: 600 }}>{cred.name}</span>
                                <span style={{ fontSize: '11px', background: 'rgba(0, 230, 118, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '10px' }}>
                                    {tenants.find(t => t.id === cred.tenant_id)?.store_name || 'Tienda Desconocida'}
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '15px', fontFamily: 'monospace' }}>
                                ••••••••••••••••
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(cred)}><Edit2 size={12} /></button>
                                <button className="btn-delete" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(cred.id!)}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCred ? 'Editar Credencial' : 'Nueva Credencial'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre Identificador</label>
                        <input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: OpenAI Key Principal"
                        />
                    </div>

                    {formData.category === 'smtp' ? (
                        <div className="p-3 bg-white/5 rounded mb-4 border border-white/10">
                            <h5 className="text-xs font-bold text-accent mb-2">Configuración SMTP</h5>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Host</label>
                                    <input value={smtpData.host} onChange={e => setSmtpData({ ...smtpData, host: e.target.value })} placeholder="smtp.gmail.com" />
                                </div>
                                <div className="form-group">
                                    <label>Puerto</label>
                                    <input value={smtpData.port} onChange={e => setSmtpData({ ...smtpData, port: e.target.value })} placeholder="587" />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Usuario</label>
                                    <input value={smtpData.user} onChange={e => setSmtpData({ ...smtpData, user: e.target.value })} placeholder="email@dominio.com" />
                                </div>
                                <div className="form-group">
                                    <label>Contraseña</label>
                                    <input type="password" value={smtpData.pass} onChange={e => setSmtpData({ ...smtpData, pass: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Valor (Token/Key)</label>
                            <input
                                required
                                type="password"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                placeholder="sk-..."
                            />
                        </div>
                    )}
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Categoría</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="whatsapp_cloud">WhatsApp Cloud API</option>
                                <option value="tiendanube">Tienda Nube</option>
                                <option value="database">Database</option>
                                <option value="smtp">SMTP (Email)</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Alcance (Scope)</label>
                            <select
                                value={formData.scope}
                                onChange={e => setFormData({ ...formData, scope: e.target.value as 'global' | 'tenant' })}
                            >
                                <option value="global">Global (Todas las tiendas)</option>
                                <option value="tenant">Específico por Tienda</option>
                            </select>
                        </div>
                    </div>

                    {formData.scope === 'tenant' && (
                        <div className="form-group">
                            <label>Asignar a Tienda</label>
                            <select
                                required
                                value={formData.tenant_id?.toString() || ''}
                                onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}
                            >
                                <option value="">Seleccionar Tienda...</option>
                                {tenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.store_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Descripción (Opcional)</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar Credencial</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
