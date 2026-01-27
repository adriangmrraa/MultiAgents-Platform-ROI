import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { Globe, Store, Trash2, Edit2, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Credential {
    id?: number;
    name: string;  // DEPRECATED: Will be replaced by credential_type_id
    user_label?: string;  // NEW: Optional user-friendly label
    credential_type_id?: number;  // NEW: FK to credential_types
    value: string;
    category: string;  // DEPRECATED: Will be inferred from credential_type
    description: string;
    scope: 'global' | 'tenant';
    tenant_id?: number | null;
}

interface CredentialType {
    id: number;
    internal_key: string;
    display_name: string;
    description: string;
    is_required: boolean;
    field_type: string;
    placeholder: string;
}

interface Tenant {
    id: number;
    store_name: string;
}

export const Credentials: React.FC = () => {
    const { t } = useLanguage();
    const { fetchApi } = useApi();
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);  // NEW
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCred, setEditingCred] = useState<Credential | null>(null);

    // Form State
    const [formData, setFormData] = useState<Credential>({
        name: '',
        user_label: '',  // NEW
        credential_type_id: undefined,  // NEW
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
            const [credsData, tenantsData, typesData] = await Promise.all([
                fetchApi('/admin/credentials'),
                fetchApi('/admin/tenants'),
                fetchApi('/admin/credential-types')  // NEW
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

            // NEW: Load credential types
            if (typesData?.providers) {
                const allTypes: CredentialType[] = [];
                typesData.providers.forEach((provider: any) => {
                    provider.types.forEach((type: CredentialType) => {
                        allTypes.push(type);
                    });
                });
                setCredentialTypes(allTypes);
            } else {
                console.error("Invalid credential types data:", typesData);
                setCredentialTypes([]);
            }
        } catch (e) {
            console.error("Failed to load credentials/tenants/types", e);
            // Don't crash the UI, use empty
            setCredentials([]);
            setTenants([]);
            setCredentialTypes([]);
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
        } catch (e: any) {
            alert(t('credentials.saveError') + ': ' + e.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('credentials.deleteConfirm'))) return;
        try {
            await fetchApi(`/admin/credentials/${id}`, { method: 'DELETE' });
            loadData();
        } catch (e: any) {
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
            user_label: '',  // NEW
            credential_type_id: undefined,  // NEW
            value: '',
            category: 'openai',
            description: '',
            scope: 'global',
            tenant_id: null
        });
        setIsModalOpen(true);
    };

    // NEW: Get selected credential type details
    const selectedType = credentialTypes.find(t => t.id === formData.credential_type_id);

    return (
        <div className="view active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="view-title" style={{ margin: 0 }}>{t('credentials.title')}</h1>
                <button className="btn-primary" onClick={openNew}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    {t('credentials.newCredential')}
                </button>
            </div>

            <div className="glass" style={{ padding: '20px' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Globe size={18} color="var(--accent)" /> {t('credentials.global')}
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
                    <Store size={18} color="var(--success)" /> {t('credentials.tenant')}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCred ? t('common.edit') + ' ' + t('credentials.identifier') : t('credentials.newCredential')}>
                <form onSubmit={handleSubmit}>
                    {/* NEW: Credential Type Dropdown (Credential Architecture v2) */}
                    <div className="form-group">
                        <label>Tipo de Credencial *</label>
                        <select
                            required
                            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                            value={formData.credential_type_id || ''}
                            onChange={e => {
                                const typeId = parseInt(e.target.value);
                                const type = credentialTypes.find(t => t.id === typeId);
                                setFormData({
                                    ...formData,
                                    credential_type_id: typeId,
                                    name: type?.internal_key || '',  // Auto-fill internal name
                                    category: type?.internal_key.split('_')[0].toLowerCase() || 'other'  // Infer category
                                });
                            }}
                        >
                            <option value="" className="bg-gray-800 text-white">Selecciona un tipo...</option>
                            {credentialTypes.map(type => (
                                <option key={type.id} value={type.id} className="bg-gray-800 text-white">
                                    {type.display_name} {type.is_required && '(Requerido)'}
                                </option>
                            ))}
                        </select>
                        {selectedType && (
                            <p style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '5px' }}>
                                {selectedType.description}
                            </p>
                        )}
                    </div>

                    {/* NEW: Optional User Label */}
                    <div className="form-group">
                        <label>Etiqueta Personalizada (Opcional)</label>
                        <input
                            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                            value={formData.user_label || ''}
                            onChange={e => setFormData({ ...formData, user_label: e.target.value })}
                            placeholder="Ej: Mi API Key de Pruebas"
                        />
                        <p style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '5px' }}>
                            Nombre descriptivo para identificar esta credencial (solo para tu referencia)
                        </p>
                    </div>

                    {formData.category === 'smtp' ? (
                        <div className="p-3 bg-white/5 rounded mb-4 border border-white/10">
                            <h5 className="text-xs font-bold text-accent mb-2">{t('credentials.smtpConfig')}</h5>
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
                            <label>{t('credentials.value')}</label>
                            <input
                                required
                                type="password"
                                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                placeholder="sk-..."
                            />
                        </div>
                    )}
                    <div className="form-grid">
                        <div className="form-group">
                            <label>{t('credentials.category')}</label>
                            <select
                                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="openai" className="bg-gray-800 text-white">OpenAI</option>
                                <option value="google" className="bg-gray-800 text-white">Google AI (Gemini)</option>
                                <option value="whatsapp_cloud" className="bg-gray-800 text-white">WhatsApp Cloud API</option>
                                <option value="tiendanube" className="bg-gray-800 text-white">Tienda Nube</option>
                                <option value="chatwoot" className="bg-gray-800 text-white">Chatwoot</option>
                                <option value="database" className="bg-gray-800 text-white">Database</option>
                                <option value="smtp" className="bg-gray-800 text-white">SMTP (Email)</option>
                                <option value="other" className="bg-gray-800 text-white">Otro</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t('credentials.scope')}</label>
                            <select
                                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                                value={formData.scope}
                                onChange={e => setFormData({ ...formData, scope: e.target.value as 'global' | 'tenant' })}
                            >
                                <option value="global" className="bg-gray-800 text-white">Global (Todas las tiendas)</option>
                                <option value="tenant" className="bg-gray-800 text-white">Específico por Tienda</option>
                            </select>
                        </div>
                    </div>

                    {formData.scope === 'tenant' && (
                        <div className="form-group">
                            <label>{t('credentials.assignToStore')}</label>
                            <select
                                required
                                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                                value={formData.tenant_id?.toString() || ''}
                                onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}
                            >
                                <option value="" className="bg-gray-800 text-white">Seleccionar Tienda...</option>
                                {tenants.map(t => (
                                    <option key={t.id} value={t.id} className="bg-gray-800 text-white">{t.store_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>{t('credentials.description')}</label>
                        <textarea
                            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:border-accent outline-none"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                        <button type="submit" className="btn-primary">{t('common.save')}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
