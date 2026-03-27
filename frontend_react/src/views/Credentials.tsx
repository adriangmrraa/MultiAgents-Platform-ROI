import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { Globe, Store, Trash2, Edit2, Plus, Key, Shield, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Credential {
    id?: number;
    name: string;
    user_label?: string;
    credential_type_id?: number;
    value: string;
    category: string;
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
    const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCred, setEditingCred] = useState<Credential | null>(null);
    const [formData, setFormData] = useState<Credential>({
        name: '', user_label: '', credential_type_id: undefined, value: '',
        category: 'openai', description: '', scope: 'global', tenant_id: null
    });
    const [smtpData, setSmtpData] = useState({ host: '', port: '587', user: '', pass: '' });

    const loadData = async () => {
        try {
            const [credsData, tenantsData, typesData] = await Promise.all([
                fetchApi('/admin/credentials'),
                fetchApi('/admin/tenants'),
                fetchApi('/admin/credential-types')
            ]);
            if (Array.isArray(credsData)) setCredentials(credsData); else setCredentials([]);
            if (Array.isArray(tenantsData)) setTenants(tenantsData); else setTenants([]);
            if (typesData?.providers) {
                const allTypes: CredentialType[] = [];
                typesData.providers.forEach((provider: any) => { provider.types.forEach((type: CredentialType) => { allTypes.push(type); }); });
                setCredentialTypes(allTypes);
            } else setCredentialTypes([]);
        } catch (e) {
            console.error("Failed to load credentials/tenants/types", e);
            setCredentials([]); setTenants([]); setCredentialTypes([]);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let submissionData = { ...formData };
            if (formData.category === 'smtp') submissionData.value = JSON.stringify(smtpData);
            await fetchApi('/admin/credentials', { method: 'POST', body: submissionData });
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
            try { const parsed = JSON.parse(cred.value); setSmtpData({ host: parsed.host || '', port: parsed.port || '587', user: parsed.user || '', pass: parsed.pass || '' }); }
            catch { setSmtpData({ host: '', port: '587', user: '', pass: '' }); }
        }
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingCred(null);
        setFormData({ name: '', user_label: '', credential_type_id: undefined, value: '', category: 'openai', description: '', scope: 'global', tenant_id: null });
        setIsModalOpen(true);
    };

    const selectedType = credentialTypes.find(ct => ct.id === formData.credential_type_id);

    const CredCard = ({ cred }: { cred: Credential }) => (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-white/15 transition-colors group">
            <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm text-white">{cred.user_label || cred.name}</span>
                <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full font-mono">{cred.category}</span>
            </div>
            <div className="text-xs text-gray-600 font-mono mb-3 tracking-wider">••••••••••••••••</div>
            {cred.scope === 'tenant' && (
                <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mb-3 border border-emerald-500/20">
                    {tenants.find(t => t.id === cred.tenant_id)?.store_name || 'Tienda'}
                </div>
            )}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(cred)} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-all">
                    <Edit2 size={12} /> Editar
                </button>
                <button onClick={() => cred.id !== undefined && handleDelete(cred.id)} className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs transition-all">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                        <Key size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">{t('credentials.title')}</h1>
                        <p className="text-xs text-gray-500">API keys y tokens de integracion</p>
                    </div>
                </div>
                <button onClick={openNew} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                    <Plus size={16} /> {t('credentials.newCredential')}
                </button>
            </div>

            {/* Global Section */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                    <Globe size={16} className="text-purple-400" /> {t('credentials.global')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {credentials.filter(c => c.scope === 'global').map(cred => <CredCard key={cred.id} cred={cred} />)}
                    {credentials.filter(c => c.scope === 'global').length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-600 text-sm">No hay credenciales globales configuradas.</div>
                    )}
                </div>
            </div>

            {/* Tenant Section */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                    <Store size={16} className="text-emerald-400" /> {t('credentials.tenant')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {credentials.filter(c => c.scope === 'tenant').map(cred => <CredCard key={cred.id} cred={cred} />)}
                    {credentials.filter(c => c.scope === 'tenant').length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-600 text-sm">No hay credenciales por tienda configuradas.</div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCred ? t('common.edit') + ' ' + t('credentials.identifier') : t('credentials.newCredential')}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tipo de Credencial *</label>
                        <select required
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            value={formData.credential_type_id || ''}
                            onChange={e => {
                                const typeId = parseInt(e.target.value);
                                const type = credentialTypes.find(ct => ct.id === typeId);
                                setFormData({ ...formData, credential_type_id: typeId, name: type?.internal_key || '', category: type?.internal_key.split('_')[0].toLowerCase() || 'other' });
                            }}
                        >
                            <option value="" className="bg-[#09090b]">Selecciona un tipo...</option>
                            {credentialTypes.map(type => (
                                <option key={type.id} value={type.id} className="bg-[#09090b]">{type.display_name} {type.is_required && '(Requerido)'}</option>
                            ))}
                        </select>
                        {selectedType && <p className="text-[11px] text-gray-500 mt-1">{selectedType.description}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Etiqueta (Opcional)</label>
                        <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                            value={formData.user_label || ''} onChange={e => setFormData({ ...formData, user_label: e.target.value })} placeholder="Ej: Mi API Key de Pruebas" />
                    </div>

                    {formData.category === 'smtp' ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                            <h5 className="text-xs font-bold text-purple-400 mb-2">{t('credentials.smtpConfig')}</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Host</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" value={smtpData.host} onChange={e => setSmtpData({ ...smtpData, host: e.target.value })} placeholder="smtp.gmail.com" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Puerto</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" value={smtpData.port} onChange={e => setSmtpData({ ...smtpData, port: e.target.value })} placeholder="587" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Usuario</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" value={smtpData.user} onChange={e => setSmtpData({ ...smtpData, user: e.target.value })} placeholder="email@dominio.com" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Contrasena</label>
                                    <input type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" value={smtpData.pass} onChange={e => setSmtpData({ ...smtpData, pass: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('credentials.value')}</label>
                            <input required type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} placeholder="sk-..." />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('credentials.category')}</label>
                            <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                {['openai', 'google', 'whatsapp_cloud', 'tiendanube', 'chatwoot', 'database', 'smtp', 'other'].map(cat => (
                                    <option key={cat} value={cat} className="bg-[#09090b]">{cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('credentials.scope')}</label>
                            <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                value={formData.scope} onChange={e => setFormData({ ...formData, scope: e.target.value as 'global' | 'tenant' })}>
                                <option value="global" className="bg-[#09090b]">Global</option>
                                <option value="tenant" className="bg-[#09090b]">Por Tienda</option>
                            </select>
                        </div>
                    </div>

                    {formData.scope === 'tenant' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('credentials.assignToStore')}</label>
                            <select required className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                value={formData.tenant_id?.toString() || ''} onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}>
                                <option value="" className="bg-[#09090b]">Seleccionar Tienda...</option>
                                {tenants.map(t => <option key={t.id} value={t.id} className="bg-[#09090b]">{t.store_name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('credentials.description')}</label>
                        <textarea className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
