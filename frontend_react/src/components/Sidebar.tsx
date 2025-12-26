import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Store,
    MessageCircle,
    BarChart2,
    Key,
    Smartphone,
    Wrench,
    Bot,
    Terminal,
    Mail,
    Zap,
    Sparkles,
    ChevronUp,
    ChevronDown,
    Menu,
    X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
    const [isMobileVisible, setIsMobileVisible] = useState(true);
    const [lastInteracted, setLastInteracted] = useState(Date.now());
    const navRef = useRef<HTMLDivElement>(null);

    // Desktop Scroll Logic
    const handleEdgeScroll = (direction: 'up' | 'down') => {
        if (!navRef.current) return;
        const scrollAmount = direction === 'up' ? -100 : 100;
        navRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    };

    // Mobile Auto-hide Logic
    useEffect(() => {
        const timer = setInterval(() => {
            if (Date.now() - lastInteracted > 10000) {
                setIsMobileVisible(false);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [lastInteracted]);

    const handleInteraction = () => {
        setLastInteracted(Date.now());
        setIsMobileVisible(true);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex sidebar shadow-2xl overflow-visible group/sidebar" onMouseMove={handleInteraction}>
                {/* Scroll Edge Detection */}
                <div className="sidebar-scroll-edge top-0 hover:opacity-100 opacity-0 bg-gradient-to-b from-slate-900/50 to-transparent h-12 flex items-center justify-center cursor-pointer" onMouseEnter={() => handleEdgeScroll('up')}>
                    <ChevronUp size={16} className="text-white/40" />
                </div>

                <nav ref={navRef} className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-4 px-2">
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Mission Control" desc="Vista global de la IA" steps={["Analizar ROI", "Revisar Galaxy"]} />
                    <NavItem to="/stores" icon={<Store size={20} />} label="Hangar" desc="Despliegue de tiendas" steps={["Configurar nodos", "Verificar stock"]} />
                    <NavItem to="/agents" icon={<Zap size={20} />} label="Agent Squad" desc="Gestión de neuronas" steps={["Activar agentes", "Refinar prompts"]} />
                    <NavItem to="/chats" icon={<MessageCircle size={20} />} label="Comms Channel" desc="Interceptión neural" steps={["Responder usuarios", "Handoff"]} />

                    <div className="h-px bg-white/5 w-8 mx-auto my-4" />

                    <NavItem to="/logs" icon={<Terminal size={20} />} label="Black Box" desc="Protocolo crudo" steps={["Depurar logs", "Rastreo SSE"]} />
                    <NavItem to="/analytics" icon={<BarChart2 size={20} />} label="Telemetry" desc="Métricas vitales" steps={["Ver tráfico", "Analizar errores"]} />
                    <NavItem to="/tools" icon={<Wrench size={20} />} label="Armory" desc="Giroscopio táctico" steps={["Habilitar tools", "Configurar API"]} />
                    <NavItem to="/console" icon={<Terminal size={20} />} label="Nerve Center" desc="Comando ROOT" steps={["Ejeutar scripts", "Bypass AI"]} />

                    <div className="h-px bg-white/5 w-8 mx-auto my-4" />

                    <NavItem to="/credentials" icon={<Key size={20} />} label="Keymaster" desc="Vault de seguridad" steps={["Rotar llaves", "Cifrar tokens"]} />
                    <NavItem to="/settings/ycloud" icon={<Mail size={20} />} label="YCloud Relay" desc="Uplink WhatsApp" steps={["Configurar Webhook", "Testear canal"]} />
                    <NavItem to="/nexus-setup" icon={<Zap size={20} />} label="Nexus Engine" desc="Ignición del núcleo" steps={["Seteo inicial", "Cargar activos"]} />
                    <NavItem to="/magic" icon={<Sparkles size={20} />} label="Magic" desc="Onboarding fluido" steps={["Auto-deploy", "Sync Tienda"]} />
                </nav>

                <div className="sidebar-scroll-edge bottom-0 hover:opacity-100 opacity-0 bg-gradient-to-t from-slate-900/50 to-transparent h-12 flex items-center justify-center cursor-pointer" onMouseEnter={() => handleEdgeScroll('down')}>
                    <ChevronDown size={16} className="text-white/40" />
                </div>
            </aside>

            {/* Mobile Adaptive Navigation */}
            <div className="lg:hidden" onTouchStart={handleInteraction}>
                {!isMobileVisible && (
                    <button className="mobile-toggle-btn shadow-indigo-500/20" onClick={() => setIsMobileVisible(true)}>
                        <Menu size={24} />
                    </button>
                )}

                <div className={`mobile-nav-v4 flex-nowrap ${isMobileVisible ? 'translate-y-0 scale-100' : 'translate-y-32 scale-90 opacity-0'}`}>
                    {isMobileVisible && (
                        <button className="absolute -top-12 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 mb-4" onClick={() => setIsMobileVisible(false)}>
                            <X size={20} />
                        </button>
                    )}
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Home" />
                    <NavItem to="/chats" icon={<MessageCircle size={20} />} label="Chats" />
                    <NavItem to="/agents" icon={<Zap size={20} />} label="Agents" />
                    <NavItem to="/analytics" icon={<BarChart2 size={20} />} label="Stats" />
                    <NavItem to="/logs" icon={<Terminal size={20} />} label="Logs" />
                    <NavItem to="/settings" icon={<Settings size={20} />} label="Config" />
                    <NavItem to="/stores" icon={<Store size={20} />} label="Stores" />
                </div>
            </div>
        </>
    );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; desc?: string; steps?: string[] }> = ({ to, icon, label, desc, steps }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
        {icon}
        {/* Advanced Info Bubble (Desktop Only) */}
        {label && (
            <div className="hidden lg:block info-bubble">
                <span className="info-bubble-title">{label}</span>
                {desc && <span className="info-bubble-desc">{desc}</span>}
                {steps && (
                    <div className="info-bubble-steps">
                        {steps.map((step, i) => (
                            <div key={i} className="info-bubble-step">
                                <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                {step}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
    </NavLink>
);
