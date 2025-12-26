import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Mail, Settings, AlertTriangle } from 'lucide-react';

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

interface Tenant {
    id: number;
    store_name: string;
}

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

    useEffect(() => {
        loadTenants();
    }, []);

    useEffect(() => {
        if (selectedTenantId) loadConfig(selectedTenantId);
    }, [selectedTenantId]);

    const loadTenants = async () => {
        const t = await fetchApi('/admin/tenants');
        if (t) {
            setTenants(t);
            if (t.length > 0) setSelectedTenantId(t[0].id);
        }
    };

    const loadConfig = async (id: number) => {
        const data = await fetchApi(`/admin/handoff/${id}`);
        if (data) setConfig(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenantId) return;
        try {
            await fetchApi('/admin/handoff', {
                method: 'POST',
                body: { ...config, tenant_id: selectedTenantId }
            });
            alert('Configuración guardada correctamente');
        } catch (e) {
            alert('Error al guardar configuración');
        }
    };

    const updateTrigger = (key: keyof HandoffConfig['triggers']) => {
        setConfig({ ...config, triggers: { ...config.triggers, [key]: !config.triggers[key] } });
    };

    const updateContext = (key: keyof HandoffConfig['email_context']) => {
        setConfig({ ...config, email_context: { ...config.email_context, [key]: !config.email_context[key] } });
    };

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title flex items-center gap-2"><Mail className="text-accent" /> Configuración de Derivación (Handoff)</h1>

            <div className="glass p-6 mb-6">
                <div className="form-group">
                    <label>Seleccionar Tienda</label>
                    <select value={selectedTenantId || ''} onChange={e => setSelectedTenantId(Number(e.target.value))}>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.store_name}</option>)}
                    </select>
                </div>
            </div>

            {selectedTenantId && (
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Rules Section */}
                        <div className="glass p-6 border-l-4 border-yellow-500">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🎯 ¿Cuándo Derivar? (Policy)</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.triggers.rule_fitting} onChange={() => updateTrigger('rule_fitting')} />
                                    Solicitud de Fitting / Asesora
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.triggers.rule_reclamo} onChange={() => updateTrigger('rule_reclamo')} />
                                    Reclamos o tono negativo
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.triggers.rule_dolor} onChange={() => updateTrigger('rule_dolor')} />
                                    Dolor / Lesión / Incomodidad
                                </label>
                            </div>
                        </div>

                        {/* Email Context Section */}
                        <div className="glass p-6 border-l-4 border-blue-500">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">✉️ Contenido del Email</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.email_context.ctx_name} onChange={() => updateContext('ctx_name')} />
                                    Nombre del Usuario
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.email_context.ctx_history} onChange={() => updateContext('ctx_history')} />
                                    Historial de Chat (Últimos mensajes)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* General Settings */}
                    <div className="glass p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="toggle" />
                            <span className="font-bold">Habilitar Derivación Automática</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Email de Destino</label>
                                <input type="email" required value={config.destination_email} onChange={e => setConfig({ ...config, destination_email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Mensaje al Cliente</label>
                                <input value={config.handoff_message} onChange={e => setConfig({ ...config, handoff_message: e.target.value })} placeholder="Te contacto con un humano..." />
                            </div>
                        </div>
                    </div>

                    {/* SMTP Settings */}
                    <div className="glass p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Settings size={18} /> Configuración SMTP</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-group">
                                <label>Host</label>
                                <input value={config.smtp_host} onChange={e => setConfig({ ...config, smtp_host: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Port</label>
                                <input type="number" value={config.smtp_port} onChange={e => setConfig({ ...config, smtp_port: parseInt(e.target.value) })} />
                            </div>
                            <div className="form-group">
                                <label>User</label>
                                <input value={config.smtp_username} onChange={e => setConfig({ ...config, smtp_username: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input type="password" value={config.smtp_password || ''} onChange={e => setConfig({ ...config, smtp_password: e.target.value })} placeholder="********" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button type="submit" className="btn-primary">Guardar Configuración</button>
                    </div>
                </form>
            )}
        </div>
    );
};
