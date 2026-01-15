import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, type Language } from '../constants/locales';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string, params?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('nexus_lang');
        return (saved as Language) || 'es';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('nexus_lang', lang);
        document.documentElement.lang = lang;
    };

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = (path: string, params?: Record<string, any>): string => {
        const keys = path.split('.');
        let result: any = translations[language];

        // Safety: If language not found, fallback to Spanish
        if (!result) {
            result = translations['es'];
        }

        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                // Emergency Fallback: Humanize the key
                const lastPart = keys[keys.length - 1];
                return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/([A-Z])/g, ' $1').trim();
            }
        }

        if (typeof result === 'string') {
            if (params) {
                Object.entries(params).forEach(([key, value]) => {
                    result = (result as string).replace(`{{${key}}}`, String(value));
                });
            }
            return result;
        }

        // If result found is NOT a string (it's an object), humanize the path
        const fallbackValue = keys[keys.length - 1];
        return fallbackValue.charAt(0).toUpperCase() + fallbackValue.slice(1).replace(/([A-Z])/g, ' $1').trim();
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
