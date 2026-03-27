import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ArrowRight, ArrowLeft, CheckCircle, Smartphone, ShoppingBag, Send, Zap, Globe, Activity } from 'lucide-react';

export const Setup: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        bot_phone_number: '', store_name: '', store_website: '',
        tiendanube_store_id: '', tiendanube_token: ''
    });
    const [testResult, setTestResult] = useState<any>(null);

    const handleNext = async () => {
        setTestResult(null);
        if (currentStep < 5) setCurrentStep(c => c + 1);
        else { alert('Setup Completo!'); window.location.href = '/'; }
    };

    const handlePrev = () => { setTestResult(null); if (currentStep > 1) setCurrentStep(c => c - 1); };

    const runTest = async (step: number) => {
        try {
            setTestResult({ status: 'loading', message: 'Probando...' });
            if (step === 3) {
                await fetchApi('/admin/tenants', { method: 'POST', body: {
                    store_name: formData.store_name, bot_phone_number: formData.bot_phone_number,
                    store_website: formData.store_website, tiendanube_store_id: formData.tiendanube_store_id,
                    tiendanube_access_token: formData.tiendanube_token
                }});
                setTestResult({ status: 'success', message: 'Tienda creada/actualizada correctamente.' });
            } else if (step === 4) {
                await fetchApi('/admin/diagnostics/healthz');
                setTestResult({ status: 'success', message: 'Conexion con Orquestador: OK' });
            } else if (step === 5) {
                await fetchApi(`/admin/tenants/${formData.bot_phone_number}/test-message`, { method: 'POST' });
                setTestResult({ status: 'success', message: 'Mensaje enviado a tu WhatsApp.' });
            }
        } catch (e: any) {
            setTestResult({ status: 'error', message: e.message });
        }
    };

    const steps = [
        { num: 1, label: 'Tienda', icon: <ShoppingBag size={14} /> },
        { num: 2, label: 'Nube', icon: <Globe size={14} /> },
        { num: 3, label: 'Guardar', icon: <CheckCircle size={14} /> },
        { num: 4, label: 'Verificar', icon: <Activity size={14} /> },
        { num: 5, label: 'Prueba', icon: <Send size={14} /> },
    ];

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                    <Zap size={20} className="text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">Asistente de Configuracion</h1>
                    <p className="text-xs text-gray-500">Configura tu tienda paso a paso</p>
                </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-10 max-w-3xl mx-auto">
                {/* Progress */}
                <div className="mb-10">
                    <div className="flex justify-between items-center mb-4">
                        {steps.map((step, i) => (
                            <React.Fragment key={step.num}>
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                                        step.num < currentStep ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-900/30' :
                                        step.num === currentStep ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' :
                                        'bg-white/5 text-gray-600 border border-white/10'
                                    }`}>
                                        {step.num < currentStep ? <CheckCircle size={16} /> : step.icon}
                                    </div>
                                    <span className={`text-[10px] font-medium ${step.num <= currentStep ? 'text-white' : 'text-gray-600'}`}>{step.label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`flex-1 h-px mx-2 mb-5 ${step.num < currentStep ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-white/10'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[280px] animate-fade-in">
                    {currentStep === 1 && (
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">Crear Tienda</h2>
                            <p className="text-sm text-gray-500 mb-6">Configura los datos basicos de tu primera tienda.</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Numero de WhatsApp (Bot)</label>
                                    <div className="relative">
                                        <Smartphone size={16} className="absolute top-3.5 left-3 text-gray-600" />
                                        <input className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                            value={formData.bot_phone_number} onChange={e => setFormData({ ...formData, bot_phone_number: e.target.value })} placeholder="54911..." />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nombre de la Tienda</label>
                                    <div className="relative">
                                        <ShoppingBag size={16} className="absolute top-3.5 left-3 text-gray-600" />
                                        <input className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                            value={formData.store_name} onChange={e => setFormData({ ...formData, store_name: e.target.value })} placeholder="Mi Tienda" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sitio Web</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        value={formData.store_website} onChange={e => setFormData({ ...formData, store_website: e.target.value })} placeholder="https://..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">Conectar Tienda Nube</h2>
                            <p className="text-sm text-gray-500 mb-6">Ingresa tus credenciales de Tienda Nube para sincronizar el catalogo.</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ID de Tienda</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        value={formData.tiendanube_store_id} onChange={e => setFormData({ ...formData, tiendanube_store_id: e.target.value })} placeholder="123456" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Access Token</label>
                                    <input type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        value={formData.tiendanube_token} onChange={e => setFormData({ ...formData, tiendanube_token: e.target.value })} placeholder="Token API" />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">Guardar Configuracion</h2>
                            <p className="text-sm text-gray-500 mb-6">Vamos a guardar tu tienda en la base de datos.</p>
                            <button onClick={() => runTest(3)} disabled={loading}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-3 rounded-xl text-sm font-medium transition-all">
                                {loading ? 'Guardando...' : 'Guardar y Verificar'}
                            </button>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">Verificar Servicios</h2>
                            <p className="text-sm text-gray-500 mb-6">Comprobando estado del sistema...</p>
                            <button onClick={() => runTest(4)} disabled={loading}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-3 rounded-xl text-sm font-medium transition-all">
                                {loading ? 'Verificando...' : 'Verificar Salud'}
                            </button>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div>
                            <h2 className="text-xl font-black text-white mb-2">Prueba Final</h2>
                            <p className="text-sm text-gray-500 mb-6">Enviaremos un mensaje de prueba a tu WhatsApp: <span className="text-white font-mono">{formData.bot_phone_number}</span></p>
                            <button onClick={() => runTest(5)} disabled={loading}
                                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                                <Send size={16} /> {loading ? 'Enviando...' : 'Enviar Mensaje de Prueba'}
                            </button>
                        </div>
                    )}

                    {testResult && (
                        <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 ${
                            testResult.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            testResult.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        }`}>
                            {testResult.status === 'success' ? <CheckCircle size={18} /> : testResult.status === 'loading' ?
                                <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : null}
                            <span className="text-sm">{testResult.message}</span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-10 pt-5 border-t border-white/10">
                    {currentStep > 1 ? (
                        <button onClick={handlePrev} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                            <ArrowLeft size={16} /> Anterior
                        </button>
                    ) : <div />}
                    <button onClick={handleNext} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                        {currentStep === 5 ? 'Finalizar' : 'Siguiente'} <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
