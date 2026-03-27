import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, ArrowRight, Search, Rocket, Bot, MessageSquare, ShoppingBag, BarChart3,
    BookOpen, Mic, Palette, CreditCard, HelpCircle, ChevronRight, Settings,
    Upload, FileText, Globe, Instagram, Facebook, Phone, CheckCircle
} from 'lucide-react';

type Section = {
    id: string;
    title: string;
    icon: React.ReactNode;
};

const sections: Section[] = [
    { id: 'getting-started', title: 'Getting Started', icon: <Rocket size={16} /> },
    { id: 'agent-config', title: 'Agente IA', icon: <Bot size={16} /> },
    { id: 'channels', title: 'Canales', icon: <MessageSquare size={16} /> },
    { id: 'products', title: 'Productos', icon: <ShoppingBag size={16} /> },
    { id: 'analytics', title: 'Analytics', icon: <BarChart3 size={16} /> },
    { id: 'knowledge', title: 'Knowledge Base', icon: <BookOpen size={16} /> },
    { id: 'voice', title: 'Voice Widget', icon: <Mic size={16} /> },
    { id: 'creative', title: 'Creative Studio', icon: <Palette size={16} /> },
    { id: 'billing', title: 'Billing', icon: <CreditCard size={16} /> },
    { id: 'faq', title: 'FAQ', icon: <HelpCircle size={16} /> },
];

const DocSection = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <section id={id} className="scroll-mt-24 mb-16">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-6 pb-3 border-b border-white/10">{title}</h2>
        {children}
    </section>
);

const Step = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
    <div className="flex gap-4 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold">{n}</div>
        <div>
            <h4 className="font-bold text-white">{title}</h4>
            <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
        </div>
    </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-300 leading-relaxed my-4">
        <span className="font-bold">Tip:</span> {children}
    </div>
);

