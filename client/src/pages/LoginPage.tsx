import React, { useEffect } from 'react';
import LoginScreen from '../components/LoginScreen';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/ConfirmDialog';

const LoginPage: React.FC = () => {
    const { currentUser, isAdmin: authIsAdmin, login, googleLogin } = useAuth();
    const navigate = useNavigate();
    const { confirm, confirmState, handleCancel } = useConfirm();

    // If user is already authenticated and visits /login, redirect directly based on role
    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'admin' || authIsAdmin) {
                navigate('/admin', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }
    }, [currentUser, authIsAdmin, navigate]);

    // Check for Google auth data in session or local storage (in case popup closed or redirected)
    useEffect(() => {
        const checkGoogleAuth = async () => {
            const googleAuthData =
                sessionStorage.getItem('googleAuthData') ||
                localStorage.getItem('googleAuthData');
            if (googleAuthData) {
                try {
                    const { email, name, sub } = JSON.parse(googleAuthData);
                    sessionStorage.removeItem('googleAuthData');
                    localStorage.removeItem('googleAuthData');
                    localStorage.removeItem('quiz_google_auth_event');
                    const result = await googleLogin({ email, name, googleId: sub });
                    sessionStorage.removeItem('suppressRedirectAfterLogin');

                    const isAdminUser = Boolean(result?.isAdmin || result?.user?.role === 'admin');

                    // Admin MUST open directly to the Admin Console (/admin), NOT student view
                    if (isAdminUser) {
                        sessionStorage.removeItem('redirectAfterLogin');
                        navigate('/admin', { replace: true });
                        return;
                    }

                    const redirect = sessionStorage.getItem('redirectAfterLogin');
                    if (redirect) {
                        sessionStorage.removeItem('redirectAfterLogin');
                        navigate(redirect, { replace: true });
                    } else {
                        navigate('/', { replace: true });
                    }
                } catch (error) {
                    console.error('Error processing stored Google auth:', error);
                }
            }
        };
        checkGoogleAuth();
    }, [googleLogin, navigate]);

    const handleLogin = async (email: string, password: string) => {
        const result = await login(email, password);
        sessionStorage.removeItem('suppressRedirectAfterLogin');

        const isAdminUser = Boolean(result?.isAdmin || result?.user?.role === 'admin');

        // Admin MUST open directly to the Admin Console (/admin), NOT student view
        if (isAdminUser) {
            sessionStorage.removeItem('redirectAfterLogin');
            navigate('/admin', { replace: true });
            return;
        }

        const redirect = sessionStorage.getItem('redirectAfterLogin');
        if (redirect) {
            sessionStorage.removeItem('redirectAfterLogin');
            navigate(redirect, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    };

    const handleGoogleSignIn = () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId) {
            confirm({
                title: 'Configuration Error',
                message: 'Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.',
                confirmText: 'OK',
                type: 'warning',
                cancelText: 'Close'
            });
            console.error('VITE_GOOGLE_CLIENT_ID is not set');
            return;
        }

        const redirectUri = `${window.location.origin}/auth/google/callback.html`;

        const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
            new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'token',
                scope: 'email profile',
                prompt: 'select_account'
            });

        const googleWindow = window.open(
            googleAuthUrl,
            'Google Sign In',
            'width=500,height=600,scrollbars=yes'
        );

        if (!googleWindow) {
            // Fallback to same-tab redirect when popups are blocked (e.g., embedded webviews)
            window.location.assign(googleAuthUrl);
            return;
        }

        let authHandled = false;
        let bc: BroadcastChannel | null = null;

        const cleanupListeners = () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
            try {
                bc?.close();
            } catch {
                // ignore
            }
            try {
                googleWindow?.close();
            } catch {
                // Silently handle COOP policy errors - popup will close itself
            }
        };

        const processPayload = async (data: {
            type?: string;
            profile?: { email: string; name: string; sub: string };
            error?: string;
        }) => {
            if (!data || authHandled) return;
            if (data.type === 'GOOGLE_AUTH_SUCCESS' && data.profile) {
                authHandled = true;
                sessionStorage.removeItem('googleAuthData');
                localStorage.removeItem('googleAuthData');
                localStorage.removeItem('quiz_google_auth_event');
                cleanupListeners();
                try {
                    const { email, name, sub } = data.profile;
                    const result = await googleLogin({ email, name, googleId: sub });
                    sessionStorage.removeItem('suppressRedirectAfterLogin');

                    const isAdminUser = Boolean(result?.isAdmin || result?.user?.role === 'admin');
                    if (isAdminUser) {
                        sessionStorage.removeItem('redirectAfterLogin');
                        navigate('/admin', { replace: true });
                        return;
                    }

                    const redirect = sessionStorage.getItem('redirectAfterLogin');
                    if (redirect) {
                        sessionStorage.removeItem('redirectAfterLogin');
                        navigate(redirect, { replace: true });
                    } else {
                        navigate('/', { replace: true });
                    }
                } catch (error) {
                    console.error('Google login error:', error);
                    confirm({
                        title: 'Login Failed',
                        message: 'Failed to sign in with Google. Please try again.',
                        confirmText: 'OK',
                        type: 'danger',
                        cancelText: 'Close'
                    });
                }
            } else if (data.type === 'GOOGLE_AUTH_ERROR') {
                authHandled = true;
                localStorage.removeItem('quiz_google_auth_event');
                cleanupListeners();
                console.error('Google auth error:', data.error);
                confirm({
                    title: 'Login Error',
                    message: `Google Sign-In failed: ${data.error}`,
                    confirmText: 'OK',
                    type: 'danger',
                    cancelText: 'Close'
                });
            }
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            void processPayload(event.data);
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'quiz_google_auth_event' && event.newValue) {
                try {
                    const parsed = JSON.parse(event.newValue);
                    void processPayload(parsed);
                } catch {
                    // ignore malformed storage payload
                }
            }
        };

        try {
            if (typeof BroadcastChannel !== 'undefined') {
                bc = new BroadcastChannel('quiz_google_auth');
                bc.onmessage = (event) => {
                    void processPayload(event.data);
                };
            }
        } catch {
            // ignore if BroadcastChannel is unsupported
        }

        window.addEventListener('message', handleMessage);
        window.addEventListener('storage', handleStorage);

        // Fallback cleanup after 5 minutes
        setTimeout(() => {
            if (!authHandled) {
                window.removeEventListener('message', handleMessage);
                window.removeEventListener('storage', handleStorage);
                try {
                    bc?.close();
                } catch {
                    // ignore
                }
            }
        }, 300000);
    };

    return (
        <>
            <LoginScreen
                onLogin={handleLogin}
                onSwitchToRegister={() => navigate('/register')}
                onSwitchToForgotPassword={() => navigate('/forgot-password')}
                onGoogleSignIn={handleGoogleSignIn}
            />
            <ConfirmDialog
                {...confirmState}
                onCancel={handleCancel}
            // Hide cancel button if it's just an alert-style message
            // The customization relies on confirmState defaults or specific calls
            />
        </>
    );
};

export default LoginPage;
