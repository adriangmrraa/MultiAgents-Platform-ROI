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
        const [a, tenantsList, s, k] = await Promise.all([
            fetchApi('/admin/agents'),
            fetchApi('/admin/tenants'),
            fetchApi('/admin/tools'),
            fetchApi('/admin/knowledge/list')
        ]);
        if (a) setAgents(a);
        if (tenantsList) setTenants(tenantsList);
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

    const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp', 'web']);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [channelStatus, setChannelStatus] = useState<Record<string, boolean>>({ whatsapp: false, instagram: false, facebook: false, web: true });

    const handleActivateSalesAgent = async () => {
        if (!user?.tenant_id) return;
        try {
            // Nexus v5.36 flow: Activate -> Show Channel Modal -> Redirect

            // 1. Fetch Integration Status (Sovereign Discovery)
            const status = await fetchApi('/admin/integrations/status');
            if (status) setChannelStatus(status);

            const res = await fetchApi(`/admin/agents/sales-config/${user.tenant_id}`);
            if (res && res.id) {
                // Pre-fill existing channels if any
                if (res.channels && Array.isArray(res.channels)) {
                    setSelectedChannels(res.channels);
                }
                setActiveAgentId(res.id);
                setIsChannelModalOpen(true);
            }
        } catch (e) {
            console.error(e);
            alert("Error activating sales agent. Please contact support.");
        }
    };

    const handleChannelsSave = async () => {
        if (!activeAgentId) return;
        try {
            // Workaround: We will fetch the agent, update channels, then PUT.
            const currentAgent = agents.find(a => a.id === activeAgentId) || await fetchApi(`/admin/agents/${activeAgentId}/config`);

            if (currentAgent) {
                const updated = { ...currentAgent, channels: selectedChannels };
                await fetchApi(`/admin/agents/${activeAgentId}`, { method: 'PUT', body: updated });
                navigate(`/admin/agents/${activeAgentId}`);
            }
        } catch (e) {
            console.error("Failed to save channels", e);
            // Proceed anyway to not block user
            navigate(`/admin/agents/${activeAgentId}`);
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

            {/* Agent Cards (mobile) / Table (desktop) */}
            <div className="space-y-3 lg:hidden">
                {agents.map(agent => (
                    <div key={agent.id} className="glass p-4 rounded-xl border border-white/10">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${agent.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">{agent.name}</p>
                                    <p className="text-xs text-slate-500">{agent.tenant_name || 'Personal'}</p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${agent.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                {agent.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="badge type text-[10px]">{agent.role}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{agent.model_provider}/{agent.model_version}</span>
                        </div>
                        <div className="flex gap-2">
                            <button className="flex-1 btn-secondary text-xs py-2 rounded-lg flex items-center justify-center gap-1" onClick={() => openEdit(agent)}>
                                <Edit size={14} /> Editar
                            </button>
                            <button className="btn-delete text-xs px-3 py-2 rounded-lg" onClick={() => agent.id && handleDelete(agent.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {agents.length === 0 && (
                    <div className="text-center py-12">
                        <Bot size={40} className="text-accent mx-auto mb-4 animate-bounce-subtle" />
                        <h3 className="text-lg font-black text-white mb-2">{t('agents.noAgentsTitle') || 'Tu Armada esta vacia'}</h3>
                        <p className="text-sm text-slate-500 mb-4">{t('agents.noAgentsDesc') || 'Comenza creando un agente.'}</p>
                        <button className="btn-primary px-6 py-3" onClick={openNew}><Plus size={18} className="mr-2" /> Crear Agente</button>
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="glass hidden lg:block">
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
                                    <button className="btn-delete text-xs px-2 py-1" onClick={() => agent.id && handleDelete(agent.id)}>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>{t('agents.name')}</label>
                            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Agente de Ventas 1" />
                        </div>
                        <div className="form-group">
                            <label>{t('agents.tenant')}</label>
                            <select required value={formData.tenant_id} onChange={e => setFormData({ ...formData, tenant_id: parseInt(e.target.value) })}>
                                <option value={0}>{t('common.select')}...</option>
                                {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.store_name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            else setFormData({ ...formData, enabled_tools: current.filter(item => item !== tool.name) });
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

            {/* Nexus v5.36: Channel Connection Modal */}
            <Modal
                isOpen={isChannelModalOpen}
                onClose={() => setIsChannelModalOpen(false)}
                title="Conecta tu Vendedor al Mundo"
            >
                <div className="space-y-6">
                    <div className="bg-purple-600/10 border border-purple-600/20 p-4 rounded-xl flex items-center gap-3">
                        <div className="bg-purple-600 rounded-full p-2 text-white">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">¡Vendedor Activado!</h4>
                            <p className="text-secondary text-sm">Antes de entrenarlo, elige dónde trabajará.</p>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="mb-3 block text-sm font-semibold text-white">Canales de Atención</label>
                        <div className="grid grid-cols-1 gap-3">
                            {['whatsapp', 'instagram', 'facebook', 'web'].map(ch => {
                                const isConnected = channelStatus[ch];
                                return (
                                    <label key={ch} className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all
                                    ${isConnected
                                            ? selectedChannels.includes(ch) ? 'bg-accent/20 border-accent text-white cursor-pointer' : 'bg-white/5 border-white/10 text-secondary hover:bg-white/10 cursor-pointer'
                                            : 'bg-black/40 border-white/5 text-gray-500 cursor-not-allowed opacity-60'}
                                `}>
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                            w-6 h-6 rounded-full border flex items-center justify-center
                                            ${isConnected && selectedChannels.includes(ch) ? 'bg-accent border-accent' : 'border-white/30'}
                                        `}>
                                                {isConnected && selectedChannels.includes(ch) && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="capitalize font-medium">{ch}</span>
                                                {!isConnected && <span className="text-[10px] text-red-400">Desconectado</span>}
                                            </div>
                                        </div>

                                        {isConnected ? (
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                disabled={!isConnected}
                                                checked={selectedChannels.includes(ch)}
                                                onChange={() => {
                                                    if (selectedChannels.includes(ch)) setSelectedChannels(prev => prev.filter(c => c !== ch));
                                                    else setSelectedChannels(prev => [...prev, ch]);
                                                }}
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigate('/settings/integrations'); }}
                                                className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white"
                                            >
                                                Conectar
                                            </button>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setIsChannelModalOpen(false);
                                if (activeAgentId) navigate(`/admin/agents/${activeAgentId}`);
                            }}
                        >
                            Omitir
                        </button>
                        <button
                            className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
                            onClick={handleChannelsSave}
                        >
                            Guardar y Personalizar <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
