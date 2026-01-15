import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { YCloudSettings } from './YCloudSettings';
import { MetaSettings } from './MetaSettings';
import { MessageSquare, Copy, Check, Info, Globe, Smartphone, LayoutGrid, Facebook } from 'lucide-react';

interface SettingsProps {
    initialTab?: 'integrations' | 'ycloud' | 'meta';
}

import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
    initialTab?: 'integrations' | 'ycloud' | 'meta';
}

export const Settings: React.FC<SettingsProps> = ({ initialTab = 'integrations' }) => {
    const { t, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<'integrations' | 'ycloud' | 'meta'>(initialTab);
    const [copied, setCopied] = useState(false);
    const { fetchApi } = useApi();
    const [webhookConfig, setWebhookConfig] = useState<{ webhook_path: string, access_token: string, api_base?: string } | null>(null);

    // Fetch Webhook Config (Secure)
    useEffect(() => {
        if (activeTab === 'integrations' && !webhookConfig) {
            fetchApi('/admin/integrations/chatwoot/config')
                .then(data => setWebhookConfig(data))
                .catch(err => console.error("Webhook fetch error:", err));
        }
    }, [activeTab, fetchApi, webhookConfig]);

    // Construct Webhook URL for Chatwoot
    const getDisplayUrl = () => {
        if (!webhookConfig) return t('common.loading');

        if (webhookConfig.api_base) {
            return `${webhookConfig.api_base}${webhookConfig.webhook_path}?access_token=${webhookConfig.access_token}`;
        }

        const envBase = import.meta.env.VITE_API_BASE_URL;
        if (envBase) {
            return `${envBase}${webhookConfig.webhook_path}?access_token=${webhookConfig.access_token}`;
        }

        return `${window.location.origin}/api${webhookConfig.webhook_path}?access_token=${webhookConfig.access_token}`;
    };

    const webhookUrl = getDisplayUrl();

    const handleCopy = () => {
        if (!webhookUrl || webhookUrl === t('common.loading')) return;
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="view active flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <LayoutGrid className="text-cyan-400" />
                    {t('settings.title')}
                </h1>

                {/* Language Quick Switch */}
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setLanguage('es')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'es' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        ES
                    </button>
                    <button
                        onClick={() => setLanguage('en')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        EN
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 mb-6">
                <TabButton
                    active={activeTab === 'integrations'}
                    onClick={() => setActiveTab('integrations')}
                    icon={<Globe size={18} />}
                    label={t('settings.integrations')}
                />
                <TabButton
                    active={activeTab === 'ycloud'}
                    onClick={() => setActiveTab('ycloud')}
                    icon={<Smartphone size={18} />}
                    label={t('settings.ycloud')}
                />
                <TabButton
                    active={activeTab === 'meta'}
                    onClick={() => setActiveTab('meta')}
                    icon={<Info size={18} />} // Meta Icon placeholder
                    label={t('settings.meta')}
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'integrations' && (
                    <div className="animate-fade-in max-w-5xl">
                        <div className="mb-8">
                            <h2 className="text-xl font-bold mb-2">Canales Conectados</h2>
                            <p className="text-sm text-slate-400">Gestiona la conectividad de todos tus puntos de contacto.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Meta Card */}
                            <div className="glass p-6 border-l-4 border-[#1877F2] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Facebook size={80} />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                                        <Facebook size={20} />
                                    </div>
                                    <h3 className="font-bold">Meta Omnichannel</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">Messenger, Instagram y WhatsApp Direct.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Activo</span>
                                    <button
                                        onClick={() => setActiveTab('meta')}
                                        className="text-xs font-bold text-[#1877F2] hover:underline"
                                    >
                                        Gestionar
                                    </button>
                                </div>
                            </div>

                            {/* Chatwoot Card */}
                            <div className="glass p-6 border-l-4 border-cyan-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <MessageSquare size={80} />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                        <MessageSquare size={20} />
                                    </div>
                                    <h3 className="font-bold">Chatwoot HQ</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">Sincronización vía Webhook Seguro.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Conectado</span>
                                    <button
                                        className="text-xs font-bold text-cyan-400 hover:underline"
                                        onClick={() => {
                                            // Manual scroll or find a way to focus the webhook section
                                            const el = document.getElementById('chatwoot-config');
                                            el?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                    >
                                        Configurar
                                    </button>
                                </div>
                            </div>

                            {/* YCloud Card */}
                            <div className="glass p-6 border-l-4 border-emerald-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Smartphone size={80} />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                        <Smartphone size={20} />
                                    </div>
                                    <h3 className="font-bold">YCloud (WhatsApp)</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">Relé oficial de alta capacidad.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pendiente</span>
                                    <button
                                        onClick={() => setActiveTab('ycloud')}
                                        className="text-xs font-bold text-emerald-400 hover:underline"
                                    >
                                        Configurar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Chatwoot Section Below Cards */}
                        <div id="chatwoot-config" className="mt-12 max-w-2xl">
                            <div className="glass p-6 border border-white/5">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    <MessageSquare className="text-cyan-400" size={20} />
                                    Configuración Chatwoot
                                </h3>
                                <p className="text-sm text-slate-400 mb-6">
                                    Para recibir mensajes de Chatwoot en esta plataforma, configura la siguiente URL de Webhook en tu panel de Chatwoot.
                                </p>

                                <div className="bg-black/50 rounded-lg p-4 border border-white/10 mb-4">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">
                                        URL del Webhook
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                                            {webhookUrl}
                                        </code>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCopy}
                                    className={`w-full py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? 'Copiado' : 'Copiar URL'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ycloud' && (
                    <div className="animate-fade-in">
                        <YCloudSettings />
                    </div>
                )}

                {activeTab === 'meta' && (
                    <div className="animate-fade-in">
                        <MetaSettings />
                    </div>
                )}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-t-lg flex items-center gap-2 text-sm font-medium transition-colors relative ${active ? 'text-white bg-white/5 border-t border-x border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
        {icon}
        {label}
        {active && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-[#09090b]" />}
        {/* Hack to blend bottom border */}
    </button>
);
