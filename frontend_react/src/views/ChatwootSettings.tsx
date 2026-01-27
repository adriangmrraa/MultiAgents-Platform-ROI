import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Save, ExternalLink, MessageSquare, AlertTriangle, Check, Copy, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const ChatwootSettings: React.FC = () => {
    const { t } = useLanguage();
    const { fetchApi, loading } = useApi();
    const [apiToken, setApiToken] = useState('');
    const [accountId, setAccountId] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState<'loading' | 'configured' | 'missing'>('loading');

    // Load existing credentials and webhook config
    useEffect(() => {
        const load = async () => {
            try {
                // 1. Fetch Webhook Config (Original logic)
                const webhookData = await fetchApi('/admin/integrations/chatwoot/config');
                if (webhookData) {
                    const envBase = import.meta.env.VITE_API_BASE_URL || '';
                    const apiBase = webhookData.api_base || envBase || window.location.origin;
                    setWebhookUrl(`${apiBase}${webhookData.webhook_path}?access_token=${webhookData.access_token}`);
                }

                // 2. Fetch Credentials specifically for Chatwoot
                const creds: any[] = await fetchApi('/admin/credentials');
                const token = creds.find(c => c.category === 'chatwoot' && c.name === 'CHATWOOT_API_TOKEN');
                const accId = creds.find(c => c.category === 'chatwoot' && c.name === 'CHATWOOT_ACCOUNT_ID');
                const base = creds.find(c => c.category === 'chatwoot' && c.name === 'CHATWOOT_BASE_URL');

                if (token) setApiToken(token.value);
                if (accId) setAccountId(accId.value);
                if (base) setBaseUrl(base.value);

                if (token && accId) setStatus('configured');
                else setStatus('missing');

            } catch (e) {
                console.error("Failed to load Chatwoot settings:", e);
                setStatus('missing');
            }
        };
        load();
    }, [fetchApi]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID || 1;

            // Save API Token
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    name: 'CHATWOOT_API_TOKEN',
                    value: apiToken,
                    category: 'chatwoot',
                    description: 'Tenant specific Chatwoot API Token',
                    scope: 'tenant',
                    tenant_id: tenantId
                }
            });

            // Save Account ID
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    name: 'CHATWOOT_ACCOUNT_ID',
                    value: accountId,
                    category: 'chatwoot',
                    description: 'Tenant specific Chatwoot Account ID',
                    scope: 'tenant',
                    tenant_id: tenantId
                }
            });

            // Save Base URL
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    name: 'CHATWOOT_BASE_URL',
                    value: baseUrl || 'https://app.chatwoot.com',
                    category: 'chatwoot',
                    description: 'Tenant specific Chatwoot Instance URL',
                    scope: 'tenant',
                    tenant_id: tenantId
                }
            });

            alert(t('chatwootSettings.saveSuccess'));
            setStatus('configured');
        } catch (e: any) {
            alert(t('chatwootSettings.saveError') + ': ' + e.message);
        }
    };

    const handleCopy = () => {
        if (!webhookUrl) return;
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="animate-fade-in max-w-5xl">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
                    <MessageSquare size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{t('chatwootSettings.title')}</h1>
                    <p className="text-secondary text-sm">{t('chatwootSettings.credentialsDesc')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column: Connection Form */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="glass p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                            <MessageSquare size={160} />
                        </div>

                        <form onSubmit={handleSave} className="space-y-6 relative">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-group">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        {t('chatwootSettings.apiToken')}
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-all placeholder:text-slate-600"
                                        value={apiToken}
                                        onChange={e => setApiToken(e.target.value)}
                                        placeholder={t('chatwootSettings.apiTokenPlaceholder')}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        {t('chatwootSettings.accountId')}
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-all placeholder:text-slate-600"
                                        value={accountId}
                                        onChange={e => setAccountId(e.target.value)}
                                        placeholder={t('chatwootSettings.accountIdPlaceholder')}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    {t('chatwootSettings.baseUrl')}
                                </label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-accent outline-none transition-all placeholder:text-slate-600"
                                        value={baseUrl}
                                        onChange={e => setBaseUrl(e.target.value)}
                                        placeholder={t('chatwootSettings.baseUrlPlaceholder')}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                disabled={loading}
                            >
                                <Save size={20} />
                                {t('chatwootSettings.saveConfig')}
                            </button>
                        </form>
                    </div>

                    {/* Integrated Webhook Info below form */}
                    <div className="glass p-8 border border-white/5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                                <ExternalLink size={18} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{t('chatwootSettings.webhookConfigTitle')}</h3>
                                <p className="text-sm text-secondary">{t('chatwootSettings.webhookConfigDesc')}</p>
                            </div>
                        </div>

                        <div className="bg-black/60 rounded-xl p-5 border border-white/5 space-y-3">
                            <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">
                                URL de Destino (para Chatwoot)
                            </label>
                            <div className="flex items-center gap-4">
                                <code className="text-sm text-emerald-400 font-mono break-all flex-1 selection:bg-emerald-500/30">
                                    {webhookUrl || t('common.loading')}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className={`p-3 rounded-lg transition-all flex-shrink-0 ${copied ? 'bg-green-500 text-white scale-110' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {copied ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 flex items-start gap-3 p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                            <AlertTriangle className="text-cyan-400 flex-shrink-0" size={18} />
                            <p className="text-xs text-cyan-400/80 leading-relaxed">
                                <strong>Importante:</strong> Los eventos deben incluir "Message Created". Asegúrate de que el token de acceso sea el correcto para que la plataforma pueda validar los envíos de tu instancia.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Status & Preview */}
                <div className="space-y-6">
                    <div className={`glass p-8 border-t-4 ${status === 'configured' ? 'border-emerald-500' : 'border-yellow-500'}`}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            {status === 'configured' ? <Check className="text-emerald-500" size={20} /> : <AlertTriangle className="text-yellow-500" size={20} />}
                            {t('chatwootSettings.statusTitle')}
                        </h3>
                        {status === 'configured' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-300">
                                    {t('chatwootSettings.statusConfigured')}
                                </p>
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Vínculo Activo
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-300">
                                {t('chatwootSettings.statusMissing')}
                            </p>
                        )}
                    </div>

                    <div className="glass p-8 bg-black/20">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Guía Rápida</h3>
                        <ul className="space-y-4">
                            {[
                                "Copia la URL del Webhook abajo",
                                "Ve a Chatwoot -> Ajustes -> Inboxes",
                                "Selecciona tu canal -> Webhooks",
                                "Pega la URL y guarda los cambios"
                            ].map((step, i) => (
                                <li key={i} className="flex gap-4 text-sm text-slate-300">
                                    <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">{i + 1}</span>
                                    {step}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
