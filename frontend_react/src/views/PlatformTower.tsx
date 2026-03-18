import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import {
    Server, Database, Users, TrendingUp, ShieldAlert, DollarSign,
    AlertTriangle, Search, ChevronDown, ChevronUp, Pause, Play,
    Archive, RefreshCw, Edit2, Crown, Clock, Activity, BarChart3,
    FileText, Eye, Ban, Zap
} from 'lucide-react';

interface TenantData {
    id: number;
    store_name: string;
    owner_email: string;
    owner_name?: string;
    bot_phone_number: string;
    tenant_status: string;
    is_active: boolean;
    is_verified?: boolean;
    plan_name?: string;
    plan_display_name?: string;
    sub_status?: string;
    trial_ends_at?: string;
    payment_provider?: string;
    messages_this_month: number;
    tokens_this_month: number;
    cost_this_month: number;
    created_at: string;
}

type Tab = 'overview' | 'tenants' | 'revenue' | 'costs' | 'audit';

export const PlatformTower: React.FC = () => {
    const { fetchApi } = useApi();
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [overview, setOverview] = useState<any>(null);
    const [infra, setInfra] = useState<any>(null);
    const [tenants, setTenants] = useState<TenantData[]>([]);
    const [tenantsTotal, setTenantsTotal] = useState(0);
    const [plans, setPlans] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [revenue, setRevenue] = useState<any>(null);
    const [costs, setCosts] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const loadOverview = useCallback(async () => {
        try {
            const [ov, inf] = await Promise.all([
                fetchApi('/platform/overview'),
                fetchApi('/platform/infrastructure')
            ]);
            setOverview(ov);
            setInfra(inf);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadTenants = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);
            if (statusFilter) params.set('status_filter', statusFilter);
            if (planFilter) params.set('plan_filter', planFilter);
            params.set('limit', '100');

            const data = await fetchApi(`/platform/tenants?${params.toString()}`);
            setTenants(data.tenants || []);
            setTenantsTotal(data.total || 0);
        } catch (e) { console.error(e); }
    }, [fetchApi, searchQuery, statusFilter, planFilter]);

    const loadPlans = useCallback(async () => {
        try {
            const data = await fetchApi('/platform/plans');
            setPlans(data || []);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadAuditLogs = useCallback(async () => {
        try {
            const data = await fetchApi('/platform/audit-logs?limit=50');
            setAuditLogs(data || []);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadRevenue = useCallback(async () => {
        try {
            const data = await fetchApi('/platform/revenue?days=30');
            setRevenue(data);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    const loadCosts = useCallback(async () => {
        try {
            const data = await fetchApi('/platform/costs?months=3');
            setCosts(data);
        } catch (e) { console.error(e); }
    }, [fetchApi]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([loadOverview(), loadTenants(), loadPlans()]);
            setLoading(false);
        };
        init();
        const interval = setInterval(loadOverview, 30000);
        return () => clearInterval(interval);
    }, [loadOverview, loadTenants, loadPlans]);

    useEffect(() => {
        if (activeTab === 'tenants') loadTenants();
    }, [activeTab, searchQuery, statusFilter, planFilter, loadTenants]);

    useEffect(() => {
        if (activeTab === 'audit') loadAuditLogs();
        if (activeTab === 'revenue') loadRevenue();
        if (activeTab === 'costs') loadCosts();
    }, [activeTab, loadAuditLogs, loadRevenue, loadCosts]);

    const handleTenantAction = async (tenantId: number, action: string, reason?: string) => {
        setActionLoading(tenantId);
        try {
            await fetchApi(`/platform/tenants/${tenantId}/action`, {
                method: 'POST',
                body: { action, reason }
            });
            await loadTenants();
            await loadOverview();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleChangePlan = async (tenantId: number, planName: string) => {
        setActionLoading(tenantId);
        try {
            await fetchApi(`/platform/tenants/${tenantId}/change-plan`, {
                method: 'POST',
                body: { plan_name: planName }
            });
            await loadTenants();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleExtendTrial = async (tenantId: number, days: number = 10) => {
        setActionLoading(tenantId);
        try {
            await fetchApi(`/platform/tenants/${tenantId}/extend-trial?days=${days}`, { method: 'POST' });
            await loadTenants();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditTenant = async (tenantId: number, data: Record<string, any>) => {
        setActionLoading(tenantId);
        try {
            await fetchApi(`/platform/tenants/${tenantId}`, {
                method: 'PUT',
                body: data
            });
            await loadTenants();
            await loadOverview();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteTenant = async (tenantId: number, storeName: string) => {
        if (!confirm(`ELIMINAR PERMANENTEMENTE "${storeName}"?\n\nEsto borra TODO: usuarios, agentes, chats, suscripción.\n\nEsta acción NO se puede deshacer.`)) return;
        if (!confirm(`CONFIRMAR: Escribir OK para eliminar "${storeName}"`)) return;
        setActionLoading(tenantId);
        try {
            await fetchApi(`/platform/tenants/${tenantId}`, { method: 'DELETE' });
            setSelectedTenant(null);
            await loadTenants();
            await loadOverview();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleForceTrialCheck = async () => {
        try {
            const result = await fetchApi('/platform/check-trials', { method: 'POST' });
            alert(`Trial check: ${result.trials_expired} expired, ${result.warnings_sent} warnings sent`);
            await loadTenants();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-900/30 text-green-400 border-green-500/30',
            trialing: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
            expired: 'bg-red-900/30 text-red-400 border-red-500/30',
            suspended: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
            canceled: 'bg-slate-800 text-slate-400 border-slate-600/30',
            past_due: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[status] || 'bg-slate-800 text-slate-400'}`}>
                {status || 'none'}
            </span>
        );
    };

    if (loading && !overview) {
        return <div className="p-8 text-center animate-pulse text-red-500 font-mono">INITIALIZING GOD MODE...</div>;
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-mono">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

            <div className="view active p-6 relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-red-900/30 pb-4">
                    <h1 className="text-2xl font-black tracking-widest text-red-500 flex items-center gap-3 uppercase">
                        <ShieldAlert /> Platform Control Tower
                    </h1>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="text-amber-500 animate-pulse">LIVE</span>
                        <button onClick={handleForceTrialCheck} className="text-xs bg-red-900/30 hover:bg-red-900/50 px-3 py-1 rounded border border-red-500/30 flex items-center gap-1">
                            <Clock size={12} /> Check Trials
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-black/30 p-1 rounded-lg w-fit">
                    {(['overview', 'tenants', 'revenue', 'costs', 'audit'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-xs uppercase font-bold rounded transition-all ${
                                activeTab === tab
                                    ? 'bg-red-600/30 text-red-400 border border-red-500/30'
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <OverviewTab overview={overview} infra={infra} plans={plans} />
                )}
                {activeTab === 'tenants' && (
                    <TenantsTab
                        tenants={tenants}
                        tenantsTotal={tenantsTotal}
                        plans={plans}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        planFilter={planFilter}
                        setPlanFilter={setPlanFilter}
                        actionLoading={actionLoading}
                        onAction={handleTenantAction}
                        onChangePlan={handleChangePlan}
                        onExtendTrial={handleExtendTrial}
                        onEditTenant={handleEditTenant}
                        onDeleteTenant={handleDeleteTenant}
                        getStatusBadge={getStatusBadge}
                        selectedTenant={selectedTenant}
                        setSelectedTenant={setSelectedTenant}
                        fetchApi={fetchApi}
                    />
                )}
                {activeTab === 'revenue' && <RevenueTab revenue={revenue} overview={overview} />}
                {activeTab === 'costs' && <CostsTab costs={costs} overview={overview} />}
                {activeTab === 'audit' && <AuditTab logs={auditLogs} />}
            </div>
        </div>
    );
};

// ============== OVERVIEW TAB ==============
const OverviewTab = ({ overview, infra, plans }: any) => (
    <>
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <MetricCard label="TENANTS" value={overview?.total_tenants} icon={<Server size={18} className="text-blue-400" />} sub={`${overview?.active_tenants || 0} activos`} />
            <MetricCard label="USERS" value={overview?.total_users} icon={<Users size={18} className="text-purple-400" />} sub="Identidades" />
            <MetricCard label="MSG 24H" value={overview?.messages_24h} icon={<Activity size={18} className="text-green-400" />} sub="Trafico" />
            <MetricCard label="MRR" value={overview?.revenue?.formatted_mrr} icon={<DollarSign size={18} className="text-emerald-400" />} sub="Recurrente" highlight />
            <MetricCard label="COSTOS MES" value={overview?.costs?.formatted_cost} icon={<BarChart3 size={18} className="text-orange-400" />} sub="LLM Tokens" />
            <MetricCard label="MARGEN" value={`$${(overview?.costs?.margin || 0).toFixed(0)}`} icon={<TrendingUp size={18} className="text-cyan-400" />} sub="MRR - Costos" highlight />
        </div>

        {/* Plan Breakdown + Infra */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Plan Breakdown */}
            <div className="glass border-l-4 border-l-purple-500/50 p-6">
                <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase flex items-center gap-2">
                    <Crown size={16} /> Distribucion de Planes
                </h3>
                <div className="space-y-3">
                    {Object.entries(overview?.plan_breakdown || {}).map(([plan, data]: [string, any]) => (
                        <div key={plan} className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-sm font-bold text-white capitalize">{plan}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">{data.total}</span>
                                <div className="text-[10px] text-slate-500">
                                    {Object.entries(data.statuses || {}).map(([s, c]: [string, any]) => (
                                        <span key={s} className="mr-1">{s}: {c}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {overview?.trials_expiring_soon > 0 && (
                    <div className="mt-4 p-3 bg-amber-900/20 rounded border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} />
                        {overview.trials_expiring_soon} trials expiran en los proximos 3 dias
                    </div>
                )}
            </div>

            {/* Infrastructure */}
            <div className="glass border-l-4 border-l-red-500/50 p-6">
                <h3 className="text-sm font-bold text-red-400 mb-4 uppercase flex items-center gap-2">
                    <Server size={16} /> Infraestructura
                </h3>
                <div className="space-y-3">
                    <InfoRow label="REDIS MEM" value={infra?.redis_memory || 'N/A'} />
                    <InfoRow label="REDIS PEAK" value={infra?.redis_peak || 'N/A'} color="text-amber-500" />
                    <InfoRow label="DB SIZE" value={infra?.db_size || 'N/A'} color="text-blue-400" />
                    <InfoRow label="STATUS" value="OPERATIONAL" color="text-green-500" />
                </div>
            </div>

            {/* Revenue Summary */}
            <div className="glass border-l-4 border-l-emerald-500/50 p-6">
                <h3 className="text-sm font-bold text-emerald-400 mb-4 uppercase flex items-center gap-2">
                    <DollarSign size={16} /> Revenue
                </h3>
                <div className="space-y-3">
                    <InfoRow label="MRR" value={overview?.revenue?.formatted_mrr || '$0'} color="text-emerald-400" />
                    <InfoRow label="30 DIAS" value={overview?.revenue?.formatted_30d || '$0'} />
                    <InfoRow label="TOTAL" value={overview?.revenue?.formatted_total || '$0'} color="text-white" />
                    <InfoRow label="TOKENS MES" value={(overview?.costs?.tokens_month || 0).toLocaleString()} color="text-orange-400" />
                </div>
            </div>
        </div>

        {/* DB Tables */}
        {infra?.tables && infra.tables.length > 0 && (
            <div className="glass p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Database Tables</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {infra.tables.map((t: any) => (
                        <div key={t.table_name} className="bg-black/30 p-2 rounded text-xs">
                            <div className="font-bold text-slate-300 truncate">{t.table_name}</div>
                            <div className="text-slate-500">{t.total_size} | {t.row_count} rows</div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </>
);

// ============== TENANTS TAB ==============
const TenantsTab = ({
    tenants, tenantsTotal, plans, searchQuery, setSearchQuery,
    statusFilter, setStatusFilter, planFilter, setPlanFilter,
    actionLoading, onAction, onChangePlan, onExtendTrial,
    onEditTenant, onDeleteTenant,
    getStatusBadge, selectedTenant, setSelectedTenant, fetchApi
}: any) => {
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState<Record<string, string>>({});

    const loadTenantDetail = async (tenantId: number) => {
        try {
            const data = await fetchApi(`/platform/tenants/${tenantId}`);
            setSelectedTenant(data);
            setEditMode(false);
        } catch (e) { console.error(e); }
    };

    const startEdit = (tenant: any) => {
        setEditForm({
            store_name: tenant.store_name || '',
            owner_email: tenant.owner_email || '',
            bot_phone_number: tenant.bot_phone_number || '',
            store_website: tenant.store_website || '',
            store_description: tenant.store_description || '',
        });
        setEditMode(true);
    };

    const submitEdit = async () => {
        const changes: Record<string, string> = {};
        const t = selectedTenant.tenant;
        if (editForm.store_name && editForm.store_name !== t.store_name) changes.store_name = editForm.store_name;
        if (editForm.owner_email && editForm.owner_email !== t.owner_email) changes.owner_email = editForm.owner_email;
        if (editForm.bot_phone_number && editForm.bot_phone_number !== t.bot_phone_number) changes.bot_phone_number = editForm.bot_phone_number;
        if (editForm.store_website !== (t.store_website || '')) changes.store_website = editForm.store_website;
        if (editForm.store_description !== (t.store_description || '')) changes.store_description = editForm.store_description;

        if (Object.keys(changes).length === 0) { setEditMode(false); return; }
        await onEditTenant(t.id, changes);
        await loadTenantDetail(t.id);
        setEditMode(false);
    };

    return (
        <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded pl-9 pr-3 py-2 text-sm text-white focus:border-red-500/50 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none"
                >
                    <option value="">Todos los estados</option>
                    <option value="active">Activo</option>
                    <option value="trialing">Trial</option>
                    <option value="expired">Expirado</option>
                    <option value="suspended">Suspendido</option>
                    <option value="canceled">Cancelado</option>
                </select>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none"
                >
                    <option value="">Todos los planes</option>
                    {plans.map((p: any) => (
                        <option key={p.name} value={p.name}>{p.display_name}</option>
                    ))}
                </select>
                <span className="self-center text-xs text-slate-500">{tenantsTotal} total</span>
            </div>

            <div className="flex gap-6">
                {/* Tenant Table */}
                <div className={`glass p-0 overflow-hidden ${selectedTenant ? 'flex-1' : 'w-full'}`}>
                    <div className="max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-[10px] text-slate-500 bg-black/40 uppercase sticky top-0 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Tienda</th>
                                    <th className="p-3">Owner</th>
                                    <th className="p-3">Plan</th>
                                    <th className="p-3">Estado</th>
                                    <th className="p-3">Msgs/mes</th>
                                    <th className="p-3">Costo</th>
                                    <th className="p-3">Creado</th>
                                    <th className="p-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-300">
                                {tenants.map((t: TenantData) => (
                                    <tr key={t.id} className={`hover:bg-white/5 transition-colors ${selectedTenant?.tenant?.id === t.id ? 'bg-red-900/10' : ''}`}>
                                        <td className="p-3 font-mono text-xs text-slate-500">#{t.id}</td>
                                        <td className="p-3">
                                            <button onClick={() => loadTenantDetail(t.id)} className="font-bold text-white hover:text-red-400 text-left">
                                                {t.store_name}
                                            </button>
                                        </td>
                                        <td className="p-3 text-xs">
                                            <div>{t.owner_email}</div>
                                            {t.is_verified === false && <span className="text-[9px] text-amber-500">NO VERIFICADO</span>}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-xs font-bold text-purple-400 capitalize">{t.plan_name || '-'}</span>
                                        </td>
                                        <td className="p-3">{getStatusBadge(t.sub_status || t.tenant_status)}</td>
                                        <td className="p-3 font-mono text-xs">{t.messages_this_month.toLocaleString()}</td>
                                        <td className="p-3 font-mono text-xs text-orange-400">${t.cost_this_month.toFixed(2)}</td>
                                        <td className="p-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            <div className="flex gap-1">
                                                {t.sub_status !== 'suspended' ? (
                                                    <button
                                                        onClick={() => onAction(t.id, 'suspend')}
                                                        disabled={actionLoading === t.id}
                                                        className="p-1 hover:bg-orange-900/30 rounded text-orange-400"
                                                        title="Suspender"
                                                    >
                                                        <Pause size={14} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => onAction(t.id, 'activate')}
                                                        disabled={actionLoading === t.id}
                                                        className="p-1 hover:bg-green-900/30 rounded text-green-400"
                                                        title="Activar"
                                                    >
                                                        <Play size={14} />
                                                    </button>
                                                )}
                                                {(t.sub_status === 'trialing' || t.sub_status === 'expired') && (
                                                    <button
                                                        onClick={() => onExtendTrial(t.id)}
                                                        disabled={actionLoading === t.id}
                                                        className="p-1 hover:bg-blue-900/30 rounded text-blue-400"
                                                        title="Extender trial +10d"
                                                    >
                                                        <Clock size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => loadTenantDetail(t.id)}
                                                    className="p-1 hover:bg-white/10 rounded text-slate-400"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteTenant(t.id, t.store_name)}
                                                    disabled={actionLoading === t.id}
                                                    className="p-1 hover:bg-red-900/30 rounded text-red-400/50 hover:text-red-400"
                                                    title="Eliminar"
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tenant Detail Panel */}
                {selectedTenant && (
                    <div className="w-96 glass p-4 max-h-[600px] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-white">Detalle #{selectedTenant.tenant.id}</h3>
                            <button onClick={() => setSelectedTenant(null)} className="text-slate-500 hover:text-white">&times;</button>
                        </div>

                        <div className="flex gap-1 mb-3">
                            <button
                                onClick={() => startEdit(selectedTenant.tenant)}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded bg-blue-900/30 text-blue-400 border border-blue-500/30 hover:bg-blue-900/50 flex items-center justify-center gap-1"
                            >
                                <Edit2 size={10} /> Editar
                            </button>
                            <button
                                onClick={() => onDeleteTenant(selectedTenant.tenant.id, selectedTenant.tenant.store_name)}
                                className="flex-1 text-[10px] font-bold py-1.5 rounded bg-red-900/30 text-red-400 border border-red-500/30 hover:bg-red-900/50 flex items-center justify-center gap-1"
                            >
                                <Ban size={10} /> Eliminar
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            {editMode ? (
                                <div className="bg-black/30 p-3 rounded space-y-2">
                                    <div className="text-slate-400 mb-1 font-bold">Editando Tenant</div>
                                    <div>
                                        <label className="text-[10px] text-slate-500">Tienda</label>
                                        <input value={editForm.store_name || ''} onChange={e => setEditForm({...editForm, store_name: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500">Email Owner</label>
                                        <input value={editForm.owner_email || ''} onChange={e => setEditForm({...editForm, owner_email: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500">Telefono</label>
                                        <input value={editForm.bot_phone_number || ''} onChange={e => setEditForm({...editForm, bot_phone_number: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500">Website</label>
                                        <input value={editForm.store_website || ''} onChange={e => setEditForm({...editForm, store_website: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500">Descripcion</label>
                                        <textarea value={editForm.store_description || ''} onChange={e => setEditForm({...editForm, store_description: e.target.value})} rows={2} className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500/50 resize-none" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={submitEdit} className="flex-1 py-1.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-900/50">Guardar</button>
                                        <button onClick={() => setEditMode(false)} className="flex-1 py-1.5 rounded bg-white/5 text-slate-400 border border-white/10 text-[10px] font-bold hover:bg-white/10">Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-black/30 p-3 rounded">
                                        <div className="text-slate-400 mb-1">Tienda</div>
                                        <div className="text-white font-bold">{selectedTenant.tenant.store_name}</div>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded">
                                        <div className="text-slate-400 mb-1">Owner</div>
                                        <div>{selectedTenant.tenant.owner_email}</div>
                                        <div className="text-slate-500">{selectedTenant.tenant.owner_name}</div>
                                    </div>
                                </>
                            )}
                            <div className="bg-black/30 p-3 rounded">
                                <div className="text-slate-400 mb-1">Plan / Estado</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-purple-400 font-bold capitalize">{selectedTenant.tenant.plan_name || 'sin plan'}</span>
                                    {getStatusBadge(selectedTenant.tenant.sub_status || 'none')}
                                </div>
                                {selectedTenant.tenant.trial_ends_at && (
                                    <div className="text-amber-400 mt-1">
                                        Trial vence: {new Date(selectedTenant.tenant.trial_ends_at).toLocaleString()}
                                    </div>
                                )}
                            </div>

                            {/* Change Plan */}
                            <div className="bg-black/30 p-3 rounded">
                                <div className="text-slate-400 mb-2">Cambiar Plan</div>
                                <div className="flex gap-1">
                                    {plans.map((p: any) => (
                                        <button
                                            key={p.name}
                                            onClick={() => onChangePlan(selectedTenant.tenant.id, p.name)}
                                            className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                                selectedTenant.tenant.plan_name === p.name
                                                    ? 'bg-purple-900/40 border-purple-500/50 text-purple-400'
                                                    : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                                            }`}
                                        >
                                            {p.display_name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Agents */}
                            <div className="bg-black/30 p-3 rounded">
                                <div className="text-slate-400 mb-1">Agentes</div>
                                <div className="text-2xl font-black text-white">{selectedTenant.agent_count}</div>
                            </div>

                            {/* Team */}
                            <div className="bg-black/30 p-3 rounded">
                                <div className="text-slate-400 mb-2">Equipo ({selectedTenant.team_members?.length || 0})</div>
                                {selectedTenant.team_members?.map((u: any) => (
                                    <div key={u.id} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                                        <span className="text-slate-300">{u.email}</span>
                                        <span className="text-[10px] text-slate-500">{u.role}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Usage History */}
                            {selectedTenant.usage_history?.length > 0 && (
                                <div className="bg-black/30 p-3 rounded">
                                    <div className="text-slate-400 mb-2">Uso Historico</div>
                                    {selectedTenant.usage_history.map((u: any, i: number) => (
                                        <div key={i} className="flex justify-between py-1 border-b border-white/5 text-[10px]">
                                            <span>{new Date(u.period_start).toLocaleDateString('es', { month: 'short', year: 'numeric' })}</span>
                                            <span>{u.messages_sent} msgs</span>
                                            <span className="text-orange-400">${(u.llm_cost_usd || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Invoices */}
                            {selectedTenant.invoices?.length > 0 && (
                                <div className="bg-black/30 p-3 rounded">
                                    <div className="text-slate-400 mb-2">Facturas</div>
                                    {selectedTenant.invoices.map((inv: any) => (
                                        <div key={inv.id} className="flex justify-between py-1 border-b border-white/5 text-[10px]">
                                            <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                                            <span className="text-emerald-400">${inv.amount_usd}</span>
                                            {getStatusBadge(inv.status)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// ============== REVENUE TAB ==============
const RevenueTab = ({ revenue, overview }: any) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="MRR" value={overview?.revenue?.formatted_mrr} icon={<DollarSign size={18} className="text-emerald-400" />} sub="Monthly Recurring" highlight />
            <MetricCard label="30 DIAS" value={overview?.revenue?.formatted_30d} icon={<TrendingUp size={18} className="text-blue-400" />} sub="Ingresos reales" />
            <MetricCard label="TOTAL HISTORICO" value={overview?.revenue?.formatted_total} icon={<Database size={18} className="text-purple-400" />} sub="Desde el inicio" />
        </div>

        {revenue?.daily_revenue && revenue.daily_revenue.length > 0 ? (
            <div className="glass p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Ingresos Diarios (30d)</h3>
                <table className="w-full text-sm">
                    <thead className="text-[10px] text-slate-500 uppercase">
                        <tr>
                            <th className="text-left p-2">Fecha</th>
                            <th className="text-right p-2">Monto USD</th>
                            <th className="text-right p-2">Facturas</th>
                            <th className="text-right p-2">Provider</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {revenue.daily_revenue.map((r: any, i: number) => (
                            <tr key={i}>
                                <td className="p-2 text-slate-300">{r.date}</td>
                                <td className="p-2 text-right text-emerald-400 font-bold">${r.revenue_usd?.toFixed(2)}</td>
                                <td className="p-2 text-right text-slate-400">{r.invoice_count}</td>
                                <td className="p-2 text-right text-slate-500">{r.payment_provider}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="glass p-8 text-center text-slate-500">
                <DollarSign size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay ingresos registrados aun.</p>
                <p className="text-xs mt-1">Los ingresos apareceran cuando los usuarios paguen sus suscripciones.</p>
            </div>
        )}
    </div>
);

// ============== COSTS TAB ==============
const CostsTab = ({ costs, overview }: any) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard label="COSTO MES" value={overview?.costs?.formatted_cost} icon={<BarChart3 size={18} className="text-orange-400" />} sub="LLM tokens" />
            <MetricCard label="TOKENS MES" value={(overview?.costs?.tokens_month || 0).toLocaleString()} icon={<Zap size={18} className="text-yellow-400" />} sub="Consumidos" />
            <MetricCard label="MARGEN" value={`$${(overview?.costs?.margin || 0).toFixed(0)}`} icon={<TrendingUp size={18} className="text-cyan-400" />} sub="MRR - Costos" highlight />
        </div>

        {costs?.records && costs.records.length > 0 ? (
            <div className="glass p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Costo por Tenant</h3>
                <table className="w-full text-sm">
                    <thead className="text-[10px] text-slate-500 uppercase">
                        <tr>
                            <th className="text-left p-2">Tenant</th>
                            <th className="text-right p-2">Periodo</th>
                            <th className="text-right p-2">Tokens</th>
                            <th className="text-right p-2">Mensajes</th>
                            <th className="text-right p-2">Costo USD</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {costs.records.map((r: any, i: number) => (
                            <tr key={i}>
                                <td className="p-2 text-white font-bold">{r.store_name}</td>
                                <td className="p-2 text-right text-slate-400 text-xs">{new Date(r.period_start).toLocaleDateString('es', { month: 'short' })}</td>
                                <td className="p-2 text-right text-yellow-400">{(r.tokens_used || 0).toLocaleString()}</td>
                                <td className="p-2 text-right text-slate-300">{r.messages_sent}</td>
                                <td className="p-2 text-right text-orange-400 font-bold">${(r.llm_cost_usd || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-3 pt-3 border-t border-white/10 text-right">
                    <span className="text-xs text-slate-400 mr-4">Total:</span>
                    <span className="text-orange-400 font-bold">{costs.summary?.formatted_cost}</span>
                </div>
            </div>
        ) : (
            <div className="glass p-8 text-center text-slate-500">
                <BarChart3 size={48} className="mx-auto mb-3 opacity-20" />
                <p>No hay datos de costos aun.</p>
                <p className="text-xs mt-1">Los costos se registraran automaticamente cuando los agentes procesen mensajes.</p>
            </div>
        )}
    </div>
);

// ============== AUDIT TAB ==============
const AuditTab = ({ logs }: { logs: any[] }) => (
    <div className="glass p-0 overflow-hidden">
        <div className="p-4 bg-black/30 border-b border-white/10">
            <h3 className="text-sm font-bold text-slate-300 uppercase flex items-center gap-2">
                <FileText size={16} /> Audit Log
            </h3>
        </div>
        {logs.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="text-[10px] text-slate-500 uppercase sticky top-0 bg-black/60 backdrop-blur">
                        <tr>
                            <th className="text-left p-3">Fecha</th>
                            <th className="text-left p-3">Accion</th>
                            <th className="text-left p-3">Usuario</th>
                            <th className="text-left p-3">Tenant</th>
                            <th className="text-left p-3">Detalles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-white/5">
                                <td className="p-3 text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="p-3 font-mono text-xs text-amber-400">{log.action}</td>
                                <td className="p-3 text-xs">{log.user_email || '-'}</td>
                                <td className="p-3 text-xs text-slate-500">#{log.tenant_id || '-'}</td>
                                <td className="p-3 text-[10px] text-slate-500 max-w-[200px] truncate">{JSON.stringify(log.details)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="p-8 text-center text-slate-500 text-sm">No hay logs de auditoria aun.</div>
        )}
    </div>
);

// ============== SHARED COMPONENTS ==============
const MetricCard = ({ label, value, icon, sub, highlight }: any) => (
    <div className={`glass p-4 border-t-2 ${highlight ? 'border-t-emerald-500/50 hover:border-t-emerald-500' : 'border-t-red-500/20 hover:border-t-red-500'} transition-colors`}>
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
            <div className="p-1.5 bg-white/5 rounded">{icon}</div>
        </div>
        <div className="text-2xl font-black text-white mb-0.5">{value || 0}</div>
        <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
);

const InfoRow = ({ label, value, color = 'text-white' }: any) => (
    <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-slate-400 text-xs">{label}</span>
        <span className={`font-mono ${color}`}>{value}</span>
    </div>
);
