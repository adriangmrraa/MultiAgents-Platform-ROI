import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BadgeDollarSign, Phone, Instagram, Facebook, MessageCircle, Filter, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AttributedOrder {
    id: string;
    order_id: string;
    order_number: string;
    order_total: number;
    order_currency: string;
    order_status: string;
    payment_status: string;
    order_created_at: string;
    customer_name: string;
    channel_source: string;
    attribution_method: string;
    attribution_confidence: number;
    conversation_id: string | null;
    conversation_preview: string | null;
    attributed_at: string | null;
}

interface RoiData {
    source: string;
    tiendanube_connected: boolean;
    total_sales: { orders: number; revenue: number; formatted: string };
    attributed_to_ai: { orders: number; revenue: number; formatted: string; percentage: number };
    by_channel: Record<string, { orders: number; revenue: number }>;
    by_method: Record<string, { orders: number }>;
}

const channelIcons: Record<string, React.ReactNode> = {
    whatsapp: <Phone size={14} className="text-green-400" />,
    instagram: <Instagram size={14} className="text-pink-400" />,
    facebook: <Facebook size={14} className="text-blue-400" />,
};

const methodLabels: Record<string, string> = {
    phone_match: 'Telefono (WhatsApp)',
    utm_tracking: 'Link Tracking (UTM)',
    email_match: 'Email (ventana temporal)',
};

const confidenceColor = (c: number) => {
    if (c >= 0.9) return 'text-emerald-400';
    if (c >= 0.5) return 'text-amber-400';
    return 'text-gray-400';
};

export const RoiAnalytics: React.FC = () => {
    const { fetchApi } = useApi();
    const [roi, setRoi] = useState<RoiData | null>(null);
    const [orders, setOrders] = useState<AttributedOrder[]>([]);
    const [totalOrders, setTotalOrders] = useState(0);
    const [page, setPage] = useState(1);
    const [channelFilter, setChannelFilter] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRoi = async () => {
            try {
                const data = await fetchApi('/admin/roi/real?days=30');
                setRoi(data);
            } catch (e) {
                console.error('ROI fetch error:', e);
            }
        };
        loadRoi();
    }, [fetchApi]);

    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            try {
                let url = `/admin/roi/attributed-orders?days=30&page=${page}&per_page=15`;
                if (channelFilter) url += `&channel=${channelFilter}`;
                if (methodFilter) url += `&method=${methodFilter}`;
                const data = await fetchApi(url);
                setOrders(data.orders || []);
                setTotalOrders(data.total || 0);
            } catch (e) {
                console.error('Attributed orders fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        loadOrders();
    }, [fetchApi, page, channelFilter, methodFilter]);

    const totalPages = Math.ceil(totalOrders / 15);

    return (
        <div className="view active">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/" className="text-gray-500 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="view-title">ROI Analytics — Atribucion de Ventas</h1>
            </div>

            {/* Summary Cards */}
            {roi && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/5 p-6 rounded-[20px] border border-white/10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ventas Totales (30d)</span>
                        <div className="text-3xl font-black text-white mt-1">{roi.total_sales.formatted}</div>
                        <span className="text-xs text-gray-500">{roi.total_sales.orders} pedidos</span>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-900/20 to-black p-6 rounded-[20px] border border-emerald-500/20">
                        <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Atribuidas al IA</span>
                        <div className="text-3xl font-black text-emerald-300 mt-1">{roi.attributed_to_ai.formatted}</div>
                        <span className="text-xs text-emerald-400/60">{roi.attributed_to_ai.orders} pedidos ({roi.attributed_to_ai.percentage}%)</span>
                    </div>

                    {/* By Channel mini cards */}
                    {Object.entries(roi.by_channel).slice(0, 2).map(([ch, data]) => (
                        <div key={ch} className="bg-white/5 p-6 rounded-[20px] border border-white/10">
                            <div className="flex items-center gap-2 mb-1">
                                {channelIcons[ch] || <MessageCircle size={14} className="text-gray-400" />}
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest capitalize">{ch}</span>
                            </div>
                            <div className="text-2xl font-black text-white mt-1">${data.revenue.toLocaleString()}</div>
                            <span className="text-xs text-gray-500">{data.orders} pedidos</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <Filter size={16} className="text-gray-500" />
                <select
                    value={channelFilter}
                    onChange={e => { setChannelFilter(e.target.value); setPage(1); }}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                >
                    <option value="">Todos los canales</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                </select>
                <select
                    value={methodFilter}
                    onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                >
                    <option value="">Todos los metodos</option>
                    <option value="phone_match">Telefono</option>
                    <option value="utm_tracking">Link Tracking</option>
                    <option value="email_match">Email</option>
                </select>
                <span className="text-xs text-gray-500">{totalOrders} ordenes atribuidas</span>
            </div>

            {/* Orders Table */}
            <div className="bg-white/5 rounded-[20px] border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Orden</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Cliente</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Monto</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Estado</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Canal</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Metodo</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Confianza</th>
                                <th className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 py-3">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500 text-sm">Cargando...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500 text-sm">Sin ordenes atribuidas en este periodo</td></tr>
                            ) : orders.map(order => (
                                <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-mono text-gray-300">#{order.order_number}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-white">{order.customer_name || '-'}</span>
                                        {order.conversation_preview && (
                                            <div className="text-[10px] text-gray-600 truncate max-w-[200px]">{order.conversation_preview}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold text-white">${order.order_total?.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                            order.payment_status === 'paid' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                            order.payment_status === 'pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                            'text-gray-400 bg-gray-500/10 border-gray-500/20'
                                        }`}>
                                            {order.payment_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {channelIcons[order.channel_source] || <MessageCircle size={12} className="text-gray-400" />}
                                            <span className="text-xs text-gray-300 capitalize">{order.channel_source}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-gray-400">{methodLabels[order.attribution_method] || order.attribution_method}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-bold ${confidenceColor(order.attribution_confidence)}`}>
                                            {Math.round(order.attribution_confidence * 100)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-gray-500">
                                            {order.order_created_at ? new Date(order.order_created_at).toLocaleDateString() : '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <span className="text-xs text-gray-500">Pagina {page} de {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
