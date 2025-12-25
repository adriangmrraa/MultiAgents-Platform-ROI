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
    // Matches "multiagents-frontend.x.host" -> "multiagents-orchestrator.x.host"
    if (hostname.includes('frontend')) {
        // Try to replace 'frontend' with 'orchestrator' which is the standard service name
        // This handles 'multiagents-frontend' -> 'multiagents-orchestrator'
        let newHost = hostname.replace('frontend', 'orchestrator');
        // If the naming convention was 'frontend-react', it might have already been handled, 
        // but this generic replacement is safer.
        return window.location.protocol + '//' + newHost;
    }

    // Default fallback to relative path (if using Nginx reverse proxy at root)
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
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-admin-token': ADMIN_TOKEN,
                ...options.headers
            };

            // Handle BFF proxying if we use relative paths
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            if (!response.ok) {
                const errorData = await response.text();
                // Prevent showing HTML error pages as text messages
                if (errorData.trim().startsWith('<!DOCTYPE html') || errorData.trim().startsWith('<html')) {
                    throw new Error(`API Error: ${response.status} (Backend Unreachable)`);
                }
                throw new Error(errorData || `HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            // If response is HTML but status is 200 (common with SPA fallbacks for bad API paths)
            const textData = await response.text();
            if (textData.trim().startsWith('<!DOCTYPE html') || textData.trim().startsWith('<html')) {
                throw new Error("Invalid API Response: Received HTML instead of JSON. Check API_BASE URL.");
            }
            return textData;

        } catch (err: any) {
            console.error("API Fetch Error:", err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { fetchApi, loading, error };
}
