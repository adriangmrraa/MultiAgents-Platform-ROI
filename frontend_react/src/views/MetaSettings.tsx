import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { MessageCircle, AlertTriangle, Facebook, Check, Loader2 } from 'lucide-react';
import { useFacebookSdk } from '../hooks/useFacebookSdk';
import MetaOnboardingWizard from './settings/MetaOnboardingWizard';
import { useLanguage } from '../contexts/LanguageContext';

export const MetaSettings: React.FC = () => {
    const { t } = useLanguage();
    const { fetchApi } = useApi();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [connectedAssets, setConnectedAssets] = useState<Record<string, boolean>>({});

    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [wizardAssets, setWizardAssets] = useState<any>(null);

    // Hook manages SDK loading lifecycle
    const isSdkReady = useFacebookSdk();

    const handleLogin = () => {
        if (!isSdkReady) return;

        setStatus('loading');

        // Business Login Flow with config_id
        // Try-catch for immediate sync errors
        try {
            if (!(window as any).FB) {
                throw new Error("El SDK de Facebook no pudo cargarse (bloqueado por navegador/red).");
            }

            (window as any).FB.login((response: any) => {
                // For Code Flow, we look for 'code' in authResponse or root
                const code = response.authResponse?.code || response.code;

                if (code) {
                    console.log('FB Code Received', code);
                    // Critical: Redirect URI must match exactly what Meta expects (usually Origin + /)
                    // We send it so backend uses the same one.
                    connectWithBackend(code);
                } else {
                    console.log('User cancelled login or did not fully authorize.', response);
                    setStatus('idle');
                    if (response.status !== 'connected' && response.status !== 'unknown') {
                        setErrorMsg("No se recibió el código de autorización.");
                        setStatus('error');
                    }
                }
            }, {
                config_id: import.meta.env.VITE_META_CONFIG_ID,
                response_type: 'code',
                override_default_response_type: true,
                extras: import.meta.env.VITE_META_EMBEDDED_SIGNUP === 'true' ? {
                    feature: 'whatsapp_embedded_signup',
                    setup: {}
                } : undefined
            });
        } catch (error) {
            console.error("Login Error", error);
            setStatus('error');
            setErrorMsg("Error al iniciar el popup. Revisa permisos.");
        }
    };

    const connectWithBackend = async (code: string) => {
        try {
            // Dynamic Redirect URI (Origin + Slash) to match Meta's strict requirement
            const redirectUri = window.location.origin + '/';

            const res = await fetchApi('/admin/meta/connect', {
                method: 'POST',
                body: {
                    code: code,
                    redirect_uri: redirectUri
                }
            });
            console.log("Meta Connect Result:", res);

            if (res.status === 'success') {
                // Instead of jumping to 'connected', show Wizard
                setWizardAssets(res.assets);
                setConnectedAssets(res.connected); // Keep simplified map as fallback
                setShowWizard(true);
            }
        } catch (e: any) {
            console.error("Backend Connect Error:", e);
            setStatus('error');
            setErrorMsg(e.message || "Error connecting to server");
        }
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">{t('metaSettings.title')}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Connect Card */}
                <div className="glass p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-6 text-[#1877F2]">
                        <Facebook size={32} />
                    </div>

                    <h2 className="text-xl font-bold mb-2">{t('metaSettings.connectBtn')}</h2>
                    <p className="text-sm text-secondary mb-8 max-w-sm">
                        {t('metaSettings.authDesc')}
                    </p>

                    {showWizard && wizardAssets && (
                        <MetaOnboardingWizard
                            assets={wizardAssets}
                            onComplete={() => {
                                setShowWizard(false);
                                setStatus('connected');
                            }}
                            onCancel={() => {
                                setShowWizard(false);
                                setStatus('idle');
                            }}
                        />
                    )}

                    {status === 'loading' ? (
                        <button disabled className="btn-primary bg-[#1877F2] border-[#1877F2] opacity-80 flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> {t('metaSettings.syncingAssets')}
                        </button>
                    ) : status === 'connected' ? (
                        <div className="flex flex-col items-center animate-fade-in w-full">
                            <div className="bg-green-500/10 text-green-400 px-4 py-2 rounded-lg flex items-center gap-2 mb-6">
                                <Check size={18} /> {t('metaSettings.successConnection')}
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
                            disabled={!isSdkReady}
                            className={`btn-primary w-full bg-[#1877F2] hover:bg-[#166fe5] border-[#1877F2] flex items-center justify-center gap-2 py-3 px-8 ${!isSdkReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {!isSdkReady ? <Loader2 size={18} className="animate-spin" /> : <Facebook size={18} />}
                            {!isSdkReady ? t('metaSettings.loadingFb') : t('metaSettings.connectBtn')}
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
                            <MessageCircle size={18} /> {t('metaSettings.whatHappensTitle')}
                        </h3>
                        <ul className="space-y-3 text-sm text-secondary">
                            <li className="flex gap-2">
                                <span className="text-blue-400">1.</span>
                                <span>{t('metaSettings.whatHappens1')}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400">2.</span>
                                <span>{t('metaSettings.whatHappens2')}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400">3.</span>
                                <span>{t('metaSettings.whatHappens3')}</span>
                            </li>
                        </ul>
                    </div>

                    <div className="glass p-6 opacity-60">
                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-yellow-400">
                            <AlertTriangle size={14} /> {t('metaSettings.requirementsTitle')}
                        </h4>
                        <p className="text-xs text-secondary">
                            {t('metaSettings.requirementsDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
