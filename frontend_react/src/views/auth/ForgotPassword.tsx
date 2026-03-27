import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Zap } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || 'Error al enviar el email.');
            }
        } catch {
            setError('Error de conexion. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-x-hidden py-10 px-4">
            <style>{`
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                @keyframes lock-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
                .animate-lock { animation: lock-bounce 2s ease-in-out infinite; }
            `}</style>

            {/* Glow Orbs */}
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none animate-glow" />
            <div className="absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-glow" />

            <div className="z-10 w-full max-w-md relative">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <Zap size={16} className="text-white fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">Future</span>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    {sent ? (
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2">Email enviado</h2>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                Si el email esta registrado, recibiras un enlace para restablecer tu contrasena. Revisa tu bandeja de entrada.
                            </p>
                            <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
                                Volver al login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center animate-lock">
                                    <Lock size={24} className="text-purple-400" />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">
                                    Restablecer contrasena
                                </h1>
                                <p className="text-gray-400 text-sm mt-2">
                                    Ingresa tu email y te enviaremos un enlace para crear una nueva contrasena.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="tu@email.com"
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
                                            Enviando...
                                        </span>
                                    ) : 'Enviar enlace'}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link to="/login" className="text-gray-500 hover:text-gray-300 text-sm flex items-center justify-center gap-1 transition-colors">
                                    <ArrowLeft size={14} /> Volver al login
                                </Link>
                            </div>
                        </>
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
