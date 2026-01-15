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
        // 1. If already initialized, mark as ready and exit
        if (window.FB) {
            setIsReady(true);
            return;
        }

        // 2. Define the OFFICIAL callback that the SDK looks for when loading
        window.fbAsyncInit = function () {
            window.FB.init({
                appId: import.meta.env.VITE_FACEBOOK_APP_ID,
                cookie: true,
                xfbml: true,
                version: import.meta.env.VITE_FACEBOOK_API_VERSION || 'v20.0'
            });
            console.log("[Meta SDK] Initialized correctly via hook");
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
