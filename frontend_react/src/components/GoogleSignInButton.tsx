import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

interface GoogleSignInButtonProps {
    onCredential: (credential: string) => void;
    disabled?: boolean;
    text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleSignInButton({ onCredential, disabled, text = 'continue_with' }: GoogleSignInButtonProps) {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [manualMode, setManualMode] = useState(false);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return;

        // Load GSI script if not already loaded
        if (!(window as any).google?.accounts?.id) {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => setScriptLoaded(true);
            document.head.appendChild(script);
        } else {
            setScriptLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!scriptLoaded || !GOOGLE_CLIENT_ID || !buttonRef.current) return;

        const google = (window as any).google;
        if (!google?.accounts?.id) return;

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
                if (response.credential) {
                    onCredential(response.credential);
                }
            },
        });

        google.accounts.id.renderButton(buttonRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: buttonRef.current.offsetWidth,
            text,
            shape: 'pill',
        });
    }, [scriptLoaded, onCredential, text]);

    if (!GOOGLE_CLIENT_ID) return null;

    // Fallback manual button if GSI script fails to render
    if (manualMode) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    const google = (window as any).google;
                    if (google?.accounts?.id) {
                        google.accounts.id.prompt();
                    }
                }}
                className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-medium transition-all disabled:opacity-50"
            >
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
            </button>
        );
    }

    return (
        <div>
            <div ref={buttonRef} className="w-full [&>div]:!w-full" />
            {scriptLoaded && (
                <div className="hidden">
                    {/* Trigger manual mode if GSI button doesn't render after 2s */}
                    <img src="" onError={() => setTimeout(() => setManualMode(true), 2000)} />
                </div>
            )}
        </div>
    );
}
