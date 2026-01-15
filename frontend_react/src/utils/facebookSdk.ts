export const initFacebookSdk = (): Promise<any> => {
    return new Promise((resolve, reject) => {
        const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
        if (!appId) {
            console.error("Missing VITE_FACEBOOK_APP_ID in .env");
            reject(new Error("Facebook App ID not configured"));
            return;
        }

        const initParams = {
            appId: appId,
            cookie: true,
            xfbml: true,
            version: import.meta.env.VITE_FACEBOOK_API_VERSION || 'v20.0'
        };

        console.log("Initializing FB SDK with:", { ...initParams, appId: 'MASKED' });

        // Case 1: SDK already loaded
        if ((window as any).FB) {
            (window as any).FB.init(initParams);
            resolve((window as any).FB);
            return;
        }

        // Case 2: Wait for Async Init
        (window as any).fbAsyncInit = function () {
            (window as any).FB.init(initParams);
            console.log("Facebook SDK Initialized (Async)");
            resolve((window as any).FB);
        };

        // Inyección del Script (es_LA para Latinoamérica)
        if (!document.getElementById('facebook-jssdk')) {
            const js = document.createElement('script');
            js.id = 'facebook-jssdk';
            js.src = "https://connect.facebook.net/es_LA/sdk.js";
            js.onerror = (error: any) => reject(error);
            const fjs = document.getElementsByTagName('script')[0];
            if (fjs && fjs.parentNode) {
                fjs.parentNode.insertBefore(js, fjs);
            } else {
                document.head.appendChild(js);
            }
        }
    });
};
