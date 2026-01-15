import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Store,
    MessageCircle,
    BarChart2,
    Key,
    Wrench,
    Terminal,
    Mail,
    Zap,
    Sparkles,
    Menu,
    X,
    Database
} from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';

export const Sidebar: React.FC = () => {
    const { t } = useLanguage();
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
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label={t('sidebar.missionControl')} desc={t('sidebar.missionControlDesc')} />
                    <NavItem to="/stores" icon={<Store size={20} />} label={t('sidebar.hangar')} desc={t('sidebar.hangarDesc')} />
                    <NavItem to="/agents" icon={<Zap size={20} />} label={t('sidebar.agentSquad')} desc={t('sidebar.agentSquadDesc')} />
                    <NavItem to="/knowledge" icon={<Database size={20} />} label={t('sidebar.knowledge')} desc={t('sidebar.knowledgeDesc')} />
                    <NavItem to="/chats" icon={<MessageCircle size={20} />} label={t('sidebar.commsChannel')} desc={t('sidebar.commsChannelDesc')} />

                    <div className="h-px bg-white/5 w-8 mx-auto my-4" />

                    <NavItem to="/logs" icon={<Terminal size={20} />} label={t('sidebar.blackBox')} desc={t('sidebar.blackBoxDesc')} />
                    <NavItem to="/analytics" icon={<BarChart2 size={20} />} label={t('sidebar.telemetry')} desc={t('sidebar.telemetryDesc')} />
                    <NavItem to="/tools" icon={<Wrench size={20} />} label={t('sidebar.armory')} desc={t('sidebar.armoryDesc')} />
                    <NavItem to="/console" icon={<Terminal size={20} />} label={t('sidebar.nerveCenter')} desc={t('sidebar.nerveCenterDesc')} />

                    <div className="h-px bg-white/5 w-8 mx-auto my-4" />

                    <NavItem to="/credentials" icon={<Key size={20} />} label={t('sidebar.keymaster')} desc={t('sidebar.keymasterDesc')} />
                    <NavItem to="/settings/ycloud" icon={<Mail size={20} />} label={t('sidebar.ycloud')} desc={t('sidebar.ycloudDesc')} />
                    <NavItem to="/nexus-setup" icon={<Zap size={20} />} label={t('sidebar.nexusEngine')} desc={t('sidebar.nexusEngineDesc')} />
                    <NavItem to="/magic" icon={<Sparkles size={20} />} label={t('sidebar.magic')} desc={t('sidebar.magicDesc')} />

                    <div className="h-px bg-white/5 w-8 mx-auto my-4" />
                    <NavItem to="/settings" icon={<Settings size={20} />} label={t('sidebar.settings')} desc={t('sidebar.settingsDesc')} />
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
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label={t('sidebar.dashboard')} />
                    <NavItem to="/chats" icon={<MessageCircle size={20} />} label={t('sidebar.chats')} />
                    <NavItem to="/agents" icon={<Zap size={20} />} label={t('sidebar.agents')} />
                    <NavItem to="/analytics" icon={<BarChart2 size={20} />} label={t('sidebar.analytics')} />
                    <NavItem to="/logs" icon={<Terminal size={20} />} label="Logs" />
                    <NavItem to="/settings" icon={<Settings size={20} />} label={t('sidebar.settings')} />
                    <NavItem to="/stores" icon={<Store size={20} />} label={t('sidebar.hangar')} />
                </div>
            </div>

            {/* User Profile Section REMOVED (Moved to UserProfile.tsx) */}
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
