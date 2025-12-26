import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BarChart3, TrendingUp, Users, AlertCircle, MessageSquare } from 'lucide-react';

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

    // Find max for scaling chart
    const maxCount = Math.max(...dailyData.map(d => d.count), 1);

    return (
        <div className="view active animate-fade-in">
            <h1 className="view-title">Métricas y Rendimiento</h1>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="stat-card glass p-6 relative overflow-hidden group">
                    <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MessageSquare size={48} />
                    </div>
                    <h3 className="text-secondary text-sm font-medium mb-1">Mensajes Totales</h3>
                    <p className="text-3xl font-bold text-white">{kpis.total_messages.toLocaleString()}</p>
                    <div className="mt-4 text-xs text-green-400 flex items-center gap-1">
                        <TrendingUp size={12} /> +{kpis.messages_today} hoy
                    </div>
                </div>

                <div className="stat-card glass p-6 relative overflow-hidden group">
                    <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={48} />
                    </div>
                    <h3 className="text-secondary text-sm font-medium mb-1">Usuarios Activos (24h)</h3>
                    <p className="text-3xl font-bold text-white">{kpis.active_users_24h}</p>
                    <div className="mt-4 text-xs text-secondary opacity-70">
                        Interacciones recientes
                    </div>
                </div>

                <div className="stat-card glass p-6 relative overflow-hidden group">
                    <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircle size={48} />
                    </div>
                    <h3 className="text-secondary text-sm font-medium mb-1">Errores (Hoy)</h3>
                    <p className={`text-3xl font-bold ${kpis.errors_today > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {kpis.errors_today}
                    </p>
                    <div className="mt-4 text-xs text-secondary opacity-70">
                        Eventos del sistema
                    </div>
                </div>
            </div>

            {/* Custom Bar Chart - Messages Last 7 Days */}
            <div className="glass p-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BarChart3 className="text-accent" /> Volumen de Mensajes (7 Días)
                    </h2>
                </div>

                {dailyData.length > 0 ? (
                    <div className="flex items-end justify-between h-[300px] gap-4">
                        {dailyData.map((d) => {
                            const heightPercent = (d.count / maxCount) * 100;
                            return (
                                <div key={d.date} className="flex flex-col items-center flex-1 h-full justify-end group">
                                    <div className="relative w-full flex justify-center items-end h-full">
                                        {/* Bar */}
                                        <div
                                            className="w-full max-w-[50px] bg-white/10 rounded-t-lg transition-all duration-500 hover:bg-accent group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] relative"
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/20">
                                                {d.count} msgs
                                            </div>
                                        </div>
                                    </div>
                                    {/* Label */}
                                    <div className="mt-4 text-xs text-secondary font-mono transform -rotate-45 origin-top-left translate-x-2">
                                        {d.date.slice(5)} {/* Show MM-DD */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-secondary opacity-50">
                        No hay datos suficientes para graficar.
                    </div>
                )}
            </div>
        </div>
    );
};
