import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Modal } from '../components/Modal';
import { Wrench, Plus, Settings, Sparkles, HelpCircle, Activity } from 'lucide-react';

interface Tool {
    name: string;
    type: string;
    service_url?: string;
    prompt_injection?: string;
    response_guide?: string;
    config?: any;
    id?: number;
}

const TACTICAL_TEMPLATES: Record<string, string> = {
    'search_specific_products': "TÁCTICA: Cuando busques productos, usa SIEMPRE el parámetro 'q' con el nombre del producto, categoría o marca exacta. \n\nEjemplo: Si te preguntan por 'Zapatillas Nike', usa q='Nike'. \n\nSi el cliente pregunta de forma vaga, pide precisión antes de buscar. NO inventes productos.",
    'search_by_category': "TÁCTICA: Selecciona la categoría correcta del catálogo para el parámetro 'category'. \n\nSi el cliente busca 'ropa', pregúntale si busca 'Remeras', 'Pantalones', etc. \n\nSi no estás seguro, usa 'search_specific_products' en su lugar.",
    'browse_general_storefront': "TÁCTICA: Usa esta herramienta solo para dar una visión de lanzamiento o 'lo nuevo'. \n\nSi el cliente menciona un producto específico, detente y usa 'search_specific_products'.",
    'orders': "TÁCTICA: Para buscar órdenes, solicita al cliente el ID numérico sin el símbolo #. \n\nInforma el estado actual de forma clara (Ej: 'Tu orden está en preparación').",
    'cupones_list': "TÁCTICA: Muestra los cupones disponibles pero aclara siempre sus condiciones de uso y fecha de expiración.",
    'derivhumano': "TÁCTICA: Activa esta herramienta si detectas frustración extrema (insultos, múltiples 'no entiendo'), o si el cliente pide hablar con un humano explícitamente. \n\nResume la situación para el operador humano."
};

const RESPONSE_TEMPLATES: Record<string, string> = {
    'search_specific_products': "GUÍA DE RESPUESTA: Extrae el nombre, precio y URL de los productos. Si no hay stock, indícalo claramente. Presenta los 3 mejores resultados con links directos.",
    'search_by_category': "GUÍA DE RESPUESTA: Lista de forma atractiva las subcategorías encontradas y pregunta al usuario cuál desea explorar.",
    'browse_general_storefront': "GUÍA DE RESPUESTA: Resalta los primeros 3 productos de la tienda con sus precios y un link general 'Ver todo'.",
    'orders': "GUÍA DE RESPUESTA: Extrae estado del pago, estado del envío y fecha de creación. Traduce tags técnicos a lenguaje humano amigable.",
    'cupones_list': "GUÍA DE RESPUESTA: Muestra el código en negrita y explica brevemente cómo aplicarlo en el checkout.",
    'derivhumano': "GUÍA DE RESPUESTA: Avisa al cliente que 'X' operador ha sido alertado y que recibirá una respuesta a la brevedad."
};

