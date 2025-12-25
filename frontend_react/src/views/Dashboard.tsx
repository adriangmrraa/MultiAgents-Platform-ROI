import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Activity, MessageSquare, Users } from 'lucide-react';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { GlobalStreamLog } from '../components/GlobalStreamLog';
import { AgentGrid } from '../components/AgentGrid';
import { RagGalaxy } from '../components/RagGalaxy';
import { SystemStatus } from '../components/SystemStatus';

interface Stats {
    active_tenants: number;
    total_messages: number;
    processed_messages: number;
}

interface HealthCheck {
    name: string;
    status: 'OK' | 'FAIL' | 'WARN';
    details?: string;
}

interface HealthData {
    status: string;
    checks: HealthCheck[];
}

export const Dashboard: React.FC = () => {
    const { fetchApi } = useApi();
    const [stats, setStats] = useState<Stats | null>(null);
    const [health, setHealth] = useState<HealthData | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [statsData, healthData] = await Promise.all([
                    fetchApi('/admin/stats'),
                    fetchApi('/admin/diagnostics/healthz')
                ]);
                setStats(statsData);
                setHealth(healthData);
            } catch (e) {
                console.error(e);
            }
        };
        loadData();
        const interval = setInterval(loadData, 10000); // Faster refresh for "Live" feel
        return () => clearInterval(interval);
    }, [fetchApi]);

    return (
        <div className="view active">
            <h1 className="view-title mb-6">Mission Control</h1>

            {/* Phase 1: Holographic Command Deck */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                    <TelemetryHUD health={health} />
                </div>
                <div>
                    <SystemStatus health={health} />
                </div>
            </div>

            {/* Phase 2: Global Neural Feed */}
            <GlobalStreamLog />

            {/* Phase 3: Agent Command Deck */}
            <AgentGrid />

            {/* Phase 4: RAG Knowledge Map */}
            <RagGalaxy />

            <div className="stats-grid mt-8">
                <div className="stat-card glass accent">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="stat-label">Tenants (Fleets)</span>
                        <Users className="stat-icon" size={20} color="var(--accent)" />
                    </div>
                    <span className="stat-value">{stats?.active_tenants || 0}</span>
                    <span className="stat-meta">Active Deployed Units</span>
                </div>

                <div className="stat-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="stat-label">Comms Traffic</span>
                        <MessageSquare className="stat-icon" size={20} color="var(--text-secondary)" />
                    </div>
                    <span className="stat-value">{stats?.total_messages || 0}</span>
                    <span className="stat-meta">Interactions Processed</span>
                </div>

                <div className="stat-card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="stat-label">Neural Efficiency</span>
                        <Activity className="stat-icon" size={20} color="var(--success)" />
                    </div>
                    <span className="stat-value">
                        {stats?.total_messages ? Math.round((stats.processed_messages / stats.total_messages) * 100) : 0}%
                    </span>
                    <span className="stat-meta">Operational Success Rate</span>
                </div>
            </div>
        </div>
    );
};
