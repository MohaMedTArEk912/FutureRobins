import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ClassHub } from '../components/social/ClassHub';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { AmbientBackground } from '../components/AmbientBackground';
import { useTheme } from '../context/ThemeContext';
import { usePersistentShell } from '../context/PersistentShellContext';

const ClassPage: React.FC = () => {
    const { currentUser, refreshUser, logout, isLoading } = useAuth();
    const { isBento } = useTheme();
    const { inPersistentShell } = usePersistentShell();
    const navigate = useNavigate();

    if (isLoading || !currentUser) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-transparent">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (inPersistentShell) {
        return (
            <main className="flex-1 relative w-full max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 md:pt-12 pb-16 xl:pb-12">
                <ClassHub user={currentUser} onUpdateUser={refreshUser} />
            </main>
        );
    }

    return (
        <div className={`min-h-dvh flex flex-col justify-between ${isBento ? 'bg-transparent text-black' : 'bg-slate-50 dark:bg-[#0a0908] text-gray-900 dark:text-white'} selection:bg-sky-500/30`}>
            {!isBento && <AmbientBackground />}
            <Navbar
                user={currentUser}
                onViewProfile={() => navigate('/profile')}
                onViewLeaderboard={() => navigate('/leaderboard')}
                onLogout={logout}
                showActions={true}
            />
            <main className="flex-1 relative w-full max-w-7xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 md:pt-12 pb-24 xl:pb-12">
                <ClassHub user={currentUser} onUpdateUser={refreshUser} />
            </main>
            <Footer />
        </div>
    );
};

export default ClassPage;
