import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

import { useLanguage } from '../../contexts/LanguageContext';

export default function Login() {
    const { login, loginWithGoogle } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [showResend, setShowResend] = useState(false);

    const handleGoogleLogin = async (credential: string) => {
        setError('');
        setGoogleLoading(true);
        try {
            await loginWithGoogle(credential);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Error con Google Sign-In');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            const msg = err.message || "Failed to login";
            setError(msg);
            if (msg.includes("verified")) {
                setShowResend(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
            // Use fetch directly or valid hook if available, but simplest is fetch for this one-off
            const res = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'dummy' })
            });
            if (res.ok) {
                setResendSuccess(true);
                setError('');
                setShowResend(false);
            }
        } catch (e) {
            // ignore
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#1B1D20] relative overflow-x-hidden px-4 py-8 lg:py-10">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 w-full max-w-md relative">
                {/* Glass Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl lg:rounded-[24px] p-6 lg:p-8 shadow-2xl">
                    <div className="mb-6 lg:mb-8 text-center">
                        <h1 className="text-2xl lg:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">
                            {t('auth.loginTitle')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-2">{t('auth.protocolAccess')}</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                            {error}
                            {showResend && (
                                <button
                                    onClick={handleResend}
                                    disabled={resendLoading}
                                    className="block mx-auto mt-2 text-xs text-red-400 hover:text-red-300 underline"
                                >
                                    {resendLoading ? t('profile.sending') : t('auth.resendVerification')}
                                </button>
                            )}
                        </div>
                    )}
                    {resendSuccess && (
                        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center">
                            {t('auth.resendSuccess')}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                {t('auth.identity')}
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-red-500 transition-colors"
                                placeholder="commander@future.ai"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                {t('auth.passcode')}
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
                                    {t('auth.authenticating')}
                                </span>
                            ) : t('auth.initSession')}
                        </button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                        <div className="relative flex justify-center text-xs"><span className="px-3 bg-[#1B1D20]/80 text-gray-500 uppercase tracking-widest">o</span></div>
                    </div>

                    <GoogleSignInButton onCredential={handleGoogleLogin} disabled={googleLoading} text="signin_with" />
                    {googleLoading && <p className="text-center text-xs text-gray-500 mt-2 animate-pulse">Autenticando con Google...</p>}

                    <div className="mt-4 text-center">
                        <Link to="/forgot-password" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                            Olvide mi contrasena
                        </Link>
                    </div>

                    <div className="mt-4 text-center text-sm text-gray-500">
                        {t('auth.noAccess')} <Link to="/register" className="text-red-400 hover:text-red-300 transition-colors font-medium">{t('auth.requestClearance')}</Link>
                    </div>
                </div>

                {/* Legal Footer — inside the card container for proper centering */}
                <div className="mt-6 text-center">
                    <div className="flex justify-center gap-6 text-[11px] text-gray-600 font-medium">
                        <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                        <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
