import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Target, TrendingUp, Coins, CheckCircle, MessageSquare, ArrowLeft, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

interface AssistData {
    sales_score: number;
    support_score: number;
    total_checkpoints: number;
    estimated_savings: string;
    recent_audits: Array<{
        conversation_id: string;
        type: string;
        score: number;
        reasoning: string;
        timestamp: string;
    }>;
}

export const AssistAnalytics: React.FC = () => {
    const { fetchApi } = useApi();
    const { t } = useLanguage();
    const [data, setData] = useState<AssistData | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                // For now we get stats and we could mock or get detailed audits if we implement the endpoint
                const stats = await fetchApi('/admin/stats');
                // We'll simulate audits if specialized endpoint doesn't exist yet
                setData({
                    sales_score: stats.assist_metrics?.sales_score || 0,
                    support_score: stats.assist_metrics?.support_score || 0,
                    total_checkpoints: stats.assist_metrics?.checkpoints || 0,
                    estimated_savings: stats.assist_metrics?.estimated_savings || '$0',
                    recent_audits: [] // To be populated from a real endpoint later
                });

                // Try to fetch detailed audits
                try {
                    const audits = await fetchApi('/admin/analytics/assist-audits');
                    if (audits && Array.isArray(audits)) {
                        setData(prev => prev ? { ...prev, recent_audits: audits } : null);
                    }
                } catch (e) {
                    console.log("Detailed audits endpoint not yet available.");
                }

            } catch (err) {
                console.error("Failed to load assist analytics:", err);
            }
        };
        load();
    }, [fetchApi]);

    if (!data) return <div className="p-8 text-gray-500 font-mono tracking-widest animate-pulse">DECODING NEURAL IMPACT...</div>;

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-gray-400" />
                </Link>
                <h1 className="view-title m-0">ROI Deep Dive: Assist Score</h1>
            </div>

            {/* Matrix Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={80} className="text-emerald-500" />
                    </div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Impacto en Ventas</div>
                    <div className="text-4xl font-black text-white">{data.sales_score}</div>
                    <div className="text-xs text-emerald-500/70 font-bold mt-1">Puntos de Tracción Comercial</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Coins size={80} className="text-emerald-500" />
                    </div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ahorro en Soporte</div>
                    <div className="text-4xl font-black text-white">{data.estimated_savings}</div>
                    <div className="text-xs text-emerald-500/70 font-bold mt-1">Valor Operativo Rescatado</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <CheckCircle size={80} className="text-emerald-500" />
                    </div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Checkpoints de Auditoría</div>
                    <div className="text-4xl font-black text-white">{data.total_checkpoints}</div>
                    <div className="text-xs text-gray-500 font-bold mt-1">Evaluaciones Autónomas 24/7</div>
                </div>
            </div>

            {/* Neural Logic explanation */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-8 mb-8 flex flex-col md:flex-row gap-8 items-center">
                <div className="bg-emerald-500/20 p-4 rounded-full">
                    <Lightbulb size={32} className="text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-white font-black text-lg mb-2">¿Cómo calculamos el valor?</h3>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                        Nuestro protocolo <strong>Sovereign Assist Score (v1.0)</strong> audita la conversación cada 3 turnos.
                        Asignamos puntos de <strong>Ventas</strong> cuando la IA logra que el cliente avance en el funnel (identificación de producto, variantes, stock o pago).
                        El <strong>Ahorro en Soporte</strong> se calcula en base al tiempo de atención humana ahorrado al resolver consultas técnicas o logísticas de forma autónoma.
                    </p>
                </div>
            </div>

            {/* Audit Log */}
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 px-2">Log de Auditoría Neuronal Reciente</h2>
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Timestamp</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Score</th>
                            <th className="px-6 py-4">Razonamiento de la IA</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.recent_audits.length > 0 ? data.recent_audits.map((audit, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 font-mono text-[10px] text-gray-500">
                                    {new Date(audit.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${audit.type === 'sales' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {audit.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-black">
                                    +{audit.score}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-xs italic">
                                    "{audit.reasoning}"
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-600 font-medium italic">
                                    Iniciando motor de auditoría... Se mostrarán datos en tiempo real al finalizar las próximas interacciones.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