export const Documentation: React.FC = () => {
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState('getting-started');
    const [mobileNav, setMobileNav] = useState(false);

    const filteredSections = sections.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase())
    );

    const scrollTo = (id: string) => {
        setActiveSection(id);
        setMobileNav(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <Link to="/landing" className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                            <Zap size={16} className="text-white fill-current" />
                        </div>
                        <span className="text-lg sm:text-xl font-bold tracking-tight">Future</span>
                        <span className="text-xs text-gray-500 ml-1 hidden sm:inline">/ Docs</span>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Link to="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                        <Link to="/register" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                            Empezar Gratis
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="pt-20 sm:pt-24 flex max-w-7xl mx-auto px-4 sm:px-6">
                {/* Sidebar */}
                <aside className="hidden lg:block w-64 shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pr-6 pb-10">
                    <div className="relative mb-4">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>
                    <nav className="space-y-1">
                        {filteredSections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => scrollTo(s.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                                    activeSection === s.id
                                        ? 'bg-purple-600/20 text-purple-400 font-medium'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {s.icon}
                                {s.title}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Mobile nav toggle */}
                <button
                    onClick={() => setMobileNav(!mobileNav)}
                    className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-900/50"
                >
                    <BookOpen size={20} />
                </button>

                {/* Mobile sidebar overlay */}
                {mobileNav && (
                    <div className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={() => setMobileNav(false)}>
                        <div className="w-72 h-full bg-[#09090b] border-r border-white/10 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="relative mb-4">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" />
                            </div>
                            <nav className="space-y-1">
                                {filteredSections.map(s => (
                                    <button key={s.id} onClick={() => scrollTo(s.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                                            activeSection === s.id ? 'bg-purple-600/20 text-purple-400 font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}>
                                        {s.icon} {s.title}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                )}

                {/* Content */}
                <main className="flex-1 min-w-0 pb-20 lg:pl-4">
                    {/* Hero */}
                    <div className="mb-12">
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Documentacion</span>
                        </h1>
                        <p className="text-gray-400 text-lg">Todo lo que necesitas para dominar Future Platform.</p>
                    </div>

                    {/* Getting Started */}
                    <DocSection id="getting-started" title="Getting Started">
                        <p className="text-gray-400 mb-6 leading-relaxed">Configura tu tienda con IA en 5 pasos simples. No necesitas conocimientos tecnicos.</p>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <Step n={1} title="Crea tu cuenta" desc="Registrate en futureplatform.ai/register. Solo necesitas email, nombre de tienda y contrasena. Gratis por 10 dias." />
                            <Step n={2} title="Verifica tu email" desc="Revisa tu bandeja de entrada y haz click en el enlace de verificacion. Si no llega, revisa spam o reenvia desde login." />
                            <Step n={3} title="Completa el Onboarding Wizard" desc="El wizard te guia para configurar tu agente: nombre, personalidad, reglas de respuesta y catalogo de productos." />
                            <Step n={4} title="Conecta tus canales" desc="Desde Configuracion > Canales, conecta WhatsApp Business, Instagram o Facebook. Sigue las instrucciones paso a paso." />
                            <Step n={5} title="Activa tu agente" desc="Una vez configurado, activa tu agente desde el Dashboard. Empieza a recibir y responder mensajes automaticamente." />
                        </div>
                        <Tip>Podes completar el setup basico en menos de 10 minutos. El Wizard te guia en cada paso.</Tip>
                    </DocSection>

                    {/* Agent Config */}
                    <DocSection id="agent-config" title="Configuracion del Agente IA">
                        <p className="text-gray-400 mb-6 leading-relaxed">Tu agente IA es el corazon de Future Platform. Configuralo para que responda como vos lo harias.</p>
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Settings size={16} className="text-purple-400" /> Prompt del sistema</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Define la personalidad y comportamiento base del agente. Ejemplo: "Sos un vendedor amigable de una tienda de ropa. Respondes en español argentino, sugeris productos y cierras ventas."</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><FileText size={16} className="text-blue-400" /> Reglas de respuesta</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Configura reglas especificas: "Nunca des descuentos mayores a 15%", "Si preguntan por envios, responde que el envio es gratis en CABA", "Si no sabes la respuesta, deriva a un humano."</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><BookOpen size={16} className="text-cyan-400" /> Diccionario</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Agrega terminos y jerga especifica de tu negocio. El agente usara estos terminos naturalmente en las conversaciones.</p>
                            </div>
                        </div>
                    </DocSection>

                    {/* Channels */}
                    <DocSection id="channels" title="Canales">
                        <p className="text-gray-400 mb-6 leading-relaxed">Conecta todos tus canales de comunicacion en un solo lugar.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-3">
                                    <Phone size={20} className="text-emerald-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">WhatsApp Business</h3>
                                <p className="text-xs text-gray-400 leading-relaxed mb-3">Conecta via Meta Business Suite. Necesitas una cuenta de WhatsApp Business verificada.</p>
                                <Link to="/meta-connection" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">Ver guia <ChevronRight size={12} /></Link>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <div className="w-10 h-10 bg-pink-600/20 rounded-lg flex items-center justify-center mb-3">
                                    <Instagram size={20} className="text-pink-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">Instagram DMs</h3>
                                <p className="text-xs text-gray-400 leading-relaxed mb-3">Conecta tu cuenta de Instagram Business. El agente responde mensajes directos automaticamente.</p>
                                <Link to="/meta-connection" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">Ver guia <ChevronRight size={12} /></Link>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-3">
                                    <Facebook size={20} className="text-blue-400" />
                                </div>
                                <h3 className="font-bold text-white mb-2">Facebook Messenger</h3>
                                <p className="text-xs text-gray-400 leading-relaxed mb-3">Conecta tu pagina de Facebook. Atencion automatica 24/7 para clientes que escriben por Messenger.</p>
                                <Link to="/meta-connection" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">Ver guia <ChevronRight size={12} /></Link>
                            </div>
                        </div>
                    </DocSection>

                    {/* Products */}
                    <DocSection id="products" title="Productos">
                        <p className="text-gray-400 mb-6 leading-relaxed">Gestiona tu catalogo de productos para que el agente pueda mostrarlos a tus clientes.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div>
                                <h3 className="font-bold text-white mb-1">Catalogo interno</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Carga productos manualmente con nombre, descripcion, precio e imagen. Ideal para negocios sin e-commerce.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Integracion con Tienda Nube</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Sincroniza tu catalogo automaticamente desde Tienda Nube. Precios, stock e imagenes se actualizan en tiempo real.</p>
                            </div>
                        </div>
                        <Tip>El agente puede mostrar productos con imagen, precio y link de compra directamente en WhatsApp.</Tip>
                    </DocSection>

                    {/* Analytics */}
                    <DocSection id="analytics" title="Analytics">
                        <p className="text-gray-400 mb-6 leading-relaxed">Metricas en tiempo real para entender el rendimiento de tu agente y tus ventas.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { title: 'Mensajes procesados', desc: 'Total de mensajes enviados y recibidos por canal y periodo.' },
                                { title: 'Tasa de respuesta', desc: 'Porcentaje de mensajes respondidos automaticamente vs derivados a humanos.' },
                                { title: 'Tiempo de respuesta', desc: 'Tiempo promedio entre el mensaje del cliente y la respuesta del agente.' },
                                { title: 'ROI Analytics', desc: 'Estimacion de ventas generadas por el agente. Ingresos asistidos por IA.' },
                                { title: 'Assist Score', desc: 'Calificacion de calidad de las respuestas del agente basada en feedback.' },
                                { title: 'Conversion funnel', desc: 'Flujo desde primer mensaje hasta venta cerrada. Identifica donde se pierden ventas.' },
                            ].map((item, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h4 className="font-bold text-white text-sm mb-1">{item.title}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </DocSection>

                    {/* Knowledge Base */}
                    <DocSection id="knowledge" title="Knowledge Base">
                        <p className="text-gray-400 mb-6 leading-relaxed">Subi informacion para que tu agente responda con datos reales de tu negocio.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="font-bold text-white mb-4">Formatos soportados</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {['PDF', 'TXT', 'DOCX', 'URLs'].map(f => (
                                    <div key={f} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                        <Upload size={16} className="text-purple-400 mx-auto mb-1" />
                                        <span className="text-sm font-bold text-white">{f}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-gray-400 mt-4 leading-relaxed">
                                Subi documentos con informacion de tu negocio: catalogo, FAQs, politicas de envio, precios, etc.
                                El agente procesa el contenido y lo usa para responder consultas de manera precisa.
                            </p>
                        </div>
                        <Tip>Cuanta mas informacion subas, mejores seran las respuestas del agente. Empieza con tu FAQ y politica de envios.</Tip>
                    </DocSection>

                    {/* Voice Widget */}
                    <DocSection id="voice" title="Voice Widget">
                        <p className="text-gray-400 mb-6 leading-relaxed">Agrega un asistente de voz a tu sitio web. Tus clientes hablan y la IA responde.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div>
                                <h3 className="font-bold text-white mb-1">Configuracion</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Desde el dashboard, configura el Voice Widget: color, posicion, idioma y personalidad del asistente de voz.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Embeber en tu web</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Copia el codigo de embed (un script de una linea) y pegalo en tu sitio web. Compatible con cualquier plataforma.</p>
                            </div>
                        </div>
                    </DocSection>

                    {/* Creative Studio */}
                    <DocSection id="creative" title="Creative Studio">
                        <p className="text-gray-400 mb-6 leading-relaxed">Genera imagenes de producto y assets visuales con IA. Sin fotografo, sin estudio.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div>
                                <h3 className="font-bold text-white mb-1">Generacion de fotos de producto</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Subi una foto de tu producto y genera variaciones con distintos fondos, estilos y composiciones. Ideal para redes sociales.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Templates y assets</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Accede a templates prediseñados para posts, stories e historias. Personaliza con tu marca y productos.</p>
                            </div>
                        </div>
                    </DocSection>

                    {/* Billing */}
                    <DocSection id="billing" title="Billing">
                        <p className="text-gray-400 mb-6 leading-relaxed">Informacion sobre planes, pagos y facturacion.</p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div>
                                <h3 className="font-bold text-white mb-2">Planes disponibles</h3>
                                <div className="space-y-2 text-sm text-gray-400">
                                    <p><span className="text-white font-medium">Free Trial:</span> 10 dias gratis con todas las funciones. Sin tarjeta de credito.</p>
                                    <p><span className="text-white font-medium">Pro ($49/mes):</span> Agentes ilimitados, todos los canales, mensajes ilimitados, Knowledge Base, Creative Studio.</p>
                                    <p><span className="text-white font-medium">Enterprise ($199/mes):</span> Todo de Pro + multi-tienda, API acceso, soporte prioritario, Voice Widget.</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-2">Metodos de pago</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Aceptamos tarjetas de credito/debito (Visa, Mastercard, AMEX) y transferencias bancarias para planes Enterprise.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-2">Cancelacion</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">Podes cancelar en cualquier momento desde tu dashboard. Sin penalidades. Tu cuenta se mantiene activa hasta el final del periodo pagado.</p>
                            </div>
                        </div>
                    </DocSection>

                    {/* FAQ */}
                    <DocSection id="faq" title="FAQ">
                        <div className="space-y-4">
                            {[
                                { q: '¿Puedo cambiar de plan en cualquier momento?', a: 'Si. Podes subir o bajar de plan desde Billing en tu dashboard. El cambio se aplica inmediatamente.' },
                                { q: '¿Que pasa si supero el limite de mensajes en Free Trial?', a: 'El agente deja de responder automaticamente hasta el dia siguiente. No se cobra nada extra.' },
                                { q: '¿Puedo tener multiples agentes?', a: 'En Pro y Enterprise si, ilimitados. En Free Trial, 1 agente.' },
                                { q: '¿Como contacto soporte?', a: 'Desde el dashboard, seccion de soporte. O escribinos a support@futureplatform.ai. Respondemos en menos de 24hs.' },
                                { q: '¿La plataforma funciona en celular?', a: 'Si. El dashboard es responsive y funciona en celular. Tus clientes interactuan normalmente desde sus apps de mensajeria.' },
                                { q: '¿Puedo exportar mis datos?', a: 'Si. Desde Configuracion > Datos, podes exportar conversaciones, analytics y configuraciones en formato CSV/JSON.' },
                            ].map((item, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
                                    <h4 className="font-bold text-white text-sm mb-2">{item.q}</h4>
                                    <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </DocSection>

                    {/* CTA */}
                    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 sm:p-8 text-center">
                        <h2 className="text-xl font-black text-white mb-2">¿Listo para empezar?</h2>
                        <p className="text-gray-400 text-sm mb-4">Crea tu cuenta gratis y activa tu agente IA en minutos.</p>
                        <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-900/30">
                            Empezar Gratis <ArrowRight size={16} />
                        </Link>
                    </div>
                </main>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 bg-black/50 mt-10">
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
                        <Link to="/meta-connection" className="text-gray-500 hover:text-white transition-colors">Meta</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Documentation;
