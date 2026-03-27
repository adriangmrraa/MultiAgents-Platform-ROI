import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    size?: 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg' }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center lg:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`relative w-full ${sizeClasses[size]} bg-[#0a0a0f] border-t lg:border border-white/10 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] lg:max-h-[90vh] animate-scale-up`}
                style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 80px rgba(124, 58, 237, 0.08)' }}>
                {/* Glow */}
                <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 lg:px-6 lg:py-5 border-b border-white/10 shrink-0">
                    <h2 className="text-lg lg:text-xl font-black text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-all active:bg-white/20"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="px-5 py-4 lg:px-6 lg:py-5 overflow-y-auto overscroll-contain custom-scrollbar safe-bottom">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
