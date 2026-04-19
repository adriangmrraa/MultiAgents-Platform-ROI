import { useState, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || detectApiBase();

function detectApiBase() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000'; // Target BFF Proxy
    }
    let hostname = window.location.hostname;

    // Legacy platform-ui support
    if (hostname.includes('platform-ui')) {
        return window.location.protocol + '//' + hostname.replace('platform-ui', 'orchestrator-service');
    }

    // Modern frontend-react support (EasyPanel / Production)
    if (hostname.includes('frontend') || hostname.includes('easypanel')) {
        // RESILIENCE FIX: Use Nginx Reverse Proxy (Relative Path)
        // This avoids guessing the backend public URL and relies on internal Docker networking.
        return '/api';
    }

    // Default fallback
    return '/api';
}

interface FetchOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    skipRedirect?: boolean;
    skipRefresh?: boolean; // Skip auto-refresh para evitar loops infinitos
}

// Mutex para evitar múltiples refreshes simultáneos
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let failedRequestsQueue: Array<() => void> = [];

const processQueue = (error: Error | null = null) => {
    failedRequestsQueue.forEach(resolve => {
        if (error) {
            resolve();
        } else {
            resolve();
        }
    });
    failedRequestsQueue = [];
};

async function attemptRefresh(): Promise<boolean> {
    if (isRefreshing) {
        return refreshPromise || Promise.resolve(false);
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            // Intentar refresh usando la cookie httponly
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Enviar cookies
            });

            if (response.ok) {
                console.log('Token refresh successful');
                processQueue(null);
                return true;
            } else {
                console.warn('Token refresh failed', response.status);
                processQueue(new Error('Refresh failed'));
                return false;
            }
        } catch (err) {
            console.error('Token refresh error:', err);
            processQueue(new Error('Refresh error'));
            return false;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

export function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const refreshCountRef = useRef(0); // Contador para evitar loops infinitos

    const fetchApi = useCallback(async (endpoint: string, options: FetchOptions = {}) => {
        setLoading(true);
        setError(null);

        const MAX_RETRIES = 3;
        const INITIAL_BACKOFF = 500; // ms

        const executeFetch = async (attempt: number): Promise<any> => {
            try {
                const isFormData = options.body instanceof FormData;
                // Get user email from localStorage for multi-tenant auth
                const userEmail = localStorage.getItem('user_email') || '';
                const headers: Record<string, string> = {
                    'x-user-email': userEmail,
                    ...options.headers
                };

                // CRITICAL: For FormData, we must let the browser set the boundary header
                if (!isFormData) {
                    headers['Content-Type'] = 'application/json';
                }

                const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers,
                    body: isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
                    credentials: 'include' // CRITICAL: Send HttpOnly Cookies
                });

                if (response.status === 401) {
                    // Skip redirect if skipRedirect is true or skipRefresh is set
                    if (options.skipRedirect || options.skipRefresh) {
                        throw new Error("Unauthorized");
                    }

                    console.warn("Unauthorized (401). Attempting refresh...");

                    // Auto-refresh con guard contra loops infinitos
                    if (refreshCountRef.current < 2) {
                        refreshCountRef.current += 1;
                        
                        const refreshSuccess = await attemptRefresh();
                        
                        if (refreshSuccess) {
                            // Reintentar el request original
                            console.log("Token refreshed, retrying original request...");
                            return executeFetch(attempt);
                        }
                    }

                    // Si el refresh falló o ya excedimos el límite, redirigir
                    console.warn("Refresh failed or limit exceeded. Redirecting to Login...");
                    refreshCountRef.current = 0; // Reset counter
                    window.location.href = '/login';
                    throw new Error("Unauthorized");
                }

                // Reset refresh counter on successful response
                if (response.ok) {
                    refreshCountRef.current = 0;
                }

                // SaaS Subscription Guard: Redirect to billing when blocked
                if (response.status === 402) {
                    const errorData = await response.json().catch(() => ({}));
                    console.warn("Subscription required (402):", errorData);
                    if (!window.location.pathname.startsWith('/billing')) {
                        window.location.href = '/billing';
                    }
                    throw new Error(errorData.message || "Suscripcion requerida");
                }

                if (!response.ok) {
                    const errorText = await response.text();

                    if (response.status === 500) {
                        console.error("CRITICAL BACKEND ERROR (500):", errorText);
                        throw new Error("Ocurrió un error inesperado en nuestros servidores. Por favor intente más tarde.");
                    }

                    if (errorText.trim().startsWith('<!DOCTYPE html') || errorText.trim().startsWith('<html')) {
                        throw new Error(`API Error: ${response.status} (Backend Unreachable)`);
                    }
                    try {
                        const jsonErr = JSON.parse(errorText);
                        let finalMsg: any = jsonErr.detail || jsonErr.message || `HTTP ${response.status}`;

                        if (typeof finalMsg !== 'string') {
                            finalMsg = JSON.stringify(finalMsg);
                        }

                        const techKeywords = ["violates", "constraint", "foreign key", "sql", "pydantic", "execution", "integrity", "table", "column"];
                        if (techKeywords.some(k => String(finalMsg).toLowerCase().includes(k))) {
                            console.warn("Sanitized Technical Error:", finalMsg);
                            finalMsg = "No se pudo completar la operación debido a dependencias activas.";
                        }

                        throw new Error(String(finalMsg));
                    } catch (err: any) {
                        if (err.message && err.message !== "Unexpected end of JSON input") throw err;
                        throw new Error("Error de comunicación con el servidor.");
                    }
                }

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                const textData = await response.text();
                // Simple sanity check
                if (textData.trim().startsWith('<!DOCTYPE html')) {
                    throw new Error("Invalid API Response: HTML received.");
                }
                return textData;

            } catch (err: any) {
                // Don't retry Auth errors
                if (err.message === "Unauthorized") throw err;

                const method = (options.method || 'GET').toUpperCase();
                const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT'].includes(method);
                if (isIdempotent && attempt < MAX_RETRIES) {
                    const delay = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                    console.warn(`API Attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return executeFetch(attempt + 1);
                }
                throw err;
            }
        };

        try {
            return await executeFetch(1);
        } catch (err: any) {
            console.error("API Fetch Error after exhaustion:", err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { fetchApi, loading, error };
}