/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--bg-dark)",
                foreground: "var(--text-primary)",
                accent: "var(--accent)",
                success: "var(--success)",
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            animation: {
                'spin-slow': 'spin 3s linear infinite',
                'fade-in': 'fadeIn 0.5s ease-out',
                'float': 'float 6s ease-in-out infinite',
                'float-delay': 'float 6s ease-in-out 2s infinite',
                'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
                'slide-up': 'slide-up 0.6s ease-out both',
                'slide-up-delay': 'slide-up 0.6s ease-out 0.15s both',
                'shimmer': 'shimmer 2s infinite',
                'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-12px)' },
                },
                'glow-pulse': {
                    '0%, 100%': { opacity: '0.3' },
                    '50%': { opacity: '0.6' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(24px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'pulse-ring': {
                    '0%, 100%': { transform: 'scale(0.95)', opacity: '0.5' },
                    '50%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            backdropBlur: {
                '3xl': '64px',
            },
        },
    },
    plugins: [],
}
