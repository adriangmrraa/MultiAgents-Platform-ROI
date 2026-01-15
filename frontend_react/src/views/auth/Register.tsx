import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

import { useLanguage } from '../../contexts/LanguageContext';

export default function Register() {
    const { register } = useAuth();
    const { t } = useLanguage();
    // const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [success, setSuccess] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleResend = async () => {
        setResendLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
            await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'dummy' })
            });
            setResendSuccess(true);
        } catch (e) {
            // ignore
        } finally {
            setResendLoading(false);
        }
    };

    const [regData, setRegData] = useState<{ email_sent: boolean, message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await register(email, password, storeName);
            setRegData(data);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || "Failed to register");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none" />

                <div className="z-10 w-full max-w-md p-8">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">
                            {regData?.email_sent ? t('auth.checkInbox') : t('auth.nextSteps')}
                        </h2>

                        {!regData?.email_sent && (
                            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                                <p className="font-bold mb-1">{t('auth.smtpErrorTitle')}</p>
                                <p className="text-xs opacity-80">{regData?.message}</p>
                            </div>
                        )}

                        <p className="text-gray-400 mb-6">
                            {regData?.email_sent
                                ? t('auth.emailSent', { email })
                                : t('auth.emailFailed', { email })
                            }
                        </p>

                        <div className="p-4 bg-black/30 rounded-lg border border-white/5 mb-6 text-xs text-gray-400 font-mono">
                            PROTOCOL_STATUS: {regData?.email_sent ? "PENDING_VERIFICATION" : "SMTP_FAILURE_MANUAL_NEEDED"}
                        </div>

                        {resendSuccess ? (
                            <p className="text-emerald-400 text-sm mb-4">{t('auth.resendSuccess')}</p>
                        ) : (
                            <button
                                onClick={handleResend}
                                disabled={resendLoading}
                                className="text-xs text-purple-400 hover:text-purple-300 underline mb-6 block w-full"
                            >
                                {resendLoading ? t('profile.sending') : t('auth.didntReceive')}
                            </button>
                        )}

                        <Link
                            to="/login"
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-all block w-full border border-white/5"
                        >
                            {t('auth.backToLogin')}
                        </Link>
                    </div>
                </div>
                {/* Legal Footer */}
                <div className="absolute bottom-4 left-0 w-full text-center">
                    <div className="flex justify-center gap-4 text-[10px] text-gray-600">
                        <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                        <span>•</span>
                        <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div >
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#1B1D20] relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 w-full max-w-md p-8 relative">
                {/* Glass Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 shadow-2xl">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-zinc-400 tracking-tight">
                            {t('auth.newDeployment')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-2">{t('auth.initIdentity')}</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                {t('auth.storeName')}
                            </label>
                            <input
                                type="text"
                                required
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-500 transition-colors"
                                placeholder="Future Brand Corp"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                {t('auth.ownerEmail')}
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-500 transition-colors"
                                placeholder="owner@future.ai"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                {t('auth.securePasscode')}
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('auth.provisioning')}
                                </span>
                            ) : t('auth.deployBtn')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        {t('auth.alreadyDeployed')} <Link to="/login" className="text-red-400 hover:text-red-300 transition-colors font-medium">{t('auth.accessCommand')}</Link>
                    </div>
                </div>
            </div>

            {/* Legal Footer */}
            <div className="absolute bottom-6 left-0 w-full text-center">
                <div className="flex justify-center gap-6 text-[11px] text-gray-600 font-medium">
                    <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                    <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                </div>
            </div>
        </div>
    );
}
