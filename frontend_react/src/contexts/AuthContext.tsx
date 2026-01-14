import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useApi } from '../hooks/useApi';

interface User {
    id: string;
    email: string;
    role: string;
    tenant_id: number;
    store_name?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    register: (email: string, pass: string, storeName: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Default loading until check completes
    const { fetchApi } = useApi();

    const checkSession = async () => {
        try {
            // Don't use global error handler wrapper here to avoid infinite loops if possible
            const data = await fetchApi('/auth/me');
            if (data && data.id) {
                setUser(data);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.log("No active session", err);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    const login = async (email: string, pass: string) => {
        await fetchApi('/auth/login', {
            method: 'POST',
            body: { email, password: pass }
        });
        // Re-check me to get full object profile
        await checkSession();
    };

    const register = async (email: string, pass: string, storeName: string) => {
        await fetchApi('/auth/register', {
            method: 'POST',
            body: { email, password: pass, store_name: storeName }
        });
        // Register auto-logs in
        await checkSession();
    };

    const logout = async () => {
        try {
            await fetchApi('/auth/logout', { method: 'POST' });
        } catch (e) { console.error("Logout error", e); }
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
