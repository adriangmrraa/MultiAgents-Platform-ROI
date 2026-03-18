import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, ArrowRight, Check, X, CreditCard, Users,
    MessageSquare, BookOpen, Radio, Crown
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

export const Pricing: React.FC = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');

    useEffect(() => {
        const load = async () => {
            try {
                const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
                const res = await fetch(`${API_BASE}/billing/plans`);
                if (res.ok) {
                    const data = await res.json();
                    setPlans((data || []).map((plan: any) => ({
                        ...plan,
                        features: typeof plan.features === 'string'
                            ? (() => { try { return JSON.parse(plan.features); } catch { return {}; } })()
                            : (plan.features || {})
                    })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const getMonthlyPrice = (plan: Plan) => billingPeriod === 'yearly'
        ? (currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly) / 12
        : (currency === 'USD' ? plan.price_usd : plan.price_ars);

    const getYearlyTotal = (plan: Plan) => currency === 'USD' ? plan.price_usd_yearly : plan.price_ars_yearly;

    const formatLimit = (val: number) => val === -1 ? 'Ilimitado' : val.toLocaleString();
    const sym = currency === 'USD' ? '$' : 'AR$';

    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                            <Zap size={18} className="text-white fill-current" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Future Platform</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Iniciar Sesion</Link>
                        <Link to="/register" className="bg-white text-black hover:bg-gray-200 px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
                            Comenzar Gratis <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                        Planes & Precios
                    </h1>
                    <p className="text-gray-400 text-lg max-w-xl mx-auto">
                        Empieza gratis, escala cuando tu negocio lo necesite.
                    </p>
                </div>

                {/* Toggles */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-lg">
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
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-lg">
                        <button onClick={() => setCurrency('USD')} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currency === 'USD' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>USD</button>
                        <button onClick={() => setCurrency('ARS')} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${currency === 'ARS' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>ARS</button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-mono">Cargando planes...</div>
                ) : (
                    <>
                        {/* Plans Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                            {plans.map((plan) => {
                                const isFree = plan.name === 'free';
                                const isPro = plan.name === 'pro';
                                const isEnt = plan.name === 'enterprise';
                                const price = getMonthlyPrice(plan);

                                return (
                                    <div key={plan.id} className={`relative rounded-2xl border p-6 sm:p-8 transition-all ${
                                        isPro
                                            ? 'border-purple-500/50 bg-gradient-to-b from-purple-900/20 to-transparent shadow-lg shadow-purple-900/20 scale-[1.02]'
                                            : isEnt
                                                ? 'border-amber-500/30 bg-gradient-to-b from-amber-900/10 to-transparent'
                                                : 'border-white/10 bg-white/[0.02]'
                                    }`}>
                                        {isPro && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                Recomendado
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mb-2">
                                            {isFree ? <CreditCard size={20} className="text-gray-400" /> :
                                             isPro ? <Zap size={20} className="text-purple-400" /> :
                                             <Crown size={20} className="text-amber-400" />}
                                            <h3 className="text-xl font-black">{plan.display_name}</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-5">{plan.description}</p>

                                        {/* Price */}
                                        <div className="mb-6">
                                            {isFree ? (
                                                <div className="text-4xl font-black">Gratis</div>
                                            ) : (
                                                <>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-sm text-slate-400">{sym}</span>
                                                        <span className="text-4xl font-black">{Math.round(price).toLocaleString()}</span>
                                                        <span className="text-slate-500 text-sm">/mes</span>
                                                    </div>
                                                    {billingPeriod === 'yearly' && (
                                                        <div className="text-xs text-emerald-400 mt-1">{sym}{getYearlyTotal(plan).toLocaleString()} facturado anualmente</div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Limits */}
                                        <div className="space-y-2.5 mb-6 text-sm">
                                            <LimitRow icon={<Users size={14} />} label="Agentes IA" value={formatLimit(plan.max_agents)} />
                                            <LimitRow icon={<MessageSquare size={14} />} label="Mensajes/mes" value={formatLimit(plan.max_messages_per_month)} />
                                            <LimitRow icon={<BookOpen size={14} />} label="Docs conocimiento" value={formatLimit(plan.max_knowledge_docs)} />
                                            <LimitRow icon={<Radio size={14} />} label="Canales" value={formatLimit(plan.max_channels)} />
                                            <LimitRow icon={<Users size={14} />} label="Equipo" value={formatLimit(plan.max_team_members)} />
                                        </div>

                                        {/* Features */}
                                        <div className="space-y-1.5 mb-6 border-t border-white/5 pt-4">
                                            {Object.entries(plan.features || {}).map(([f, on]) => (
                                                <div key={f} className="flex items-center gap-2 text-xs">
                                                    {on ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-700" />}
                                                    <span className={on ? 'text-slate-300' : 'text-slate-600'}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* CTA */}
                                        <Link
                                            to="/register"
                                            className={`block w-full py-3 rounded-xl font-bold text-sm text-center transition-all ${
                                                isPro
                                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/30'
                                                    : isEnt
                                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white'
                                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                            }`}
                                        >
                                            {isFree ? 'Empezar Gratis' : 'Elegir Plan'}
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>

                        {/* FAQ hint */}
                        <div className="text-center text-gray-500 text-sm">
                            Todos los planes incluyen soporte por email. <Link to="/register" className="text-purple-400 hover:text-purple-300 font-bold">Registrate gratis</Link> y elige tu plan despues.
                        </div>
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 py-12 bg-black">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-500 text-sm">&copy; 2026 Future Platform. Todos los derechos reservados.</div>
                    <div className="flex gap-6 text-sm font-medium">
                        <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">Terminos</Link>
                        <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacidad</Link>
                    </div>
                </div>
            </footer>
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

export default Pricing;
