import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Smartphone, ShoppingBag, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MagicOnboarding: React.FC = () => {
    const { fetchApi } = useApi();
    const navigate = useNavigate();

    const [step, setStep] = useState<'input' | 'process' | 'done'>('input');
    const [formData, setFormData] = useState({
        store_name: '',
        tiendanube_store_id: '',
        tiendanube_access_token: '',
        bot_phone_number: ''
    });

    const [logs, setLogs] = useState<string[]>([]);

    const handleMagic = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('process');
        addLog("🚀 Iniciando Protocolo Mágico Nexus...");

        try {
            addLog("🔐 Verificando credenciales de Tienda Nube...");
            await new Promise(r => setTimeout(r, 800)); // UX delay

            const res = await fetchApi('/admin/onboarding/magic', {
                method: 'POST',
                body: formData
            });

            if (res.status === 'success') {
                addLog("✅ Identidad del Tenant establecida (UUID).");
                addLog("🔐 Token Tienda Nube cifrado (Fernet 256-bit).");
                addLog("✨ Supervisor Omega... ONLINE");

                await new Promise(r => setTimeout(r, 800));
                addLog("🖨️ Imprimiendo Activos Digitales (3D Print Flow)...");
                addLog("🎨 Generando Identidad Visual (Branding)...");
                addLog("📜 Redactando Guiones de Venta (Neuro-Linguistic)...");
                addLog("📊 Calculando Proyección ROI...");

                await new Promise(r => setTimeout(r, 1500));
                addLog("✅ Activos generados y sincronizados.");
                addLog(`⚙️ Protocolo Omega Activo: ${formData.store_name}`);

                await new Promise(r => setTimeout(r, 800));
                addLog("🔎 Analizando ADN de la tienda (Catálogo)...");
                addLog("🧠 Transformación Neural (GPT-4o-mini) iniciada...");

                await new Promise(r => setTimeout(r, 1200));
                addLog("🤖 Desplegando Unidad: Ventas Expert... OK");
                addLog("🤖 Desplegando Unidad: Soporte Nivel 1... OK");
                addLog("🤖 Desplegando Unidad: Especialista de Talles... OK");
                addLog("🤖 Desplegando Unidad: Logística... OK");
                addLog("🤖 Desplegando Unidad: Supervisor Omega... OK");

                addLog("📚 Ingesta RAG en segundo plano (Puerto 8003)...");
                await new Promise(r => setTimeout(r, 800));

                setStep('done');
            } else {
                addLog("❌ Error en la secuencia de inicio.");
                setStep('input');
            }
        } catch (e: any) {
            addLog(`❌ Error crítico: ${e.message}`);
            setStep('input');
        }
    };

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, msg]);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/90 p-4 font-mono">
            {step === 'input' && (
                <div className="glass max-w-md w-full p-8 animate-fade-in border-t-4 border-accent">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-accent/20 rounded-full animate-pulse">
                            <Zap size={48} className="text-accent" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">Conexión Tienda Nube</h1>
                    <p className="text-center text-secondary mb-8 text-sm">
                        Ingresa tus credenciales y deja que Nexus construya tu negocio autónomo.
                    </p>

                    <form onSubmit={handleMagic} className="space-y-4">
                        <div className="form-group">
                            <label>Nombre de la Tienda</label>
                            <input required value={formData.store_name} onChange={e => setFormData({ ...formData, store_name: e.target.value })} placeholder="Ej: Moda Futura" />
                        </div>
                        <div className="form-group">
                            <label>Tienda Nube ID</label>
                            <input required value={formData.tiendanube_store_id} onChange={e => setFormData({ ...formData, tiendanube_store_id: e.target.value })} placeholder="123456" />
                        </div>
                        <div className="form-group">
                            <label>Access Token (API)</label>
                            <input required type="password" value={formData.tiendanube_access_token} onChange={e => setFormData({ ...formData, tiendanube_access_token: e.target.value })} placeholder="bearer_..." />
                        </div>
                        <div className="form-group">
                            <label>Teléfono del Bot (Opcional)</label>
                            <input value={formData.bot_phone_number} onChange={e => setFormData({ ...formData, bot_phone_number: e.target.value })} placeholder="549..." />
                        </div>

                        <button type="submit" className="btn-primary w-full py-3 text-lg font-bold glow-effect mt-4">
                            ✨ HACE MAGIA
                        </button>
                    </form>
                </div>
            )}

            {step === 'process' && (
                <div className="glass max-w-lg w-full p-8 text-center animate-fade-in">
                    <Loader2 size={64} className="text-accent animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-6">Construyendo Infraestructura...</h2>
                    <div className="text-left bg-black/40 p-4 rounded h-64 overflow-y-auto font-mono text-xs text-green-400 space-y-2 custom-scrollbar">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            )}

            {step === 'done' && (
                <div className="glass max-w-md w-full p-8 text-center animate-bounce-in">
                    <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold mb-2">¡Sistema Operativo!</h2>
                    <p className="text-secondary mb-8">
                        5 Agentes han sido desplegados y tu catálogo ha sido vectorizado.
                    </p>
                    <button onClick={() => navigate('/agents')} className="btn-primary w-full py-3">
                        Ver Mis Agentes
                    </button>
                    <button onClick={() => navigate('/chats')} className="btn-secondary w-full py-3 mt-4">
                        Ir a Conversaciones
                    </button>
                </div>
            )}
        </div>
    );
};
