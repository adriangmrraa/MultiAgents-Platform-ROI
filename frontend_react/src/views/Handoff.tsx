import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Mail, Settings, AlertTriangle, Shield, Send, CheckCircle, User, MessageSquare, Phone, Hash } from 'lucide-react';

interface HandoffConfig {
    enabled: boolean;
    destination_email: string;
    handoff_instructions: string;
    handoff_message: string;
    smtp_host: string;
    smtp_port: number;
    smtp_security: string;
    smtp_username: string;
    smtp_password?: string;
    triggers: {
        rule_fitting: boolean;
        rule_reclamo: boolean;
        rule_dolor: boolean;
        rule_talle: boolean;
        rule_especial: boolean;
    };
    email_context: {
        ctx_name: boolean;
        ctx_phone: boolean;
        ctx_history: boolean;
        ctx_id: boolean;
    };
}

interface Tenant { id: number; store_name: string; }

export const Handoff: React.FC = () => {
    const { fetchApi } = useApi();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
    const [config, setConfig] = useState<HandoffConfig>({
        enabled: true, destination_email: '', handoff_instructions: '', handoff_message: '',
        smtp_host: '', smtp_port: 465, smtp_security: 'SSL', smtp_username: '',
        triggers: { rule_fitting: false, rule_reclamo: false, rule_dolor: false, rule_talle: false, rule_especial: false },
        email_context: { ctx_name: true, ctx_phone: true, ctx_history: true, ctx_id: false }
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => { loadTenants(); }, []);
    useEffect(() => { if (selectedTenantId) loadConfig(selectedTenantId); }, [selectedTenantId]);

    const loadTenants = async () => { const t = await fetchApi('/admin/tenants'); if (t) { setTenants(t); if (t.length > 0) setSelectedTenantId(t[0].id); } };
    const loadConfig = async (id: number) => { const data = await fetchApi(`/admin/handoff/${id}`); if (data) setConfig(data); };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenantId) return;
        try {
            await fetchApi('/admin/handoff', { method: 'POST', body: { ...config, tenant_id: selectedTenantId } });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e) { alert('Error al guardar configuracion'); }
    };

    const updateTrigger = (key: keyof HandoffConfig['triggers']) => { setConfig({ ...config, triggers: { ...config.triggers, [key]: !config.triggers[key] } }); };
    const updateContext = (key: keyof HandoffConfig['email_context']) => { setConfig({ ...config, email_context: { ...config.email_context, [key]: !config.email_context[key] } }); };

    const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
        <label className="flex items-center gap-3 cursor-pointer group py-1.5">
            <div className={`w-10 h-6 rounded-full relative transition-all ${checked ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-white/10'}`} onClick={onChange}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow ${checked ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
        </label>
    );

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
                    <Mail size={20} className="text-amber-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">Derivacion (Handoff)</h1>
                    <p className="text-xs text-gray-500">Configura cuando derivar a un humano por email</p>
                </div>
            </div>

            {/* Tenant Selector */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Seleccionar Tienda</label>
                <select value={selectedTenantId || ''} onChange={e => setSelectedTenantId(Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors">
                    {tenants.map(t => <option key={t.id} value={t.id} className="bg-[#09090b]">{t.store_name}</option>)}
                </select>
            </div>

            {selectedTenantId && (
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Rules */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 border-l-4 border-l-amber-500/50">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Shield size={16} className="text-amber-400" /> Cuando Derivar (Policy)
                            </h3>
                            <div className="space-y-1">
                                <Toggle checked={config.triggers.rule_fitting} onChange={() => updateTrigger('rule_fitting')} label="Solicitud de Fitting / Asesora" />
                                <Toggle checked={config.triggers.rule_reclamo} onChange={() => updateTrigger('rule_reclamo')} label="Reclamos o tono negativo" />
                                <Toggle checked={config.triggers.rule_dolor} onChange={() => updateTrigger('rule_dolor')} label="Dolor / Lesion / Incomodidad" />
                                <Toggle checked={config.triggers.rule_talle} onChange={() => updateTrigger('rule_talle')} label="Consulta de talle especifica" />
                                <Toggle checked={config.triggers.rule_especial} onChange={() => updateTrigger('rule_especial')} label="Caso especial / custom" />
                            </div>
                        </div>

                        {/* Email Context */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 border-l-4 border-l-blue-500/50">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <MessageSquare size={16} className="text-blue-400" /> Contenido del Email
                            </h3>
                            <div className="space-y-1">
                                <Toggle checked={config.email_context.ctx_name} onChange={() => updateContext('ctx_name')} label="Nombre del Usuario" />
                                <Toggle checked={config.email_context.ctx_phone} onChange={() => updateContext('ctx_phone')} label="Telefono del Usuario" />
                                <Toggle checked={config.email_context.ctx_history} onChange={() => updateContext('ctx_history')} label="Historial de Chat" />
                                <Toggle checked={config.email_context.ctx_id} onChange={() => updateContext('ctx_id')} label="ID de Conversacion" />
                            </div>
                        </div>
                    </div>

                    {/* General */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-5">
                            <Toggle checked={config.enabled} onChange={() => setConfig({ ...config, enabled: !config.enabled })} label="" />
                            <span className="font-bold text-white text-sm">Habilitar Derivacion Automatica</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email de Destino</label>
                                <input type="email" required value={config.destination_email} onChange={e => setConfig({ ...config, destination_email: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" placeholder="soporte@tutienda.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Mensaje al Cliente</label>
                                <input value={config.handoff_message} onChange={e => setConfig({ ...config, handoff_message: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" placeholder="Te contacto con un humano..." />
                            </div>
                        </div>
                    </div>

                    {/* SMTP */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Settings size={16} className="text-gray-400" /> Configuracion SMTP
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Host</label>
                                <input value={config.smtp_host} onChange={e => setConfig({ ...config, smtp_host: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" placeholder="smtp.gmail.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Port</label>
                                <input type="number" value={config.smtp_port} onChange={e => setConfig({ ...config, smtp_port: parseInt(e.target.value) })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">User</label>
                                <input value={config.smtp_username} onChange={e => setConfig({ ...config, smtp_username: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Password</label>
                                <input type="password" value={config.smtp_password || ''} onChange={e => setConfig({ ...config, smtp_password: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors" placeholder="••••••••" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        {saved && (
                            <span className="text-emerald-400 text-sm flex items-center gap-1 animate-fade-in">
                                <CheckCircle size={14} /> Guardado
                            </span>
                        )}
                        <button type="submit" className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                            Guardar Configuracion
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
