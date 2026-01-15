import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { MessageCircle, AlertTriangle, Facebook, Check, Loader2 } from 'lucide-react';

export const MetaSettings: React.FC = () => {
    const { fetchApi } = useApi();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [connectedAssets, setConnectedAssets] = useState<Record<string, boolean>>({});

    // 1. Initialize FB SDK
    useEffect(() => {
        // Load SDK asynchronously
        if (!(window as any).FB) {
            const script = document.createElement('script');
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.async = true;
            script.defer = true;
            script.crossOrigin = "anonymous";
            script.onload = () => {
                (window as any).FB.init({
                    appId: import.meta.env.VITE_META_APP_ID, // Ensure this is in .env
                    autoLogAppEvents: true,
                    xfbml: true,
                    version: 'v19.0'
                });
            };
            document.body.appendChild(script);
        }
    }, []);

    const handleLogin = () => {
        if (!(window as any).FB) return;

        setStatus('loading');
        (window as any).FB.login((response: any) => {
            if (response.authResponse) {
                console.log('FB Login Success', response);
                connectWithBackend(response.authResponse.accessToken);
            } else {
                console.log('User cancelled login or did not fully authorize.');
                setStatus('idle');
            }
        }, {
            scope: 'pages_show_list,pages_messaging,instagram_basic,instagram_manage_messages,business_management',
            override_default_response_type: true
        });
    };

    const connectWithBackend = async (shortToken: string) => {
        try {
            const res = await fetchApi('/admin/meta/connect', {
                method: 'POST',
                body: { short_lived_token: shortToken }
            });
            console.log("Meta Connect Result:", res);

            if (res.status === 'success') {
                setStatus('connected');
                setConnectedAssets(res.connected); // Storing the 'connected' flags map

                // Optional: Store detailed assets if needed later in another state
                // setAssetsDetails(res.assets);
            }
        } catch (e: any) {
            console.error("Backend Connect Error:", e);
            setStatus('error');
            setErrorMsg(e.message || "Error connecting to server");
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">Meta Uplink Protocol</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Connect Card */}
                <div className="glass p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-6 text-[#1877F2]">
                        <Facebook size={32} />
                    </div>

                    <h2 className="text-xl font-bold mb-2">Conectar con Meta</h2>
                    <p className="text-sm text-secondary mb-8 max-w-sm">
                        Vincula tu cuenta de Facebook para habilitar la mensajería automática en Messenger, Instagram y WhatsApp.
                    </p>

                    {status === 'loading' ? (
                        <button disabled className="btn-primary bg-[#1877F2] border-[#1877F2] opacity-80 flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> Sincronizando Activos...
                        </button>
                    ) : status === 'connected' ? (
                        <div className="flex flex-col items-center animate-fade-in w-full">
                            <div className="bg-green-500/10 text-green-400 px-4 py-2 rounded-lg flex items-center gap-2 mb-6">
                                <Check size={18} /> Conexión Exitosa
                            </div>

                            {/* Discovery Result Grid */}
                            <div className="grid grid-cols-3 gap-4 w-full mb-6">
                                {/* Facebook */}
                                <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${connectedAssets['facebook'] ? 'bg-[#1877F2]/10 border-[#1877F2]/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                    <Facebook size={24} className={connectedAssets['facebook'] ? 'text-[#1877F2]' : 'text-gray-400'} />
                                    <span className="text-xs font-bold">Facebook</span>
                                    {connectedAssets['facebook'] && <Check size={12} className="text-[#1877F2]" />}
                                </div>

                                {/* Instagram */}
                                <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${connectedAssets['instagram'] ? 'bg-[#E1306C]/10 border-[#E1306C]/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                    <div className={connectedAssets['instagram'] ? 'text-[#E1306C]' : 'text-gray-400'}><MessageCircle size={24} /></div>
                                    <span className="text-xs font-bold">Instagram</span>
                                    {connectedAssets['instagram'] && <Check size={12} className="text-[#E1306C]" />}
                                </div>

                                {/* WhatsApp */}
                                <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${connectedAssets['whatsapp'] ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                    <div className={connectedAssets['whatsapp'] ? 'text-[#25D366]' : 'text-gray-400'}><MessageCircle size={24} /></div>
                                    <span className="text-xs font-bold">WhatsApp</span>
                                    {connectedAssets['whatsapp'] ? <Check size={12} className="text-[#25D366]" /> : <span className="text-[10px] text-yellow-500">No detectado</span>}
                                </div>
                            </div>

                            {!connectedAssets['whatsapp'] && (
                                <div className="text-xs text-yellow-500 bg-yellow-500/10 p-3 rounded text-left w-full flex gap-2 items-start">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <span>
                                        Facebook e Instagram conectados. No detectamos una cuenta de WhatsApp Business.
                                        Asegúrate de tener los permisos correctos si deseas usar WhatsApp.
                                    </span>
                                </div>
                            )}

                        </div>
                    ) : (
                        <button
                            onClick={handleLogin}
                            className="btn-primary bg-[#1877F2] hover:bg-[#166fe5] border-[#1877F2] flex items-center gap-2 px-8"
                        >
                            <Facebook size={18} /> Continuar con Facebook
                        </button>
                    )}

                    {status === 'error' && (
                        <div className="mt-4 text-red-400 text-sm bg-red-500/10 p-2 rounded">
                            {errorMsg}
                        </div>
                    )}
                </div>

                {/* Info / Debug */}
                <div className="space-y-6">
                    <div className="glass p-6 border-l-4 border-blue-500">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <MessageCircle size={18} /> ¿Qué sucede al conectar?
                        </h3>
                        <ul className="space-y-3 text-sm text-secondary">
                            <li className="flex gap-2">
                                <span className="text-blue-400">1.</span>
                                <span>Obtenemos un <strong>Token de Acceso Permanente</strong> (60 días).</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400">2.</span>
                                <span>Identificamos tus Páginas de Facebook y Cuentas de Instagram Business.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400">3.</span>
                                <span>Configuramos las suscripciones a <strong>Webhooks</strong> automáticamente.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="glass p-6 opacity-60">
                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-yellow-400">
                            <AlertTriangle size={14} /> Requisitos
                        </h4>
                        <p className="text-xs text-secondary">
                            Debes tener rol de Administrador en las páginas que deseas conectar.
                            Para WhatsApp, asegúrate de tener una cuenta de WhatsApp Business API configurada.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
