import React from 'react';
import RegisterScreen from '../components/RegisterScreen';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (name: string, email: string, password: string) => {
        const result = await register(name, email, password);
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
            onRegister={handleRegister}
            onSwitchToLogin={() => navigate('/login')}
        />
    );
};

export default RegisterPage;