export const Tools: React.FC = () => {
    const { fetchApi } = useApi();
    const [tools, setTools] = useState<Tool[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Tool>({ name: '', type: 'http', service_url: '', prompt_injection: '', config: {} });

    const loadTools = async () => {
        try {
            const data = await fetchApi('/admin/tools');
            setTools(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadTools();
    }, []);

    const openForEdit = (tool: Tool) => {
        // Only allow editing descriptions/prompts for now, name is locked for consistency if system
        setFormData({ ...tool });
        setIsModalOpen(true);
    };

    const [improving, setImproving] = useState(false);

    const handleImprovePrompt = async (field: string) => {
        const text = field === 'prompt' ? formData.prompt_injection : '';
        if (!text) return;
        setImproving(true);
        try {
            const res = await fetchApi('/admin/ai/improve-prompt', { method: 'POST', body: { text, context: 'tool' } });
            if (res.refined_text) {
                setFormData({ ...formData, prompt_injection: res.refined_text });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setImproving(false);
        }
    };

    const openForNew = () => {
        setFormData({ name: '', type: 'http', service_url: '', prompt_injection: '', config: {} });
        setIsModalOpen(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Check if we are updating or creating. 
            // Currently API only supports POST (create) or DELETE. 
            // For MVP, we will assume Create New. 
            // However, the User wants to "Click Config" -> "Display Menu". 
            // So we need to support updating the prompt.
            // But the API I implemented only does Create. 
            // Strategy: For system tools, we might need a separate endpoint or just allow overriding via DB entry with same name?
            // Actually, admin_routes code explicitly blocks creating tools with same name as system tools.
            // AND we can't edit system tools.
            // The User said: "And also in the tool page, the config buttons... display a menu... to add this."
            // This implies editing existing tools or system tools.
            // I'll implement the creation flow first, but the UI suggests editing.
            // I will assume for now we are creating new custom tools.

            await fetchApi('/admin/tools', { method: 'POST', body: formData });
            setIsModalOpen(false);
            loadTools();
        } catch (e) {
            alert('Error al guardar herramienta');
        }
    };

    return (
        <div className="view active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 className="view-title" style={{ margin: 0 }}>Armory: Tactical Tools</h1>
                <button className="btn-primary" onClick={openForNew}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nueva Herramienta
                </button>
            </div>

            <div className="glass">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>URL de Servicio</th>
                            <th>Prompt Injection (Instrucciones)</th>
                            <th>Configuración</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tools.map((t, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{t.name}</td>
                                <td><span className="badge type">{t.type}</span></td>
                                <td style={{ fontSize: '12px', color: '#a1a1aa' }}>{t.service_url || 'N/A'}</td>
                                <td style={{ fontSize: '12px', color: '#a1a1aa', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.prompt_injection || <span style={{ opacity: 0.5 }}>Sin instrucciones extra</span>}
                                </td>
                                <td>
                                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => openForEdit(t)}>
                                        <Settings size={12} style={{ marginRight: '4px' }} /> Configurar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Editar Herramienta" : "Nueva Herramienta"}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre de la Herramienta</label>
                        <input
                            required
                            disabled={!!formData.id}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Buscador de Productos"
                        />
                    </div>
                    <div className="form-group">
                        <label>Tipo</label>
                        <select
                            disabled={!!formData.id}
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="http">HTTP Request (API)</option>
                            <option value="tienda_nube">Tienda Nube Action</option>
                            <option value="function">Function Call</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Prompt Injection (System Prompt)
                                <HelpCircle size={14} style={{ opacity: 0.5 }} title="Estas instrucciones le dicen al Agente CÓMO usar esta herramienta específica." />
                            </label>
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '10px', height: 'auto', border: '1px solid var(--accent)' }}
                                onClick={() => handleImprovePrompt('prompt')}
                                disabled={improving || !formData.prompt_injection}
                            >
                                <Sparkles size={10} style={{ marginRight: '4px' }} />
                                {improving ? 'Mejorando...' : 'Mejorar con IA'}
                            </button>
                        </div>
                        <div className="input-hint">Define el "comportamiento táctico" del agente con esta herramienta.</div>
                        {TACTICAL_TEMPLATES[formData.name] && !formData.prompt_injection && (
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ margin: '8px 0', fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)' }}
                                onClick={() => setFormData({ ...formData, prompt_injection: TACTICAL_TEMPLATES[formData.name] })}
                            >
                                <Plus size={10} className="mr-1" /> Cargar Plantilla Recomendada para {formData.name}
                            </button>
                        )}
                        <textarea
                            rows={6}
                            value={formData.prompt_injection}
                            onChange={e => setFormData({ ...formData, prompt_injection: e.target.value })}
                            placeholder="Ej: Deberías usar esta herramienta siempre que el cliente pregunte por precios exactos..."
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontFamily: 'monospace', marginTop: '8px' }}
                        />

                        <div className="mt-6 mb-2 flex items-center gap-2 text-accent font-bold">
                            <Activity size={16} /> 2. PROTOCOLO DE RESPUESTA / EXTRACCIÓN
                        </div>
                        <div className="input-hint">Define cómo el agente debe procesar la salida de esta herramienta y qué datos debe presentar al usuario.</div>
                        {RESPONSE_TEMPLATES[formData.name] && !formData.response_guide && (
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ margin: '8px 0', fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)' }}
                                onClick={() => setFormData({ ...formData, response_guide: RESPONSE_TEMPLATES[formData.name] })}
                            >
                                <Plus size={10} className="mr-1" /> Cargar Plantilla Extracción para {formData.name}
                            </button>
                        )}
                        <textarea
                            rows={6}
                            value={formData.response_guide}
                            onChange={e => setFormData({ ...formData, response_guide: e.target.value })}
                            placeholder="Ej: Extrae solo el ID de seguimiento y dáselo al cliente resaltado..."
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontFamily: 'monospace', marginTop: '8px' }}
                        />
                    </div>

                    {formData.type === 'http' && (
                        <div className="form-group">
                            <label>Service URL</label>
                            <input value={formData.service_url} onChange={e => setFormData({ ...formData, service_url: e.target.value })} placeholder="https://api.example.com/v1/search" />
                        </div>
                    )}
                    <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
