import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { useLanguage } from '../../contexts/LanguageContext';
import { Zap, Bot, MessageSquare, BarChart3, Shield, Star } from 'lucide-react';

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
        <div className="min-h-screen w-full flex bg-[#09090b] relative overflow-x-hidden">
            {/* CSS */}
            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-float-delay { animation: float 6s ease-in-out 2s infinite; }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
            `}</style>

            {/* Glow Orbs */}
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none animate-glow" />
            <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-glow" />

            {/* ─── Left Hero (hidden on mobile) ─── */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16 relative z-10">
                <div className="max-w-lg">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                            <Zap size={20} className="text-white fill-current" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">Future</span>
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-white mb-4 leading-[1.1]">
                        Tu vendedor IA{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
                            que nunca duerme
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                        Conecta WhatsApp, Instagram y Facebook. La IA responde, vende y cierra por vos. 24/7.
                    </p>

                    {/* Floating Feature Cards */}
                    <div className="space-y-3 mb-10">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center gap-4 animate-float">
                            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <Bot size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Agente IA 24/7</div>
                                <div className="text-xs text-gray-500">Responde y vende sin intervencion humana</div>
                            </div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center gap-4 animate-float-delay">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <MessageSquare size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Multi-canal unificado</div>
                                <div className="text-xs text-gray-500">WhatsApp + Instagram + Facebook en uno</div>
                            </div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center gap-4 animate-float">
                            <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <BarChart3 size={20} className="text-cyan-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Analytics en tiempo real</div>
                                <div className="text-xs text-gray-500">Metricas de ROI, conversion y respuesta</div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-8">
                        <div>
                            <div className="text-2xl font-black text-white">500+</div>
                            <div className="text-xs text-gray-500">Tiendas activas</div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white">1M+</div>
                            <div className="text-xs text-gray-500">Mensajes procesados</div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white">99.9%</div>
                            <div className="text-xs text-gray-500">Uptime</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Right Form ─── */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-8 py-8 relative z-10">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <Zap size={16} className="text-white fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">Future</span>
                </div>

                <div className="w-full max-w-md">
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

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                    {t('auth.identity')}
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="tu@email.com"
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
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30"
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
                            <div className="relative flex justify-center text-xs"><span className="px-3 bg-[#09090b]/80 text-gray-500 uppercase tracking-widest">o</span></div>
                        </div>

                        <GoogleSignInButton onCredential={handleGoogleLogin} disabled={googleLoading} text="signin_with" />
                        {googleLoading && <p className="text-center text-xs text-gray-500 mt-2 animate-pulse">Autenticando con Google...</p>}

                        <div className="mt-4 text-center">
                            <Link to="/forgot-password" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                                Olvide mi contrasena
                            </Link>
                        </div>

                        <div className="mt-4 text-center text-sm text-gray-500">
                            {t('auth.noAccess')} <Link to="/register" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">{t('auth.requestClearance')}</Link>
                        </div>
                    </div>

                    {/* Legal Footer */}
                    <div className="mt-6 text-center">
                        <div className="flex justify-center gap-6 text-[11px] text-gray-600 font-medium">
                            <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                            <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
