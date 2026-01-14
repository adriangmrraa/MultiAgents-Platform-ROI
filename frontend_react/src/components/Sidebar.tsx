import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
    Menu,
    X,
    Database
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
                {/* Invisible Scroll Zones */}
                <div className="absolute top-0 left-0 right-0 h-20 z-10 cursor-ns-resize opacity-0" onMouseEnter={() => handleEdgeScroll('up')} />

                <nav ref={navRef} className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-4 px-2">
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Mission Control" desc="Vista global de la IA" steps={["Analizar ROI", "Revisar Galaxy"]} />
                    <NavItem to="/stores" icon={<Store size={20} />} label="Hangar" desc="Despliegue de tiendas" steps={["Configurar nodos", "Verificar stock"]} />
                    <NavItem to="/agents" icon={<Zap size={20} />} label="Agent Squad" desc="Gestión de neuronas" steps={["Activar agentes", "Refinar prompts"]} />
                    <NavItem to="/knowledge" icon={<Database size={20} />} label="Knowledge Base" desc="Cerebro del agente" steps={["Subir PDF/Docs", "Vectorizar"]} />
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

                <div className="absolute bottom-0 left-0 right-0 h-20 z-10 cursor-ns-resize opacity-0" onMouseEnter={() => handleEdgeScroll('down')} />
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

            {/* User Profile Section (Bottom) */}
            <div className="p-4 border-t border-white/5">
                <UserProfile />
            </div>
        </>
    );
};

const UserProfile: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[1px]">
                    {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                            <div className="text-xs font-bold text-white">
                                {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : (user?.email?.substring(0, 2).toUpperCase() || 'ME')}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex-1 text-left hidden lg:block">
                    <div className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors truncate max-w-[120px]">
                        {user?.full_name || 'My Profile'}
                    </div>
                    <div className="text-xs text-white/40 truncate max-w-[120px]">
                        {user?.store_name || user?.role || 'Tenant Owner'}
                    </div>
                </div>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#09090b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2">
                        <NavLink to="/profile" className="px-4 py-3 hover:bg-white/5 flex items-center gap-3 text-sm text-white/80 hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                            <Key size={16} /> Account Settings
                        </NavLink>
                        <div className="h-px bg-white/5" />
                        <button
                            onClick={() => {
                                logout();
                                setIsOpen(false);
                            }}
                            className="px-4 py-3 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 text-sm w-full text-left transition-colors"
                        >
                            <Menu size={16} className="rotate-90" /> Log Out
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}


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
