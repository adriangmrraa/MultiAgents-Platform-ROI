import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BadgeDollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface RoiData {
    summary: {
        total_estimated_gmv: number;
        formatted: string;
        total_conversions: number;
    };
}

export const RoiTicker: React.FC = () => {
    const { fetchApi } = useApi();
    const [roi, setRoi] = useState<RoiData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRoi = async () => {
            try {
                const data = await fetchApi('/admin/reports/assisted-gmv?days=30');
                setRoi(data);
            } catch (e) {
                console.error("ROI Fetch Error", e);
            } finally {
                setLoading(false);
            }
        };
        loadRoi();
    }, [fetchApi]);

    if (loading) return (
        <div className="glass p-4 rounded-xl animate-pulse h-32 flex items-center justify-center">
            <span className="text-cyan-500/50 font-mono text-sm">CALIBRATING ROI ENGINE...</span>
        </div>
    );

    return (
        <div className="glass p-6 rounded-xl relative overflow-hidden border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            {/* Background Gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <BadgeDollarSign className="text-emerald-400" size={24} />
                    <h3 className="text-lg font-bold text-white tracking-wide">ASSISTED GMV</h3>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono text-emerald-400/80 bg-emerald-900/30 px-2 py-1 rounded">
                    <TrendingUp size={12} />
                    <span>LAST 30 DAYS</span>
                </div>
            </div>

            <div className="flex flex-col">
                <span className="text-sm text-slate-400 font-mono mb-1">VALUE GENERATED</span>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 font-mono tracking-tight drop-shadow-lg">
                    {roi?.summary.formatted || "$0.00"}
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-slate-300">
                        <span className="font-bold text-emerald-400">{roi?.summary.total_conversions || 0}</span>
                        <span>Conversions confirmed</span>
                    </div>
                </div>
            </div>

            {/* Micro-disclaimer for heuristics */}
            <div className="absolute bottom-2 right-4 text-[10px] text-slate-600 flex items-center gap-1">
                <AlertCircle size={8} />
                <span>HEURISTIC EST.</span>
            </div>
        </div>
    );
};
