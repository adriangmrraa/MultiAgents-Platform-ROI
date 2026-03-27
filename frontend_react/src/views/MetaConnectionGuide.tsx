import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, ArrowRight, Shield, Lock, Eye, EyeOff, Server, Globe, ChevronDown, ChevronUp,
    CheckCircle, Database, Key, FileText, Users, AlertTriangle, MessageSquare, Instagram, Facebook
} from 'lucide-react';

const FAQItem = ({ q, a }: { q: string; a: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors">
                <span className="font-semibold text-white text-sm sm:text-base">{q}</span>
                {open ? <ChevronUp size={18} className="text-gray-500 shrink-0 ml-4" /> : <ChevronDown size={18} className="text-gray-500 shrink-0 ml-4" />}
            </button>
            {open && <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">{a}</div>}
        </div>
    );
};

export const MetaConnectionGuide: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30">
            <style>{`
                @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
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
                        <Link to="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                        <Link to="/register" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-lg shadow-purple-900/30">
                            Empezar Gratis
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-28 sm:pt-36 pb-16 px-4 sm:px-6 relative">
                <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none animate-glow" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 mb-6">
                        <Shield size={12} /> Meta Platform Integration
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-6 leading-[1.1]">
                        Como Future Platform se conecta con{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Meta</span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Informacion completa sobre nuestra integracion con WhatsApp Business, Instagram y Facebook.
                        Transparencia total sobre que datos accedemos, como los usamos y como los protegemos.
                    </p>
                </div>
            </section>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">

                {/* How it works */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                            <Globe size={20} className="text-purple-400" />
                        </div>
                        Como funciona la conexion
                    </h2>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-sm font-bold text-purple-400">1</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white mb-1">Autorizacion OAuth 2.0</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        El usuario inicia sesion con su cuenta de Facebook/Instagram y autoriza a Future Platform
                                        a acceder a su cuenta de negocio. Usamos el flujo estandar OAuth 2.0 de Meta.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-sm font-bold text-blue-400">2</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white mb-1">Permisos solicitados</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Solicitamos permisos minimos necesarios: mensajeria de pagina, lectura de mensajes de Instagram,
                                        y acceso a WhatsApp Business API. No solicitamos acceso a datos personales del perfil del usuario.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 bg-cyan-600/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-sm font-bold text-cyan-400">3</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white mb-1">Configuracion de Webhooks</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Una vez autorizado, configuramos webhooks seguros para recibir mensajes entrantes en tiempo real.
                                        Los webhooks son verificados con tokens de seguridad unicos por tenant.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-sm font-bold text-emerald-400">4</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white mb-1">Procesamiento con IA</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Los mensajes recibidos son procesados por el agente IA del usuario para generar respuestas
                                        contextuales basadas en la base de conocimiento configurada por el negocio.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Data Access */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                            <Database size={20} className="text-blue-400" />
                        </div>
                        Que datos accedemos y para que
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <MessageSquare size={20} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white mb-2">Mensajes entrantes</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Leemos mensajes que los clientes envian al negocio para que el agente IA pueda responder.
                                Solo mensajes de la pagina/cuenta de negocio, no personales.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <Users size={20} className="text-blue-400 mb-3" />
                            <h3 className="font-bold text-white mb-2">Informacion de pagina</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Accedemos al nombre e ID de la pagina de Facebook/Instagram del negocio
                                para configurar correctamente la integracion.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <Key size={20} className="text-purple-400 mb-3" />
                            <h3 className="font-bold text-white mb-2">Tokens de acceso</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Almacenamos tokens de acceso encriptados para mantener la conexion activa.
                                Los tokens se renuevan automaticamente segun las politicas de Meta.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <FileText size={20} className="text-amber-400 mb-3" />
                            <h3 className="font-bold text-white mb-2">Informacion de WhatsApp Business</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Numero de telefono de WhatsApp Business, templates de mensajes aprobados,
                                y estado de la cuenta para gestionar la comunicacion.
                            </p>
                        </div>
                    </div>
                </section>

                {/* What we DON'T do */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600/20 border border-red-500/30 rounded-xl flex items-center justify-center">
                            <EyeOff size={20} className="text-red-400" />
                        </div>
                        Que NO hacemos con los datos
                    </h2>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
                        <div className="space-y-4">
                            {[
                                'No vendemos datos de usuarios a terceros, nunca.',
                                'No usamos datos de mensajes para publicidad o targeting de ads.',
                                'No compartimos informacion entre diferentes cuentas/tenants.',
                                'No almacenamos datos personales de los clientes finales mas alla de lo necesario para la conversacion.',
                                'No accedemos a mensajes personales del dueño del negocio.',
                                'No usamos los datos para entrenar modelos de IA propios.',
                                'No retenemos datos despues de que el usuario elimina su cuenta.'
                            ].map((text, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <span className="text-sm text-gray-300">{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Security */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                            <Lock size={20} className="text-emerald-400" />
                        </div>
                        Seguridad y encriptacion
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <CheckCircle size={18} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white text-sm mb-2">Encriptacion en transito (TLS 1.3)</h3>
                            <p className="text-xs text-gray-400">Todas las comunicaciones entre Future Platform, Meta y los usuarios estan encriptadas con TLS 1.3.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <CheckCircle size={18} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white text-sm mb-2">Encriptacion en reposo (AES-256)</h3>
                            <p className="text-xs text-gray-400">Tokens de acceso y datos sensibles se almacenan encriptados con AES-256 en nuestra base de datos.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <CheckCircle size={18} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white text-sm mb-2">Aislamiento por tenant</h3>
                            <p className="text-xs text-gray-400">Cada negocio opera en un espacio aislado. Los datos de un tenant nunca se mezclan con los de otro.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <CheckCircle size={18} className="text-emerald-400 mb-3" />
                            <h3 className="font-bold text-white text-sm mb-2">Verificacion de webhooks</h3>
                            <p className="text-xs text-gray-400">Cada webhook entrante se verifica con la firma de Meta para prevenir solicitudes falsificadas.</p>
                        </div>
                    </div>
                </section>

                {/* Compliance */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                            <Shield size={20} className="text-purple-400" />
                        </div>
                        Compliance
                    </h2>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div>
                            <h3 className="font-bold text-white mb-2">GDPR (General Data Protection Regulation)</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Cumplimos con los requisitos del GDPR para usuarios europeos. Los usuarios pueden solicitar
                                exportacion y eliminacion de sus datos en cualquier momento.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-2">Ley de Proteccion de Datos Personales (Argentina - Ley 25.326)</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Cumplimos con la legislacion argentina de proteccion de datos personales.
                                Los datos se procesan con consentimiento explicito y para el fin declarado.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-white mb-2">Meta Platform Terms</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Nuestra integracion cumple con los terminos de plataforma de Meta,
                                incluyendo las politicas de uso de datos de WhatsApp Business API.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Channels */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6">Canales soportados</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                                <MessageSquare size={24} className="text-emerald-400" />
                            </div>
                            <h3 className="font-bold text-white mb-1">WhatsApp Business</h3>
                            <p className="text-xs text-gray-400">Via Cloud API oficial de Meta. Numero verificado, templates, multimedia.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 bg-pink-600/20 rounded-xl flex items-center justify-center">
                                <Instagram size={24} className="text-pink-400" />
                            </div>
                            <h3 className="font-bold text-white mb-1">Instagram DMs</h3>
                            <p className="text-xs text-gray-400">Mensajes directos de Instagram Business. Respuestas automaticas con IA.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                <Facebook size={24} className="text-blue-400" />
                            </div>
                            <h3 className="font-bold text-white mb-1">Facebook Messenger</h3>
                            <p className="text-xs text-gray-400">Mensajes de pagina de Facebook. Atencion automatica 24/7.</p>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mb-16">
                    <h2 className="text-2xl font-black mb-6">Preguntas frecuentes</h2>
                    <div className="space-y-3">
                        <FAQItem q="¿Que pasa si revoco el acceso desde Facebook?" a="Si revocas el acceso, Future Platform dejara de recibir mensajes de ese canal inmediatamente. Tus datos almacenados se mantienen hasta que elimines tu cuenta o solicites su eliminacion." />
                        <FAQItem q="¿Puedo ver que datos tiene Future Platform sobre mi negocio?" a="Si. Desde la seccion de Configuracion en el dashboard, puedes ver todos los canales conectados, tokens activos y datos almacenados. Tambien puedes solicitar una exportacion completa." />
                        <FAQItem q="¿Como elimino mis datos?" a="Puedes eliminar tu cuenta desde el dashboard. Esto eliminara todos tus datos, incluyendo conversaciones, configuraciones y tokens de acceso, en un plazo de 30 dias." />
                        <FAQItem q="¿Future Platform almacena mensajes de mis clientes?" a="Almacenamos mensajes temporalmente para que el agente IA pueda mantener contexto en las conversaciones. Los mensajes se purgan automaticamente segun la retencion configurada por el usuario." />
                        <FAQItem q="¿Necesito un numero de WhatsApp Business?" a="Si. Para usar la integracion de WhatsApp, necesitas una cuenta de WhatsApp Business verificada a traves de Meta Business Suite." />
                    </div>
                </section>

                {/* Contact */}
                <section>
                    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 sm:p-8 text-center">
                        <h2 className="text-xl font-black text-white mb-2">¿Tenes mas preguntas?</h2>
                        <p className="text-gray-400 text-sm mb-4">Contactanos para cualquier consulta sobre nuestra integracion con Meta.</p>
                        <a href="mailto:support@futureplatform.ai" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-900/30">
                            Contactar soporte <ArrowRight size={16} />
                        </a>
                    </div>
                </section>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 bg-black/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-md flex items-center justify-center">
                            <Zap size={12} className="text-white fill-current" />
                        </div>
                        <span className="text-xs text-gray-500">&copy; 2026 Future Platform. Todos los derechos reservados.</span>
                    </div>
                    <div className="flex gap-6 text-sm font-medium">
                        <Link to="/terms-of-service" className="text-gray-500 hover:text-white transition-colors text-xs">Terminos</Link>
                        <Link to="/privacy-policy" className="text-gray-500 hover:text-white transition-colors text-xs">Privacidad</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MetaConnectionGuide;
