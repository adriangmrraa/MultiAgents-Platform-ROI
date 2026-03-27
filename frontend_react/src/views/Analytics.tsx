import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BarChart3, TrendingUp, Users, AlertCircle, MessageSquare, Activity } from 'lucide-react';

interface KPIs {
    total_messages: number;
    messages_today: number;
    active_users_24h: number;
    errors_today: number;
}

interface DailyData {
    date: string;
    count: number;
}

export const Analytics: React.FC = () => {
    const { fetchApi, loading } = useApi();
    const [kpis, setKpis] = useState<KPIs>({ total_messages: 0, messages_today: 0, active_users_24h: 0, errors_today: 0 });
    const [dailyData, setDailyData] = useState<DailyData[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [kpiData, daily] = await Promise.all([
                    fetchApi('/admin/analytics/kpis'),
                    fetchApi('/admin/analytics/daily')
                ]);
                if (kpiData) setKpis(kpiData);
                if (Array.isArray(daily)) setDailyData(daily);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, [fetchApi]);

    const maxCount = Math.max(...dailyData.map(d => d.count), 1);

    return (
        <div className="view active animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                    <Activity size={20} className="text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">Metricas y Rendimiento</h1>
                    <p className="text-xs text-gray-500">Vista general del sistema</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                    <div className="absolute -right-2 -top-2 w-16 h-16 bg-purple-600/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center mb-3">
                        <MessageSquare size={16} className="text-purple-400" />
                    </div>
                    <h3 className="text-xs text-gray-500 font-medium mb-1">Mensajes Totales</h3>
                    <p className="text-2xl font-black text-white">{kpis.total_messages.toLocaleString()}</p>
                    <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                        <TrendingUp size={12} /> +{kpis.messages_today} hoy
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                    <div className="absolute -right-2 -top-2 w-16 h-16 bg-blue-600/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mb-3">
                        <BarChart3 size={16} className="text-blue-400" />
                    </div>
                    <h3 className="text-xs text-gray-500 font-medium mb-1">Mensajes Hoy</h3>
                    <p className="text-2xl font-black text-white">{kpis.messages_today.toLocaleString()}</p>
                    <div className="mt-2 text-xs text-gray-600">Procesados hoy</div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/20 transition-colors">
                    <div className="absolute -right-2 -top-2 w-16 h-16 bg-cyan-600/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-3">
                        <Users size={16} className="text-cyan-400" />
                    </div>
                    <h3 className="text-xs text-gray-500 font-medium mb-1">Usuarios Activos (24h)</h3>
                    <p className="text-2xl font-black text-white">{kpis.active_users_24h}</p>
                    <div className="mt-2 text-xs text-gray-600">Interacciones recientes</div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-red-500/20 transition-colors">
                    <div className="absolute -right-2 -top-2 w-16 h-16 bg-red-600/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center mb-3">
                        <AlertCircle size={16} className="text-red-400" />
                    </div>
                    <h3 className="text-xs text-gray-500 font-medium mb-1">Errores Hoy</h3>
                    <p className={`text-2xl font-black ${kpis.errors_today > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {kpis.errors_today}
                    </p>
                    <div className="mt-2 text-xs text-gray-600">Eventos del sistema</div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                        <BarChart3 size={18} className="text-purple-400" /> Volumen de Mensajes (7 Dias)
                    </h2>
                </div>

                {dailyData.length > 0 ? (
                    <div className="flex items-end justify-between h-[200px] sm:h-[280px] gap-2 sm:gap-4">
                        {dailyData.map((d) => {
                            const heightPercent = (d.count / maxCount) * 100;
                            return (
                                <div key={d.date} className="flex flex-col items-center flex-1 h-full justify-end group">
                                    <div className="relative w-full flex justify-center items-end h-full">
                                        <div
                                            className="w-full max-w-[50px] bg-gradient-to-t from-purple-600/30 to-blue-600/30 border border-purple-500/20 rounded-t-lg transition-all duration-500 hover:from-purple-600/50 hover:to-blue-600/50 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] relative"
                                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0a0a0f] text-white text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 font-mono">
                                                {d.count}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-[10px] text-gray-600 font-mono">
                                        {d.date.slice(5)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[280px] flex flex-col items-center justify-center text-gray-600">
                        <BarChart3 size={32} className="mb-3 opacity-20" />
                        <p className="text-sm">No hay datos suficientes para graficar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
