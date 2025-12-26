import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Store,
    MessageCircle,
    ScrollText,
    BarChart2,
    Key,
    Smartphone,
    Wrench,
    Bot,
    Terminal,
    Mail,
    Zap,
    Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
    return (
        <aside className="
            lg:w-16 lg:h-screen lg:flex-col lg:border-r
            w-full h-16 flex-row border-t fixed bottom-0 left-0
            border-white/10 flex items-center py-4 lg:py-6 bg-black/40 backdrop-blur-md z-50
        ">
            {/* Logo - Hidden on mobile */}
            <div className="hidden lg:flex mb-8 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bot size={24} className="text-white" />
            </div>

            {/* Nav Items */}
            <nav className="flex-1 flex lg:flex-col flex-row justify-around lg:justify-start gap-2 lg:gap-4 w-full px-2 lg:overflow-y-auto pb-2 lg:pb-0">
                <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Mission Control" />
                <NavItem to="/stores" icon={<Store size={20} />} label="Hangar (Stores)" />
                <NavItem to="/agents" icon={<Zap size={20} />} label="Agent Squad" />
                <NavItem to="/chats" icon={<MessageCircle size={20} />} label="Comms Channel" />

                <div className="hidden lg:block h-px bg-white/10 w-full my-2" />

                <NavItem to="/logs" icon={<Terminal size={20} />} label="Black Box" />
                <NavItem to="/analytics" icon={<BarChart2 size={20} />} label="Telemetry" />
                <NavItem to="/tools" icon={<Wrench size={20} />} label="Armory (Tools)" />
                <NavItem to="/console" icon={<Terminal size={20} />} label="Nerve Center (Console)" />

                <div className="hidden lg:block h-px bg-white/10 w-full my-2" />

                <NavItem to="/credentials" icon={<Key size={20} />} label="Keymaster" />
                <NavItem to="/settings/meta" icon={<Smartphone size={20} />} label="Meta Uplink" />
                <NavItem to="/settings/ycloud" icon={<Mail size={20} />} label="YCloud Relay" />
                <NavItem to="/nexus-setup" icon={<Zap size={20} />} label="Nexus Engine" />
                <NavItem to="/magic" icon={<Sparkles size={20} />} label="Magic Onboarding" />
                <NavItem to="/setup" icon={<ScrollText size={20} />} label="Protocol Init" />
            </nav>

            {/* Footer - Hidden on mobile or integrated into nav */}
            <div className="hidden lg:block mt-auto">
                <NavItem to="/settings" icon={<Settings size={20} />} label="Config" />
            </div>
        </aside>
    );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group relative
            ${isActive ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-white/40 hover:text-white hover:bg-white/5'}
        `}
    >
        {icon}
        {/* Tooltip */}
        <div className="absolute left-14 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-sm">
            {label}
        </div>
    </NavLink>
);
