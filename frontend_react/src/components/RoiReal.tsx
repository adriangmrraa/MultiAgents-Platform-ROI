import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BadgeDollarSign, TrendingUp, MessageCircle, Instagram, Facebook, Phone, AlertCircle } from 'lucide-react';

interface ChannelData {
    orders: number;
    revenue: number;
}

interface RoiRealData {
    source: string;
    tiendanube_connected: boolean;
    total_sales: {
        orders: number;
        revenue: number;
        formatted: string;
    };
    attributed_to_ai: {
        orders: number;
        revenue: number;
        formatted: string;
        percentage: number;
    };
    by_channel: Record<string, ChannelData>;
    by_method: Record<string, { orders: number }>;
}

const channelIcons: Record<string, React.ReactNode> = {
    whatsapp: <Phone size={14} className="text-green-400" />,
    instagram: <Instagram size={14} className="text-pink-400" />,
    facebook: <Facebook size={14} className="text-blue-400" />,
};

const channelColors: Record<string, string> = {
    whatsapp: 'bg-green-500',
    instagram: 'bg-pink-500',
    facebook: 'bg-blue-500',
};

export const RoiReal: React.FC = () => {
    const { fetchApi } = useApi();
    const [data, setData] = useState<RoiRealData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const result = await fetchApi('/admin/roi/real?days=30');
                setData(result);
            } catch (e) {
                console.error('RoiReal fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchApi]);

    if (loading) {
        return (
            <div className="glass p-4 rounded-xl animate-pulse h-32 flex items-center justify-center">
                <span className="text-emerald-500/50 font-mono text-sm">LOADING ROI ENGINE...</span>
            </div>
        );
    }

    if (!data || !data.tiendanube_connected) {
        // Fallback: show heuristic-style widget
        return <HeuristicFallback />;
    }

    const totalAttrOrders = data.attributed_to_ai.orders;
    const channels = Object.entries(data.by_channel);

    return (
        <div className="glass p-6 rounded-xl relative overflow-hidden border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <BadgeDollarSign className="text-emerald-400" size={24} />
                    <h3 className="text-lg font-bold text-white tracking-wide">ROI DEL AGENTE IA</h3>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono text-emerald-400/80 bg-emerald-900/30 px-2 py-1 rounded">
                    <TrendingUp size={12} />
                    <span>LIVE — 30 DIAS</span>
                </div>
            </div>

            {/* Main Numbers */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Ventas Totales</span>
                    <div className="text-2xl font-black text-white tracking-tight">{data.total_sales.formatted}</div>
                    <span className="text-xs text-gray-500">{data.total_sales.orders} pedidos</span>
                </div>
                <div>
                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase">Atribuidas al IA</span>
                    <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 tracking-tight">
                        {data.attributed_to_ai.formatted}
                    </div>
                    <span className="text-xs text-emerald-400/60">
                        {data.attributed_to_ai.orders} pedidos ({data.attributed_to_ai.percentage}%)
                    </span>
                </div>
            </div>

            {/* Channel Breakdown */}
            {channels.length > 0 && (
                <div className="space-y-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Por Canal</span>
                    {channels.map(([channel, chData]) => {
                        const pct = totalAttrOrders > 0 ? Math.round((chData.orders / totalAttrOrders) * 100) : 0;
                        return (
                            <div key={channel} className="flex items-center gap-3">
                                <div className="w-20 flex items-center gap-1.5">
                                    {channelIcons[channel] || <MessageCircle size={14} className="text-gray-400" />}
                                    <span className="text-xs font-bold text-gray-300 capitalize">{channel}</span>
                                </div>
                                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${channelColors[channel] || 'bg-gray-500'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-xs font-mono text-gray-400 w-16 text-right">
                                    {chData.orders} ({pct}%)
                                </span>
                                <span className="text-xs font-bold text-white w-24 text-right">
                                    ${chData.revenue.toLocaleString()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const HeuristicFallback: React.FC = () => {
    const { fetchApi } = useApi();
    const [roi, setRoi] = useState<{ summary: { formatted: string; total_conversions: number } } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchApi('/admin/reports/assisted-gmv?days=30');
                setRoi(data);
            } catch (e) {
                console.error('ROI heuristic fetch error:', e);
            }
        };
        load();
    }, [fetchApi]);

    return (
        <div className="glass p-6 rounded-xl relative overflow-hidden border border-white/10">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <BadgeDollarSign className="text-gray-400" size={24} />
                    <h3 className="text-lg font-bold text-white tracking-wide">ASSISTED GMV</h3>
                </div>
                <div className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    HEURISTIC
                </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight mb-2">
                {roi?.summary.formatted || '$0'}
            </div>
            <div className="text-xs text-gray-500">
                {roi?.summary.total_conversions || 0} conversiones estimadas
            </div>
            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-dashed border-white/10">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <AlertCircle size={12} />
                    <span>Conecta Tienda Nube para ver datos reales de ventas y atribucion al agente IA</span>
                </div>
            </div>
        </div>
    );
};
