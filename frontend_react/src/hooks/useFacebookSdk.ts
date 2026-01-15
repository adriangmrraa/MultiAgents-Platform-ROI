import { useState, useEffect } from 'react';

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export const useFacebookSdk = () => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        console.log("Variables cargadas:", import.meta.env); // DEBUG: User requested

        const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
        if (!appId) {
            console.error("[Meta SDK] CRITICAL: VITE_FACEBOOK_APP_ID missing in environment");
            return;
        }

        const initParams = {
            appId: appId,
            cookie: true,
            xfbml: true,
            version: import.meta.env.VITE_FACEBOOK_API_VERSION || 'v20.0'
        };

        // 1. If already loaded, Force Init to ensure it's configured
        if (window.FB) {
            console.log("[Meta SDK] FB Object found, forcing init...");
            try {
                window.FB.init(initParams);
                setIsReady(true);
            } catch (err) {
                console.error("[Meta SDK] Force Init Failed:", err);
                setIsReady(true); // Fallback even if init fails
            }
            return;
        }

        // 2. Define the OFFICIAL callback
        window.fbAsyncInit = function () {
            console.log("[Meta SDK] Async Hook Triggered. Initializing...");
            try {
                window.FB.init(initParams);
            } catch (err) {
                console.error("[Meta SDK] Async Init Failed:", err);
            } finally {
                setIsReady(true);
            }
        };    // 4. Timeout Fallback (3s) - Force UI Unblock no matter what
        const timeoutId = setTimeout(() => {
            console.warn("[Meta SDK] 3s Timeout reached. Forcing 'Ready' state to unblock UI.");
            setIsReady(true);
        }, 3000);

        // 3. Load the script
        const scriptId = 'facebook-jssdk';
        if (document.getElementById(scriptId)) return;

        const js = document.createElement('script');
        js.id = scriptId;
        js.src = "https://connect.facebook.net/es_LA/sdk.js";
        js.onerror = () => {
            console.error("[Meta SDK] Script Failed to Load (Network blocked?)");
            setIsReady(true);
        };

        const fjs = document.getElementsByTagName('script')[0];
        if (fjs && fjs.parentNode) {
            fjs.parentNode.insertBefore(js, fjs);
        } else {
            document.head.appendChild(js);
        }

        return () => clearTimeout(timeoutId);
    }, []); // Runs once on mount

    return isReady;
};
