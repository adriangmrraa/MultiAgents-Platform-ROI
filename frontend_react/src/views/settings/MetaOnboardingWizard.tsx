import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Check, Facebook, Instagram, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';

interface Asset {
    id: string;
    name?: string;
    username?: string;
    access_token?: string;
}

interface MetaAssets {
    pages: Asset[];
    instagram: Asset[];
    whatsapp: Asset[];
}

interface MetaOnboardingWizardProps {
    assets: MetaAssets;
    onComplete: () => void;
    onCancel: () => void;
}

const MetaOnboardingWizard: React.FC<MetaOnboardingWizardProps> = ({ assets, onComplete, onCancel }) => {
    const { t } = useLanguage();
    // Determine initial steps based on available assets
    const hasPages = assets.pages?.length > 0;
    const hasIg = assets.instagram?.length > 0;
    const hasWa = assets.whatsapp?.length > 0;

    const [step, setStep] = useState(hasPages ? 'pages' : hasIg ? 'instagram' : hasWa ? 'whatsapp' : 'empty');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const { fetchApi } = useApi();

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleNext = async () => {
        if (step === 'pages' && hasIg) {
            setStep('instagram');
        } else if ((step === 'pages' || step === 'instagram') && hasWa) {
            setStep('whatsapp');
        } else {
            await handleFinish();
        }
    };

    const handleFinish = async () => {
        setIsSaving(true);
        try {
            await fetchApi('/admin/integrations/update-channels', {
                method: 'POST',
                body: { selected_assets: Array.from(selectedIds) }
            });
            onComplete();
        } catch (error) {
            console.error("Error saving selection:", error);
            // Handle error (maybe show toast)
        } finally {
            setIsSaving(false);
        }
    };

    const renderStepContent = () => {
        if (step === 'empty') {
            return (
                <div className="text-center py-10">
                    <p className="text-zinc-400">{t('metaWizard.noAssets')}</p>
                </div>
            );
        }

        const currentAssets =
            step === 'pages' ? assets.pages :
                step === 'instagram' ? assets.instagram :
                    assets.whatsapp;

        const icon =
            step === 'pages' ? <Facebook className="w-5 h-5 text-blue-500" /> :
                step === 'instagram' ? <Instagram className="w-5 h-5 text-pink-500" /> :
                    <MessageCircle className="w-5 h-5 text-green-500" />;

        return (
            <div className="space-y-3">
                {currentAssets.map(asset => (
                    <div
                        key={asset.id}
                        onClick={() => toggleSelection(asset.id)}
                        className={`
                            border rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between
                            ${selectedIds.has(asset.id)
                                ? 'bg-zinc-900 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                                : 'bg-black/40 border-zinc-800 hover:border-zinc-700'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${selectedIds.has(asset.id) ? 'bg-zinc-800' : 'bg-zinc-900'}`}>
                                {icon}
                            </div>
                            <div>
                                <h3 className="text-white font-medium">{asset.name || asset.username}</h3>
                                <p className="text-xs text-zinc-500">ID: {asset.id}</p>
                            </div>
                        </div>

                        <div className={`
                            w-6 h-6 rounded-full border flex items-center justify-center transition-colors
                            ${selectedIds.has(asset.id) ? 'bg-red-600 border-red-600' : 'border-zinc-700'}
                        `}>
                            {selectedIds.has(asset.id) && <Check className="w-4 h-4 text-white" />}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#09090b] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
                    <h2 className="text-xl font-bold text-white mb-1">{t('metaWizard.title')}</h2>
                    <p className="text-sm text-zinc-400">
                        {step === 'pages' && t('metaWizard.titlePages')}
                        {step === 'instagram' && t('metaWizard.titleIg')}
                        {step === 'whatsapp' && t('metaWizard.titleWa')}
                        {step === 'empty' && t('metaWizard.noAssets')}
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {renderStepContent()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {step === 'whatsapp' || !hasWa && step === 'instagram' || step === 'empty' ? t('metaWizard.finish') : t('common.next')}
                        {!isSaving && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MetaOnboardingWizard;
