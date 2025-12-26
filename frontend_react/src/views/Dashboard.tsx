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

import { FrustrationGauge } from '../components/FrustrationGauge';

export const Dashboard: React.FC = () => {
    // ... (existing code) ...

    return (
        <div className="view active">
            <h1 className="view-title mb-6">Mission Control</h1>

            {/* Phase 1: Holographic Command Deck */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <TelemetryHUD health={health} />
                    <div className="grid grid-cols-2 gap-6">
                        <RoiTicker />
                        <FrustrationGauge />
                    </div>
                </div>
                <div>
                    <SystemStatus health={health} />
                </div>
            </div>

            {/* Phase 2: Global Neural Feed */}
            <GlobalStreamLog />

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
