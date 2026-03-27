import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Link } from 'react-router-dom';
import { Activity, MessageSquare, Target, TrendingUp, Coins, ArrowRight, ShoppingBag } from 'lucide-react';
import { GlobalStreamLog } from '../components/GlobalStreamLog';
import { RagGalaxy } from '../components/RagGalaxy';
import { SystemStatus } from '../components/SystemStatus';

interface Stats {
    active_tenants: number;
    total_messages: number;
    processed_messages: number;
    roi_metrics: {
        source?: string;
        total_gmv: number;
        conversions: number;
        last_30_days: number;
        formatted_gmv: string;
        attributed_gmv?: number;
        attributed_orders?: number;
        formatted_attributed?: string;
    };
    assist_metrics?: {
        sales_score: number;
        support_score: number;
        checkpoints: number;
        estimated_savings: string;
    };
    sales_metrics?: {
        tiendanube_connected: boolean;
        total_orders_30d: number;
        total_revenue_30d: number;
        total_revenue_formatted: string;
        attributed_orders: number;
        attributed_revenue: number;
        attributed_revenue_formatted: string;
    };
}

interface HealthCheck {
    name: string;
    status: 'OK' | 'FAIL' | 'WARN';
    details?: string;
}

interface HealthData {
    status: string;
    checks: HealthCheck[];
}



import { useLanguage } from '../contexts/LanguageContext';

