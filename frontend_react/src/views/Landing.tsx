import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, MessageSquare, Bot, BookOpen, Palette, Check } from 'lucide-react';

export const Landing: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                            <Zap size={18} className="text-white fill-current" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Future Platform</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">Precios</Link>
                        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Iniciar Sesion</Link>
                        <Link to="/register" className="bg-white text-black hover:bg-gray-200 px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
                            Comenzar Gratis <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 mb-8">
                        <Zap size={12} className="text-purple-400" />
                        Plataforma de IA para negocios
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.1]">
                        Conecta tu negocio{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
                            con IA
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Automatiza la atencion al cliente en WhatsApp, Instagram y Facebook.
                        Deja que la inteligencia artificial responda por vos, 24/7.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/register" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/30">
                            Comenzar Gratis <ArrowRight size={16} />
                        </Link>
                        <Link to="/pricing" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all">
                            Ver Precios
                        </Link>
                    </div>
                    <p className="text-xs text-gray-600 mt-4">10 dias gratis. Sin tarjeta de credito.</p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Todo lo que necesitas</h2>
                        <p className="text-gray-400 max-w-xl mx-auto">Una plataforma completa para gestionar la comunicacion de tu negocio con inteligencia artificial.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeatureCard
                            icon={<MessageSquare size={24} />}
                            title="Omnichannel"
                            description="WhatsApp, Instagram, Facebook y mas. Todos tus canales en un solo lugar."
                            color="purple"
                        />
                        <FeatureCard
                            icon={<Bot size={24} />}
                            title="Agentes IA"
                            description="Crea agentes inteligentes que entienden tu negocio y responden como vos lo harias."
                            color="blue"
                        />
                        <FeatureCard
                            icon={<BookOpen size={24} />}
                            title="Base de Conocimiento"
                            description="Subi tus documentos, productos y FAQs. La IA aprende de tu informacion."
                            color="cyan"
                        />
                        <FeatureCard
                            icon={<Palette size={24} />}
                            title="Creative Studio"
                            description="Templates, respuestas automaticas y flujos personalizados para cada situacion."
                            color="pink"
                        />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 px-6 bg-white/[0.02]">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Como funciona</h2>
                        <p className="text-gray-400">Tres pasos simples para automatizar tu negocio.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StepCard number="01" title="Registrate" description="Crea tu cuenta gratis en menos de 2 minutos. Sin tarjeta de credito." />
                        <StepCard number="02" title="Conecta canales" description="Vincula WhatsApp, Instagram o Facebook con un par de clicks." />
                        <StepCard number="03" title="La IA responde" description="Tu agente de IA empieza a responder clientes automaticamente, 24/7." />
                    </div>
                </div>
            </section>

            {/* Pricing Preview */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Planes simples y transparentes</h2>
                    <p className="text-gray-400 mb-8">Empieza gratis, escala cuando quieras.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-1">Free Trial</h3>
                            <div className="text-3xl font-black mb-2">$0</div>
                            <p className="text-xs text-gray-500">10 dias gratis</p>
                        </div>
                        <div className="bg-gradient-to-b from-purple-900/20 to-transparent border border-purple-500/30 rounded-xl p-6 relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">POPULAR</div>
                            <h3 className="font-bold text-lg mb-1">Pro</h3>
                            <div className="text-3xl font-black mb-2">$49<span className="text-sm text-gray-500 font-normal">/mes</span></div>
                            <p className="text-xs text-gray-500">Para negocios en crecimiento</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-1">Enterprise</h3>
                            <div className="text-3xl font-black mb-2">$199<span className="text-sm text-gray-500 font-normal">/mes</span></div>
                            <p className="text-xs text-gray-500">Para grandes equipos</p>
                        </div>
                    </div>
                    <Link to="/pricing" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold transition-colors">
                        Ver comparacion completa <ArrowRight size={16} />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-12 bg-black">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-md flex items-center justify-center">
                            <Zap size={12} className="text-white fill-current" />
                        </div>
                        <span className="text-sm text-gray-500">&copy; 2026 Future Platform. Todos los derechos reservados.</span>
                    </div>
                    <div className="flex gap-6 text-sm font-medium">
                        <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">Terminos</Link>
                        <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacidad</Link>
                        <Link to="/login" className="text-gray-400 hover:text-white transition-colors">Login</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) => {
    const colorMap: Record<string, string> = {
        purple: 'from-purple-600/20 to-transparent border-purple-500/20 text-purple-400',
        blue: 'from-blue-600/20 to-transparent border-blue-500/20 text-blue-400',
        cyan: 'from-cyan-600/20 to-transparent border-cyan-500/20 text-cyan-400',
        pink: 'from-pink-600/20 to-transparent border-pink-500/20 text-pink-400',
    };
    const c = colorMap[color] || colorMap.purple;
    const [grad, border, text] = [
        c.split(' ').slice(0, 2).join(' '),
        c.split(' ')[2],
        c.split(' ')[3],
    ];

    return (
        <div className={`bg-gradient-to-b ${grad} border ${border} rounded-2xl p-6 hover:scale-[1.02] transition-transform`}>
            <div className={`${text} mb-4`}>{icon}</div>
            <h3 className="font-bold text-lg mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
    );
};

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
    <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-400 font-black text-sm mb-4">
            {number}
        </div>
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
    </div>
);

export default Landing;
