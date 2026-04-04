import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Zap, ArrowRight, Check, Gift, Bot, MessageSquare,
  BarChart3, Shield, Clock, Star, Sparkles, Phone,
  Instagram, Globe, ChevronDown, ChevronUp,
  BookOpen, Palette, Users, TrendingUp
} from 'lucide-react';

// ─── Hooks ────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function StatCounter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.3);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── FAQ Item ─────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors">
        <span className="font-semibold text-white/90 pr-4">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-purple-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function PromoLanding() {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Form
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Scroll refs
  const formRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(0.1);
  const statsInView = useInView(0.15);
  const featuresInView = useInView(0.1);
  const giftInView = useInView(0.1);
  const socialInView = useInView(0.1);
  const faqInView = useInView(0.1);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeName.trim() || !email.trim() || !password.trim()) {
      setError('Completá todos los campos');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, storeName);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Error al crear la cuenta. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[180px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-blue-600/15 rounded-full blur-[150px]" />
        </div>
        <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">¡Cuenta creada! 🎉</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Te enviamos un email de verificación a <span className="text-purple-400 font-medium">{email}</span>.
            Verificá tu cuenta y empezá a vender con IA.
          </p>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-purple-300">
              <Gift className="w-4 h-4 inline mr-1" />
              Tu cuenta incluye <strong>14 días gratis</strong> con 200 mensajes y un agente IA pre-configurado.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-white hover:scale-[1.02] transition-transform"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  // ─── Promo Page ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06060e] text-white overflow-x-hidden">
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(2deg); } }
        @keyframes glow-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes border-glow { 0%,100% { border-color: rgba(139,92,246,0.3); } 50% { border-color: rgba(139,92,246,0.6); } }
        .animate-float { animation: float 7s ease-in-out infinite; }
        .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
        .animate-shimmer { background-size: 200% auto; animation: shimmer 3s linear infinite; }
        .animate-border-glow { animation: border-glow 3s ease-in-out infinite; }
      `}</style>

      {/* ── Glow Orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[180px] animate-glow" />
        <div className="absolute bottom-40 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] animate-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[120px] animate-glow" style={{ animationDelay: '4s' }} />
      </div>

      {/* ── Minimal Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-[#06060e]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">Future</span>
          </Link>
          <button onClick={scrollToForm} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-sm font-bold hover:scale-105 transition-transform">
            Crear cuenta gratis
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO — Valor + Formulario inline
         ══════════════════════════════════════════════════════════ */}
      <section ref={heroInView.ref} className="relative pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Value Prop */}
          <div className={`transition-all duration-700 ${heroInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
              <Gift className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-purple-300">Oferta de lanzamiento — 14 días gratis</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6">
              Tu vendedor IA
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                que nunca duerme
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-8 max-w-lg">
              Conectá WhatsApp, Instagram y Facebook. Dejá que la IA responda, venda y cierre por vos. <strong className="text-white">24 horas, 7 días.</strong>
            </p>

            {/* Gift boxes */}
            <div className="space-y-3 mb-8">
              {[
                { icon: Bot, text: 'Agente IA pre-configurado para tu negocio' },
                { icon: MessageSquare, text: '200 mensajes gratis para que pruebes' },
                { icon: Clock, text: '14 días completos sin pagar nada' },
                { icon: Shield, text: 'Sin tarjeta de crédito, cancelá cuando quieras' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm text-gray-300">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Social proof mini */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 border-2 border-[#06060e] flex items-center justify-center">
                    <Users className="w-3 h-3 text-white/80" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                <span className="text-white font-semibold">+500 negocios</span> ya venden con Future
              </p>
            </div>
          </div>

          {/* Right — Registration Form */}
          <div ref={formRef} className={`transition-all duration-700 delay-200 ${heroInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 sm:p-10 animate-border-glow">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">100% Gratis</span>
                </div>
                <h2 className="text-2xl font-black text-white">Creá tu cuenta en 30 segundos</h2>
                <p className="text-sm text-gray-500 mt-2">Sin tarjeta. Sin compromisos. Empezá a vender hoy.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nombre de tu negocio</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ej: Mi Tienda Online"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-lg text-white shadow-[0_8px_32px_rgba(124,58,237,0.4)] hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creando tu cuenta...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Empezar gratis <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </button>

                <p className="text-xs text-center text-gray-600">
                  Al registrarte aceptás los{' '}
                  <Link to="/terms-of-service" className="text-purple-400 hover:text-purple-300">Términos</Link>
                  {' '}y{' '}
                  <Link to="/privacy-policy" className="text-purple-400 hover:text-purple-300">Política de Privacidad</Link>
                </p>
              </form>

              <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
                <p className="text-sm text-gray-500">
                  ¿Ya tenés cuenta?{' '}
                  <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium">Iniciar sesión</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS — Social proof números
         ══════════════════════════════════════════════════════════ */}
      <section ref={statsInView.ref} className="relative py-16 border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 text-center transition-all duration-700 ${statsInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {[
              { end: 500, suffix: '+', label: 'Negocios activos' },
              { end: 1, suffix: 'M+', label: 'Mensajes procesados' },
              { end: 99, suffix: '.9%', label: 'Uptime garantizado' },
              { end: 2, prefix: '$', suffix: 'M+', label: 'En ventas asistidas' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  <StatCounter end={stat.end} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES — Qué puede hacer tu agente
         ══════════════════════════════════════════════════════════ */}
      <section ref={featuresInView.ref} className="relative py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-14 transition-all duration-700 ${featuresInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Todo lo que tu{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">agente IA</span>
              {' '}puede hacer
            </h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">Un empleado que trabaja 24/7, no pide vacaciones, y mejora con cada conversación.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Bot, title: 'Vende por vos', desc: 'Responde consultas, muestra productos y cierra ventas de forma autónoma. Como tu mejor vendedor, pero las 24 horas.', color: 'purple' },
              { icon: MessageSquare, title: 'WhatsApp + Instagram + Facebook', desc: 'Un solo lugar para todos tus canales. Tu agente responde en cada plataforma con el mismo conocimiento.', color: 'blue' },
              { icon: BarChart3, title: 'Analytics de verdad', desc: 'Sabé exactamente cuánto vendés gracias a la IA. ROI real, no métricas de vanidad.', color: 'cyan' },
              { icon: BookOpen, title: 'Aprende tu negocio', desc: 'Subí PDFs, catálogos, preguntas frecuentes. El agente aprende y responde con tu información real.', color: 'purple' },
              { icon: Phone, title: 'Widget de voz', desc: 'Embebé un asistente de voz IA en tu sitio web. Tus clientes hablan, el agente responde.', color: 'blue' },
              { icon: Palette, title: 'Estudio creativo', desc: 'Generá imágenes de productos y assets de marketing con IA. Todo desde la misma plataforma.', color: 'cyan' },
            ].map((f, i) => (
              <div
                key={i}
                className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-1 ${featuresInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  f.color === 'purple' ? 'bg-purple-500/10 border border-purple-500/20' :
                  f.color === 'blue' ? 'bg-blue-500/10 border border-blue-500/20' :
                  'bg-cyan-500/10 border border-cyan-500/20'
                }`}>
                  <f.icon className={`w-6 h-6 ${
                    f.color === 'purple' ? 'text-purple-400' :
                    f.color === 'blue' ? 'text-blue-400' :
                    'text-cyan-400'
                  }`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          GIFT SECTION — Lo que incluye gratis
         ══════════════════════════════════════════════════════════ */}
      <section ref={giftInView.ref} className="relative py-20 sm:py-28 border-y border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-12 transition-all duration-700 ${giftInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
              <Gift className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-green-300">Lo que incluye tu cuenta gratis</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Empezá <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">sin pagar un peso</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Bot, title: '1 Agente IA completo', desc: 'Configurado con las instrucciones de tu negocio' },
              { icon: MessageSquare, title: '200 mensajes', desc: 'Suficiente para ver resultados reales en 14 días' },
              { icon: Globe, title: '1 canal conectado', desc: 'WhatsApp, Instagram o Facebook — vos elegís' },
              { icon: BookOpen, title: '5 documentos de conocimiento', desc: 'Subí tu catálogo, FAQ, o lo que necesites' },
              { icon: Clock, title: '14 días completos', desc: 'Sin presión, probá todo a tu ritmo' },
              { icon: Shield, title: 'Sin tarjeta de crédito', desc: 'No te pedimos datos de pago. Nunca.' },
              { icon: Sparkles, title: 'Onboarding guiado', desc: 'Te llevamos paso a paso para que configures todo' },
              { icon: TrendingUp, title: 'Dashboard de analytics', desc: 'Medí el impacto real de tu agente IA' },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] transition-all duration-500 ${giftInView.inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button onClick={scrollToForm} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-lg shadow-[0_8px_32px_rgba(124,58,237,0.4)] hover:scale-105 transition-transform">
              Quiero mi cuenta gratis <ArrowRight className="w-5 h-5 inline ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SOCIAL PROOF — Testimonios
         ══════════════════════════════════════════════════════════ */}
      <section ref={socialInView.ref} className="relative py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-12 transition-all duration-700 ${socialInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Lo que dicen nuestros{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">clientes</span>
            </h2>
          </div>

          <div className={`grid sm:grid-cols-3 gap-5 transition-all duration-700 ${socialInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {[
              { name: 'Martín R.', role: 'Dueño — Tienda de ropa', quote: 'Dejé de perder ventas a las 3 AM. El agente cierra pedidos mientras duermo. Incrementé mis ventas un 40% el primer mes.', stars: 5 },
              { name: 'Carolina S.', role: 'Manager — E-commerce', quote: 'Teníamos 3 personas respondiendo WhatsApp. Ahora Future responde el 80% solo. Mis empleados se enfocan en lo importante.', stars: 5 },
              { name: 'Diego L.', role: 'Agencia digital', quote: 'Manejo 12 tiendas desde Future. Cada cliente tiene su agente personalizado. Cobro el servicio y la plataforma se paga sola.', stars: 5 },
            ].map((t, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6" style={{ transitionDelay: `${i * 150}ms` }}>
                <div className="flex gap-1 mb-3">
                  {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 text-yellow-500 fill-yellow-500" />)}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-4 italic">"{t.quote}"</p>
                <div>
                  <p className="font-bold text-white text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FAQ
         ══════════════════════════════════════════════════════════ */}
      <section ref={faqInView.ref} className="relative py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-12 transition-all duration-700 ${faqInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl font-black tracking-tight">Preguntas frecuentes</h2>
          </div>

          <div className={`space-y-3 transition-all duration-700 ${faqInView.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <FAQItem q="¿Realmente es gratis?" a="Sí. Tenés 14 días con un agente IA, 200 mensajes y un canal. Sin tarjeta de crédito. Después podés seguir con el plan gratuito o subir a Pro." />
            <FAQItem q="¿Qué pasa después de los 14 días?" a="Tu cuenta sigue activa con el plan gratuito (50 mensajes/mes, 1 agente). Si querés más, los planes Pro arrancan en USD $49/mes." />
            <FAQItem q="¿Necesito saber programar?" a="No. El onboarding te guía paso a paso. En 10 minutos tenés tu agente configurado y respondiendo clientes." />
            <FAQItem q="¿Funciona con mi tienda de Tiendanube?" a="Sí. Future se integra directo con Tiendanube — sincroniza tu catálogo, busca productos y genera links de compra automáticamente." />
            <FAQItem q="¿El agente puede vender por WhatsApp?" a="Sí. Conectás tu número de WhatsApp Business y el agente responde, muestra productos, y cierra ventas. Todo automático." />
            <FAQItem q="¿Puedo cancelar en cualquier momento?" a="Sí. No hay contratos ni permanencia mínima. Podés cancelar desde tu dashboard en 2 clicks." />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
         ══════════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-b from-purple-900/20 to-transparent border border-purple-500/20 rounded-3xl p-10 sm:p-14">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              ¿Listo para vender mientras dormís?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Más de 500 negocios ya usan Future para vender 24/7. Creá tu cuenta gratis y probalo vos mismo.
            </p>
            <button onClick={scrollToForm} className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold text-lg shadow-[0_8px_32px_rgba(124,58,237,0.4)] hover:scale-105 transition-transform">
              Crear mi cuenta gratis <ArrowRight className="w-5 h-5 inline ml-1" />
            </button>
            <p className="text-xs text-gray-600 mt-4">Sin tarjeta de crédito. Setup en 10 minutos.</p>
          </div>
        </div>
      </section>

      {/* ── Footer mínimo ── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-500">Future Platform © 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link to="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacidad</Link>
            <Link to="/terms-of-service" className="hover:text-gray-400 transition-colors">Términos</Link>
            <Link to="/pricing" className="hover:text-gray-400 transition-colors">Precios</Link>
            <Link to="/landing" className="hover:text-gray-400 transition-colors">Inicio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