export const Dashboard: React.FC = () => {
    const { fetchApi } = useApi();
    const { t } = useLanguage();
    const [health, setHealth] = useState<HealthData>({ status: 'unknown', checks: [] });
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const [healthData, statsData] = await Promise.all([
                    fetchApi('/admin/health'),
                    fetchApi('/admin/stats')
                ]);
                setHealth(healthData);
                setStats(statsData);
            } catch (err) {
                console.error("Failed to load dashboard telemetry:", err);
            }
        };
        loadDashboardData();
        // Poll every 30s
        const interval = setInterval(loadDashboardData, 30000);
        return () => clearInterval(interval);
    }, [fetchApi]);

    const isLiveData = stats?.roi_metrics?.source === 'tiendanube_live';
    const hasTN = stats?.sales_metrics?.tiendanube_connected;

    return (
        <div className="view active">
            <h1 className="view-title mb-6">{t('dashboard.title')}</h1>

            {/* CEO View: Value Generation (Hero Section) */}
            {stats?.roi_metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Hero: GMV — now shows live vs heuristic */}
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[24px] border border-white/10 relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity size={120} className="text-purple-600" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">{t('dashboard.valueGenerated')}</h2>
                            {isLiveData ? (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">LIVE</span>
                            ) : (
                                <span className="text-[9px] font-bold text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-500/20">HEURISTIC</span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-4 relative z-10">
                            <span className="text-6xl font-black text-white tracking-tighter">
                                {stats.roi_metrics.formatted_gmv}
                            </span>
                            <span className="text-purple-400 font-bold bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 text-xs uppercase tracking-wider">
                                {t('dashboard.conversions', { count: stats.roi_metrics.conversions })}
                            </span>
                        </div>
                        {/* Attribution line (when available) */}
                        {(stats.roi_metrics.attributed_orders ?? 0) > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                                <TrendingUp size={12} className="text-emerald-400" />
                                <span className="text-sm text-emerald-400 font-bold">
                                    {stats.roi_metrics.formatted_attributed} atribuidos al agente IA
                                </span>
                                <span className="text-xs text-gray-500">
                                    ({stats.roi_metrics.attributed_orders} pedidos)
                                </span>
                            </div>
                        )}
                        <p className="text-gray-500 mt-3 text-sm max-w-md font-medium">
                            {t('dashboard.heroDesc')}
                        </p>
                    </div>

                    {/* Direct Impact Sovereign Card (v7.6) */}
                    <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[24px] border border-white/5 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Target size={120} className="text-emerald-500" />
                        </div>

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xs font-black text-emerald-500/70 uppercase tracking-[0.2em] mb-1">{t('dashboard.directImpact')}</h2>
                                <div className="text-3xl font-black text-white tracking-tight">Protocolo Assist Score</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                LIVE AUDIT
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{t('dashboard.salesValue')}</span>
                                </div>
                                <div className="text-2xl font-black text-white">
                                    {stats.assist_metrics?.sales_score ?? 0} <span className="text-xs text-gray-500">{t('dashboard.points')}</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Coins size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{t('dashboard.supportValue')}</span>
                                </div>
                                <div className="text-2xl font-black text-white">
                                    {stats.assist_metrics?.estimated_savings ?? '$0'}
                                </div>
                                <div className="text-[9px] text-emerald-500/70 font-bold">{t('dashboard.estimatedSavings')}</div>
                            </div>
                        </div>

                        <Link
                            to="/analytics/assist"
                            className="mt-6 flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-white transition-colors group/btn"
                        >
                            {t('dashboard.deepDive')}
                            <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Sales & ROI — Entry Point Card */}
            <Link
                to="/analytics/roi"
                className="block mb-8 bg-gradient-to-r from-emerald-900/20 via-black to-emerald-900/10 p-6 rounded-[24px] border border-emerald-500/20 hover:border-emerald-500/40 transition-all group cursor-pointer"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ShoppingBag size={22} className="text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Ventas & ROI del Agente IA</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {hasTN
                                    ? 'Ventas reales de Tienda Nube, atribucion por canal y pedidos recientes'
                                    : 'Conecta Tienda Nube para ver ventas reales y atribucion al agente IA'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasTN && stats?.sales_metrics && (
                            <div className="hidden md:flex items-center gap-4 mr-4">
                                <div className="text-right">
                                    <div className="text-lg font-black text-white">{stats.sales_metrics.total_revenue_formatted}</div>
                                    <div className="text-[10px] text-gray-500">{stats.sales_metrics.total_orders_30d} pedidos (30d)</div>
                                </div>
                                {stats.sales_metrics.attributed_orders > 0 && (
                                    <div className="text-right pl-4 border-l border-emerald-500/20">
                                        <div className="text-lg font-black text-emerald-400">{stats.sales_metrics.attributed_revenue_formatted}</div>
                                        <div className="text-[10px] text-emerald-500/60">{stats.sales_metrics.attributed_orders} atribuidos al IA</div>
                                    </div>
                                )}
                            </div>
                        )}
                        <ArrowRight size={20} className="text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                    </div>
                </div>
            </Link>

            {/* Operational Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Traffic Stats */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-zinc-800/20 rounded-full blur-[20px]" />
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('dashboard.commsTraffic')}</span>
                        <MessageSquare className="text-zinc-600 group-hover:text-red-500 transition-colors" size={20} />
                    </div>
                    <span className="text-3xl font-black text-white block mb-0.5 tracking-tighter">{stats?.total_messages ?? 0}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.interactions')}</span>
                </div>

                {/* Efficiency */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-600/5 rounded-full blur-[20px]" />
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('dashboard.efficiency')}</span>
                        <Activity className="text-purple-600 group-hover:text-purple-400 transition-colors" size={20} />
                    </div>
                    <span className="text-3xl font-black text-white block mb-0.5 tracking-tighter">
                        {stats?.total_messages ? Math.round((stats.processed_messages / stats.total_messages) * 100) : 0}%
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.successRate')}</span>
                </div>

                {/* System Status (Condensed) */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md flex items-center justify-between hover:border-purple-500/20 transition-colors">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t('dashboard.systemHealth')}</div>
                        <div className={`text-2xl font-black tracking-tight ${health.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {health.status}
                        </div>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${health.status === 'OK' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'} animate-pulse`} />
                </div>
            </div>

            {/* Phase 2: Global Neural Feed */}
            <GlobalStreamLog />

            {/* Secondary Technical Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 opacity-60 hover:opacity-100 transition-opacity">
                <SystemStatus health={health} />
                <RagGalaxy />
            </div>

        </div>
    );
};
