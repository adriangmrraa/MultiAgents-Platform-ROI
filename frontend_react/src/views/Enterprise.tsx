import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, ArrowRight, GraduationCap, Building2, Users, BarChart3, Bot, BookOpen,
    CheckCircle, Clock, Shield, TrendingUp, Award, Target, Layers, Send
} from 'lucide-react';

export const Enterprise: React.FC = () => {
    const [formData, setFormData] = useState({ name: '', email: '', company: '', role: '', message: '' });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        // Simulate form submission
        await new Promise(r => setTimeout(r, 1000));
        setSubmitted(true);
        setSending(false);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30 overflow-x-hidden">
            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-glow { animation: glow-pulse 4s ease-in-out infinite; }
            `}</style>

            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <Link to="/landing" className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                            <Zap size={16} className="text-white fill-current" />
                        </div>
                        <span className="text-lg sm:text-xl font-bold tracking-tight">Future</span>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Link to="/landing" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">Producto</Link>
                        <Link to="/pricing" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">Precios</Link>
                        <Link to="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                        <Link to="/register" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                            Empezar Gratis
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-28 sm:pt-36 pb-20 px-4 sm:px-6 relative">
                <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none animate-glow" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-glow" />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 mb-8">
                        <Building2 size={12} className="text-purple-400" />
                        Para empresas e instituciones educativas
                    </div>
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 leading-[1.08]">
                        Programa de IA aplicada{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">
                            para tu organizacion
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                        Arma infraestructura que sirva para escalar con IA. Tus alumnos o empleados aprenden
                        usando una plataforma real de ventas con inteligencia artificial. No teoria — practica desde el dia 1.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a href="#contact" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/30 hover:scale-[1.02]">
                            Solicitar demo <ArrowRight size={16} />
                        </a>
                        <Link to="/docs" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all">
                            Ver documentacion
                        </Link>
                    </div>
                </div>
            </section>

            {/* Why Enterprise */}
            <section className="py-20 px-4 sm:px-6 bg-white/[0.02]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                            ¿Por que elegir Future Platform para tu organizacion?
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            No es un curso teorico. Es acceso a una plataforma real de IA donde cada alumno o empleado
                            configura, lanza y mide un agente de ventas en produccion.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <BenefitCard icon={<GraduationCap size={24} />} title="Curricula lista para usar" description="Programa de 8 semanas con modulos, ejercicios y proyectos reales. Adaptable a cualquier nivel." color="purple" />
                        <BenefitCard icon={<Bot size={24} />} title="Plataforma real, no simuladores" description="Cada alumno crea un agente de ventas IA que funciona en WhatsApp, Instagram y Facebook." color="blue" />
                        <BenefitCard icon={<BarChart3 size={24} />} title="Metricas de aprendizaje" description="Dashboard para instituciones con progreso de alumnos, metricas de uso y resultados." color="cyan" />
                        <BenefitCard icon={<Users size={24} />} title="Cuentas multi-usuario" description="Panel de administracion para gestionar alumnos/empleados. Alta masiva, control de permisos." color="emerald" />
                        <BenefitCard icon={<Shield size={24} />} title="Soporte dedicado" description="Equipo de soporte asignado a tu institucion. Capacitacion inicial para profesores/lideres." color="amber" />
                        <BenefitCard icon={<TrendingUp size={24} />} title="ROI medible" description="Tus alumnos generan ventas reales desde la semana 1. El ROI del programa se mide en tiempo real." color="pink" />
                    </div>
                </div>
            </section>

            {/* Use Case */}
            <section className="py-20 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Caso de uso real</h2>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                                <Target size={20} className="text-purple-400" />
                            </div>
                            <h3 className="text-xl font-black text-white">Un alumno configura un agente de ventas en 1 hora</h3>
                        </div>
                        <div className="space-y-4">
                            <TimelineStep time="0-10 min" title="Crea su cuenta y configura la tienda" desc="El alumno se registra, nombra su negocio ficticio y completa el wizard de onboarding." />
                            <TimelineStep time="10-25 min" title="Configura el agente IA" desc="Define la personalidad del agente, reglas de respuesta y sube informacion de productos." />
                            <TimelineStep time="25-40 min" title="Conecta un canal y prueba" desc="Conecta un canal de prueba y envia mensajes simulados. El agente responde automaticamente." />
                            <TimelineStep time="40-60 min" title="Analiza resultados" desc="Revisa analytics: tiempo de respuesta, calidad de respuestas, metricas de conversion." />
                        </div>
                        <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <p className="text-sm text-emerald-300 font-medium">
                                Resultado: En 1 hora, el alumno tiene un agente IA funcional que puede responder consultas de ventas, mostrar productos y cerrar ventas. Experiencia practica con IA aplicada al mundo real.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Who it's for */}
            <section className="py-20 px-4 sm:px-6 bg-white/[0.02]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">¿Para quien es?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
                            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-4">
                                <GraduationCap size={24} className="text-purple-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-3">Instituciones Educativas</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Universidades con carreras de negocios, marketing o tecnologia</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Institutos de formacion profesional</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Bootcamps y academias de tecnologia</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Programas de capacitacion corporativa</li>
                            </ul>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mb-4">
                                <Building2 size={24} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-3">Empresas</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Empresas que quieren capacitar a su equipo en IA</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Departamentos de ventas que buscan automatizar</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Agencias de marketing que manejan multiples clientes</li>
                                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> Startups que escalan con equipos pequenos</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section className="py-20 px-4 sm:px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Precios Enterprise</h2>
                    <p className="text-gray-400 mb-10">Planes flexibles adaptados a tu organizacion.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 text-left">
                            <Layers size={24} className="text-purple-400 mb-4" />
                            <h3 className="text-xl font-black text-white mb-2">Educacion</h3>
                            <p className="text-gray-400 text-sm mb-4">Para universidades e institutos</p>
                            <ul className="space-y-2 text-sm text-gray-400 mb-6">
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Hasta 100 cuentas de alumnos</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Panel de administracion</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Curricula incluida</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Soporte tecnico dedicado</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Metricas de progreso</li>
                            </ul>
                            <div className="text-3xl font-black text-white mb-1">Custom</div>
                            <p className="text-xs text-gray-500 mb-4">Precio por alumno/semestre</p>
                            <a href="#contact" className="block w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-center transition-colors text-sm">
                                Solicitar cotizacion
                            </a>
                        </div>
                        <div className="bg-gradient-to-b from-purple-900/30 to-transparent backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 sm:p-8 text-left relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] font-bold px-4 py-1 rounded-full">RECOMENDADO</div>
                            <Building2 size={24} className="text-blue-400 mb-4" />
                            <h3 className="text-xl font-black text-white mb-2">Enterprise</h3>
                            <p className="text-gray-400 text-sm mb-4">Para empresas y agencias</p>
                            <ul className="space-y-2 text-sm text-gray-400 mb-6">
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Usuarios ilimitados</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Multi-tienda / multi-marca</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> API acceso completo</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Soporte prioritario 24/7</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Capacitacion on-site</li>
                                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> SLA garantizado</li>
                            </ul>
                            <div className="text-3xl font-black text-white mb-1">Custom</div>
                            <p className="text-xs text-gray-500 mb-4">Facturacion anual o mensual</p>
                            <a href="#contact" className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl text-center transition-all shadow-lg shadow-purple-900/30 text-sm">
                                Contactar ventas
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Form */}
            <section id="contact" className="py-20 px-4 sm:px-6 bg-white/[0.02] scroll-mt-20">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Contactanos</h2>
                        <p className="text-gray-400">Completa el formulario y te contactamos en menos de 24 horas.</p>
                    </div>

                    {submitted ? (
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Mensaje enviado</h3>
                            <p className="text-gray-400 text-sm">Nuestro equipo de ventas te contactara en breve. Gracias por tu interes.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nombre</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="Tu nombre" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email</label>
                                    <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="tu@empresa.com" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Empresa / Institucion</label>
                                    <input type="text" required value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors"
                                        placeholder="Nombre de la organizacion" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Rol</label>
                                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none">
                                        <option value="" className="bg-[#09090b]">Seleccionar...</option>
                                        <option value="director" className="bg-[#09090b]">Director / Rector</option>
                                        <option value="profesor" className="bg-[#09090b]">Profesor / Instructor</option>
                                        <option value="cto" className="bg-[#09090b]">CTO / VP Engineering</option>
                                        <option value="ceo" className="bg-[#09090b]">CEO / Founder</option>
                                        <option value="hr" className="bg-[#09090b]">HR / People</option>
                                        <option value="other" className="bg-[#09090b]">Otro</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Mensaje</label>
                                <textarea rows={4} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                                    placeholder="Contanos sobre tu proyecto, cantidad de alumnos/empleados, timeline..." />
                            </div>
                            <button type="submit" disabled={sending}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50">
                                {sending ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Enviando...
                                    </span>
                                ) : (
                                    <>Enviar mensaje <Send size={16} /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 bg-black/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-md flex items-center justify-center">
                            <Zap size={12} className="text-white fill-current" />
                        </div>
                        <span className="text-xs text-gray-500">&copy; 2026 Future Platform. Todos los derechos reservados.</span>
                    </div>
                    <div className="flex gap-6 text-xs font-medium">
                        <Link to="/terms-of-service" className="text-gray-500 hover:text-white transition-colors">Terminos</Link>
                        <Link to="/privacy-policy" className="text-gray-500 hover:text-white transition-colors">Privacidad</Link>
                        <Link to="/landing" className="text-gray-500 hover:text-white transition-colors">Inicio</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

/* ─── Subcomponents ─── */

const BenefitCard = ({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) => {
    const colorMap: Record<string, string> = {
        purple: 'from-purple-600/20 border-purple-500/20 text-purple-400',
        blue: 'from-blue-600/20 border-blue-500/20 text-blue-400',
        cyan: 'from-cyan-600/20 border-cyan-500/20 text-cyan-400',
        emerald: 'from-emerald-600/20 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-600/20 border-amber-500/20 text-amber-400',
        pink: 'from-pink-600/20 border-pink-500/20 text-pink-400',
    };
    const c = colorMap[color] || colorMap.purple;
    const [grad, border, text] = c.split(' ');

    return (
        <div className={`bg-gradient-to-b ${grad} to-transparent border ${border} backdrop-blur-xl rounded-2xl p-6 hover:scale-[1.02] transition-all`}>
            <div className={`${text} mb-4`}>{icon}</div>
            <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
    );
};

const TimelineStep = ({ time, title, desc }: { time: string; title: string; desc: string }) => (
    <div className="flex gap-4">
        <div className="w-20 shrink-0 text-right">
            <span className="text-xs font-mono text-purple-400 bg-purple-600/20 px-2 py-1 rounded">{time}</span>
        </div>
        <div className="w-px bg-white/10 shrink-0" />
        <div className="pb-4">
            <h4 className="font-bold text-white text-sm">{title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default Enterprise;
