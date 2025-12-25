import React from 'react';
import { Bot, Zap, MessageSquare, Power, BrainCircuit } from 'lucide-react';

interface AgentCardProps {
    agent: {
        id: string;
        name: string;
        role: string;
        status: 'idle' | 'thinking' | 'sleeping';
        capabilities: string[];
        description: string;
    };
    onChat: (id: string) => void;
    onToggle: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onChat, onToggle }) => {
    const isSleeping = agent.status === 'sleeping';
    const isThinking = agent.status === 'thinking';

    return (
        <div className={`glass relative overflow-hidden p-6 transition-all duration-300 hover:scale-[1.02] border ${isThinking ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' :
                isSleeping ? 'border-slate-700/50 opacity-70' :
                    'border-cyan-500/30'
            }`}>
            {/* Status Indicator */}
            <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${isThinking ? 'bg-purple-400 animate-ping' :
                    isSleeping ? 'bg-slate-600' : 'bg-green-400'
                }`} />

            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${isThinking ? 'bg-purple-500/20' :
                        isSleeping ? 'bg-slate-700/20' : 'bg-cyan-500/20'
                    }`}>
                    <Bot size={28} className={
                        isThinking ? 'text-purple-400' :
                            isSleeping ? 'text-slate-400' : 'text-cyan-400'
                    } />
                </div>
                <button
                    onClick={() => onToggle(agent.id)}
                    className={`p-2 rounded-lg transition-colors ${isSleeping ? 'text-slate-500 hover:text-green-400' : 'text-green-400 hover:text-red-400'
                        }`}
                    title={isSleeping ? "Wake Agent" : "Sleep Mode"}
                >
                    <Power size={18} />
                </button>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
            <p className="text-xs text-cyan-500/80 font-mono mb-4 uppercase tracking-wider">{agent.role}</p>

            <p className="text-slate-400 text-sm mb-6 h-10 line-clamp-2">
                {agent.description}
            </p>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-2 mb-6">
                {agent.capabilities.map((cap, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-800/50 text-slate-300 border border-slate-700">
                        {cap}
                    </span>
                ))}
            </div>

            {/* Actions */}
            <div className="mt-auto">
                <button
                    onClick={() => onChat(agent.id)}
                    disabled={isSleeping}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isSleeping
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20'
                        }`}
                >
                    {isThinking ? (
                        <>
                            <BrainCircuit size={16} className="animate-pulse" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <MessageSquare size={16} />
                            Direct Link
                        </>
                    )}
                </button>
            </div>

            {/* Holographic corner accents */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/10 rounded-tl-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/10 rounded-br-xl pointer-events-none" />
        </div>
    );
};
