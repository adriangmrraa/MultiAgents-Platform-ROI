import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Zap, Mail, CheckCircle, XCircle } from 'lucide-react';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchApi } = useApi();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Token de verificacion no encontrado.');
            return;
        }

        const verify = async () => {
            try {
                await fetchApi('/auth/verify-email', { method: 'POST', body: { token } });
                setStatus('success');
                setTimeout(() => { navigate('/login'); }, 3000);
            } catch (err: any) {
                setStatus('error');
                setErrorMessage(err.message || 'El enlace ha expirado o es invalido.');
            }
        };
        verify();
    }, [token, fetchApi, navigate]);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-x-hidden py-10 px-4">
            <style>{`
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(20px) rotate(360deg); opacity: 0; } }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
                .animate-check { animation: check-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
            `}</style>

            {/* Glow Orbs */}
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none animate-glow" />
            <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-glow" />

            {/* Success confetti orbs */}
            {status === 'success' && (
                <>
                    <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute top-1/4 right-1/3 w-[150px] h-[150px] bg-cyan-500/20 rounded-full blur-[80px] pointer-events-none" />
                </>
            )}

            <div className="z-10 w-full max-w-md relative">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <Zap size={16} className="text-white fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">Future</span>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
                    {/* Icon */}
                    <div className="mb-6">
                        {status === 'verifying' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                                <svg className="w-8 h-8 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-check">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                <XCircle size={32} className="text-red-400" />
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
                        {status === 'verifying' && 'Verificando tu email...'}
                        {status === 'success' && 'Email verificado'}
                        {status === 'error' && 'Enlace invalido'}
                    </h2>

                    {/* Message */}
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        {status === 'verifying' && 'Estamos validando tu token de acceso. Un momento...'}
                        {status === 'success' && 'Tu cuenta esta lista. Redirigiendo al login en 3 segundos...'}
                        {status === 'error' && (errorMessage || 'No pudimos verificar tu correo. Solicita un nuevo enlace.')}
                    </p>

                    {/* Actions */}
                    {status === 'success' && (
                        <button onClick={() => navigate('/login')}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-900/30">
                            Ir al Login
                        </button>
                    )}
                    {status === 'error' && (
                        <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
                            Volver al Login
                        </Link>
                    )}
                </div>

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
