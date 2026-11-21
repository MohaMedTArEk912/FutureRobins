import React from 'react';
import Leaderboard from '../components/Leaderboard';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { GUEST_USER } from '../constants/appDefaults';
import { navigateBackSafely } from '../lib/navigation';

const LeaderboardPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { allUsers, userWithRank } = useData();
    const navigate = useNavigate();

    const handleBack = () => {
        navigateBackSafely(navigate, '/');
    };

    return (
        <Leaderboard
            users={allUsers}
            currentUser={userWithRank || currentUser || GUEST_USER}
            onBack={handleBack}
        />
    );
};


export default LeaderboardPage;
