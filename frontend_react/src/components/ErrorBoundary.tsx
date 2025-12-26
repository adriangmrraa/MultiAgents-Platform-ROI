import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    height: '100vh',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
                        {/* Fallback icon if lucide fails */}
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Nexus System Failure</h1>
                    <div style={{
                        backgroundColor: '#1e293b',
                        padding: '1.5rem',
                        borderRadius: '0.5rem',
                        maxWidth: '800px',
                        width: '100%',
                        overflow: 'auto',
                        border: '1px solid #334155'
                    }}>
                        <h2 style={{ color: '#f87171', marginTop: 0 }}>{this.state.error?.name}: {this.state.error?.message}</h2>
                        <pre style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                            {this.state.errorInfo?.componentStack || this.state.error?.stack}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
