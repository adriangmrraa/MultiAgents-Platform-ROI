import React, { useEffect, useRef, useState } from 'react';
import { Database, Network, Search, Sparkles } from 'lucide-react';

interface KnowledgeNode {
    id: string;
    x: number;
    y: number;
    size: number;
    category: string;
    description: string;
    meta: string;
    color: string;
}

const { fetchApi } = useApi();
const [nodes, setNodes] = useState<KnowledgeNode[]>([]);

useEffect(() => {
    const loadGalaxy = async () => {
        try {
            // Fetch the "Star Map" from the Brain
            // Passing a mock tenant_id if not in context, or assuming backend infers it/global
            // In v3.5 we verify '1' or actual ID.
            const vectorNodes = await fetchApi('/admin/rag/galaxy?tenant_id=1');
            if (Array.isArray(vectorNodes)) {
                setNodes(vectorNodes);
            }
        } catch (e) {
            console.error("Galaxy Align Error", e);
        }
    };
    loadGalaxy();
}, [fetchApi]);

// Animation Loop
useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
        time += 0.005;
        // Resize canvas to parent
        if (containerRef.current) {
            canvas.width = containerRef.current.offsetWidth;
            canvas.height = containerRef.current.offsetHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections (Neural web)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        nodes.forEach((node, i) => {
            // Determine screen pos
            const nx = (node.x / 100) * canvas.width;
            const ny = (node.y / 100) * canvas.height;

            // Float animation
            const floatY = Math.sin(time + i) * 5;

            // Find close nodes to connect
            nodes.forEach((other, j) => {
                if (i === j) return;
                const ox = (other.x / 100) * canvas.width;
                const oy = (other.y / 100) * canvas.height + Math.sin(time + j) * 5;

                const dist = Math.hypot(nx - ox, (ny + floatY) - oy);
                if (dist < 100) {
                    ctx.moveTo(nx, ny + floatY);
                    ctx.lineTo(ox, oy);
                }
            });
        });
        ctx.stroke();

        // Draw Nodes
        nodes.forEach((node, i) => {
            const nx = (node.x / 100) * canvas.width;
            const ny = (node.y / 100) * canvas.height + Math.sin(time + i) * 5;

            ctx.beginPath();
            ctx.arc(nx, ny, node.size, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = node.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
}, [nodes]);

// Simple Mouse Interaction (Overlay)
const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check collision crudely
    const found = nodes.find(node => {
        const nx = (node.x / 100) * rect.width;
        const ny = (node.y / 100) * rect.height; // Ignore float for hitbox precision simply
        const dist = Math.hypot(mouseX - nx, mouseY - ny);
        return dist < 15;
    });

    setHoveredNode(found || null);
};

return (
    <div className="glass mt-8 p-1 rounded-2xl border border-indigo-900/30 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 bg-slate-900/80 p-3 border-b border-indigo-500/20 flex justify-between items-center z-10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <Database size={16} className="text-indigo-400" />
                <span className="text-xs font-mono text-indigo-300 tracking-widest">RAG_KNOWLEDGE_MAP v2.1</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Catalog
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span> Policy
                </div>
            </div>
        </div>

        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredNode(null)}
            className="h-[300px] w-full bg-black/60 relative cursor-crosshair"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black opacity-50"></div>
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Neural Description Tooltip */}
            {hoveredNode && (
                <div
                    className="absolute pointer-events-none z-20 bg-slate-900/95 border border-indigo-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] w-64 backdrop-blur-md"
                    style={{
                        left: `${hoveredNode.x}%`,
                        top: `${hoveredNode.y}%`,
                        transform: 'translate(10px, 10px)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={12} className="text-indigo-400 animate-pulse" />
                        <span className="text-[10px] text-indigo-300 font-bold uppercase">{hoveredNode.category} Node</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-light">
                        {hoveredNode.description}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>{hoveredNode.meta}</span>
                        <span>ID: {hoveredNode.id.split('-')[1]}</span>
                    </div>
                </div>
            )}

            {/* Empty State / Loading */}
            {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                    <Network className="animate-pulse mr-2" />
                    <span>Initializing Vector Space...</span>
                </div>
            )}
        </div>
    </div>
);
};
