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
            window.FB.init(initParams);
            setIsReady(true);
            return;
        }

        // 2. Define the OFFICIAL callback
        window.fbAsyncInit = function () {
            console.log("[Meta SDK] Async Hook Triggered. Initializing with:", { ...initParams, appId: 'MASKED' });
            window.FB.init(initParams);
            setIsReady(true);
        };

        // 3. Load the script ONLY after defining fbAsyncInit
        // Using distinct ID to avoid duplicate scripts
        const scriptId = 'facebook-jssdk';
        if (document.getElementById(scriptId)) return;

        const js = document.createElement('script');
        js.id = scriptId;
        js.src = "https://connect.facebook.net/es_LA/sdk.js";

        const fjs = document.getElementsByTagName('script')[0];
        if (fjs && fjs.parentNode) {
            fjs.parentNode.insertBefore(js, fjs);
        } else {
            document.head.appendChild(js);
        }

    }, []); // Runs once on mount

    return isReady;
};
