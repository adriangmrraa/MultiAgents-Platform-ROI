import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Save, ExternalLink, MessageCircle, AlertTriangle } from 'lucide-react';

export const MetaSettings: React.FC = () => {
    const { fetchApi } = useApi();
    const [token, setToken] = useState('');
    const [phoneId, setPhoneId] = useState('');
    const [businessId, setBusinessId] = useState('');
    const [webhookToken, setWebhookToken] = useState('');
    const [status, setStatus] = useState<'loading' | 'configured' | 'missing'>('loading');

    // Load existing credentials
    useEffect(() => {
        const load = async () => {
            try {
                const creds: any[] = await fetchApi('/admin/credentials');

                // Helper to find value
                const getVal = (name: string) => creds.find(c => c.category === 'meta_whatsapp' && c.name === name)?.value || '';

                const t = getVal('Meta User Token');
                const pid = getVal('Meta Phone ID');
                const bid = getVal('Meta Business ID');
                const wht = getVal('Meta Webhook Verify Token');

                setToken(t);
                setPhoneId(pid);
                setBusinessId(bid);
                setWebhookToken(wht);

                if (t && pid) setStatus('configured');
                else setStatus('missing');

            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, [fetchApi]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const save = (name: string, value: string) => fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    name,
                    value,
                    category: 'meta_whatsapp',
                    description: 'Meta WhatsApp Configuration',
                    scope: 'global'
                }
            });

            await Promise.all([
                save('Meta User Token', token),
                save('Meta Phone ID', phoneId),
                save('Meta Business ID', businessId),
                save('Meta Webhook Verify Token', webhookToken)
            ]);

            alert('Configuración guardada correctamente');
            setStatus('configured');
        } catch (e) {
            alert('Error al guardar: ' + e.message);
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">WhatsApp Meta Integration (Official)</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuration Form */}
                <div className="glass p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Configuración Meta</h2>
                            <p className="text-sm text-secondary">Acceso a Cloud API oficial</p>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="form-group">
                            <label className="block text-sm font-medium mb-1">Permanent Access Token</label>
                            <input
                                type="password"
                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                placeholder="EAAG..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="block text-sm font-medium mb-1">Phone Number ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                    value={phoneId}
                                    onChange={e => setPhoneId(e.target.value)}
                                    placeholder="100..."
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="block text-sm font-medium mb-1">Business ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                    value={businessId}
                                    onChange={e => setBusinessId(e.target.value)}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium mb-1">Webhook Verify Token</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                value={webhookToken}
                                onChange={e => setWebhookToken(e.target.value)}
                                placeholder="Token personalizado..."
                            />
                        </div>

                        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Save size={18} /> Guardar Configuración
                        </button>
                    </form>
                </div>

                {/* Status & Instructions */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className={`glass p-6 border-l-4 ${status === 'configured' ? 'border-green-500' : 'border-gray-500'}`}>
                        <h3 className="text-lg font-bold mb-2">Estado</h3>
                        {status === 'configured' ? (
                            <p className="text-green-400">
                                Credenciales guardadas.
                            </p>
                        ) : (
                            <p className="text-white/50">
                                Configura tus credenciales para activar.
                            </p>
                        )}
                    </div>

                    {/* Webhook Info */}
                    <div className="glass p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <ExternalLink size={18} /> Webhook Meta
                        </h3>

                        <div className="bg-black/40 p-3 rounded border border-white/10 font-mono text-xs break-all mb-4">
                            /webhooks/meta (Endpoint no implementado aún en backend)
                        </div>

                        <p className="text-xs text-yellow-400 flex items-center gap-2">
                            <AlertTriangle size={12} />
                            Actualmente el Backend soporta principalmente YCloud. Esta vista es para preparar la migración futura a Meta Oficial.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
