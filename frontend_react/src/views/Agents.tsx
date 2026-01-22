import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Modal } from '../components/Modal';
import { GlobalStreamLog } from '../components/GlobalStreamLog';
import { Bot, Plus, Trash2, Edit, Activity, Lock, BookOpen, Sparkles, Zap, Store, ChevronRight, Star } from 'lucide-react';

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
    knowledge_sources: string[];
    channels?: string[];
    is_active: boolean;
    tenant_name?: string;
}

interface KnowledgeFile {
    id: string;
    filename: string;
    status: string;
}

interface Tenant {
    id: number;
    store_name: string;
}

export const Agents: React.FC = () => {
    const { t } = useLanguage();
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [tools, setTools] = useState<any[]>([]);
    const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const defaultAgent: Agent = {
        name: '', role: 'sales', tenant_id: 0, model_provider: 'openai',
        model_version: 'gpt-4o', temperature: 0.3, system_prompt_template: '',
        enabled_tools: ['search_specific_products'], knowledge_sources: [],
        channels: ['whatsapp', 'instagram', 'facebook', 'web'], is_active: true
    };
    const [formData, setFormData] = useState<Agent>(defaultAgent);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [a, t, s, k] = await Promise.all([
            fetchApi('/admin/agents'),
            fetchApi('/admin/tenants'),
            fetchApi('/admin/tools'),
            fetchApi('/admin/knowledge/list')
        ]);
        if (a) setAgents(a);
        if (t) setTenants(t);
        if (s) setTools(s);
        if (k) setKnowledgeFiles(k);
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
            alert(t('agents.saveError'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('agents.deleteConfirm'))) return;
        await fetchApi(`/admin/agents/${id}`, { method: 'DELETE' });
        loadData();
    };

    const openEdit = (agent: Agent) => {
        // Nexus v5.28: Redirect to Dynamic Wizard for editing
        if (agent.id) {
            navigate(`/admin/agents/${agent.id}`);
        }
    };

    const openNew = () => {
        if (!user?.is_verified) {
            alert("Por favor verifica tu correo para crear nuevos agentes.");
            return;
        }
        navigate('/admin/agents/new');
    };

    const handleActivateSalesAgent = async () => {
        if (!user?.tenant_id) return;
        try {
            // Nexus v5.24: Auto-provision Sales Agent
            const res = await fetchApi(`/admin/agents/sales-config/${user.tenant_id}`);
            if (res && res.id) {
                navigate(`/admin/agents/${res.id}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error activating sales agent. Please contact support.");
        }
    };

    return (
        <div className="view active animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="view-title">{t('agents.title')}</h1>
                <button
                    className={`btn-primary ${!user?.is_verified ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={openNew}
                >
                    <Plus size={18} className="mr-2" /> {t('agents.newAgent')}
                </button>
            </div>

            <div className="glass p-4 mb-6 border-l-4 border-accent">
                <h4 className="font-bold mb-2 flex items-center gap-2"><Bot size={16} /> {t('agents.opsManual')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-secondary">
                    <div className="p-3 bg-white/5 rounded border border-white/10">
                        <p className="font-semibold text-white mb-1">🧠 {t('agents.agentLogic')}</p>
                        {t('agents.agentLogicDesc')}
                    </div>
                    <div className="p-3 bg-white/5 rounded border border-white/10">
                        <p className="font-semibold text-white mb-1">🛠 {t('agents.tacticalTools')}</p>
                        {t('agents.tacticalToolsDesc')}
                    </div>
                </div>
            </div>

            {/* Featured Agent Card (Nexus v5.24) */}
            {!agents.some(a => a.role === 'sales') && (
                <div className="mb-8 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-accent to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative glass p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="bg-gradient-to-br from-accent to-purple-600 p-4 rounded-xl shadow-lg shadow-accent/20">
                                <Store size={32} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xl font-bold text-white">Agente de Ventas (IA)</h3>
                                    <span className="bg-accent/20 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent/20 flex items-center gap-1">
                                        <Star size={10} fill="currentColor" /> RECOMENDADO
                                    </span>
                                </div>
                                <p className="text-secondary text-sm max-w-lg">
                                    Tu vendedor experto 24/7. Gestiona catálogo, stock, variantes y cierre de ventas automáticamente.
                                    Pre-entrenado con las mejores prácticas de e-commerce.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleActivateSalesAgent}
                            className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-bold shadow-xl flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 whitespace-nowrap"
                        >
                            <Sparkles size={18} className="text-accent" />
                            Activar Ahora
                            <ChevronRight size={18} className="opacity-50" />
                        </button>
                    </div>
                </div>
            )}

            <div className="glass">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('agents.name')}</th>
                            <th>{t('agents.role')}</th>
                            <th>{t('agents.tenant')}</th>
                            <th>{t('agents.model')}</th>
                            <th>{t('agents.status')}</th>
                            <th>{t('agents.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(agent => (
                            <tr key={agent.id}>
                                <td className="font-semibold">{agent.name}</td>
                                <td><span className="badge type">{agent.role}</span></td>
                                <td>
                                    {!agent.tenant_id ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-accent">
                                            <Lock size={12} /> System Template
                                        </span>
                                    ) : (
                                        <span className="text-xs text-secondary">{agent.tenant_name || 'Personal'}</span>
                                    )}
                                </td>
                                <td className="font-mono text-xs">{agent.model_provider} / {agent.model_version}</td>
                                <td>
                                    <span className={`status-dot ${agent.is_active ? 'configured' : ''}`}></span>
                                    {agent.is_active ? t('agents.active') : t('agents.inactive')}
                                </td>
                                <td className="flex gap-2">
                                    <button className="btn-secondary text-xs px-2 py-1" onClick={() => openEdit(agent)}>
                                        <Edit size={12} className="mr-1" /> {t('common.edit')}
                                    </button>
                                    <button className="btn-delete text-xs px-2 py-1" onClick={() => handleDelete(agent.id!)}>
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center p-20">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="bg-accent/10 p-4 rounded-full text-accent scale-150 mb-4 animate-bounce-subtle">
                                            <Bot size={40} />
                                        </div>
                                        <h3 className="text-xl font-black text-white">{t('agents.noAgentsTitle') || 'Tu Armada está vacía'}</h3>
                                        <p className="text-secondary text-sm max-w-xs mx-auto">
                                            {t('agents.noAgentsDesc') || 'Aún no tienes agentes configurados. Comienza creando uno con nuestra plantilla maestra.'}
                                        </p>
                                        <button
                                            className="btn-primary mt-4 px-8 py-3"
                                            onClick={openNew}
                                        >
                                            <Plus size={18} className="mr-2" /> {t('agents.newAgent') || 'Crear mi primer Agente'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? t('common.edit') + ' ' + t('agents.name') : t('agents.newAgent')}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>{t('agents.name')}</label>
                            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Agente de Ventas 1" />
                        </div>
                        <div className="form-group">
                            <label>{t('agents.tenant')}</label>
                            <select required value={formData.tenant_id} onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}>
                                <option value={0}>{t('common.select')}...</option>
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.store_name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>{t('agents.model')}</label>
                            <select value={formData.model_provider} onChange={e => setFormData({ ...formData, model_provider: e.target.value })}>
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Version</label>
                            <input value={formData.model_version} onChange={e => setFormData({ ...formData, model_version: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="flex justify-between items-center mb-1">
                            <label>{t('agents.identity')}</label>
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
                        <label>{t('agents.active')}</label>
                    </div>

                    <div className="form-group">
                        <label>{t('agents.channels')}</label>
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
                        <label>{t('agents.tools')}</label>
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

                    <div className="form-group">
                        <label className="flex items-center gap-2">
                            <BookOpen size={16} className="text-accent" />
                            Knowledge Base (RAG)
                        </label>
                        <div className="text-[11px] text-secondary mb-2 italic">
                            Vincula archivos específicos para que este agente tenga acceso a su contenido.
                        </div>
                        <div className="grid grid-cols-1 gap-2 mt-2 p-3 glass rounded border border-white/5 max-h-40 overflow-y-auto">
                            {knowledgeFiles.filter(f => f.status === 'active').map(file => (
                                <label key={file.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.knowledge_sources?.includes(file.id)}
                                        onChange={e => {
                                            const current = formData.knowledge_sources || [];
                                            if (e.target.checked) setFormData({ ...formData, knowledge_sources: [...current, file.id] });
                                            else setFormData({ ...formData, knowledge_sources: current.filter(id => id !== file.id) });
                                        }}
                                    />
                                    <span className="text-xs truncate">{file.filename}</span>
                                </label>
                            ))}
                            {knowledgeFiles.filter(f => f.status === 'active').length === 0 && (
                                <span className="text-xs text-secondary italic">No hay archivos activos en la base de conocimiento.</span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                        <button type="submit" className="btn-primary">{t('common.save')}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
