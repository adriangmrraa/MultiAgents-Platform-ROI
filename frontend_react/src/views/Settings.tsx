import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { WebSettings } from './WebSettings';
import { YCloudSettings } from './YCloudSettings';
import { MetaSettings } from './MetaSettings';
import { ChatwootSettings } from './ChatwootSettings';
import { MessageSquare, Info, Globe, Smartphone, LayoutGrid, Facebook, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
    initialTab?: 'integrations' | 'ycloud' | 'meta' | 'web' | 'chatwoot';
}

export const Settings: React.FC<SettingsProps> = ({ initialTab = 'integrations' }) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'integrations' | 'ycloud' | 'meta' | 'web' | 'chatwoot'>(initialTab);
    const { fetchApi } = useApi();
    const [connections, setConnections] = useState<any>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    const tenantId = user?.tenant_id || import.meta.env.VITE_DEFAULT_TENANT_ID || "1";
    const [selectedTenantId, setSelectedTenantId] = useState<string>(String(tenantId));

    // Fetch Connection Status
    useEffect(() => {
        const loadData = async () => {
            try {
                const detailsData = await fetchApi(`/admin/tenants/${tenantId}/details`);
                setConnections(detailsData?.connections);

                // Also fetch all tenants for the dropdown
                const tenantsData = await fetchApi('/admin/tenants');
                setTenants(tenantsData || []);
            } catch (err) {
                console.error("Settings data fetch error:", err);
            }
        };

        if (activeTab === 'integrations' && !connections) {
            loadData();
        }
    }, [activeTab, fetchApi, connections]);

    const connectTiendaNube = () => {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const tid = user?.tenant_id || import.meta.env.VITE_DEFAULT_TENANT_ID || 1;
        let serviceUrl = import.meta.env.VITE_TIENDANUBE_SERVICE_URL || "https://multiagents-tiendanube-service.yn8wow.easypanel.host";
        serviceUrl = serviceUrl.replace(/\/$/, '');
        const url = `${serviceUrl}/auth/login?tenant_id=${tid}`;
        window.open(url, "TiendaNubeLogin", `width=${width},height=${height},top=${top},left=${left}`);

        const handleMessage = (event: MessageEvent) => {
            // Validate origin to prevent cross-origin message forgery
            const allowedOrigin = serviceUrl.replace(/\/auth\/login.*/, '');
            if (event.origin !== allowedOrigin && event.origin !== window.location.origin) return;
            if (event.data?.type === 'TIENDANUBE_SUCCESS') {
                window.removeEventListener("message", handleMessage);
                window.location.reload();
            }
        };
        window.addEventListener("message", handleMessage);
        // Auto-cleanup after 5 minutes
        setTimeout(() => window.removeEventListener("message", handleMessage), 300000);
    };

    const [showManualTn, setShowManualTn] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [manualStoreId, setManualStoreId] = useState('');

    const handleManualConnect = async () => {
        const token = manualToken;
        const id = manualStoreId;
        if (!token || !id) return alert("Completa ambos campos");
        if (!selectedTenantId) return alert("Selecciona una tienda");

        try {
            // Consolidated v7.1.0 Endpoint (Backend handles encryption & Vault sync)
            await fetchApi(`/admin/tenants/${selectedTenantId}`, {
                method: 'PUT',
                body: { tiendanube_access_token: token, tiendanube_store_id: id }
            });
            window.location.reload();
        } catch (e) {
            alert("Error guardando credenciales");
        }
    };

    return (
        <div className="view active flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Globe className="text-accent" size={28} />
                        {t('settings.title')}
                    </h1>
                    <p className="text-secondary text-sm mt-1">{t('settings.integrations')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 mb-6 flex-shrink-0">
                <TabButton
                    active={activeTab === 'integrations'}
                    onClick={() => setActiveTab('integrations')}
                    icon={<Globe size={18} />}
                    label={t('settings.integrations')}
                />
                <TabButton
                    active={activeTab === 'web'}
                    onClick={() => setActiveTab('web')}
                    icon={<LayoutGrid size={18} />}
                    label="Web Chat"
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
                    icon={<Info size={18} />}
                    label={t('settings.meta')}
                />
                <TabButton
                    active={activeTab === 'chatwoot'}
                    onClick={() => setActiveTab('chatwoot')}
                    icon={<MessageSquare size={18} />}
                    label="Chatwoot"
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin">
                {activeTab === 'integrations' && (
                    <div className="animate-fade-in max-w-5xl pb-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Web Chat Card */}
                            <div className="glass p-6 border-l-4 border-violet-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Globe size={80} />
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
                                        <MessageSquare size={20} />
                                    </div>
                                    <h3 className="font-bold">Web Widget</h3>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">Chat flotante para tu sitio web.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.web_widget?.configured ? 'text-green-400' : 'text-slate-400'}`}>
                                        {connections?.web_widget?.configured ? 'Activo' : 'Disponible'}
                                    </span>
                                    <button onClick={() => setActiveTab('web')} className="text-xs font-bold text-violet-400 hover:underline">Configurar</button>
                                </div>
                            </div>

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
                                    <button onClick={() => setActiveTab('meta')} className="text-xs font-bold text-[#1877F2] hover:underline">
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
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.chatwoot?.configured ? 'text-cyan-400' : 'text-slate-500'}`}>
                                        {connections?.chatwoot?.configured ? 'Conectado' : 'Pendiente'}
                                    </span>
                                    <button onClick={() => setActiveTab('chatwoot')} className="text-xs font-bold text-cyan-400 hover:underline">Configurar</button>
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
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.ycloud?.configured ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {connections?.ycloud?.configured ? 'Conectado' : 'Pendiente'}
                                    </span>
                                    <button onClick={() => setActiveTab('ycloud')} className="text-xs font-bold text-emerald-400 hover:underline">Configurar</button>
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
                                <p className="text-xs text-slate-400 mb-6">Catálogo y órdenes.</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${connections?.tiendanube?.configured ? 'text-green-400' : 'text-slate-500'}`}>
                                        {connections?.tiendanube?.configured ? 'Conectado' : 'Pendiente'}
                                    </span>
                                    <button onClick={() => { document.getElementById('tiendanube-config')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-xs font-bold text-indigo-400 hover:underline">Configurar</button>
                                </div>
                            </div>
                        </div>

                        {/* Tienda Nube Config Block */}
                        <div id="tiendanube-config" className="mt-12 max-w-2xl bg-[#2D3278]/5 rounded-xl border border-[#2D3278]/20 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-300">
                                <ShoppingBag size={20} />
                                Configuración Tienda Nube
                            </h3>
                            <div className="flex flex-col gap-6">
                                <div className="bg-black/20 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-white">Conexión Automática</h4>
                                        <p className="text-xs text-slate-400 mt-1">Vincula tu tienda en segundos.</p>
                                    </div>
                                    <button onClick={connectTiendaNube} className="bg-[#2D3278] hover:bg-[#2D3278]/80 text-white px-4 py-2 rounded-lg font-bold text-sm">Conectar</button>
                                </div>
                                <div>
                                    <button onClick={() => setShowManualTn(!showManualTn)} className="text-xs text-slate-500 hover:text-white underline decoration-dashed">
                                        {showManualTn ? 'Ocultar manual' : '¿Ingreso manual de credenciales?'}
                                    </button>
                                    {showManualTn && (
                                        <div className="mt-4 space-y-4 bg-black/40 p-4 rounded-lg border border-white/5">
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase text-slate-500 font-bold">Seleccionar Tienda</label>
                                                <select
                                                    value={selectedTenantId}
                                                    onChange={(e) => setSelectedTenantId(e.target.value)}
                                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none"
                                                >
                                                    {tenants.map((tenant: any) => (
                                                        <option key={tenant.id} value={tenant.id}>{tenant.store_name} (ID: {tenant.id})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <input type="password" value={manualToken} onChange={e => setManualToken(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none" placeholder="Access Token" />
                                            <input type="text" value={manualStoreId} onChange={e => setManualStoreId(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none" placeholder="Store ID" />
                                            <button onClick={handleManualConnect} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded">Guardar</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chatwoot' && (
                    <div className="animate-fade-in max-w-5xl pb-10">
                        <ChatwootSettings />
                    </div>
                )}

                {activeTab === 'web' && <div className="animate-fade-in"><WebSettings /></div>}
                {activeTab === 'ycloud' && (<div className="animate-fade-in"><YCloudSettings /></div>)}
                {activeTab === 'meta' && (<div className="animate-fade-in"><MetaSettings /></div>)}
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
    </button>
);
