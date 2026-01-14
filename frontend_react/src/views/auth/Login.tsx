import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [showResend, setShowResend] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
            navigate('/');
        } catch (err: any) {
            const msg = err.message || "Failed to login";
            setError(msg);
            if (msg.includes("verified")) {
                setShowResend(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
            // Use fetch directly or valid hook if available, but simplest is fetch for this one-off
            const res = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'dummy' }) // Password ignored by backend but schema requires UserLogin? No, I defined UserLogin in backend which needs password? Yes. I should adjust backend schema or send dummy.
                // Wait, backend uses UserLogin schema which implies password required?
                // `class UserLogin(BaseModel): email: EmailStr; password: str`
                // Yes. I will send a dummy password since the endpoint doesn't verify it (it just checks email existence).
            });
            if (res.ok) {
                setResendSuccess(true);
                setError('');
                setShowResend(false);
            }
        } catch (e) {
            // ignore
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 w-full max-w-md p-8 relative">
                {/* Glass Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Nexus Command
                        </h1>
                        <p className="text-gray-400 text-sm mt-2">Protocol Omega v5.1 Access</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm text-center">
                            {error}
                            {showResend && (
                                <button
                                    onClick={handleResend}
                                    disabled={resendLoading}
                                    className="block mx-auto mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
                                >
                                    {resendLoading ? "Sending..." : "Resend Verification Email"}
                                </button>
                            )}
                        </div>
                    )}
                    {resendSuccess && (
                        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-sm text-center">
                            Verification email resent! Check your inbox.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                                Identity
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="commander@nexus.ai"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                                Passcode
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </span>
                            ) : "Initialize Session"}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        No access? <Link to="/register" className="text-purple-400 hover:text-purple-300 transition-colors">Request Clearance</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
