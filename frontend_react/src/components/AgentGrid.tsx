import React, { useState } from 'react';
import { AgentCard } from './AgentCard';

export const AgentGrid: React.FC = () => {
    // Phase 3: Mock Data based on engine.py definitions
    const [agents, setAgents] = useState([
        {
            id: 'branding',
            name: 'Branding Officer',
            role: 'Identity Specialist',
            status: 'idle' as const,
            capabilities: ['analyze_store_name', 'generate_palette'],
            description: 'Analyzes brand archetypes and generates cohesive visual identities.'
        },
        {
            id: 'scripts',
            name: 'Script Supervisor',
            role: 'Sales Copywriter',
            status: 'idle' as const,
            capabilities: ['context_aware_copy', 'objection_handling'],
            description: 'Drafts high-converting sales scripts and handling logic.'
        },
        {
            id: 'visuals',
            name: 'Visual Director',
            role: 'Creative Lead',
            status: 'sleeping' as const,
            capabilities: ['generate_social_posts', 'prompt_engineering'],
            description: 'Designs futuristic visual assets and marketing materials.'
        },
        {
            id: 'roi',
            name: 'ROI Analyst',
            role: 'Growth Strategist',
            status: 'thinking' as const,
            capabilities: ['projection_engine', 'growth_calculator'],
            description: 'Calculates break-even points and projects revenue growth.'
        },
        {
            id: 'rag',
            name: 'RAG Librarian',
            role: 'Knowledge Officer',
            status: 'idle' as const,
            capabilities: ['vector_embedding', 'knowledge_indexing'],
            description: 'Ingests product catalogs into vector memory for semantic search.'
        }
    ]);

    const handleChat = (id: string) => {
        console.log(`Opening comms link with agent: ${id}`);
        // Todo: Implement Chat Modal
    };

    const handleToggle = (id: string) => {
        setAgents(prev => prev.map(a => {
            if (a.id === id) {
                return {
                    ...a,
                    status: a.status === 'sleeping' ? 'idle' : 'sleeping'
                };
            }
            return a;
        }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-8">
            {agents.map(agent => (
                <AgentCard
                    key={agent.id}
                    agent={agent}
                    onChat={handleChat}
                    onToggle={handleToggle}
                />
            ))}
        </div>
    );
};
