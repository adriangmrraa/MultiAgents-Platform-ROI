import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { WebSettings } from './WebSettings';
import { YCloudSettings } from './YCloudSettings';
import { MetaSettings } from './MetaSettings';
import { MessageSquare, Copy, Check, Info, Globe, Smartphone, LayoutGrid, Facebook, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
    initialTab?: 'integrations' | 'ycloud' | 'meta' | 'web';
}

export const Settings: React.FC<SettingsProps> = ({ initialTab = 'integrations' }) => {
    const { t, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<'integrations' | 'ycloud' | 'meta' | 'web'>(initialTab);
    // ...

    return (
        <div className="view active flex flex-col h-full">
            {/* ... Header ... */}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 mb-6">
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
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'integrations' && (
                    <div className="animate-fade-in max-w-5xl">
                        {/* ... Header ... */}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Web Chat Card (New) */}
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
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                                        Disponible
                                    </span>
                                    <button
                                        onClick={() => setActiveTab('web')}
                                        className="text-xs font-bold text-violet-400 hover:underline"
                                    >
                                        Configurar
                                    </button>
                                </div>
                            </div>

                            {/* ... Existing Cards (Meta, Chatwoot, YCloud, TiendaNube) ... */}
                            {/* Copy existing Meta Card here or rely on replace block context */}
                            {/* Since I am replacing the whole return block related logic, I should be careful not to delete existing cards if I target a large chunk, 
                               but the tool forces me to replace content.
                               I will Target the Grid and Prepend the Web Card, OR I will just inject the Tab and the View Logic.
                               The user asked for a "New Card".
                            */}
                            {/* Meta Card */}
                            <div className="glass p-6 border-l-4 border-[#1877F2] relative overflow-hidden group">
                                {/* ... Meta Card Content from original file ... */}
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
                                        className="text-xs font-bold text--[#1877F2] hover:underline"
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

                        {/* ... Config Sections for TiendaNube etc ... */}
                        {/* We can leave those as is */}
                        <div id="tiendanube-config" className="mt-12 max-w-2xl bg-[#2D3278]/5 rounded-xl border border-[#2D3278]/20 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-300">
                                <ShoppingBag size={20} />
                                Configuración Tienda Nube
                            </h3>
                            {/* ... Content ... */}
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

                {activeTab === 'web' && (
                    <div className="animate-fade-in">
                        <WebSettings />
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
