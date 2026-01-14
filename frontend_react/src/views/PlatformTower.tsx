import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Server, Database, Users, TrendingUp, ShieldAlert } from 'lucide-react';

export const PlatformTower: React.FC = () => {
    const { fetchApi } = useApi();
    const [overview, setOverview] = useState<any>(null);
    const [infra, setInfra] = useState<any>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [ov, inf, ten] = await Promise.all([
                    fetchApi('/platform/overview'),
                    fetchApi('/platform/infrastructure'),
                    fetchApi('/platform/tenants')
                ]);
                setOverview(ov);
                setInfra(inf);
                setTenants(ten);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 10000); // 10s refresh for "Realtime" feel
        return () => clearInterval(interval);
    }, [fetchApi]);

    if (loading && !overview) return <div className="p-8 text-center animate-pulse text-red-500 font-mono">INITIALIZING GOD MODE...</div>;

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-mono">
            {/* God Mode Decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
            <div className="absolute top-1 left-0 right-0 h-24 bg-gradient-to-b from-red-900/20 to-transparent pointer-events-none" />

            <div className="view active p-6 relative z-10">
                <div className="flex justify-between items-center mb-8 border-b border-red-900/30 pb-4">
                    <h1 className="text-2xl font-black tracking-widest text-red-500 flex items-center gap-3 uppercase">
                        <ShieldAlert /> Platform Control Tower
                    </h1>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="text-amber-500 animate-pulse">● LIVE TELEMETRY</span>
                        <span className="text-slate-500">ZERO CONTENT ACCESS ENFORCED</span>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                        label="TOTAL TENANTS"
                        value={overview?.total_tenants}
                        icon={<Server size={20} className="text-blue-400" />}
                        sub="Active Org Units"
                    />
                    <MetricCard
                        label="TOTAL USERS"
                        value={overview?.total_users}
                        icon={<Users size={20} className="text-purple-400" />}
                        sub="Registered Identities"
                    />
                    <MetricCard
                        label="MSG TRAFFIC (24H)"
                        value={overview?.messages_24h}
                        icon={<TrendingUp size={20} className="text-green-400" />}
                        sub="Volumetric Load"
                    />
                    <MetricCard
                        label="PLATFORM GMV (EST)"
                        value={overview?.formatted_revenue}
                        icon={<Database size={20} className="text-amber-400" />}
                        sub="Aggregate Value Flow"
                    />
                </div>

                {/* Infrastructure & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Infrastructure Health */}
                    <div className="glass border-l-4 border-l-red-500/50 p-6 rounded-none">
                        <h3 className="text-sm font-bold text-red-400 mb-4 uppercase flex items-center gap-2">
                            <Server size={16} /> Infrastructure Pulse
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-slate-400 text-xs">REDIS MEMORY</span>
                                <span className="font-mono text-white">{infra?.redis_memory || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-slate-400 text-xs">REDIS PEAK</span>
                                <span className="font-mono text-amber-500">{infra?.redis_peak || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-slate-400 text-xs">DB SIZE</span>
                                <span className="font-mono text-blue-400">{infra?.db_size || 'UNKNOWN'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">STATUS</span>
                                <span className="text-green-500 font-bold bg-green-900/20 px-2 py-0.5 rounded text-[10px]">OPERATIONAL</span>
                            </div>
                        </div>
                    </div>

                    {/* Sim Chart: Traffic */}
                    <div className="glass p-6 lg:col-span-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <TrendingUp size={100} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">Global Message Volume (Simulated Trend)</h3>
                        <div className="h-32 flex items-end gap-1">
                            {/* Simulated Sparkline Bars */}
                            {Array.from({ length: 40 }).map((_, i) => {
                                const h = Math.max(10, Math.random() * 80 + 20); // Mock data since no historic API yet
                                return (
                                    <div
                                        key={i}
                                        className="bg-red-500/20 flex-1 hover:bg-red-500/60 transition-colors"
                                        style={{ height: `${h}%` }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Tenant Registry */}
                <div className="glass p-0 overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-300 uppercase">Tenant Registry</h3>
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded">{tenants.length} UNITS</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs text-slate-500 bg-black/20 uppercase sticky top-0 backdrop-blur">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Store Name</th>
                                    <th className="p-3">Owner</th>
                                    <th className="p-3">Phone</th>
                                    <th className="p-3">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-300">
                                {tenants.map((t) => (
                                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 font-mono text-xs text-slate-500">#{t.id}</td>
                                        <td className="p-3 font-bold text-white">{t.store_name}</td>
                                        <td className="p-3">{t.owner_email}</td>
                                        <td className="p-3 font-mono text-xs">{t.bot_phone_number}</td>
                                        <td className="p-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon, sub }: any) => (
    <div className="glass p-6 border-t-2 border-t-red-500/20 hover:border-t-red-500 transition-colors">
        <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
            <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
        </div>
        <div className="text-3xl font-black text-white mb-1">{value || 0}</div>
        <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
);
