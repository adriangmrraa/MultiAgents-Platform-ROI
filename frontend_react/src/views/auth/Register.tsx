import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { useLanguage } from '../../contexts/LanguageContext';
import { Zap, Check, CreditCard, Clock, Gift, Bot, MessageSquare, BarChart3, Shield, ArrowRight } from 'lucide-react';

export default function Register() {
    const { register, loginWithGoogle } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [storeName, setStoreName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [regData, setRegData] = useState<{ email_sent: boolean; message: string } | null>(null);

    const handleGoogleRegister = async (credential: string) => {
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

    /* ─── Success Screen ─── */
    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-x-hidden py-10 px-4">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none" />

                <div className="z-10 w-full max-w-md">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
                            <button onClick={handleResend} disabled={resendLoading} className="text-xs text-purple-400 hover:text-purple-300 underline mb-6 block w-full">
                                {resendLoading ? t('profile.sending') : t('auth.didntReceive')}
                            </button>
                        )}

                        <Link to="/login" className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-all block w-full border border-white/5">
                            {t('auth.backToLogin')}
                        </Link>
                    </div>
                    <div className="mt-6 text-center">
                        <div className="flex justify-center gap-4 text-[10px] text-gray-600">
                            <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                            <span>•</span>
                            <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── Register Form ─── */
    return (
        <div className="min-h-screen w-full flex bg-[#09090b] relative overflow-x-hidden">
            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
            `}</style>

            {/* Glow Orbs */}
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none animate-glow" />
            <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-glow" />

            {/* ─── Left Benefits Panel (hidden on mobile) ─── */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16 relative z-10">
                <div className="max-w-lg">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                            <Zap size={20} className="text-white fill-current" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">Future</span>
                    </div>

                    <h1 className="text-4xl font-black tracking-tight text-white mb-4 leading-[1.1]">
                        Crea tu tienda IA{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">en minutos</span>
                    </h1>
                    <p className="text-gray-400 text-lg mb-10">Activa tu vendedor inteligente y empeza a automatizar ventas hoy.</p>

                    {/* Steps Indicator */}
                    <div className="flex items-center gap-3 mb-10">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">1</div>
                            <span className="text-sm font-medium text-white">Cuenta</span>
                        </div>
                        <div className="w-8 h-px bg-white/20" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">2</div>
                            <span className="text-sm font-medium text-gray-500">Tienda</span>
                        </div>
                        <div className="w-8 h-px bg-white/20" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">3</div>
                            <span className="text-sm font-medium text-gray-500">Listo</span>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4 mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <CreditCard size={18} className="text-emerald-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Sin tarjeta de credito</div>
                                <div className="text-xs text-gray-500">No pedimos datos de pago para empezar</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <Clock size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">Setup en 5 minutos</div>
                                <div className="text-xs text-gray-500">Wizard guiado paso a paso</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center shrink-0">
                                <Gift size={18} className="text-purple-400" />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-white">10 dias gratis</div>
                                <div className="text-xs text-gray-500">Acceso completo a todas las funciones</div>
                            </div>
                        </div>
                    </div>

                    {/* Social proof */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield size={16} className="text-purple-400" />
                            <span className="text-xs font-bold text-gray-300">500+ negocios ya confian en Future</span>
                        </div>
                        <p className="text-xs text-gray-500">"Active el agente y en la primera semana ya habia respondido 2,000 mensajes." — Lucia F.</p>
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

                {/* Mobile steps */}
                <div className="lg:hidden flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white">1</div>
                    <div className="w-6 h-px bg-white/20" />
                    <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">2</div>
                    <div className="w-6 h-px bg-white/20" />
                    <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">3</div>
                </div>

                <div className="w-full max-w-md">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl lg:rounded-[24px] p-6 lg:p-8 shadow-2xl">
                        <div className="mb-6 lg:mb-8 text-center">
                            <h1 className="text-2xl lg:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">
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
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Mi Tienda Online"
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
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="tu@email.com"
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
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {t('auth.provisioning')}
                                    </span>
                                ) : (
                                    <>
                                        {t('auth.deployBtn')} <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                            <div className="relative flex justify-center text-xs"><span className="px-3 bg-[#09090b]/80 text-gray-500 uppercase tracking-widest">o</span></div>
                        </div>

                        <GoogleSignInButton onCredential={handleGoogleRegister} disabled={googleLoading} text="signup_with" />
                        {googleLoading && <p className="text-center text-xs text-gray-500 mt-2 animate-pulse">Creando cuenta con Google...</p>}

                        <div className="mt-6 text-center text-sm text-gray-500">
                            {t('auth.alreadyDeployed')} <Link to="/login" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">{t('auth.accessCommand')}</Link>
                        </div>
                    </div>

                    {/* Mobile benefits */}
                    <div className="lg:hidden mt-6 flex gap-4 justify-center text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> Sin tarjeta</span>
                        <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> 5 min setup</span>
                        <span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" /> 10 dias gratis</span>
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
