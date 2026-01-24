import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Copy, Check, Globe, Layout, MessageCircle, Palette } from 'lucide-react';

export const WebSettings: React.FC = () => {
    const { fetchApi } = useApi();
    const [config, setConfig] = useState({
        brand_color: '#8B5CF6',
        welcome_message: '¡Hola! ¿En qué puedo ayudarte hoy?',
        website_token: '',
        chatwoot_base_url: 'https://app.chatwoot.com'
    });
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            // Fetch cached web config or chatwoot creds
            // For now we might just load default or empty
            // Ideally fetch from a new endpoint GET /admin/tenants/web-config
            const data = await fetchApi('/admin/integrations/web/config');
            if (data) setConfig(prev => ({ ...prev, ...data }));
        } catch (e) {
            // ignore if not found
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetchApi('/admin/integrations/web/config', {
                method: 'POST',
                body: config
            });
            alert('Configuración guardada');
        } catch (e) {
            console.error(e);
            alert('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const scriptCode = `
<script>
  (function(d,t) {
    var BASE_URL="${config.chatwoot_base_url}";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSettings = {
        position: 'right',
        type: 'standard',
        launcherTitle: 'Chat'
      };
      window.chatwootSDK.run({
        websiteToken: '${config.website_token || 'TU_TOKEN_AQUI'}',
        baseUrl: BASE_URL
      });
    }
  })(document,"script");
</script>
`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(scriptCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-8">
                <div className="flex items-start gap-6">
                    <div className="bg-violet-600 p-4 rounded-xl shadow-lg shadow-violet-500/30">
                        <Globe size={32} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Web Chat Widget</h2>
                        <p className="text-slate-300 mb-6 max-w-xl">
                            Instala un chat de alta conversión en tu sitio web. Copia el código y pégalo en el HTML de tu tienda.
                            Compatible con Shopify, WordPress, TiendaNube, WooCommerce y sitios a medida.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Form */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Palette size={18} className="text-violet-400" />
                            Personalización
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Color de Marca</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={config.brand_color}
                                        onChange={e => setConfig({ ...config, brand_color: e.target.value })}
                                        className="h-10 w-20 rounded cursor-pointer bg-transparent border-none"
                                    />
                                    <input
                                        type="text"
                                        value={config.brand_color}
                                        onChange={e => setConfig({ ...config, brand_color: e.target.value })}
                                        className="flex-1 bg-white/5 border border-white/10 rounded px-3 text-sm text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Mensaje de Bienvenida</label>
                                <input
                                    type="text"
                                    value={config.welcome_message}
                                    onChange={e => setConfig({ ...config, welcome_message: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none transition-colors"
                                    placeholder="Hola, ¿cómo puedo ayudarte?"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Layout size={18} className="text-violet-400" />
                            Conexión (Chatwoot)
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Website Token</label>
                                <input
                                    type="text"
                                    value={config.website_token}
                                    onChange={e => setConfig({ ...config, website_token: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none transition-colors font-mono"
                                    placeholder="Pegue aquí el token de su Website Inbox"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Obténgalo en Ajustes {'>'} Bandejas de Entrada {'>'} Sitio Web {'>'} Configuración en su panel de Chatwoot.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Chatwoot Base URL</label>
                                <input
                                    type="text"
                                    value={config.chatwoot_base_url}
                                    onChange={e => setConfig({ ...config, chatwoot_base_url: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-violet-500 outline-none transition-colors"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview and Code */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-xl border border-white/5 bg-black/40">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Globe size={18} className="text-green-400" />
                                Código de Instalación
                            </h3>
                            <button
                                onClick={copyToClipboard}
                                className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all ${copied ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>

                        <div className="bg-[#0f0f0f] p-4 rounded-lg border border-white/5 overflow-x-auto relative group">
                            <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
                                {scriptCode.trim()}
                            </pre>
                        </div>

                        <div className="mt-4 flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <MessageCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-200">
                                <strong>Instrucciones:</strong> Copia este código y pégalo justo antes de la etiqueta <code>&lt;/body&gt;</code> en el código HTML de tu sitio web.
                            </p>
                        </div>
                    </div>

                    {/* Live Preview Mockup */}
                    <div className="relative h-64 bg-white rounded-xl overflow-hidden border border-white/10 opacity-90">
                        <div className="absolute top-0 w-full h-8 bg-gray-100 border-b flex items-center px-4 gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                            <div className="mx-auto w-32 h-4 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="flex items-center justify-center h-full text-gray-300 font-bold text-2xl tracking-widest">
                            TU SITIO WEB
                        </div>

                        {/* Fake Widget */}
                        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 animate-bounce-subtle">
                            <div className="bg-white text-black text-xs px-3 py-2 rounded-l-xl rounded-t-xl shadow-lg border border-gray-100 max-w-[150px]">
                                {config.welcome_message}
                            </div>
                            <div
                                style={{ backgroundColor: config.brand_color }}
                                className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white"
                            >
                                <MessageCircle size={24} fill="currentColor" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
