import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Key, LogOut, User as UserIcon, Settings } from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';

export const UserProfile: React.FC = () => {
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    // Initial Helper
    const getInitials = () => {
        if (user?.full_name) return user.full_name.substring(0, 2).toUpperCase();
        if (user?.email) return user.email.substring(0, 2).toUpperCase();
        return 'ME';
    };

    return (
        <>
            {/* 
              DESKTOP STRATEGY (Screens > 768px - 'lg' in Tailwind)
              "The Command Center" - Fixed Top Right Tower 
            */}
            <div className="hidden lg:block fixed top-6 right-8 z-[60]">
                <div className="relative">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`flex items-center gap-3 pl-3 pr-4 py-2 rounded-full border transition-all duration-300 group
                            ${isOpen
                                ? 'bg-black/60 border-red-500/50 shadow-[0_0_15px_rgba(255,0,0,0.2)]'
                                : 'bg-black/40 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-black/50'
                            }`}
                    >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 via-zinc-700 to-red-500 p-[1.5px] shadow-lg">
                            <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white">
                                        {getInitials()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Name & Role (Desktop) */}
                        <div className="flex flex-col items-start mr-1">
                            <span className="text-xs font-black text-white leading-tight group-hover:text-red-400 transition-colors tracking-tight">
                                {user?.full_name?.split(' ')[0] || t('userProfile.commander')}
                            </span>
                            <span className="text-[10px] text-white/50 font-mono leading-tight uppercase tracking-wider">
                                {user?.role === 'owner' ? 'Tenant Owner' : user?.role || 'Guest'}
                            </span>
                        </div>
                    </button>

                    {/* Desktop Dropdown (Anchored Bottom-Right) */}
                    {isOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                            <div className="absolute top-full right-0 mt-3 w-64 bg-[#1B1D20]/95 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">

                                <div className="p-4 border-b border-white/5">
                                    <p className="text-sm font-bold text-white">{user?.full_name || 'User Profile'}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                </div>

                                <div className="p-2 gap-1 flex flex-col">
                                    <NavLink
                                        to="/profile"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <div className="p-1.5 rounded-md bg-white/5 text-red-500">
                                            <UserIcon size={14} />
                                        </div>
                                        {t('userProfile.profileSettings')}
                                    </NavLink>
                                    <NavLink
                                        to="/credentials"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <div className="p-1.5 rounded-md bg-white/5 text-emerald-400">
                                            <Key size={14} />
                                        </div>
                                        {t('userProfile.apiKeys')}
                                    </NavLink>
                                    <NavLink
                                        to="/settings"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <div className="p-1.5 rounded-md bg-white/5 text-cyan-400">
                                            <Settings size={14} />
                                        </div>
                                        {t('userProfile.config')}
                                    </NavLink>
                                </div>

                                <div className="h-px bg-white/5 mx-2" />

                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-white hover:bg-red-500/20 transition-all group/logout"
                                    >
                                        <div className="p-1.5 rounded-md bg-red-500/10 text-red-400 group-hover/logout:text-red-300">
                                            <LogOut size={14} />
                                        </div>
                                        {t('userProfile.disconnect')}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 
              MOBILE STRATEGY (Screens < 768px - 'lg:hidden')
              "Integrated Header" - Fixed Top Bar
            */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#09090b]/90 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-4">
                {/* Left Side: Spacer for Hamburger (Sidebar handles the button, we just reserve space) */}
                <div className="w-10">
                    {/* Placeholder for sidebar hamburger alignment */}
                </div>

                {/* Center: Logo (Optional, can replace with Title) */}
                <div className="text-sm font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-white uppercase">
                    FUTURE IA
                </div>

                {/* Right Side: Avatar Trigger */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px]">
                        <div className="w-full h-full rounded-full bg-black overflow-hidden">
                            <img src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.full_name || 'User'}&background=random`} alt="Mobile Avatar" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </button>

                {/* Mobile Dropdown (Full Screen Overlay or Dropdown?) - Let's use Dropdown */}
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-14 right-2 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[60] flex flex-col p-2 animate-in slide-in-from-top-4">
                            <div className="p-3 border-b border-white/5 mb-2">
                                <p className="text-white font-bold">{user?.full_name}</p>
                                <p className="text-xs text-slate-400">{user?.role}</p>
                            </div>
                            <NavLink to="/profile" className="px-3 py-3 rounded hover:bg-white/5 text-sm text-slate-300 flex items-center gap-3">
                                <UserIcon size={16} /> Profile
                            </NavLink>
                            <NavLink to="/settings" className="px-3 py-3 rounded hover:bg-white/5 text-sm text-slate-300 flex items-center gap-3">
                                <Key size={16} /> Settings
                            </NavLink>
                            <button onClick={logout} className="px-3 py-3 rounded hover:bg-red-900/20 text-sm text-red-400 flex items-center gap-3 mt-2">
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </>
                )}
            </header>
        </>
    );
};
