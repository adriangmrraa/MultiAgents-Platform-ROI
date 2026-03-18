import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, Check, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-purple-500/30">
            {/* Header / Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#09090b]/80 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                            <Zap size={18} className="text-white fill-current" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Future Platform</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Iniciar Sesión</Link>
                        <Link to="/register" className="btn-primary bg-white text-black hover:bg-gray-200 border-none px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                            Prueba Gratis <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* Legal Content Column */}
                <div className="lg:col-span-8 space-y-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
                            Política de Privacidad
                        </h1>
                        <p className="text-xl text-gray-400 leading-relaxed">
                            En Future Platform, la transparencia es nuestro core. Esta política detalla cómo protegemos, procesamos y respetamos tus datos y los de tus clientes al utilizar nuestra infraestructura de Inteligencia Artificial.
                        </p>
                    </div>

                    <div className="space-y-8 text-gray-300 font-light leading-relaxed border-l-2 border-white/5 pl-8">

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">01.</span> Recopilación de Datos
                            </h3>
                            <p>
                                Para proporcionar nuestros servicios de automatización, recopilamos información limitada necesaria para el funcionamiento de los agentes de IA. Esto incluye:
                            </p>
                            <ul className="mt-4 grid grid-cols-1 gap-3">
                                <li className="bg-white/5 p-3 rounded-lg flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded text-blue-400"><Eye size={16} /></div>
                                    <span><strong>Datos de Identidad:</strong> Nombre, correo electrónico y perfil público (proporcionado vía Login de Meta/Google).</span>
                                </li>
                                <li className="bg-white/5 p-3 rounded-lg flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/20 rounded text-purple-400"><RefreshCw size={16} /></div>
                                    <span><strong>Datos de Interacción:</strong> Historial de mensajes y metadatos técnicos para el entrenamiento contextual de su agente.</span>
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">02.</span> Uso de Datos de Meta (Facebook/Instagram/WhatsApp)
                            </h3>
                            <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
                                <p className="text-blue-200 font-medium mb-2">Compromiso de Privacidad con Meta:</p>
                                <p className="text-sm opacity-80">
                                    Utilizamos los datos obtenidos a través de las APIs de Meta (Graph API, WhatsApp Business API) <strong>exclusivamente</strong> para facilitar la comunicación automatizada entre su empresa y sus clientes.
                                </p>
                                <ul className="mt-3 text-sm space-y-1">
                                    <li className="flex gap-2"><Check size={14} className="text-blue-400" /> NO vendemos datos de Meta a terceros.</li>
                                    <li className="flex gap-2"><Check size={14} className="text-blue-400" /> NO utilizamos estos datos para fines publicitarios propios.</li>
                                    <li className="flex gap-2"><Check size={14} className="text-blue-400" /> NO transferimos datos fuera de nuestra infraestructura segura.</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">03.</span> Derechos del Usuario (GDPR)
                            </h3>
                            <p>
                                Usted mantiene el control total sobre sus datos. Conforme a las regulaciones de protección de datos, tiene derecho a:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 mt-2 marker:text-purple-500">
                                <li><strong>Acceso:</strong> Solicitar una copia de los datos que almacenamos.</li>
                                <li><strong>Rectificación:</strong> Corregir información inexacta.</li>
                                <li><strong>Olvido:</strong> Solicitar la eliminación completa de sus datos de nuestros servidores ("Derecho al olvido").</li>
                            </ul>
                            <p className="mt-2 text-sm text-gray-500">Para ejercer estos derechos, contacte a: privacy@futureia.com</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">04.</span> Procesamiento con Inteligencia Artificial
                            </h3>
                            <p>
                                Future Platform utiliza modelos de IA de terceros (OpenAI, Anthropic, etc.) para procesar mensajes y generar respuestas automatizadas.
                                Sus datos de conversación son enviados a estos proveedores exclusivamente para generar respuestas en tiempo real.
                                No se utilizan para entrenar modelos de IA externos. Los proveedores de IA están sujetos a acuerdos de procesamiento de datos (DPA)
                                que garantizan la confidencialidad y seguridad de la información procesada.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">05.</span> Seguridad y Retención de Datos
                            </h3>
                            <p className="mb-3">
                                Implementamos medidas técnicas avanzadas (Cifrado TLS 1.3, bases de datos encriptadas en reposo) para proteger su información.
                            </p>
                            <ul className="list-disc pl-5 space-y-1 mt-2 marker:text-purple-500">
                                <li><strong>Datos de cuenta:</strong> Se retienen mientras la cuenta esté activa y hasta 90 días después de la cancelación.</li>
                                <li><strong>Historial de conversaciones:</strong> Se retiene durante la vigencia de la suscripción. Puede solicitar su eliminación en cualquier momento.</li>
                                <li><strong>Datos de facturación:</strong> Se retienen por el período legalmente requerido (mínimo 5 años por normativa fiscal).</li>
                                <li><strong>Logs y analytics:</strong> Datos anonimizados pueden retenerse indefinidamente para mejora del servicio.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="text-purple-500">06.</span> Pagos y Datos Financieros
                            </h3>
                            <p>
                                Los pagos son procesados por Stripe y MercadoPago. Future Platform no almacena números de tarjeta de crédito ni datos
                                financieros sensibles. Toda la información de pago es gestionada directamente por los procesadores de pago certificados (PCI DSS).
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
                        {/* Trust Card */}
                        <div className="bg-gradient-to-b from-white/10 to-transparent p-[1px] rounded-2xl mb-6">
                            <div className="bg-[#0c0c0f] p-6 rounded-2xl relative overflow-hidden group">
                                <Lock className="text-purple-500 mb-4" size={32} />
                                <h3 className="text-lg font-bold text-white mb-2">Tus Datos son Tuyos</h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    Nuestra arquitectura "Sovereign AI" garantiza que tus datos comerciales nunca se mezclan con los de otros clientes.
                                </p>
                            </div>
                        </div>

                        {/* CTA Card */}
                        <div className="bg-white text-black p-8 rounded-2xl text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600" />
                            <h3 className="text-2xl font-black mb-2">Automatiza Hoy</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Recupera 20 horas a la semana dejando que la IA responda por ti.
                            </p>
                            <Link to="/register" className="block w-full py-4 bg-black text-white font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-xl shadow-black/20">
                                Empezar Ahora
                            </Link>
                            <p className="text-[10px] text-gray-500 mt-4">Setup en menos de 5 minutos</p>
                        </div>
                    </div>
                </div>

            </main>

            {/* Simple Footer */}
            <footer className="border-t border-white/10 py-12 bg-black">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-500 text-sm">
                        © 2026 Future Platform & Automatización.
                    </div>
                    <div className="flex gap-6 text-sm font-medium">
                        <Link to="/privacy-policy" className="text-white">Política de Privacidad</Link>
                        <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">Términos</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
