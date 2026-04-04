import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://orchestrator_service:8000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// Configuración de CORS: lista blanca explícita desde variable de entorno
const ALLOWED_ORIGINS_RAW = process.env.CORS_ALLOWED_ORIGINS || '';
const ALLOWED_ORIGINS: string[] = ALLOWED_ORIGINS_RAW
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Permitir solicitudes sin origin (ej. servidor a servidor, curl)
        if (!origin) return callback(null, true);
        // Si no hay lista configurada, permitir todo (modo desarrollo)
        if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-signature', 'Cookie']
}));
app.options('*', cors());
app.use(express.json());

// Middleware: valida sesión activa antes de inyectar el token admin
async function validateSession(req: any, res: any, next: any) {
    const cookieHeader = req.headers['cookie'] || '';
    if (!cookieHeader) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const verifyRes = await axios.get(`${ORCHESTRATOR_URL}/auth/me`, {
            headers: { cookie: cookieHeader },
            timeout: 5000,
        });
        if (verifyRes.status !== 200) {
            return res.status(401).json({ error: 'Invalid session' });
        }
        (req as any).user = verifyRes.data;
        next();
    } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 403) {
            return res.status(401).json({ error: 'Session expired' });
        }
        return res.status(503).json({ error: 'Auth service unavailable' });
    }
}

// --- Strict Contracts ---

interface TelemetryLog {
    id: number | string;
    event_type: string;
    message: string;
    severity?: string;
    payload?: any;
    occurred_at?: string;
}

interface BusinessAsset {
    id: string;
    asset_type: 'branding' | 'script' | 'image' | 'roi_report' | 'other';
    content: any;
    created_at: string;
}

// --- Smart SSE Logic ---

// --- Global Stream (Phase 2: Mission Control) ---
app.get('/api/engine/stream/global', validateSession, async (req: Request, res: Response) => {
    console.log(`[SSE] Global Console connected`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let lastLogId = 0;
    let isActive = true;

    req.on('close', () => {
        console.log(`[SSE] Global Console disconnected`);
        isActive = false;
    });

    const loop = async () => {
        if (!isActive) return;

        try {
            // Fetch Global Events from Orchestrator
            // We use /admin/events (which returns system_events globally)
            const logsRes = await axios.get<any[]>(`${ORCHESTRATOR_URL}/admin/events`, {
                params: { limit: 20 },
                headers: { 'x-admin-token': ADMIN_TOKEN }
            });

            const newLogs = logsRes.data || [];

            // Filter strictly new logs
            const freshLogs = newLogs.filter((l: any) => {
                const lid = Number(l.id);
                return !isNaN(lid) && lid > lastLogId;
            }).reverse();

            if (freshLogs.length > 0) {
                lastLogId = Number(freshLogs[freshLogs.length - 1].id);
                freshLogs.forEach((log: any) => {
                    res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
                });
            }

        } catch (error) {
            // console.error(`[Global SSE Error] ${error}`);
            // Silent retry
        }

        if (isActive) setTimeout(loop, 2000);
    };

    loop();
});

app.get('/api/engine/stream/:tenantId', validateSession, async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    console.log(`[SSE] Client connected for Tenant: ${tenantId}`);

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Polling State
    let lastAssetCount = 0;
    let lastLogId = 0;
    let isActive = true;

    // Cleanup on close
    req.on('close', () => {
        console.log(`[SSE] Client disconnected: ${tenantId}`);
        isActive = false;
    });

    // The "Heartbeat" Loop
    const loop = async () => {
        if (!isActive) return;

        try {
            // 1. Fetch Telemetry (Thinking Logs)
            // We use the admin token to access internal telemetry
            try {
                // FIXED: Use /admin/events as verified in Schema
                const logsRes = await axios.get<any[]>(`${ORCHESTRATOR_URL}/admin/events`, {
                    params: { tenant_id: tenantId, limit: 10 },
                    headers: { 'x-admin-token': ADMIN_TOKEN }
                });

                // Check if response is array (admin/events returns simple array) or dict
                const newLogs = Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data as any).items || [];

                // Filtering logic: robust check
                const freshLogs = newLogs.filter((l: TelemetryLog) => {
                    const lid = Number(l.id);
                    return !isNaN(lid) && lid > lastLogId;
                }).reverse(); // Oldest first

                if (freshLogs.length > 0) {
                    const last = freshLogs[freshLogs.length - 1];
                    lastLogId = Number(last.id);

                    freshLogs.forEach((log: TelemetryLog) => {
                        res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
                    });
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                // console.error("Log fetch error", message); // Optional: verbose
            }

            // 2. Fetch Business Assets
            try {
                const assetsRes = await axios.get<{ assets: BusinessAsset[] }>(`${ORCHESTRATOR_URL}/admin/engine/assets/${tenantId}`, {
                    headers: { 'x-admin-token': ADMIN_TOKEN }
                });
                const assets = assetsRes.data.assets || [];

                if (assets.length > lastAssetCount) {
                    // Find *new* assets
                    const newAssets = assets.slice(lastAssetCount);
                    lastAssetCount = assets.length;

                    newAssets.forEach((asset: any) => {
                        // Dispatch specific event types based on asset_type
                        // Asset types: 'branding', 'script', 'image', 'roi_report'
                        const evtType = asset.asset_type || 'asset';
                        res.write(`event: ${evtType}\ndata: ${JSON.stringify(asset)}\n\n`);
                    });
                }
            } catch (err) {
                // Silent fail
            }

        } catch (error) {
            console.error(`[SSE Loop Error] ${error}`);
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Sync error" })}\n\n`);
        }

        // Schedule next tick
        if (isActive) setTimeout(loop, 2000);
    };

    // Start
    loop();
});

// --- Standard Proxy ---

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'bff-interface', mode: 'hybrid-sse' });
});

app.use(async (req: Request, res: Response, next: any) => {
    // PROD-04: Validar sesión antes de inyectar el token admin en rutas /api/engine
    if (req.originalUrl.startsWith('/api/engine')) {
        return validateSession(req, res, async () => {
            await proxyToOrchestrator(req, res);
        });
    }
    await proxyToOrchestrator(req, res);
});

async function proxyToOrchestrator(req: Request, res: Response) {
    // Reescritura de rutas: /api/engine/* → /admin/engine/*
    let targetUrl = req.originalUrl;
    if (req.originalUrl.startsWith('/api/engine')) {
        targetUrl = req.originalUrl.replace('/api/engine', '/admin/engine');
    }

    const fullUrl = `${ORCHESTRATOR_URL}${targetUrl}`;
    console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${fullUrl}`);

    try {
        const response = await axios({
            method: req.method,
            url: fullUrl,
            data: req.body,
            headers: {
                ...req.headers,
                host: undefined,
                // Inyectar token admin server-side (nunca expuesto al browser)
                ...(req.originalUrl.startsWith('/api/engine') ? { 'x-admin-token': ADMIN_TOKEN } : {})
            }
        });
        res.status(response.status).send(response.data);
    } catch (error: any) {
        console.error(`[Proxy Error] ${error.message}`);
        if (error.response) {
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(502).json({ error: 'Orchestrator unavailable', details: error.message });
        }
    }
}

app.listen(port, () => {
    console.log(`BFF Service running on port ${port}`);
    console.log(`Mode: Smart Proxy (SSE + Rewrite)`);
});