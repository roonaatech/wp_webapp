import React from 'react';

/**
 * Global React Error Boundary Component
 * Catches any unhandled runtime rendering errors, preventing mobile browsers from loading a blank white page.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught unhandled React error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/my-requests';
    };

    handleClearAndLogin = () => {
        try {
            // Keep device id if present so attendance fingerprint remains stable
            const deviceId = localStorage.getItem('wp_device_id');
            localStorage.clear();
            if (deviceId) {
                localStorage.setItem('wp_device_id', deviceId);
            }
        } catch (_) {}
        window.location.href = '/login';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    padding: '20px',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                    <div style={{
                        maxWidth: '440px',
                        width: '100%',
                        background: '#ffffff',
                        borderRadius: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        padding: '36px 28px',
                        textAlign: 'center',
                        border: '1px solid #e2e8f0'
                    }}>
                        {/* WorkPulse Icon */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '20px',
                            background: '#eff6ff',
                            border: '2px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                            color: '#2563eb'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>

                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
                            Something went wrong
                        </h2>
                        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', marginBottom: '16px' }}>
                            We encountered an issue while loading this page. Please try refreshing or returning to the portal.
                        </p>

                        {this.state.error && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '12px 14px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                textAlign: 'left',
                                maxHeight: '160px',
                                overflowY: 'auto'
                            }}>
                                <p style={{
                                    color: '#b91c1c',
                                    fontSize: '12px',
                                    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontWeight: '600',
                                    margin: '0 0 4px 0',
                                    wordBreak: 'break-word'
                                }}>
                                    {this.state.error.name}: {this.state.error.message}
                                </p>
                                {this.state.error.stack && (
                                    <pre style={{
                                        color: '#7f1d1d',
                                        fontSize: '10px',
                                        fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        opacity: 0.8
                                    }}>
                                        {this.state.error.stack.split('\n').slice(0, 4).join('\n')}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    width: '100%',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                                }}
                            >
                                Reload Page
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                style={{
                                    width: '100%',
                                    padding: '12px 20px',
                                    borderRadius: '12px',
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    border: '1px solid #cbd5e1',
                                    cursor: 'pointer'
                                }}
                            >
                                Go to My Requests
                            </button>

                            <button
                                onClick={this.handleClearAndLogin}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    marginTop: '8px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Clear session & sign in again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
