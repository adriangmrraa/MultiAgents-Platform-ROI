import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { YCloudSettings } from './YCloudSettings';
import { MetaSettings } from './MetaSettings';
import { MessageSquare, Copy, Check, Info, Globe, Smartphone, LayoutGrid, Facebook, ShoppingBag } from 'lucide-react';

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
    const [connections, setConnections] = useState<any>(null);

    // Fetch Webhook Config & Connection Status
    useEffect(() => {
        const loadData = async () => {
            try {
                const [webhookData, detailsData] = await Promise.all([
                    fetchApi('/admin/integrations/chatwoot/config'),
                    fetchApi(`/admin/tenants/${import.meta.env.VITE_DEFAULT_TENANT_ID || 1}/details`)
                ]);
                setWebhookConfig(webhookData);
                setConnections(detailsData?.connections);
            } catch (err) {
                console.error("Settings data fetch error:", err);
            }
        };

        if (activeTab === 'integrations' && (!webhookConfig || !connections)) {
            loadData();
        }
    }, [activeTab, fetchApi, webhookConfig, connections]);

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

    const connectTiendaNube = () => {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID || 1;

        // Tienda Nube Service URL (Sovereign Service)
        // Default to Prod URL provided by user if Env Var is missing
        let serviceUrl = import.meta.env.VITE_TIENDANUBE_SERVICE_URL || "https://multiagents-tiendanube-service.yn8wow.easypanel.host";

        // Remove trailing slash if present to avoid double slashes
        serviceUrl = serviceUrl.replace(/\/$/, '');

        // Auth Path: /auth/login (Matching the /auth/callback structure)
        const url = `${serviceUrl}/auth/login?tenant_id=${tenantId}`;

        console.log("Launching Tienda Nube Auth:", url);
        window.open(url, "TiendaNubeLogin", `width=${width},height=${height},top=${top},left=${left}`);

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'TIENDANUBE_SUCCESS') {
                console.log("Tienda Nube Connected!");
                // Refresh connections data to show "Connected" status
                window.location.reload();
                window.removeEventListener('message', handleMessage);
            }
        };
        window.addEventListener("message", handleMessage);
    };

    const [showManualTn, setShowManualTn] = useState(false);

    const handleManualConnect = async () => {
        const token = (document.getElementById('tn_manual_token') as HTMLInputElement).value;
        const id = (document.getElementById('tn_manual_id') as HTMLInputElement).value;

        if (!token || !id) return alert("Completa ambos campos");

        try {
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    tenant_id: import.meta.env.VITE_DEFAULT_TENANT_ID || 1,
                    category: 'tiendanube',
                    name: 'TIENDANUBE_ACCESS_TOKEN',
                    value: token
                }
            });
            await fetchApi('/admin/credentials', {
                method: 'POST',
                body: {
                    tenant_id: import.meta.env.VITE_DEFAULT_TENANT_ID || 1,
                    category: 'tiendanube',
                    name: 'TIENDANUBE_USER_ID',
                    value: id
                }
            });
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error guardando credenciales");
        }
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
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.meta_omnichannel?.configured ? 'text-green-400' : 'text-slate-500'}`}>
                                        {connections?.meta_omnichannel?.configured ? 'Activo' : 'Pendiente'}
                                    </span>
                                    <button
                                        onClick={() => setActiveTab('meta')}
                                        className="text-xs font-bold text-[#1877F2] hover:underline"
                                    >
                                        {connections?.meta_omnichannel?.configured ? 'Gestionar' : 'Configurar'}
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

                            {/* Tienda Nube Card */}
                            <div className="glass p-6 border-l-4 border-[#2D3278] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <ShoppingBag size={80} />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-[#2D3278]/10 flex items-center justify-center text-[#2D3278] dark:text-indigo-400">
                                        <ShoppingBag size={20} />
                                    </div>
                                    <h3 className="font-bold">Tienda Nube</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">Sincronización de catálogo y órdenes.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.tiendanube?.configured ? 'text-green-400' : 'text-slate-500'}`}>
                                        {connections?.tiendanube?.configured ? 'Conectado' : 'Pendiente'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            const el = document.getElementById('tiendanube-config');
                                            el?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="text-xs font-bold text-indigo-400 hover:underline"
                                    >
                                        Configurar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tienda Nube Configuration Section */}
                        <div id="tiendanube-config" className="mt-12 max-w-2xl bg-[#2D3278]/5 rounded-xl border border-[#2D3278]/20 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-300">
                                <ShoppingBag size={20} />
                                Configuración Tienda Nube
                            </h3>

                            <div className="flex flex-col gap-6">
                                {/* Auto Mode */}
                                <div className="bg-black/20 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-white">Conexión Automática (Recomendado)</h4>
                                        <p className="text-xs text-slate-400 mt-1">Inicia sesión con tu cuenta de Tienda Nube para vincular.</p>
                                    </div>
                                    <button
                                        onClick={connectTiendaNube}
                                        className="bg-[#2D3278] hover:bg-[#2D3278]/80 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                                    >
                                        Conectar Ahora
                                    </button>
                                </div>

                                {/* Manual Mode Toggle */}
                                <div>
                                    <button
                                        onClick={() => setShowManualTn(!showManualTn)}
                                        className="text-xs text-slate-500 hover:text-white underline decoration-dashed underline-offset-4"
                                    >
                                        {showManualTn ? 'Ocultar configuración manual' : '¿Prefieres ingresar credenciales manualmente?'}
                                    </button>

                                    {showManualTn && (
                                        <div className="mt-4 space-y-4 animate-fade-in bg-black/40 p-4 rounded-lg border border-white/5">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 block mb-1">Access Token</label>
                                                <input
                                                    type="password"
                                                    placeholder="bearer token..."
                                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                                                    id="tn_manual_token"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 block mb-1">Store ID (User ID)</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: 123456"
                                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                                                    id="tn_manual_id"
                                                />
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={handleManualConnect}
                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded transition-colors"
                                                >
                                                    Guardar Credenciales
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
