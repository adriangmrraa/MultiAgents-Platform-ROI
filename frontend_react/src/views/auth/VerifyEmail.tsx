import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchApi } = useApi();

    const token = searchParams.get('token');

    // Status: idle, verifying, success, error
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Token de verificación no encontrado.');
            return;
        }

        const verify = async () => {
            try {
                // Call verification endpoint
                await fetchApi('/auth/verify-email', {
                    method: 'POST',
                    body: { token }
                });
                setStatus('success');

                // Auto redirect after 3s
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (err: any) {
                console.error("Verification failed", err);
                setStatus('error');
                setErrorMessage(err.message || 'El enlace ha expirado o es inválido.');
            }
        };

        verify();
    }, [token, fetchApi, navigate]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Effects (Cyber/Glass) */}
            <div className="absolute inset-0 z-0">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Glass Container */}
                <div className="backdrop-blur-xl bg-slate-800/40 border border-slate-700/50 rounded-2xl shadow-2xl p-8 text-center">

                    {/* Header Logo/Icon */}
                    <div className="mb-8">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            {status === 'verifying' && (
                                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {status === 'success' && (
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            )}
                            {status === 'error' && (
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                        {status === 'verifying' && 'Verificando Identidad...'}
                        {status === 'success' && '¡Identidad Confirmada!'}
                        {status === 'error' && 'Enlace Inválido'}
                    </h2>

                    <p className="text-slate-400 mb-8">
                        {status === 'verifying' && 'Estamos validando tu token de acceso seguro.'}
                        {status === 'success' && 'Tu fábrica de negocios está lista. Redirigiendo...'}
                        {status === 'error' && (errorMessage || 'No pudimos verificar tu correo. Solicita un nuevo enlace.')}
                    </p>

                    {/* Actions */}
                    {status === 'success' && (
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
                        >
                            Ir al Login
                        </button>
                    )}

                    {status === 'error' && (
                        <button
                            onClick={() => navigate('/login')}
                            className="text-slate-400 hover:text-white underline text-sm"
                        >
                            Volver al Inicio
                        </button>
                    )}

                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-xs text-slate-600 font-mono">
                    PROTOCOL OMEGA // ZERO TRUST ARCHITECTURE
                </div>
            </div>
        </div>
    );
}
