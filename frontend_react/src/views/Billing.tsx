import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import {
    CreditCard, Check, X, Clock, AlertTriangle, ArrowRight,
    Zap, Shield, Crown, Star, BarChart3, Users, MessageSquare,
    BookOpen, Radio, ChevronRight, Receipt, TrendingUp
} from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    display_name: string;
    description: string;
    price_usd: number;
    price_ars: number;
    price_usd_yearly: number;
    price_ars_yearly: number;
    max_agents: number;
    max_messages_per_month: number;
    max_knowledge_docs: number;
    max_channels: number;
    max_team_members: number;
    max_tokens_per_month: number;
    features: Record<string, boolean>;
}

interface Subscription {
    has_subscription: boolean;
    status: string;
    plan_name?: string;
    plan_display_name?: string;
    trial_ends_at?: string;
    trial_days_remaining?: number;
    trial_expired?: boolean;
    price_usd?: number;
    price_ars?: number;
    payment_provider?: string;
    plan_features?: Record<string, boolean>;
}

export const Billing: React.FC = () => {
    const { fetchApi } = useApi();
    const { user } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<any>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, s, u, i] = await Promise.all([
                    fetchApi('/billing/plans'),
                    fetchApi('/billing/my-subscription'),
                    fetchApi('/billing/usage').catch(() => null),
                    fetchApi('/billing/invoices').catch(() => [])
                ]);
                setPlans(p || []);
                setSubscription(s);
                setUsage(u);
                setInvoices(i || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchApi]);

    const handleCheckout = async (planName: string, provider: string) => {
        setCheckoutLoading(`${planName}-${provider}`);
        try {
            const result = await fetchApi('/billing/checkout', {
                method: 'POST',
                body: {
                    plan_name: planName,
                    billing_period: billingPeriod,
                    provider,
                    currency
                }
            });
            if (result.checkout_url) {
                window.location.href = result.checkout_url;
            }
        } catch (e: any) {
            alert(e.message || 'Error al crear el checkout');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const getPrice = (plan: Plan) => {
        if (billingPeriod === 'yearly') {
            return currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly;
        }
        return currency === 'USD' ? plan.price_usd : plan.price_ars;
    };

    const getMonthlyPrice = (plan: Plan) => {
        if (billingPeriod === 'yearly') {
            const yearly = currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly;
            return yearly / 12;
        }
        return currency === 'USD' ? plan.price_usd : plan.price_ars;
    };

    const formatLimit = (val: number) => {
        if (val === -1) return 'Ilimitado';
        return val.toLocaleString();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="animate-pulse text-slate-400 font-mono">Cargando planes...</div>
            </div>
        );
    }

    const isTrialExpired = subscription?.status === 'expired' || subscription?.trial_expired;
    const isBlocked = isTrialExpired || subscription?.status === 'suspended' || subscription?.status === 'canceled';
    const currentPlan = subscription?.plan_name;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <div className="view active p-6 max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                        <CreditCard className="text-purple-400" />
                        Suscripcion & Planes
                    </h1>
                    <p className="text-slate-400">Gestiona tu plan, pagos y consumo.</p>
                </div>

                {/* Trial/Blocked Warning */}
                {isBlocked && (
                    <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-red-900/30 to-orange-900/20 border border-red-500/30">
                        <div className="flex items-start gap-4">
                            <AlertTriangle size={32} className="text-red-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-bold text-red-400 mb-1">
                                    {isTrialExpired ? 'Tu periodo de prueba ha expirado' : 'Tu cuenta esta bloqueada'}
                                </h3>
                                <p className="text-slate-300">
                                    {isTrialExpired
                                        ? 'Tus 10 dias de prueba gratuita terminaron. Elige un plan para seguir usando la plataforma.'
                                        : 'Tu suscripcion fue cancelada o suspendida. Reactiva un plan para continuar.'
                                    }
                                </p>
                                <p className="text-sm text-slate-500 mt-1">Tus datos estan seguros y se mantienen intactos.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Trial Active Banner */}
                {subscription?.status === 'trialing' && !isTrialExpired && (
                    <div className="mb-8 p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className="text-blue-400" />
                            <div>
                                <span className="text-blue-400 font-bold">Periodo de prueba activo</span>
                                <span className="text-slate-400 ml-2">
                                    Te quedan <strong className="text-white">{subscription.trial_days_remaining}</strong> dias
                                </span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">
                            Vence: {subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : '-'}
                        </div>
                    </div>
                )}

                {/* Active Subscription Banner */}
                {subscription?.status === 'active' && currentPlan !== 'free' && (
                    <div className="mb-8 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Check className="text-emerald-400" />
                            <div>
                                <span className="text-emerald-400 font-bold">Plan {subscription.plan_display_name} activo</span>
                                {subscription.payment_provider && (
                                    <span className="text-slate-500 ml-2 text-xs">via {subscription.payment_provider}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Billing Period & Currency Toggle */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                        <button
                            onClick={() => setBillingPeriod('monthly')}
                            className={`px-4 py-2 rounded text-sm font-bold transition-all ${
                                billingPeriod === 'monthly'
                                    ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30'
                                    : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => setBillingPeriod('yearly')}
                            className={`px-4 py-2 rounded text-sm font-bold transition-all flex items-center gap-1 ${
                                billingPeriod === 'yearly'
                                    ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                                    : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            Anual <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-1">-20%</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                        <button
                            onClick={() => setCurrency('USD')}
                            className={`px-3 py-1.5 rounded text-xs font-bold ${currency === 'USD' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                        >
                            USD
                        </button>
                        <button
                            onClick={() => setCurrency('ARS')}
                            className={`px-3 py-1.5 rounded text-xs font-bold ${currency === 'ARS' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                        >
                            ARS
                        </button>
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {plans.map((plan) => {
                        const isCurrent = currentPlan === plan.name;
                        const isPro = plan.name === 'pro';
                        const isEnterprise = plan.name === 'enterprise';
                        const isFree = plan.name === 'free';
                        const price = getMonthlyPrice(plan);

                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-2xl border p-6 transition-all ${
                                    isPro
                                        ? 'border-purple-500/50 bg-gradient-to-b from-purple-900/20 to-transparent shadow-lg shadow-purple-900/20'
                                        : isEnterprise
                                        ? 'border-amber-500/30 bg-gradient-to-b from-amber-900/10 to-transparent'
                                        : 'border-white/10 bg-black/30'
                                } ${isCurrent ? 'ring-2 ring-emerald-500/50' : ''}`}
                            >
                                {isPro && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        MAS POPULAR
                                    </div>
                                )}
                                {isCurrent && (
                                    <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        PLAN ACTUAL
                                    </div>
                                )}

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        {isFree && <Star size={18} className="text-slate-400" />}
                                        {isPro && <Zap size={18} className="text-purple-400" />}
                                        {isEnterprise && <Crown size={18} className="text-amber-400" />}
                                        <h3 className="text-xl font-bold">{plan.display_name}</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">{plan.description}</p>
                                </div>

                                {/* Price */}
                                <div className="mb-6">
                                    {isFree ? (
                                        <div className="text-3xl font-black text-white">Gratis</div>
                                    ) : (
                                        <>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm text-slate-400">{currency === 'USD' ? '$' : 'AR$'}</span>
                                                <span className="text-4xl font-black text-white">{Math.round(price).toLocaleString()}</span>
                                                <span className="text-slate-500 text-sm">/mes</span>
                                            </div>
                                            {billingPeriod === 'yearly' && (
                                                <div className="text-xs text-emerald-400 mt-1">
                                                    {currency === 'USD' ? '$' : 'AR$'}{getPrice(plan).toLocaleString()} facturado anualmente
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {isFree && <div className="text-xs text-blue-400 mt-1">10 dias de prueba completa</div>}
                                </div>

                                {/* Limits */}
                                <div className="space-y-2 mb-6 text-sm">
                                    <LimitRow icon={<Users size={14} />} label="Agentes" value={formatLimit(plan.max_agents)} />
                                    <LimitRow icon={<MessageSquare size={14} />} label="Mensajes/mes" value={formatLimit(plan.max_messages_per_month)} />
                                    <LimitRow icon={<BookOpen size={14} />} label="Docs conocimiento" value={formatLimit(plan.max_knowledge_docs)} />
                                    <LimitRow icon={<Radio size={14} />} label="Canales" value={formatLimit(plan.max_channels)} />
                                    <LimitRow icon={<Users size={14} />} label="Team" value={formatLimit(plan.max_team_members)} />
                                    <LimitRow icon={<Zap size={14} />} label="Tokens LLM/mes" value={formatLimit(plan.max_tokens_per_month)} />
                                </div>

                                {/* Features */}
                                <div className="space-y-1.5 mb-6">
                                    {Object.entries(plan.features || {}).map(([feature, enabled]) => (
                                        <div key={feature} className="flex items-center gap-2 text-xs">
                                            {enabled ? (
                                                <Check size={14} className="text-emerald-400" />
                                            ) : (
                                                <X size={14} className="text-slate-600" />
                                            )}
                                            <span className={enabled ? 'text-slate-300' : 'text-slate-600'}>
                                                {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA */}
                                {isFree ? (
                                    <div className="text-center text-xs text-slate-500 py-3">
                                        {isCurrent ? 'Plan actual (trial)' : 'Incluido al registrarte'}
                                    </div>
                                ) : isCurrent && subscription?.status === 'active' ? (
                                    <div className="text-center text-emerald-400 font-bold py-3 text-sm">
                                        Plan Activo
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => handleCheckout(plan.name, 'stripe')}
                                            disabled={!!checkoutLoading}
                                            className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                                isPro
                                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white'
                                                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white'
                                            } disabled:opacity-50`}
                                        >
                                            {checkoutLoading === `${plan.name}-stripe` ? 'Redirigiendo...' : (
                                                <>
                                                    <CreditCard size={16} /> Pagar con Stripe
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleCheckout(plan.name, 'mercadopago')}
                                            disabled={!!checkoutLoading}
                                            className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-[#009ee3]/20 hover:bg-[#009ee3]/30 text-[#00b1ea] border border-[#009ee3]/30 transition-all disabled:opacity-50"
                                        >
                                            {checkoutLoading === `${plan.name}-mercadopago` ? 'Redirigiendo...' : (
                                                <>Pagar con MercadoPago</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Usage Section */}
                {usage && (
                    <div className="mb-8">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <BarChart3 className="text-blue-400" /> Consumo Este Mes
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <UsageCard
                                label="Mensajes Enviados"
                                value={usage.messages_sent}
                                limit={usage.limits?.max_messages}
                                pct={usage.limits?.messages_pct}
                            />
                            <UsageCard
                                label="Mensajes Recibidos"
                                value={usage.messages_received}
                            />
                            <UsageCard
                                label="Tokens LLM"
                                value={usage.tokens_used?.toLocaleString()}
                                limit={usage.limits?.max_tokens}
                                pct={usage.limits?.tokens_pct}
                            />
                            <UsageCard
                                label="Costo Estimado"
                                value={`$${(usage.llm_cost_usd || 0).toFixed(2)}`}
                            />
                        </div>
                    </div>
                )}

                {/* Invoices Section */}
                {invoices.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Receipt className="text-slate-400" /> Historial de Facturacion
                        </h2>
                        <div className="glass rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] text-slate-500 uppercase bg-black/30">
                                    <tr>
                                        <th className="text-left p-3">Fecha</th>
                                        <th className="text-left p-3">Periodo</th>
                                        <th className="text-right p-3">Monto</th>
                                        <th className="text-right p-3">Estado</th>
                                        <th className="text-right p-3">Provider</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} className="hover:bg-white/5">
                                            <td className="p-3 text-slate-300">{new Date(inv.created_at).toLocaleDateString()}</td>
                                            <td className="p-3 text-slate-500 text-xs">
                                                {inv.period_start ? `${new Date(inv.period_start).toLocaleDateString()} - ${new Date(inv.period_end).toLocaleDateString()}` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-400">
                                                {inv.currency === 'ARS' ? 'AR$' : '$'}{inv.amount_usd || inv.amount_local}
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    inv.status === 'paid' ? 'bg-emerald-900/30 text-emerald-400' :
                                                    inv.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                                                    'bg-red-900/30 text-red-400'
                                                }`}>
                                                    {inv.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-slate-500 text-xs">{inv.payment_provider || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const LimitRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
            {icon}
            <span>{label}</span>
        </div>
        <span className="font-bold text-white">{value}</span>
    </div>
);

const UsageCard = ({ label, value, limit, pct }: { label: string; value: any; limit?: number; pct?: number }) => (
    <div className="glass p-4 rounded-xl">
        <div className="text-[10px] text-slate-500 uppercase mb-1">{label}</div>
        <div className="text-2xl font-black text-white">{value || 0}</div>
        {limit && limit !== -1 && (
            <>
                <div className="text-xs text-slate-500 mt-1">de {limit.toLocaleString()}</div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${(pct || 0) > 90 ? 'bg-red-500' : (pct || 0) > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, pct || 0)}%` }}
                    />
                </div>
            </>
        )}
    </div>
);
