import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, ArrowRight, MessageSquare, Bot, BookOpen, Palette, Mic, BarChart3,
    Check, ChevronDown, ChevronUp, Star, Shield, Clock, Users, TrendingUp,
    Instagram, Facebook, Sparkles, Play, Globe, Phone
} from 'lucide-react';

/* ─── Mouse Parallax Hook ─── */
const useMouseParallax = (intensity = 0.02) => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const x = (e.clientX - window.innerWidth / 2) * intensity;
        const y = (e.clientY - window.innerHeight / 2) * intensity;
        setOffset({ x, y });
    }, [intensity]);
    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [handleMouseMove]);
    return offset;
};

/* ─── Intersection Observer Hook ─── */
const useInView = (threshold = 0.15) => {
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
};

/* ─── Animated Counter ─── */
const StatCounter = ({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) => {
    const [count, setCount] = useState(0);
    const { ref, inView } = useInView(0.3);
    const started = useRef(false);
    useEffect(() => {
        if (inView && !started.current) {
            started.current = true;
            const duration = 2000;
            const step = Math.ceil(value / (duration / 16));
            let current = 0;
            const timer = setInterval(() => {
                current += step;
                if (current >= value) { current = value; clearInterval(timer); }
                setCount(current);
            }, 16);
        }
    }, [inView, value]);
    return (
        <div ref={ref} className="text-center group cursor-default">
            <div className="text-3xl sm:text-4xl font-black text-white transition-transform duration-300 group-hover:scale-110">
                {count.toLocaleString()}{suffix}
            </div>
            <div className="text-sm text-gray-500 mt-1 group-hover:text-gray-400 transition-colors">{label}</div>
        </div>
    );
};

/* ─── FAQ Accordion ─── */
const FAQItem = ({ q, a }: { q: string; a: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-all duration-300 group">
                <span className="font-semibold text-white text-sm sm:text-base group-hover:text-purple-300 transition-colors">{q}</span>
                <div className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} className="text-gray-500" />
                </div>
            </button>
            <div className={`overflow-hidden transition-all duration-500 ${open ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">{a}</div>
            </div>
        </div>
    );
};

/* ─── Testimonial Card ─── */
const TestimonialCard = ({ name, role, text, rating }: { name: string; role: string; text: string; rating: number }) => (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col min-w-[300px] sm:min-w-[340px] hover:border-purple-500/30 hover:bg-white/[0.06] transition-all duration-500 group cursor-default hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-900/10">
        <div className="flex gap-1 mb-4">
            {Array.from({ length: rating }).map((_, i) => <Star key={i} size={14} className="text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" style={{ transitionDelay: `${i * 50}ms` }} />)}
        </div>
        <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-4 group-hover:text-gray-200 transition-colors">"{text}"</p>
        <div>
            <div className="font-bold text-white text-sm">{name}</div>
            <div className="text-xs text-gray-500">{role}</div>
        </div>
    </div>
);

/* ─── Neural Background ─── */
const NeuralBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animId: number;
        let nodes: { x: number; y: number; vx: number; vy: number }[] = [];
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);
        // Create nodes
        const count = Math.min(Math.floor(window.innerWidth / 25), 60);
        for (let i = 0; i < count; i++) {
            nodes.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 });
        }
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Update and draw nodes
            nodes.forEach(n => {
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
                if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
                ctx.beginPath();
                ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(124, 58, 237, 0.3)';
                ctx.fill();
            });
            // Draw connections
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.strokeStyle = `rgba(124, 58, 237, ${0.08 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

/* ─── Interactive Feature Card ─── */
const FeatureCard = ({ icon, title, description, gradient, border, iconColor, delay = 0 }: {
    icon: React.ReactNode; title: string; description: string; gradient: string; border: string; iconColor: string; delay?: number;
}) => {
    const { ref, inView } = useInView(0.1);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
        setTilt({ x: -y, y: x });
    };

    return (
        <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${delay}ms` }}>
            <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTilt({ x: 0, y: 0 })}
                className={`bg-gradient-to-b ${gradient} to-transparent border ${border} backdrop-blur-xl rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10 cursor-default group`}
                style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            >
                <div className={`${iconColor} mb-4 transition-all duration-500 group-hover:scale-125 group-hover:drop-shadow-[0_0_12px_currentColor]`}>{icon}</div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-white transition-colors">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">{description}</p>
            </div>
        </div>
    );
};

/* ─── Step Card ─── */
const StepCard = ({ number, title, description, color, delay = 0 }: { number: string; title: string; description: string; color: string; delay?: number }) => {
    const { ref, inView } = useInView(0.1);
    const colorMap: Record<string, string> = {
        purple: 'bg-purple-600/20 border-purple-500/30 text-purple-400 group-hover:bg-purple-600/40 group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]',
        blue: 'bg-blue-600/20 border-blue-500/30 text-blue-400 group-hover:bg-blue-600/40 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        cyan: 'bg-cyan-600/20 border-cyan-500/30 text-cyan-400 group-hover:bg-cyan-600/40 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    };
    return (
        <div ref={ref} className={`text-center relative z-10 group cursor-default transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${delay}ms` }}>
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${colorMap[color] || colorMap.purple} border font-black text-lg mb-4 transition-all duration-500`}>
                {number}
            </div>
            <h3 className="font-bold text-lg mb-2 group-hover:text-purple-300 transition-colors">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">{description}</p>
        </div>
    );
};

/* ─── MAIN LANDING ─── */
export const Landing: React.FC = () => {
    const mouse = useMouseParallax(0.015);
    const heroSection = useInView(0.1);
    const statsSection = useInView(0.2);
    const featuresSection = useInView(0.1);
    const ctaSection = useInView(0.2);

    return (
        <div className="min-h-screen bg-[#06060e] text-white selection:bg-purple-500/30 overflow-x-hidden">
            {/* ─── Global Styles ─── */}
            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 33% { transform: translateY(-20px) rotate(1deg); } 66% { transform: translateY(10px) rotate(-1deg); } }
                @keyframes float-delayed { 0%, 100% { transform: translateY(0px) rotate(0deg); } 33% { transform: translateY(15px) rotate(-1deg); } 66% { transform: translateY(-10px) rotate(1deg); } }
                @keyframes glow-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
                @keyframes slide-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes orbit { 0% { transform: rotate(0deg) translateX(120px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); } }
                @keyframes grid-fade { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.06; } }
                @keyframes border-glow { 0%, 100% { border-color: rgba(124,58,237,0.1); } 50% { border-color: rgba(124,58,237,0.3); } }
                @keyframes text-glow { 0%, 100% { text-shadow: 0 0 20px rgba(124,58,237,0); } 50% { text-shadow: 0 0 40px rgba(124,58,237,0.3); } }
                .animate-float { animation: float 8s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite; }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
                .animate-shimmer { background: linear-gradient(90deg, transparent, rgba(124,58,237,0.1), transparent); background-size: 200% 100%; animation: shimmer 4s linear infinite; }
                .animate-orbit { animation: orbit 20s linear infinite; }
                .animate-grid-fade { animation: grid-fade 6s ease-in-out infinite; }
                .animate-border-glow { animation: border-glow 3s ease-in-out infinite; }
                .animate-text-glow { animation: text-glow 3s ease-in-out infinite; }
                .hover-lift { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .hover-lift:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(124,58,237,0.15); }
            `}</style>

            {/* ─── Neural Background ─── */}
            <NeuralBackground />

            {/* ─── Grid Overlay ─── */}
            <div className="fixed inset-0 pointer-events-none z-0 animate-grid-fade"
                style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

            {/* ─── Nav ─── */}
            <nav className="fixed top-0 w-full z-50 bg-[#06060e]/70 backdrop-blur-2xl border-b border-white/[0.06]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] group-hover:scale-110">
                            <Zap size={16} className="text-white fill-current" />
                        </div>
                        <span className="text-lg sm:text-xl font-bold tracking-tight group-hover:text-purple-300 transition-colors">Future</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-5">
                        <Link to="/pricing" className="text-xs sm:text-sm text-gray-500 hover:text-white transition-all duration-300 hidden sm:block hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Precios</Link>
                        <Link to="/docs" className="text-xs sm:text-sm text-gray-500 hover:text-white transition-all duration-300 hidden sm:block hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Docs</Link>
                        <Link to="/enterprise" className="text-xs sm:text-sm text-gray-500 hover:text-white transition-all duration-300 hidden sm:block hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Enterprise</Link>
                        <Link to="/login" className="text-xs sm:text-sm text-gray-500 hover:text-white transition-all duration-300">Login</Link>
                        <Link to="/register" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all duration-500 shadow-lg shadow-purple-900/30 hover:shadow-purple-900/60 hover:scale-105 active:scale-95">
                            Empezar Gratis <ArrowRight size={13} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ─── */}
            <section ref={heroSection.ref} className="pt-32 sm:pt-40 pb-24 px-4 sm:px-6 relative min-h-screen flex flex-col justify-center">
                {/* Animated Glow Orbs with parallax */}
                <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[180px] pointer-events-none animate-glow" style={{ transform: `translate(${mouse.x * 2}px, ${mouse.y * 2}px)` }} />
                <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none animate-glow" style={{ transform: `translate(${mouse.x * -1.5}px, ${mouse.y * -1.5}px)`, animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" style={{ transform: `translate(${mouse.x * -1}px, ${mouse.y * -1}px)` }} />

                {/* Floating particles */}
                {[...Array(8)].map((_, i) => (
                    <div key={i} className={`absolute rounded-full bg-purple-400/10 pointer-events-none ${i % 2 === 0 ? 'animate-float' : 'animate-float-delayed'}`}
                        style={{ width: `${8 + i * 5}px`, height: `${8 + i * 5}px`, top: `${10 + i * 10}%`, left: `${5 + i * 12}%`, animationDelay: `${i * 0.7}s` }} />
                ))}

                {/* Orbit element */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] pointer-events-none hidden lg:block">
                    <div className="animate-orbit">
                        <div className="w-3 h-3 bg-purple-400/30 rounded-full blur-sm" />
                    </div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {/* Badge */}
                    <div className={`inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-5 py-2 text-xs text-gray-400 mb-8 transition-all duration-1000 hover:border-purple-500/30 hover:bg-purple-500/5 cursor-default ${heroSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <Sparkles size={12} className="text-purple-400 animate-pulse" />
                        <span className="animate-shimmer bg-clip-text">Plataforma #1 de IA para ventas en Latinoamerica</span>
                    </div>

                    {/* Title */}
                    <h1 className={`text-4xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6 leading-[1.05] transition-all duration-1000 delay-200 ${heroSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                        style={{ transform: `translate(${mouse.x * 0.5}px, ${mouse.y * 0.5}px)` }}>
                        Tu vendedor IA{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 animate-text-glow">
                            que nunca duerme
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className={`text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-1000 delay-400 ${heroSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        Conecta WhatsApp, Instagram y Facebook. Deja que la IA responda, venda y cierre por vos. <span className="text-white font-semibold">24/7.</span>
                    </p>

                    {/* CTAs */}
                    <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${heroSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <Link to="/register" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-10 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all duration-500 shadow-[0_8px_32px_rgba(124,58,237,0.4)] hover:shadow-[0_12px_48px_rgba(124,58,237,0.6)] hover:scale-105 active:scale-95">
                            Empezar Gratis <ArrowRight size={16} />
                        </Link>
                        <Link to="/pricing" className="w-full sm:w-auto bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-white font-bold px-10 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all duration-500 hover:scale-105 active:scale-95 group">
                            <Play size={14} className="group-hover:text-purple-400 transition-colors" /> Ver Demo
                        </Link>
                    </div>
                    <p className="text-xs text-gray-600 mt-5 tracking-wide">10 dias gratis — Sin tarjeta de credito — Cancela cuando quieras</p>
                </div>

                {/* Floating Feature Cards with parallax */}
                <div className="max-w-4xl mx-auto mt-20 relative">
                    <div className="grid grid-cols-3 gap-4 sm:gap-6">
                        {[
                            { icon: <Bot size={24} />, title: 'Agente IA 24/7', sub: 'Responde y vende solo', color: 'text-purple-400', delay: 0 },
                            { icon: <MessageSquare size={24} />, title: 'Multi-canal', sub: 'WA + IG + FB en uno', color: 'text-blue-400', delay: 1 },
                            { icon: <BarChart3 size={24} />, title: 'Analytics Real-time', sub: 'Metricas en vivo', color: 'text-cyan-400', delay: 2 },
                        ].map((card, i) => (
                            <div key={i}
                                className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 text-center hover-lift animate-border-glow cursor-default ${i % 2 === 0 ? 'animate-float' : 'animate-float-delayed'}`}
                                style={{ transform: `translate(${mouse.x * (i - 1) * 0.8}px, ${mouse.y * (i - 1) * 0.4}px)`, animationDelay: `${card.delay}s` }}>
                                <div className={`${card.color} mx-auto mb-2 transition-all duration-500 hover:scale-125 hover:drop-shadow-[0_0_15px_currentColor]`}>{card.icon}</div>
                                <div className="text-sm font-bold">{card.title}</div>
                                <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Stats / Social Proof ─── */}
            <section ref={statsSection.ref} className="py-20 px-4 sm:px-6 border-y border-white/[0.06] relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/5 via-transparent to-blue-900/5 pointer-events-none" />
                <div className={`max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 transition-all duration-1000 ${statsSection.inView ? 'opacity-100' : 'opacity-0'}`}>
                    <StatCounter value={500} suffix="+" label="Tiendas activas" />
                    <StatCounter value={1000000} suffix="+" label="Mensajes procesados" />
                    <StatCounter value={99} suffix=".9%" label="Uptime garantizado" />
                    <StatCounter value={2} suffix="M+" label="En ventas asistidas" />
                </div>
            </section>

            {/* ─── Features Grid (6) ─── */}
            <section ref={featuresSection.ref} className="py-24 px-4 sm:px-6 relative">
                <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[150px] pointer-events-none" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className={`text-3xl sm:text-5xl font-black tracking-tight mb-4 transition-all duration-1000 ${featuresSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            Todo lo que necesitas para{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">vender con IA</span>
                        </h2>
                        <p className={`text-gray-500 max-w-xl mx-auto transition-all duration-1000 delay-200 ${featuresSection.inView ? 'opacity-100' : 'opacity-0'}`}>Una plataforma completa que reemplaza 5 herramientas. Desde el primer mensaje hasta el cierre de venta.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard icon={<Bot size={24} />} title="Agente de Ventas IA" description="Responde consultas, muestra productos, cierra ventas. Sin intervencion humana." gradient="from-purple-600/15" border="border-purple-500/15" iconColor="text-purple-400" delay={0} />
                        <FeatureCard icon={<MessageSquare size={24} />} title="Multi-canal" description="WhatsApp + Instagram + Facebook en un solo lugar. Una bandeja, un agente." gradient="from-blue-600/15" border="border-blue-500/15" iconColor="text-blue-400" delay={100} />
                        <FeatureCard icon={<BarChart3 size={24} />} title="Analytics en Tiempo Real" description="Ve que vende, que falla, y que mejorar. Metricas de ROI y conversion." gradient="from-cyan-600/15" border="border-cyan-500/15" iconColor="text-cyan-400" delay={200} />
                        <FeatureCard icon={<BookOpen size={24} />} title="Base de Conocimiento" description="Subi PDFs, textos, URLs. El agente aprende al instante y responde con tu info." gradient="from-emerald-600/15" border="border-emerald-500/15" iconColor="text-emerald-400" delay={300} />
                        <FeatureCard icon={<Mic size={24} />} title="Voice Widget" description="Asistente de voz embebible en tu web. Tus clientes hablan, la IA responde." gradient="from-amber-600/15" border="border-amber-500/15" iconColor="text-amber-400" delay={400} />
                        <FeatureCard icon={<Palette size={24} />} title="Creative Studio" description="Genera fotos de producto con IA. Sin fotografo, sin estudio. Publica directo." gradient="from-pink-600/15" border="border-pink-500/15" iconColor="text-pink-400" delay={500} />
                    </div>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section className="py-24 px-4 sm:px-6 bg-white/[0.015] relative">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Activa tu vendedor IA en <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">3 pasos</span></h2>
                        <p className="text-gray-500">Sin codigo, sin conocimientos tecnicos. En menos de 10 minutos.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        <div className="hidden md:block absolute top-10 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-purple-600/50 via-blue-600/50 to-cyan-600/50" />
                        <StepCard number="01" title="Crea tu cuenta" description="Registrate gratis en 2 minutos. Sin tarjeta de credito. Acceso inmediato." color="purple" delay={0} />
                        <StepCard number="02" title="Conecta tus canales" description="Vincula WhatsApp, Instagram o Facebook con un par de clicks." color="blue" delay={200} />
                        <StepCard number="03" title="La IA vende por vos" description="Tu agente empieza a responder y cerrar ventas automaticamente." color="cyan" delay={400} />
                    </div>
                </div>
            </section>

            {/* ─── Pricing Preview ─── */}
            <section className="py-24 px-4 sm:px-6 relative">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Planes simples, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">sin sorpresas</span></h2>
                    <p className="text-gray-500 mb-14">Empieza gratis. Escala cuando tu negocio lo necesite.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                        {/* Free */}
                        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 hover-lift group">
                            <h3 className="font-bold text-lg mb-1 group-hover:text-purple-300 transition-colors">Free Trial</h3>
                            <div className="text-4xl font-black mb-2">$0</div>
                            <p className="text-xs text-gray-500 mb-6">10 dias gratis, todo incluido</p>
                            <ul className="text-sm text-gray-400 space-y-2.5 text-left mb-6">
                                {['1 agente IA', '1 canal conectado', '100 mensajes/dia', 'Analytics basico'].map(f => (
                                    <li key={f} className="flex items-center gap-2 group-hover:text-gray-300 transition-colors"><Check size={14} className="text-emerald-400 shrink-0" /> {f}</li>
                                ))}
                            </ul>
                            <Link to="/register" className="block w-full bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold py-3 rounded-xl text-center transition-all duration-300 text-sm border border-white/[0.06] hover:border-white/20">
                                Probar Gratis
                            </Link>
                        </div>
                        {/* Pro */}
                        <div className="bg-gradient-to-b from-purple-900/30 to-transparent backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 sm:p-8 relative hover-lift group scale-[1.02]">
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] font-bold px-5 py-1.5 rounded-full shadow-lg shadow-purple-900/50">MAS POPULAR</div>
                            <h3 className="font-bold text-lg mb-1 group-hover:text-purple-300 transition-colors">Pro</h3>
                            <div className="text-4xl font-black mb-2">$49<span className="text-sm text-gray-500 font-normal">/mes</span></div>
                            <p className="text-xs text-gray-500 mb-6">Para negocios en crecimiento</p>
                            <ul className="text-sm text-gray-400 space-y-2.5 text-left mb-6">
                                {['Agentes ilimitados', 'Todos los canales', 'Mensajes ilimitados', 'Creative Studio', 'Knowledge Base'].map(f => (
                                    <li key={f} className="flex items-center gap-2 group-hover:text-gray-300 transition-colors"><Check size={14} className="text-emerald-400 shrink-0" /> {f}</li>
                                ))}
                            </ul>
                            <Link to="/register" className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl text-center transition-all duration-300 shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 text-sm">
                                Empezar con Pro
                            </Link>
                        </div>
                        {/* Enterprise */}
                        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 sm:p-8 hover-lift group">
                            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-300 transition-colors">Enterprise</h3>
                            <div className="text-4xl font-black mb-2">$199<span className="text-sm text-gray-500 font-normal">/mes</span></div>
                            <p className="text-xs text-gray-500 mb-6">Para equipos y agencias</p>
                            <ul className="text-sm text-gray-400 space-y-2.5 text-left mb-6">
                                {['Todo de Pro', 'Multi-tienda', 'API acceso', 'Soporte prioritario', 'Voice Widget'].map(f => (
                                    <li key={f} className="flex items-center gap-2 group-hover:text-gray-300 transition-colors"><Check size={14} className="text-emerald-400 shrink-0" /> {f}</li>
                                ))}
                            </ul>
                            <Link to="/enterprise" className="block w-full bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold py-3 rounded-xl text-center transition-all duration-300 text-sm border border-white/[0.06] hover:border-white/20">
                                Contactar Ventas
                            </Link>
                        </div>
                    </div>
                    <Link to="/pricing" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold transition-all duration-300 group hover:drop-shadow-[0_0_12px_rgba(124,58,237,0.4)]">
                        Ver comparacion completa <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </section>

            {/* ─── Testimonials ─── */}
            <section className="py-24 px-4 sm:px-6 bg-white/[0.015] relative overflow-hidden">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Lo que dicen nuestros clientes</h2>
                        <p className="text-gray-500">Negocios reales, resultados reales.</p>
                    </div>
                    <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <TestimonialCard name="Lucia Fernandez" role="Duena de tienda online" text="Desde que active el agente IA, mis ventas por WhatsApp subieron un 40%. Responde mejor que mis empleados y nunca se cansa." rating={5} />
                        <TestimonialCard name="Martin Gonzalez" role="CEO, AgenciaMKT" text="Manejo 15 cuentas de clientes desde una sola plataforma. El ROI analytics me muestra exactamente cuanto genera cada agente." rating={5} />
                        <TestimonialCard name="Camila Rodriguez" role="E-commerce Manager" text="El Creative Studio es increible. Genero fotos de productos en minutos, sin fotografo. Mis publicaciones en Instagram se ven profesionales." rating={5} />
                        <TestimonialCard name="Diego Martinez" role="Founder, TechStore" text="Conecte WhatsApp e Instagram en 10 minutos. La IA ya respondio 50,000 mensajes por mi. No vuelvo atras." rating={5} />
                    </div>
                </div>
            </section>

            {/* ─── FAQ ─── */}
            <section className="py-24 px-4 sm:px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Preguntas frecuentes</h2>
                    </div>
                    <div className="space-y-3">
                        <FAQItem q="¿Necesito conocimientos tecnicos?" a="No. La plataforma esta diseñada para que cualquier persona pueda configurar su agente IA en minutos. Sin codigo, sin complicaciones. Te guiamos paso a paso." />
                        <FAQItem q="¿Que pasa despues de los 10 dias gratis?" a="Podes elegir un plan pago o tu cuenta se pausa. No cobramos nada automaticamente. Sin letra chica." />
                        <FAQItem q="¿Puedo conectar WhatsApp Business?" a="Si. Nos conectamos a la API oficial de WhatsApp Business via Meta. Tu numero queda verificado y profesional." />
                        <FAQItem q="¿El agente IA puede equivocarse?" a="El agente responde basado en tu base de conocimiento. Cuanto mejor sea tu informacion, mejores sus respuestas. Ademas, podes revisar y ajustar en tiempo real." />
                        <FAQItem q="¿Puedo usar la plataforma en español?" a="Si. La plataforma y el agente IA estan optimizados para español latinoamericano. Tambien soporta ingles y portugues." />
                        <FAQItem q="¿Hay limite de mensajes?" a="En Free Trial, 100 mensajes por dia. En Pro y Enterprise, mensajes ilimitados." />
                    </div>
                </div>
            </section>

            {/* ─── Final CTA ─── */}
            <section ref={ctaSection.ref} className="py-32 px-4 sm:px-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-blue-900/10 to-transparent pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[200px] pointer-events-none animate-glow" />
                <div className={`max-w-3xl mx-auto text-center relative z-10 transition-all duration-1000 ${ctaSection.inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <h2 className="text-3xl sm:text-6xl font-black tracking-tight mb-6">
                        Empeza a vender con IA{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 animate-text-glow">hoy mismo</span>
                    </h2>
                    <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
                        Unite a las 500+ tiendas que ya automatizaron sus ventas. Gratis por 10 dias, sin tarjeta.
                    </p>
                    <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-12 py-5 rounded-xl text-lg transition-all duration-500 shadow-[0_8px_40px_rgba(124,58,237,0.4)] hover:shadow-[0_16px_60px_rgba(124,58,237,0.6)] hover:scale-105 active:scale-95">
                        Crear mi cuenta gratis <ArrowRight size={20} />
                    </Link>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="border-t border-white/[0.06] py-14 bg-black/30 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-4 group cursor-pointer">
                                <div className="w-7 h-7 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(124,58,237,0.4)]">
                                    <Zap size={13} className="text-white fill-current" />
                                </div>
                                <span className="font-bold group-hover:text-purple-300 transition-colors">Future</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">Plataforma de IA para automatizar ventas y atencion al cliente.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-gray-400">Producto</h4>
                            <div className="space-y-2 text-sm">
                                {[{ to: '/pricing', label: 'Precios' }, { to: '/docs', label: 'Documentacion' }, { to: '/enterprise', label: 'Enterprise' }].map(l => (
                                    <Link key={l.to} to={l.to} className="block text-gray-600 hover:text-white transition-all duration-300 hover:translate-x-1">{l.label}</Link>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-gray-400">Legal</h4>
                            <div className="space-y-2 text-sm">
                                {[{ to: '/terms-of-service', label: 'Terminos' }, { to: '/privacy-policy', label: 'Privacidad' }, { to: '/meta-connection', label: 'Conexion Meta' }].map(l => (
                                    <Link key={l.to} to={l.to} className="block text-gray-600 hover:text-white transition-all duration-300 hover:translate-x-1">{l.label}</Link>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-gray-400">Cuenta</h4>
                            <div className="space-y-2 text-sm">
                                {[{ to: '/login', label: 'Iniciar sesion' }, { to: '/register', label: 'Crear cuenta' }].map(l => (
                                    <Link key={l.to} to={l.to} className="block text-gray-600 hover:text-white transition-all duration-300 hover:translate-x-1">{l.label}</Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-white/[0.06] pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <span className="text-xs text-gray-700">&copy; 2026 Future Platform. Todos los derechos reservados.</span>
                        <div className="flex gap-4">
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-white transition-all duration-300 hover:scale-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"><Instagram size={16} /></a>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-white transition-all duration-300 hover:scale-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"><Facebook size={16} /></a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
