import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import {
    CreditCard, Check, X, Clock, AlertTriangle, ArrowRight,
    Zap, Shield, Crown, Star, BarChart3, Users, MessageSquare,
    BookOpen, Radio, Receipt, TrendingUp, Instagram, Facebook,
    MessageCircle, Store, Sparkles
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
                    fetchApi('/billing/plans').catch(() => []),
                    fetchApi('/billing/my-subscription').catch(() => null),
                    fetchApi('/billing/usage').catch(() => null),
                    fetchApi('/billing/invoices').catch(() => [])
                ]);
                setPlans((p || []).map((plan: any) => ({
                    ...plan,
                    features: typeof plan.features === 'string' ? (() => { try { return JSON.parse(plan.features); } catch { return {}; } })() : (plan.features || {})
                })));
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

    const [mpFallbackUrl, setMpFallbackUrl] = useState<string | null>(null);

    const handleCheckout = async (planName: string, provider: string) => {
        setCheckoutLoading(`${planName}-${provider}`);
        setMpFallbackUrl(null);
        try {
            const result = await fetchApi('/billing/checkout', {
                method: 'POST',
                body: { plan_name: planName, billing_period: billingPeriod, provider, currency }
            });
            if (result.checkout_url) {
                if (provider === 'mercadopago') {
                    // Open in new tab — avoids tracking prevention blocking MP assets
                    const newWindow = window.open(result.checkout_url, '_blank');
                    if (!newWindow) {
                        // Popup blocked — show fallback link
                        setMpFallbackUrl(result.checkout_url);
                    }
                } else {
                    // Stripe: redirect in same tab (works fine)
                    window.location.href = result.checkout_url;
                }
            }
        } catch (e: any) {
            alert(e.message || 'Error al crear el checkout');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const getPrice = (plan: Plan) => billingPeriod === 'yearly'
        ? (currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly)
        : (currency === 'USD' ? plan.price_usd : plan.price_ars);

    const getMonthlyPrice = (plan: Plan) => billingPeriod === 'yearly'
        ? (currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly) / 12
        : (currency === 'USD' ? plan.price_usd : plan.price_ars);

    const formatLimit = (val: number) => val === -1 ? 'Ilimitado' : val.toLocaleString();

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
    const isFreeUser = !currentPlan || currentPlan === 'free' || !subscription?.has_subscription;
    const isPaidActive = subscription?.status === 'active' && currentPlan && currentPlan !== 'free';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <div className="view active p-4 sm:p-6 max-w-6xl mx-auto">

                {/* ============ FREE / TRIAL USER VIEW ============ */}
                {isFreeUser && !isPaidActive && (
                    <>
                        {/* Hero */}
                        <div className="text-center mb-8 sm:mb-10">
                            <div className="inline-flex p-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-2xl mb-4 border border-purple-500/10">
                                <Sparkles size={36} className="text-purple-400" />
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
                                Potencia tu negocio con <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Future</span>
                            </h1>
                            <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
                                Conecta todos tus canales de atencion, deja que la IA responda por vos y enfocate en hacer crecer tu negocio.
                            </p>
                        </div>

                        {/* Trial Status */}
                        {subscription?.status === 'trialing' && !isTrialExpired && (
                            <div className="mb-8 p-4 sm:p-5 rounded-xl bg-blue-900/20 border border-blue-500/30">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Clock className="text-blue-400 shrink-0" size={20} />
                                        <div>
                                            <div className="text-blue-400 font-bold text-sm">Periodo de prueba gratuito</div>
                                            <div className="text-slate-400 text-xs">
                                                Te quedan <strong className="text-white">{subscription.trial_days_remaining || 0}</strong> dias de acceso
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Vence: {subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Expired Banner */}
                        {isBlocked && (
                            <div className="mb-8 p-4 sm:p-6 rounded-xl bg-gradient-to-r from-red-900/30 to-orange-900/20 border border-red-500/30">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={24} className="text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-bold text-red-400 mb-1">
                                            {isTrialExpired ? 'Tu periodo de prueba ha expirado' : 'Tu cuenta esta bloqueada'}
                                        </h3>
                                        <p className="text-slate-300 text-sm">
                                            Elige un plan para seguir usando la plataforma. Tus datos estan seguros.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* What's Included in Free */}
                        <div className="mb-8 p-4 sm:p-6 rounded-xl bg-white/[0.02] border border-white/10">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                                Incluido en el periodo gratuito (10 dias)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <FreeInclude icon={<Store size={16} />} label="1 Tienda" />
                                <FreeInclude icon={<Instagram size={16} />} label="1 Instagram" />
                                <FreeInclude icon={<Facebook size={16} />} label="1 Facebook" />
                                <FreeInclude icon={<MessageCircle size={16} />} label="2 WhatsApp" />
                                <FreeInclude icon={<MessageSquare size={16} />} label="200 mensajes" />
                                <FreeInclude icon={<Users size={16} />} label="1 agente IA" />
                            </div>
                            <p className="text-[11px] text-slate-600 mt-3">
                                Si se agotan los mensajes antes de los 10 dias, necesitaras un plan pago para continuar.
                            </p>
                        </div>

                        {/* Period & Currency Toggle */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                                <button
                                    onClick={() => setBillingPeriod('monthly')}
                                    className={`px-4 py-2 rounded text-sm font-bold transition-all ${billingPeriod === 'monthly' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Mensual
                                </button>
                                <button
                                    onClick={() => setBillingPeriod('yearly')}
                                    className={`px-4 py-2 rounded text-sm font-bold transition-all flex items-center gap-1 ${billingPeriod === 'yearly' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Anual <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-1">-20%</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                                <button onClick={() => setCurrency('USD')} className={`px-3 py-1.5 rounded text-xs font-bold ${currency === 'USD' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>USD</button>
                                <button onClick={() => setCurrency('ARS')} className={`px-3 py-1.5 rounded text-xs font-bold ${currency === 'ARS' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>ARS</button>
                            </div>
                        </div>

                        {/* MP Fallback Link */}
                        {mpFallbackUrl && (
                            <div className="mb-6 p-4 rounded-xl bg-[#009ee3]/10 border border-[#009ee3]/30">
                                <p className="text-sm text-[#00b1ea] font-bold mb-2">Tu navegador bloqueo la ventana de pago</p>
                                <p className="text-xs text-slate-400 mb-3">Si la pagina de MercadoPago no se abrio, usa este enlace:</p>
                                <div className="flex gap-2">
                                    <a href={mpFallbackUrl} target="_blank" rel="noopener noreferrer"
                                       className="flex-1 py-2.5 bg-[#009ee3] hover:bg-[#0088cc] text-white font-bold text-sm rounded-lg text-center transition-colors">
                                        Abrir MercadoPago
                                    </a>
                                    <button onClick={() => { navigator.clipboard.writeText(mpFallbackUrl); alert('Link copiado!'); }}
                                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg font-bold transition-colors">
                                        Copiar Link
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Plans Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            {plans.filter(p => p.name !== 'free').map((plan) => {
                                const isPro = plan.name === 'pro';
                                const price = getMonthlyPrice(plan);
                                const sym = currency === 'USD' ? '$' : 'AR$';

                                return (
                                    <div key={plan.id} className={`relative rounded-2xl border p-5 sm:p-6 transition-all ${
                                        isPro
                                            ? 'border-purple-500/50 bg-gradient-to-b from-purple-900/20 to-transparent shadow-lg shadow-purple-900/20'
                                            : 'border-amber-500/30 bg-gradient-to-b from-amber-900/10 to-transparent'
                                    }`}>
                                        {isPro && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                Recomendado
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mb-2">
                                            {isPro ? <Zap size={20} className="text-purple-400" /> : <Crown size={20} className="text-amber-400" />}
                                            <h3 className="text-xl font-black">{plan.display_name}</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4">{plan.description}</p>

                                        {/* Price */}
                                        <div className="mb-5">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm text-slate-400">{sym}</span>
                                                <span className="text-4xl font-black text-white">{Math.round(price).toLocaleString()}</span>
                                                <span className="text-slate-500 text-sm">/mes</span>
                                            </div>
                                            {billingPeriod === 'yearly' && (
                                                <div className="text-xs text-emerald-400 mt-1">{sym}{getPrice(plan).toLocaleString()} facturado anualmente</div>
                                            )}
                                        </div>

                                        {/* Limits */}
                                        <div className="space-y-2 mb-5 text-sm">
                                            <LimitRow icon={<Users size={14} />} label="Agentes IA" value={formatLimit(plan.max_agents)} />
                                            <LimitRow icon={<MessageSquare size={14} />} label="Mensajes/mes" value={formatLimit(plan.max_messages_per_month)} />
                                            <LimitRow icon={<BookOpen size={14} />} label="Docs conocimiento" value={formatLimit(plan.max_knowledge_docs)} />
                                            <LimitRow icon={<Radio size={14} />} label="Canales" value={formatLimit(plan.max_channels)} />
                                            <LimitRow icon={<Users size={14} />} label="Miembros del equipo" value={formatLimit(plan.max_team_members)} />
                                            <LimitRow icon={<Zap size={14} />} label="Tokens LLM/mes" value={formatLimit(plan.max_tokens_per_month)} />
                                        </div>

                                        {/* Features */}
                                        <div className="space-y-1.5 mb-5">
                                            {Object.entries(plan.features || {}).map(([f, on]) => (
                                                <div key={f} className="flex items-center gap-2 text-xs">
                                                    {on ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-600" />}
                                                    <span className={on ? 'text-slate-300' : 'text-slate-600'}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* CTA Buttons */}
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleCheckout(plan.name, 'stripe')}
                                                disabled={!!checkoutLoading}
                                                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                                    isPro
                                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'
                                                        : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                                                } text-white disabled:opacity-50`}
                                            >
                                                {checkoutLoading === `${plan.name}-stripe` ? 'Redirigiendo...' : (<><CreditCard size={16} /> Pagar con Tarjeta (Stripe)</>)}
                                            </button>
                                            <button
                                                onClick={() => handleCheckout(plan.name, 'mercadopago')}
                                                disabled={!!checkoutLoading}
                                                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-[#009ee3]/20 hover:bg-[#009ee3]/30 text-[#00b1ea] border border-[#009ee3]/30 transition-all disabled:opacity-50"
                                            >
                                                {checkoutLoading === `${plan.name}-mercadopago` ? 'Redirigiendo...' : 'Pagar con MercadoPago'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* No plans loaded fallback */}
                        {plans.length === 0 && (
                            <div className="text-center py-16 text-slate-500">
                                <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-bold mb-2">Los planes se estan cargando...</p>
                                <p className="text-sm">Si esto persiste, recarga la pagina o contacta soporte.</p>
                            </div>
                        )}
                    </>
                )}

                {/* ============ PAID / ACTIVE USER VIEW ============ */}
                {isPaidActive && (
                    <>
                        <div className="mb-8">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                                <CreditCard className="text-purple-400" />
                                Suscripcion & Planes
                            </h1>
                            <p className="text-slate-400 text-sm">Gestiona tu plan, pagos y consumo.</p>
                        </div>

                        {/* Active Plan Banner */}
                        <div className="mb-8 p-4 sm:p-5 rounded-xl bg-emerald-900/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Check className="text-emerald-400" />
                                <div>
                                    <span className="text-emerald-400 font-bold">Plan {subscription?.plan_display_name} activo</span>
                                    {subscription?.payment_provider && (
                                        <span className="text-slate-500 ml-2 text-xs">via {subscription.payment_provider}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Usage Section */}
                        {usage && (
                            <div className="mb-8">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <BarChart3 className="text-blue-400" /> Consumo Este Mes
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                    <UsageCard label="Mensajes Enviados" value={usage.messages_sent} limit={usage.limits?.max_messages} pct={usage.limits?.messages_pct} />
                                    <UsageCard label="Mensajes Recibidos" value={usage.messages_received} />
                                    <UsageCard label="Tokens LLM" value={usage.tokens_used?.toLocaleString()} limit={usage.limits?.max_tokens} pct={usage.limits?.tokens_pct} />
                                    <UsageCard label="Costo Estimado" value={`$${(usage.llm_cost_usd || 0).toFixed(2)}`} />
                                </div>
                            </div>
                        )}

                        {/* Plan Comparison (for upgrades) */}
                        <div className="mb-8">
                            <h2 className="text-lg font-bold mb-4">Cambiar Plan</h2>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                                    <button onClick={() => setBillingPeriod('monthly')} className={`px-3 py-1.5 rounded text-xs font-bold ${billingPeriod === 'monthly' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30' : 'text-slate-500'}`}>Mensual</button>
                                    <button onClick={() => setBillingPeriod('yearly')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${billingPeriod === 'yearly' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30' : 'text-slate-500'}`}>
                                        Anual <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded-full">-20%</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg">
                                    <button onClick={() => setCurrency('USD')} className={`px-2 py-1 rounded text-xs font-bold ${currency === 'USD' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>USD</button>
                                    <button onClick={() => setCurrency('ARS')} className={`px-2 py-1 rounded text-xs font-bold ${currency === 'ARS' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>ARS</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {plans.map(plan => {
                                    const isCurrent = currentPlan === plan.name;
                                    const price = getMonthlyPrice(plan);
                                    const sym = currency === 'USD' ? '$' : 'AR$';
                                    return (
                                        <div key={plan.id} className={`rounded-xl border p-4 ${isCurrent ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-white/10 bg-black/30'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-bold">{plan.display_name}</h4>
                                                {isCurrent && <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">ACTUAL</span>}
                                            </div>
                                            <div className="text-2xl font-black mb-3">{plan.name === 'free' ? 'Gratis' : `${sym}${Math.round(price).toLocaleString()}/mes`}</div>
                                            {!isCurrent && plan.name !== 'free' && (
                                                <div className="space-y-1.5">
                                                    <button onClick={() => handleCheckout(plan.name, 'stripe')} disabled={!!checkoutLoading} className="w-full py-2 rounded-lg text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 disabled:opacity-50">
                                                        {checkoutLoading === `${plan.name}-stripe` ? '...' : 'Stripe'}
                                                    </button>
                                                    <button onClick={() => handleCheckout(plan.name, 'mercadopago')} disabled={!!checkoutLoading} className="w-full py-2 rounded-lg text-xs font-bold bg-[#009ee3]/10 text-[#00b1ea] border border-[#009ee3]/20 hover:bg-[#009ee3]/20 disabled:opacity-50">
                                                        {checkoutLoading === `${plan.name}-mercadopago` ? '...' : 'MercadoPago'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Invoices */}
                        {invoices.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Receipt className="text-slate-400" /> Historial de Facturacion
                                </h2>
                                <div className="glass rounded-xl overflow-x-auto">
                                    <table className="w-full text-sm min-w-[500px]">
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
                                                    <td className="p-3 text-slate-500 text-xs">{inv.period_start ? `${new Date(inv.period_start).toLocaleDateString()} - ${new Date(inv.period_end).toLocaleDateString()}` : '-'}</td>
                                                    <td className="p-3 text-right font-bold text-emerald-400">{inv.currency === 'ARS' ? 'AR$' : '$'}{inv.amount_usd || inv.amount_local}</td>
                                                    <td className="p-3 text-right">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inv.status === 'paid' ? 'bg-emerald-900/30 text-emerald-400' : inv.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-red-900/30 text-red-400'}`}>
                                                            {(inv.status || 'unknown').toUpperCase()}
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
                    </>
                )}
            </div>
        </div>
    );
};

const FreeInclude = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-3">
        <span className="text-blue-400">{icon}</span>
        <span className="text-xs text-slate-300 font-medium">{label}</span>
    </div>
);

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
