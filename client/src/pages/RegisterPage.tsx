import React from 'react';
import RegisterScreen from '../components/RegisterScreen';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { UserData } from '../lib/api';

const RegisterPage: React.FC = () => {
    const { completeAuthSession } = useAuth();
    const navigate = useNavigate();

    const handleVerified = (user: UserData, token: string) => {
        const result = completeAuthSession(user, token);
        sessionStorage.removeItem('suppressRedirectAfterLogin');
        const isAdmin = Boolean(result?.isAdmin || result?.user?.role === 'admin');
        if (isAdmin) {
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

    return (
        <RegisterScreen
            onVerified={handleVerified}
            onSwitchToLogin={() => navigate('/login')}
        />
    );
};

export default RegisterPage;
