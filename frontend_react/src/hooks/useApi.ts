import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || detectApiBase();
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "admin-secret-99";

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
}

export function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchApi = useCallback(async (endpoint: string, options: FetchOptions = {}) => {
        setLoading(true);
        setError(null);

        const MAX_RETRIES = 3;
        const INITIAL_BACKOFF = 500; // ms

        const executeFetch = async (attempt: number): Promise<any> => {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-admin-token': ADMIN_TOKEN,
                    ...options.headers
                };

                const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    if (errorData.trim().startsWith('<!DOCTYPE html') || errorData.trim().startsWith('<html')) {
                        throw new Error(`API Error: ${response.status} (Backend Unreachable)`);
                    }
                    throw new Error(errorData || `HTTP ${response.status}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                const textData = await response.text();
                if (textData.trim().startsWith('<!DOCTYPE html') || textData.trim().startsWith('<html')) {
                    throw new Error("Invalid API Response: Received HTML instead of JSON. Check API_BASE URL.");
                }
                return textData;

            } catch (err: any) {
                if (attempt < MAX_RETRIES) {
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
