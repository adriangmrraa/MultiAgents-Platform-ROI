import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { User, Shield, Key, Save, LogOut } from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';

export const Profile: React.FC = () => {
    const { user, logout } = useAuth(); // We'll refresh user by reloading or refetching
    const { fetchApi } = useApi();
    const { t, language, setLanguage } = useLanguage();

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let timer: any;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(c => c - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResendEmail = async () => {
        setIsResending(true);
        setMessage('');
        try {
            await fetchApi('/auth/resend-verification', { method: 'POST' });
            setMessage('✓ ' + t('profile.resendSuccess'));
            setCooldown(60);
        } catch (err: any) {
            if (err.status === 429) {
                setMessage(t('profile.retryIn', { count: 30 }));
                setCooldown(30);
            } else {
                setMessage(t('common.error') + ': ' + (err.message || 'Error SMTP'));
            }
        } finally {
            setIsResending(false);
        }
    };

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setAvatarUrl(user.avatar_url || '');
        }
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage('');

        try {
            await fetchApi('/auth/profile', {
                method: 'PUT',
                body: {
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    password: password || undefined
                }
            });
            setMessage(t('common.success') + '. ' + t('profile.refreshNotice'));
            setPassword('');
        } catch (err: any) {
            setMessage(t('common.error') + ': ' + (err.message || 'Unknown error'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="view active">
            <h1 className="view-title flex items-center gap-3">
                <User className="text-purple-400" /> {t('profile.title')}
            </h1>

            {!user?.is_verified && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse-subtle">
                    <div className="flex items-center gap-4 text-center md:text-left">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h3 className="text-amber-500 font-bold">{t('profile.unverified')}</h3>
                            <p className="text-amber-500/60 text-sm">{t('profile.unverifiedDesc')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleResendEmail}
                        disabled={isResending || cooldown > 0}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${cooldown > 0
                            ? 'bg-white/5 text-white/40 cursor-not-allowed'
                            : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                            }`}
                    >
                        {isResending ? t('profile.sending') : cooldown > 0 ? t('profile.retryIn', { count: cooldown }) : t('profile.resendEmail')}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">

                {/* ID Card */}
                <div className="glass p-8 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-32 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="flex flex-col items-center justify-center mb-8">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-1 mb-4 shadow-lg shadow-purple-500/20">
                            <img
                                src={avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (user?.email || 'user')}
                                alt="Avatar"
                                className="w-full h-full rounded-full bg-black object-cover"
                            />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">{user?.full_name || 'Anonymous User'}</h2>
                        <span className="text-white/40 text-sm font-mono mt-1">{user?.email}</span>
                        <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
                            <Shield size={12} /> {user?.role || 'Guest'}
                        </span>
                    </div>

                    <div className="border-t border-white/5 pt-6 grid grid-cols-2 gap-4 text-sm">
                        <div className="col-span-2 mb-4">
                            <label className="block text-white/30 text-xs uppercase font-bold tracking-wider mb-2">{t('profile.language')}</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setLanguage('es')}
                                    className={`flex-1 py-2 rounded-lg border transition-all ${language === 'es' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                >
                                    Español
                                </button>
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={`flex-1 py-2 rounded-lg border transition-all ${language === 'en' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                >
                                    English
                                </button>
                            </div>
                        </div>
                        <div>
                            <span className="block text-white/30 text-xs uppercase font-bold tracking-wider mb-1">Tenant ID</span>
                            <span className="font-mono text-white/80">#{user?.tenant_id}</span>
                        </div>
                        <div>
                            <span className="block text-white/30 text-xs uppercase font-bold tracking-wider mb-1">Store</span>
                            <span className="font-mono text-white/80">{user?.store_name || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="glass p-8 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Key size={18} className="text-white/60" /> {t('profile.accountSettings')}
                    </h3>

                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="form-group">
                            <label className="block text-sm font-medium text-white/60 mb-2">{t('profile.displayName')}</label>
                            <input
                                type="text"
                                className="input-field w-full"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your name"
                            />
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-white/60 mb-2">{t('profile.avatarUrl')}</label>
                            <input
                                type="text"
                                className="input-field w-full"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-white/60 mb-2">{t('profile.password')}</label>
                            <input
                                type="password"
                                className="input-field w-full"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('profile.passwordPlaceholder')}
                            />
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={logout}
                                className="px-4 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 text-sm"
                            >
                                <LogOut size={16} /> {t('common.signOut')}
                            </button>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="btn-primary flex items-center gap-2"
                            >
                                {isSaving ? <span className="animate-spin">⌛</span> : <Save size={18} />}
                                {t('common.save')}
                            </button>
                        </div>

                        {message && (
                            <div className={`mt-4 p-3 rounded-lg text-sm ${message.includes('Error') ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'}`}>
                                {message}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};
