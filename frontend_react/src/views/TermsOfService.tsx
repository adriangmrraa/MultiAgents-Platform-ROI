import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Check, ArrowRight, Zap } from 'lucide-react';

export const TermsOfService: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-red-500/30">
            {/* Header / Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-tr from-red-600 to-orange-600 rounded-lg flex items-center justify-center">
                            <Zap size={16} className="text-white fill-current" />
                        </div>
                        <span className="text-lg sm:text-xl font-bold tracking-tight">Future</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-6">
                        <Link to="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                        <Link to="/register" className="bg-white text-black hover:bg-gray-200 border-none px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-2">
                            Gratis <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* Legal Content Column */}
                <div className="lg:col-span-8 space-y-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
                            Condiciones del Servicio
                        </h1>
                        <p className="text-xl text-gray-400 leading-relaxed">
                            Bienvenido a Future Platform. Al utilizar nuestra plataforma de automatización inteligente, aceptas potenciar tu negocio bajo las siguientes condiciones diseñadas para proteger tu crecimiento y seguridad.
                        </p>
                    </div>

                    <div className="space-y-8 text-gray-300 font-light leading-relaxed border-l-2 border-white/5 pl-8">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">01.</span> Aceptación de Términos
                            </h3>
                            <p>
                                Al acceder y utilizar la plataforma "Future Platform" (en adelante, "el Servicio"), usted acepta estar legalmente vinculado por estos términos. Si no está de acuerdo con alguna parte, no podrá acceder al servicio. Estas condiciones aplican a todos los visitantes, usuarios y otras personas que accedan o utilicen el Servicio.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">02.</span> Descripción del Servicio
                            </h3>
                            <p>
                                Future Platform provee herramientas de software como servicio (SaaS) para la automatización de mensajería, gestión de clientes y operaciones comerciales mediante Inteligencia Artificial.
                                Nos reservamos el derecho de modificar, suspender o discontinuar cualquier aspecto del servicio en cualquier momento, aunque nos esforzaremos por notificar cambios significativos.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">03.</span> Responsabilidad del Usuario
                            </h3>
                            <p className="mb-4">Usted es responsable de:</p>
                            <ul className="list-none space-y-2">
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Mantener la confidencialidad de sus credenciales de acceso.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Todo el contenido y actividad que ocurra bajo su cuenta.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Cumplir con las políticas de uso de Meta, WhatsApp y otras plataformas integradas.</span>
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">04.</span> Uso Prohibido
                            </h3>
                            <p>
                                Queda estrictamente prohibido usar el servicio para enviar spam, contenido ilegal, ofensivo o que viole derechos de terceros. Future Platform se adhiere a una política de tolerancia cero respecto al abuso de mensajería automatizada.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">05.</span> Pagos Recurrentes y Suscripciones
                            </h3>
                            <p className="mb-3">
                                Al suscribirse a un plan pago de Future Platform, usted acepta los siguientes términos de facturación:
                            </p>
                            <ul className="list-none space-y-2">
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Los pagos son recurrentes (mensuales o anuales) y se cobran automáticamente al inicio de cada período.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Puede cancelar su suscripción en cualquier momento desde el panel de Facturación. La cancelación toma efecto al finalizar el período ya pagado.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>No se realizan reembolsos por períodos parciales. Mantendrá acceso hasta el final del ciclo de facturación.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Check size={16} className="text-green-500 mt-1 shrink-0" />
                                    <span>Los precios pueden actualizarse con previo aviso de 30 días. Se le notificará por email antes de aplicar cambios.</span>
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">06.</span> Procesamiento con Inteligencia Artificial
                            </h3>
                            <p>
                                Future Platform utiliza modelos de Inteligencia Artificial para procesar mensajes, generar respuestas y automatizar interacciones comerciales.
                                Al utilizar el servicio, usted acepta que sus datos de conversación y contenido comercial sean procesados por sistemas de IA
                                con el único propósito de brindar el servicio contratado. No utilizamos sus datos para entrenar modelos de IA de terceros.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-red-500">07.</span> Limitación de Responsabilidad
                            </h3>
                            <p>
                                En ningún caso Future Platform, ni sus directores, empleados o afiliados, serán responsables por daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo sin limitación, pérdida de beneficios, datos, uso, buena voluntad u otras pérdidas intangibles.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-white/10 text-sm text-gray-500">
                            Última actualización: 18 de Marzo de 2026
                        </div>
                    </div>
                </div>

                {/* Sales Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="sticky top-32">
                        {/* Value Card 1 */}
                        <div className="bg-gradient-to-b from-white/10 to-transparent p-[1px] rounded-2xl mb-6">
                            <div className="bg-[#0c0c0f] p-6 rounded-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-[50px] group-hover:bg-red-600/20 transition-all" />

                                <Shield className="text-red-500 mb-4" size={32} />
                                <h3 className="text-lg font-bold text-white mb-2">Seguridad Enterprise</h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    Tus datos están protegidos con encriptación de grado militar. Cumplimos con los más altos estándares.
                                </p>
                                <ul className="text-xs text-gray-500 space-y-2 mb-6">
                                    <li className="flex gap-2"><Check size={12} className="text-red-500" /> Encriptación AES-256</li>
                                    <li className="flex gap-2"><Check size={12} className="text-red-500" /> ISO 27001 Compliant</li>
                                </ul>
                            </div>
                        </div>

                        {/* CTA Card */}
                        <div className="bg-white text-black p-8 rounded-2xl text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                            <h3 className="text-2xl font-black mb-2">¿Listo para escalar?</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Únete a las empresas que automatizan el 80% de su atención al cliente hoy.
                            </p>
                            <Link to="/register" className="block w-full py-4 bg-black text-white font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-xl shadow-black/20">
                                Crear Cuenta Gratis
                            </Link>
                            <p className="text-[10px] text-gray-500 mt-4">No requiere tarjeta de crédito</p>
                        </div>
                    </div>
                </div>

            </main>

            {/* Simple Footer */}
            <footer className="border-t border-white/10 py-12 bg-black">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-500 text-sm">
                        © 2026 Future Platform & Automatización. Todos los derechos reservados.
                    </div>
                    <div className="flex gap-6 text-sm font-medium">
                        <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Política de Privacidad</Link>
                        <Link to="/terms-of-service" className="text-white">Términos</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
