import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Activity, MessageSquare } from 'lucide-react';
import { GlobalStreamLog } from '../components/GlobalStreamLog';
import { RagGalaxy } from '../components/RagGalaxy';
import { SystemStatus } from '../components/SystemStatus';

interface Stats {
    active_tenants: number;
    total_messages: number;
    processed_messages: number;
    roi_metrics: {
        total_gmv: number;
        conversions: number;
        last_30_days: number;
        formatted_gmv: string;
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

    return (
        <div className="view active">
            <h1 className="view-title mb-6">{t('dashboard.title')}</h1>

            {/* CEO View: Value Generation (Hero Section) */}
            {stats?.roi_metrics && (
                <div className="mb-8">
                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[24px] border border-white/10 relative overflow-hidden group hover:border-red-500/20 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity size={120} className="text-red-600" />
                        </div>
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-2">{t('dashboard.valueGenerated')}</h2>
                        <div className="flex items-baseline gap-4 relative z-10">
                            <span className="text-6xl font-black text-white tracking-tighter">
                                {stats.roi_metrics.formatted_gmv}
                            </span>
                            <span className="text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 text-xs uppercase tracking-wider">
                                {t('dashboard.conversions', { count: stats.roi_metrics.conversions })}
                            </span>
                        </div>
                        <p className="text-gray-500 mt-4 text-sm max-w-md font-medium">
                            {t('dashboard.heroDesc')}
                        </p>
                    </div>
                </div>
            )}

            {/* Operational Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Traffic Stats */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md relative overflow-hidden group hover:border-red-500/20 transition-colors">
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-zinc-800/20 rounded-full blur-[20px]" />
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('dashboard.commsTraffic')}</span>
                        <MessageSquare className="text-zinc-600 group-hover:text-red-500 transition-colors" size={20} />
                    </div>
                    <span className="text-3xl font-black text-white block mb-0.5 tracking-tighter">{stats?.total_messages || 0}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.interactions')}</span>
                </div>

                {/* Efficiency */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md relative overflow-hidden group hover:border-red-500/20 transition-colors">
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-red-600/5 rounded-full blur-[20px]" />
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('dashboard.efficiency')}</span>
                        <Activity className="text-red-600 group-hover:text-red-400 transition-colors" size={20} />
                    </div>
                    <span className="text-3xl font-black text-white block mb-0.5 tracking-tighter">
                        {stats?.total_messages ? Math.round((stats.processed_messages / stats.total_messages) * 100) : 0}%
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.successRate')}</span>
                </div>

                {/* System Status (Condensed) */}
                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md flex items-center justify-between hover:border-red-500/20 transition-colors">
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
