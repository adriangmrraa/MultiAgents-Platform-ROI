import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://orchestrator_service:8000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-99';

// Configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-tenant-id', 'x-signature']
}));
app.options('*', cors());
app.use(express.json());

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
app.get('/api/engine/stream/global', async (req: Request, res: Response) => {
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

app.get('/api/engine/stream/:tenantId', async (req: Request, res: Response) => {
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

app.use(async (req: Request, res: Response) => {
    // Inject Admin Token for /api/engine calls if coming from UI? 
    // No, UI should send its auth. But for /admin calls proxying...
    // Let's keep it simple: strict proxy.

    // Rewrite path: /api/x -> /admin/x if needed? 
    // Our UI calls /api/engine/ignite. Orchestrator expects /admin/engine/ignite.
    // Let's do a smart rewrite for "User Friendly" API paths to "Internal Admin" paths

    let targetUrl = req.originalUrl;

    // Rewrite Map
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
                // If it's an engine call, we might need to inject the admin token if the user doesn't have it.
                // For MVP SetupExperience, we suppose the user has a temporary token or we Inject trusted one.
                // Let's inject ADMIN_TOKEN for 'engine' calls to simplify the "No Auth Setup" requirement.
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
});

app.listen(port, () => {
    console.log(`BFF Service running on port ${port}`);
    console.log(`Mode: Smart Proxy (SSE + Rewrite)`);
});