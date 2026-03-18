import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ShoppingBag, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink, Package } from 'lucide-react';

interface ProductItem {
    name: string;
    quantity: number;
    price: string;
    image: string;
    variant?: string[];
}

interface OrderItem {
    id: string;
    number: string;
    created_at: string;
    total: string;
    currency: string;
    status: string;
    payment_status: string;
    customer_name: string;
    products?: ProductItem[];
}

interface SalesData {
    tiendanube_connected: boolean;
    total_orders: number;
    total_revenue: number;
    total_revenue_formatted: string;
    avg_ticket: number;
    avg_ticket_formatted: string;
    by_status: Record<string, number>;
    by_payment_status: Record<string, number>;
    recent_orders: OrderItem[];
    attributed_to_ai: {
        orders: number;
        revenue: number;
        revenue_formatted: string;
        percentage: number;
    };
}

const statusColors: Record<string, string> = {
    paid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cancelled: 'text-red-400 bg-red-500/10 border-red-500/20',
    refunded: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    closed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    open: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const color = statusColors[status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    return (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${color}`}>
            {status}
        </span>
    );
};

export const SalesDashboard: React.FC = () => {
    const { fetchApi } = useApi();
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const result = await fetchApi('/admin/sales/dashboard?days=30');
                setData(result);
            } catch (e) {
                console.error('SalesDashboard fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 300000); // Refresh every 5 min
        return () => clearInterval(interval);
    }, [fetchApi]);

    if (loading) {
        return (
            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[24px] border border-white/10 animate-pulse h-48 flex items-center justify-center">
                <span className="text-gray-500 font-mono text-sm">LOADING SALES DATA...</span>
            </div>
        );
    }

    if (!data || !data.tiendanube_connected) {
        return (
            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[24px] border border-white/10 border-dashed">
                <div className="flex items-center gap-3 mb-3">
                    <ShoppingBag size={20} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Ventas en tiempo real</span>
                </div>
                <p className="text-gray-500 text-sm">
                    Conecta tu Tienda Nube para ver ventas reales, estados de pedidos y atribucion al agente IA.
                </p>
                <a href="/settings" className="inline-block mt-4 text-xs font-bold text-red-400 hover:text-red-300 uppercase tracking-wider">
                    Conectar Tienda Nube →
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Revenue Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Revenue */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[20px] border border-white/10 group hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ventas Totales</span>
                    </div>
                    <div className="text-3xl font-black text-white tracking-tighter">{data.total_revenue_formatted}</div>
                    <div className="text-xs text-gray-500 mt-1">{data.total_orders} pedidos | Ticket prom. {data.avg_ticket_formatted}</div>
                    <div className="text-[9px] text-emerald-500/70 font-bold mt-2 flex items-center gap-1">
                        <CheckCircle size={10} /> LIVE DATA — Tienda Nube
                    </div>
                </div>

                {/* Attributed to AI */}
                <div className="bg-gradient-to-br from-emerald-900/20 to-black p-6 rounded-[20px] border border-emerald-500/20 group hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Ventas del Agente IA</span>
                    </div>
                    <div className="text-3xl font-black text-emerald-300 tracking-tighter">{data.attributed_to_ai.revenue_formatted}</div>
                    <div className="text-xs text-emerald-400/60 mt-1">{data.attributed_to_ai.orders} pedidos atribuidos</div>
                    {data.attributed_to_ai.percentage > 0 && (
                        <div className="mt-2 bg-emerald-500/10 rounded-full px-3 py-1 inline-block">
                            <span className="text-[10px] font-black text-emerald-400">{data.attributed_to_ai.percentage}% de tus ventas</span>
                        </div>
                    )}
                </div>

                {/* Status Breakdown */}
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[20px] border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Por Estado de Pago</span>
                    </div>
                    <div className="space-y-2">
                        {Object.entries(data.by_payment_status).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <StatusBadge status={status} />
                                <span className="text-sm font-bold text-white">{count}</span>
                            </div>
                        ))}
                        {Object.keys(data.by_payment_status).length === 0 && (
                            <span className="text-xs text-gray-600">Sin datos</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Orders with Products */}
            {data.recent_orders.length > 0 && (
                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[20px] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ventas Recientes</span>
                        <a href="/analytics/roi" className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-wider flex items-center gap-1">
                            Ver todas <ExternalLink size={10} />
                        </a>
                    </div>
                    <div className="space-y-3">
                        {data.recent_orders.map((order, i) => (
                            <div key={i} className="py-3 border-b border-white/5 last:border-0">
                                {/* Order header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-mono text-gray-400">#{order.number}</span>
                                        <span className="text-sm text-white font-medium">{order.customer_name || 'Sin nombre'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={order.payment_status} />
                                        <span className="text-sm font-bold text-white">${parseFloat(order.total).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Products */}
                                {order.products && order.products.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {order.products.map((prod, j) => (
                                            <div key={j} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                                                {prod.image ? (
                                                    <img
                                                        src={prod.image}
                                                        alt={prod.name}
                                                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                                                        <Package size={14} className="text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-xs text-white font-medium truncate max-w-[120px] sm:max-w-[180px]">{prod.name}</div>
                                                    <div className="text-[10px] text-gray-500">
                                                        {prod.quantity > 1 && `${prod.quantity}x `}${parseFloat(prod.price).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
