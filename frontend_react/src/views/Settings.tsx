import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { YCloudSettings } from './YCloudSettings';
import { MetaSettings } from './MetaSettings';
import { MessageSquare, Copy, Check, Info, Globe, Smartphone, LayoutGrid } from 'lucide-react';

interface SettingsProps {
    initialTab?: 'integrations' | 'ycloud' | 'meta';
}

export const Settings: React.FC<SettingsProps> = ({ initialTab = 'integrations' }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'integrations' | 'ycloud' | 'meta'>(initialTab);
    const [copied, setCopied] = useState(false);
    const [apiBaseUrl, setApiBaseUrl] = useState('');

    useEffect(() => {
        // Dynamic API Base Detection (Protocol Omega)
        const currentHost = window.location.protocol + '//' + window.location.hostname;
        // If local, assume localhost:8000. If prod (easypanel), replace ui with api or service name
        let inferredApi = currentHost.replace('frontend', 'backend').replace('ui.', 'api.');

        // Localhost fallback
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            inferredApi = 'http://localhost:8000';
        } else if (currentHost.includes('platform-ui')) {
            inferredApi = currentHost.replace('platform-ui', 'orchestrator-service');
        }

        setApiBaseUrl(inferredApi);
    }, []);

    const webhookUrl = `${apiBaseUrl}/chat?tenant_id=${user?.tenant_id || 'UNKNOWN'}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="view active flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <LayoutGrid className="text-cyan-400" />
                    System Configuration
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 mb-6">
                <TabButton
                    active={activeTab === 'integrations'}
                    onClick={() => setActiveTab('integrations')}
                    icon={<Globe size={18} />}
                    label="Integrations"
                />
                <TabButton
                    active={activeTab === 'ycloud'}
                    onClick={() => setActiveTab('ycloud')}
                    icon={<Smartphone size={18} />}
                    label="YCloud (WhatsApp)"
                />
                <TabButton
                    active={activeTab === 'meta'}
                    onClick={() => setActiveTab('meta')}
                    icon={<Info size={18} />} // Meta Icon placeholder
                    label="Meta (Facebook/IG)"
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'integrations' && (
                    <div className="animate-fade-in max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Chatwoot Card */}
                            <div className="glass p-6 border-l-4 border-blue-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <MessageSquare size={100} />
                                </div>

                                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                    <MessageSquare className="text-blue-400" />
                                    Conexión Omnicanal
                                </h3>
                                <p className="text-sm text-slate-400 mb-6">
                                    Vincula Chatwoot para centralizar la atención humana. Usa este Webhook para recibir mensajes de todos los canales.
                                </p>

                                <div className="bg-black/50 rounded-lg p-4 border border-white/10 mb-4">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">
                                        Chatwoot Webhook URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                                            {webhookUrl}
                                        </code>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCopy}
                                    className={`w-full py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? 'URL Copiada' : 'Copiar URL de Conexión'}
                                </button>

                                <div className="mt-4 flex items-start gap-2 text-[10px] text-slate-500 bg-blue-500/5 p-2 rounded">
                                    <Info size={14} className="shrink-0 mt-[1px]" />
                                    <p>Este webhook incluye tu <strong>Tenant ID ({user?.tenant_id})</strong> para enrutar mensajes en el Búnker.</p>
                                </div>
                            </div>

                            {/* Placeholder for other integrations */}
                            <div className="glass p-6 border border-white/5 flex flex-col items-center justify-center text-center opacity-50">
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                                    <Globe size={32} className="text-slate-600" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Más Integraciones</h3>
                                <p className="text-sm text-slate-500">Próximamente: Slack, Discord, Email Relay.</p>
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
