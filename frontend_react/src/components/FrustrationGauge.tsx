import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { AlertTriangle, ThermometerSun, HeartHandshake } from 'lucide-react';

interface FrustrationData {
    score: number;
    status: string;
    triggers: string[];
}

export const FrustrationGauge: React.FC = () => {
    const { fetchApi } = useApi();
    const [data, setData] = useState<FrustrationData | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetchApi('/admin/analytics/frustration');
                setData(res);
            } catch (e) {
                console.error("Gauge Error", e);
            }
        };
        load();
        const interval = setInterval(load, 5000); // Fast poller
        return () => clearInterval(interval);
    }, [fetchApi]);

    if (!data) return null;

    const getColor = (score: number) => {
        if (score < 30) return 'text-emerald-400 border-emerald-500/30';
        if (score < 60) return 'text-yellow-400 border-yellow-500/30';
        return 'text-red-500 border-red-500/50 animate-pulse';
    };

    const getIcon = (score: number) => {
        if (score < 30) return <HeartHandshake size={20} />;
        if (score < 60) return <ThermometerSun size={20} />;
        return <AlertTriangle size={20} />;
    };

    return (
        <div className={`glass p-4 rounded-xl border ${getColor(data.score).split(' ')[1]} flex items-center gap-4 transition-all duration-500`}>
            <div className={`p-3 rounded-full bg-black/20 ${getColor(data.score).split(' ')[0]}`}>
                {getIcon(data.score)}
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-300 tracking-wider">CUSTOMER MOOD</span>
                    <span className={`text-xs font-black ${getColor(data.score).split(' ')[0]}`}>{data.score}%</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-out ${data.score > 60 ? 'bg-gradient-to-r from-orange-500 to-red-600' :
                                data.score > 30 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                                    'bg-gradient-to-r from-emerald-400 to-cyan-400'
                            }`}
                        style={{ width: `${data.score}%` }}
                    />
                </div>
            </div>

            {/* Triggers Warning */}
            {data.triggers.length > 0 && (
                <div className="hidden lg:block text-[10px] text-slate-500 text-right font-mono">
                    {data.triggers.map(t => <div key={t}>⚠️ {t.toUpperCase()}</div>)}
                </div>
            )}
        </div>
    );
};
