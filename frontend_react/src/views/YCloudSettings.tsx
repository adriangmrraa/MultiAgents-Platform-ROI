import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Save, ExternalLink, Smartphone, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const YCloudSettings: React.FC = () => {
    const { t } = useLanguage();
    const { fetchApi, loading } = useApi();
    const [apiKey, setApiKey] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [apiBaseUrl, setApiBaseUrl] = useState('');
    const [status, setStatus] = useState<'loading' | 'configured' | 'missing'>('loading');

    // Load existing credentials
    useEffect(() => {
        const load = async () => {
            try {
                // Determine API Base URL for Webhook display
                // If VITE_API_BASE_URL is relative or empty, we construct it from window.location
                // But typically for the user we want the PUBLIC domain.
                // We'll trust the current hostname for now or what the backend reports.
                const currentHost = window.location.protocol + '//' + window.location.hostname;
                // Replace 'ui' with 'api' if needed, or append /api if running on same domain
                let inferredApi = currentHost.replace('platform-ui', 'orchestrator-service').replace('ui.', 'api.');
                if (window.location.hostname === 'localhost') inferredApi = 'http://localhost:8000';
                setApiBaseUrl(inferredApi);

                // Fetch Credentials specifically for YCloud
                const creds: any[] = await fetchApi('/admin/credentials');
                const key = creds.find(c => c.category === 'whatsapp_cloud' && c.name === 'YCloud API Key');
                const secret = creds.find(c => c.category === 'whatsapp_cloud' && c.name === 'YCloud Webhook Secret');

                if (key) setApiKey(key.value);
                if (secret) setWebhookSecret(secret.value);

                if (key && secret) setStatus('configured');
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
            // Save API Key (Credential Architecture v2)
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    credential_type_id: 10,  // YCLOUD_API_KEY
                    user_label: 'YCloud API Key',
                    name: 'YCloud API Key', // REQUIRED by backend
                    category: 'whatsapp_cloud', // REQUIRED by backend
                    value: apiKey,
                    description: 'Main API Key for YCloud Integration',
                    scope: 'global'
                }
            });

            // Save Webhook Secret (using legacy name-based approach for now)
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    name: 'YCloud Webhook Secret',
                    value: webhookSecret,
                    category: 'whatsapp_cloud',
                    description: 'Secret for validating YCloud Webhooks',
                    scope: 'global'
                }
            });

            alert(t('ycloudSettings.saveSuccess'));
            setStatus('configured');
        } catch (e: any) {
            alert(t('ycloudSettings.saveError') + ': ' + e.message);
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">{t('ycloudSettings.title')}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuration Form */}
                <div className="glass p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                            <Smartphone size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">{t('ycloudSettings.credentials')}</h2>
                            <p className="text-sm text-secondary">{t('ycloudSettings.credentialsDesc')}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="form-group">
                            <label className="block text-sm font-medium mb-1">{t('ycloudSettings.apiKey')}</label>
                            <input
                                type="password"
                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder={t('ycloudSettings.apiKeyPlaceholder')}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium mb-1">{t('ycloudSettings.webhookSecret')}</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-accent outline-none"
                                value={webhookSecret}
                                onChange={e => setWebhookSecret(e.target.value)}
                                placeholder={t('ycloudSettings.webhookSecretPlaceholder')}
                            />
                        </div>

                        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Save size={18} /> {t('ycloudSettings.saveConfig')}
                        </button>
                    </form>
                </div>

                {/* Status & Instructions */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className={`glass p-6 border-l-4 ${status === 'configured' ? 'border-green-500' : 'border-yellow-500'}`}>
                        <h3 className="text-lg font-bold mb-2">{t('ycloudSettings.statusTitle')}</h3>
                        {status === 'configured' ? (
                            <p className="text-green-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                {t('ycloudSettings.statusConfigured')}
                            </p>
                        ) : (
                            <p className="text-yellow-400 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {t('ycloudSettings.statusMissing')}
                            </p>
                        )}
                    </div>

                    {/* Webhook Info */}
                    <div className="glass p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <ExternalLink size={18} /> {t('ycloudSettings.webhookConfigTitle')}
                        </h3>
                        <p className="text-sm text-secondary mb-4">
                            {t('ycloudSettings.webhookConfigDesc')}
                        </p>

                        <div className="bg-black/40 p-3 rounded border border-white/10 font-mono text-xs break-all mb-4">
                            {apiBaseUrl}/webhooks/ycloud
                        </div>

                        <div className="text-xs text-secondary opacity-70">
                            <strong>{t('ycloudSettings.requiredEvents')}</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>message.received</li>
                                <li>message.sent</li>
                                <li>message.failed</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
