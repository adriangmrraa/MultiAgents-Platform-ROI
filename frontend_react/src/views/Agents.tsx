import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { GlobalStreamLog } from '../components/GlobalStreamLog';
import { Bot, Plus, Settings, Trash2, Edit, Activity } from 'lucide-react';

interface Agent {
    id?: string;
    name: string;
    role: string;
    tenant_id: number;
    whatsapp_number?: string;
    model_provider: string;
    model_version: string;
    temperature: number;
    system_prompt_template: string;
    enabled_tools: string[];
    channels?: string[];
    is_active: boolean;
    tenant_name?: string;
}

interface Tenant {
    id: number;
    store_name: string;
}

export const Agents: React.FC = () => {
    const { fetchApi } = useApi();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [tools, setTools] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const defaultAgent: Agent = {
        name: '', role: 'sales', tenant_id: 0, model_provider: 'openai',
        model_version: 'gpt-4o', temperature: 0.3, system_prompt_template: '',
        enabled_tools: ['search_specific_products'], channels: ['whatsapp', 'instagram', 'facebook', 'web'], is_active: true
    };
    const [formData, setFormData] = useState<Agent>(defaultAgent);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [a, t, s] = await Promise.all([
            fetchApi('/admin/agents'),
            fetchApi('/admin/tenants'),
            fetchApi('/admin/tools')
        ]);
        if (a) setAgents(a);
        if (t) setTenants(t);
        if (s) setTools(s);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && formData.id) {
                await fetchApi(`/admin/agents/${formData.id}`, { method: 'PUT', body: formData });
            } else {
                await fetchApi('/admin/agents', { method: 'POST', body: formData });
            }
            setIsModalOpen(false);
            loadData();
        } catch (e) {
            alert('Error al guardar agente');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar agente? Esta acción no se puede deshacer.')) return;
        await fetchApi(`/admin/agents/${id}`, { method: 'DELETE' });
        loadData();
    };

    const openEdit = (agent: Agent) => {
        setFormData(agent);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openNew = () => {
        setFormData(defaultAgent);
        setIsEditing(false);
        setIsModalOpen(true);
    };

    return (
        <div className="view active animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="view-title">Agent Squad: Neural Configuration</h1>
                <button className="btn-primary" onClick={openNew}>
                    <Plus size={18} className="mr-2" /> Nuevo Agente
                </button>
            </div>

            <div className="glass p-4 mb-6 border-l-4 border-accent">
                <h4 className="font-bold mb-2 flex items-center gap-2"><Bot size={16} /> Protocolo Omega: Manual de Operaciones</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-secondary">
                    <div className="p-3 bg-white/5 rounded border border-white/10">
                        <p className="font-semibold text-white mb-1">🧠 Lógica del Agente</p>
                        Los agentes utilizan el <strong>System Prompt</strong> como su identidad base. Asegúrate de incluir reglas de estilo (Ej: "Usa emojis", "Habla de usted").
                    </div>
                    <div className="p-3 bg-white/5 rounded border border-white/10">
                        <p className="font-semibold text-white mb-1">🛠 Herramientas Tácticas</p>
                        Cada herramienta añade capacidades. Configura el "Comportamiento Táctico" en la Armería para que el agente sepa CUÁNDO y CÓMO usarlas.
                    </div>
                </div>
            </div>

            <div className="glass">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Rol</th>
                            <th>Tenant</th>
                            <th>Modelo</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(agent => (
                            <tr key={agent.id}>
                                <td className="font-semibold">{agent.name}</td>
                                <td><span className="badge type">{agent.role}</span></td>
                                <td>{agent.tenant_name || '-'}</td>
                                <td className="font-mono text-xs">{agent.model_provider} / {agent.model_version}</td>
                                <td>
                                    <span className={`status-dot ${agent.is_active ? 'configured' : ''}`}></span>
                                    {agent.is_active ? 'Activo' : 'Inactivo'}
                                </td>
                                <td className="flex gap-2">
                                    <button className="btn-secondary text-xs px-2 py-1" onClick={() => openEdit(agent)}>
                                        <Edit size={12} className="mr-1" /> Editar
                                    </button>
                                    <button className="btn-delete text-xs px-2 py-1" onClick={() => handleDelete(agent.id!)}>
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr><td colSpan={6} className="text-center p-8 text-secondary">No hay agentes configurados</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-accent" /> Neural Thinking Log
                </h3>
                <GlobalStreamLog />
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Editar Agente' : 'Nuevo Agente'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>Nombre</label>
                            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Agente de Ventas 1" />
                        </div>
                        <div className="form-group">
                            <label>Tenant</label>
                            <select required value={formData.tenant_id} onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}>
                                <option value={0}>Seleccionar...</option>
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.store_name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>Proveedor IA</label>
                            <select value={formData.model_provider} onChange={e => setFormData({ ...formData, model_provider: e.target.value })}>
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Modelo</label>
                            <input value={formData.model_version} onChange={e => setFormData({ ...formData, model_version: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="flex justify-between items-center mb-1">
                            <label>System Prompt Template</label>
                            <div className="text-[10px] text-accent font-bold bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                RECOMENDADO: NÚCLEO OMEGA
                            </div>
                        </div>
                        <div className="text-[11px] text-secondary mb-2 italic">
                            Define la personalidad. El sistema inyectará automáticamente el catálogo y descripción de la tienda.
                        </div>
                        <textarea
                            className="font-mono text-xs h-32"
                            value={formData.system_prompt_template || ''}
                            onChange={e => setFormData({ ...formData, system_prompt_template: e.target.value })}
                            placeholder="Eres un experto en ventas..."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                        <label>Agente Activo</label>
                    </div>

                    <div className="form-group">
                        <label>Canales Asignados (Ruteo)</label>
                        <div className="flex gap-4 mt-2 mb-4">
                            {['whatsapp', 'instagram', 'facebook', 'web'].map(ch => (
                                <label key={ch} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.channels?.includes(ch)}
                                        onChange={e => {
                                            const current = formData.channels || [];
                                            if (e.target.checked) setFormData({ ...formData, channels: [...current, ch] });
                                            else setFormData({ ...formData, channels: current.filter(c => c !== ch) });
                                        }}
                                    />
                                    <span className="capitalize text-sm">{ch}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Herramientas Habilitadas (RAG)</label>
                        <div className="text-[11px] text-secondary mb-2">Habilita las herramientas que este agente podrá invocar.</div>
                        <div className="grid grid-cols-2 gap-2 mt-2 p-3 glass rounded border border-white/5">
                            {tools.map(tool => (
                                <label key={tool.name} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors" title={tool.description}>
                                    <input
                                        type="checkbox"
                                        checked={formData.enabled_tools?.includes(tool.name)}
                                        onChange={e => {
                                            const current = formData.enabled_tools || [];
                                            if (e.target.checked) setFormData({ ...formData, enabled_tools: [...current, tool.name] });
                                            else setFormData({ ...formData, enabled_tools: current.filter(t => t !== tool.name) });
                                        }}
                                    />
                                    <span className="text-xs font-mono">{tool.name}</span>
                                </label>
                            ))}
                            {tools.length === 0 && <span className="text-xs text-secondary italic">Cargando herramientas...</span>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar Agente</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
