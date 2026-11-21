import React, { createContext, useContext, useState, useEffect, type ReactNode, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import type { Quiz, UserData, AttemptData, BadgeDefinition, ChallengeData, Subject, SkillTrack } from '../lib/api';
import { useAuth } from './AuthContext';

interface PlatformStatsMeta {
    totalAttempts?: number;
    totalUsers?: number;
    avgScore?: number;
    avgPercentage?: number;
}

interface DataContextType {
    availableQuizzes: Quiz[];
    allUsers: UserData[];
    allAttempts: AttemptData[];
    allBadges: BadgeDefinition[];
    challenges: ChallengeData[];
    subjects: Subject[];
    skillTracks: SkillTrack[];
    platformStats: PlatformStatsMeta | null;
    loadingData: boolean;
    loadingQuizzes: boolean;
    refreshData: () => Promise<void>;
    userWithRank: UserData | null;
}

const globalDataStore = globalThis as { __quizDataContext?: React.Context<DataContextType | undefined> };
const DataContext = import.meta.env.DEV
    ? (globalDataStore.__quizDataContext ??= createContext<DataContextType | undefined>(undefined))
    : createContext<DataContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser, isAdmin } = useAuth();
    const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    const [allAttempts, setAllAttempts] = useState<AttemptData[]>([]);
    const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
    const [challenges, setChallenges] = useState<ChallengeData[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [skillTracks, setSkillTracks] = useState<SkillTrack[]>([]);
    const [platformStats, setPlatformStats] = useState<PlatformStatsMeta | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);

    // Load Foundation Data (Available for all users, including guests)
    useEffect(() => {
        const loadPublicData = async () => {
            setLoadingQuizzes(true);
            try {
                const canSeeHiddenQuizzes = isAdmin || currentUser?.role === 'teacher';
                const [quizzesRes, subjectsRes, tracksRes, leaderboardRes] = await Promise.allSettled([
                    canSeeHiddenQuizzes ? api.getQuizzes(undefined, true) : api.getQuizzes(),
                    api.getSubjects(),
                    api.getSkillTracks(),
                    api.getLeaderboard()
                ]);

                if (quizzesRes.status === 'fulfilled' && Array.isArray(quizzesRes.value)) {
                    setAvailableQuizzes(quizzesRes.value);
                }
                if (subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value)) {
                    setSubjects(subjectsRes.value);
                }
                if (tracksRes.status === 'fulfilled' && Array.isArray(tracksRes.value)) {
                    setSkillTracks(tracksRes.value);
                }
                if (leaderboardRes.status === 'fulfilled' && Array.isArray(leaderboardRes.value)) {
                    const isDemoViewer = currentUser?.userId === 'demo_student' || currentUser?.userId === 'demo_teacher';
                    const filteredLb = isDemoViewer
                        ? leaderboardRes.value
                        : leaderboardRes.value.filter(
                              (u: UserData) => u.userId !== 'demo_student' && u.userId !== 'demo_teacher'
                          );
                    setAllUsers(prev => (prev.length > 0 ? prev : filteredLb));
                }
            } catch (error) {
                console.error('[DataContext] Failed to load foundation data:', error);
            } finally {
                setLoadingQuizzes(false);
            }
        };

        loadPublicData();
    }, [isAdmin, currentUser?.role, currentUser?.userId]);

    // Load User Data (Authenticated)
    const refreshData = useCallback(async () => {
        const uid = currentUser?.userId;
        if (!uid) return;
        setLoadingData(true);
        try {
            if (isAdmin) {
                // Admin fetches everything
                const { users, attempts, badges, subjects: adminSubjects, meta } = await api.getData(uid);

                // Admins also need quizzes and skill tracks
                try {
                    const [freshQuizzes, sTracks] = await Promise.all([
                        api.getQuizzes(undefined, true),
                        api.getSkillTracks()
                    ]);
                    if (Array.isArray(freshQuizzes)) setAvailableQuizzes(freshQuizzes);
                    setSkillTracks(sTracks || []);
                } catch (e) {
                    console.error('Failed to load admin extra data:', e);
                }

                const isDemoViewer = uid === 'demo_student' || uid === 'demo_teacher';
                const cleanUsers = (users || []).filter(
                    (u: UserData) => isDemoViewer || (u.userId !== 'demo_student' && u.userId !== 'demo_teacher')
                );
                setAllUsers(cleanUsers);
                setAllAttempts(attempts || []);
                setAllBadges(badges || []);
                setSubjects(adminSubjects || []);
                setPlatformStats(meta || null);
                setChallenges([]);
            } else {
                // Regular user fetches optimized set
                const { attempts, badges, users, challenges: userChallenges } = await api.getUserData(uid);

                // Also fetch quizzes, skill tracks, and subjects for regular users
                try {
                    const [freshQuizzes, tracksRes, subjectsRes] = await Promise.all([
                        api.getQuizzes(undefined, currentUser?.role === 'teacher' ? true : undefined),
                        api.getSkillTracks(),
                        api.getSubjects()
                    ]);
                    if (Array.isArray(freshQuizzes)) setAvailableQuizzes(freshQuizzes);
                    setSkillTracks(tracksRes || []);
                    setSubjects(subjectsRes || []);
                } catch (e) {
                    console.error('Failed to load user extra data:', e);
                }

                const isDemoViewer = uid === 'demo_student' || uid === 'demo_teacher';
                const cleanUsers = (users || []).filter(
                    (u: UserData) => isDemoViewer || (u.userId !== 'demo_student' && u.userId !== 'demo_teacher')
                );
                setAllUsers(cleanUsers);
                setAllAttempts(attempts || []);
                setAllBadges(badges || []);
                setChallenges(userChallenges || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoadingData(false);
        }
    }, [currentUser?.userId, currentUser?.role, isAdmin]);

    useEffect(() => {
        if (currentUser?.userId) {
            refreshData();
        } else {
            // Clear data on logout
            setAllUsers([]);
            setAllAttempts([]);
            setChallenges([]);
            setSubjects([]);
            setPlatformStats(null);
        }
    }, [currentUser?.userId, isAdmin, refreshData]);

    const userWithRank = useMemo(() => {
        if (!currentUser) return null;
        if (currentUser.rank) return currentUser;
        if (allUsers.length === 0) return currentUser;

        const sortedUsers = [...allUsers].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        const rank = sortedUsers.findIndex((u: UserData) => u.userId === currentUser.userId) + 1;
        return { ...currentUser, rank: rank > 0 ? rank : undefined };
    }, [currentUser, allUsers]);

    return (
        <DataContext.Provider value={{
            availableQuizzes,
            allUsers,
            allAttempts,
            allBadges,
            challenges,
            subjects,
            skillTracks,
            platformStats,
            loadingData,
            loadingQuizzes,
            refreshData,
            userWithRank
        }}>
            {children}
        </DataContext.Provider>
    );
};
