/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import type { Clan, ClassSummary } from '../types';
import type { TeacherSectionId } from '../components/teacher/teacherTheme';

interface TeacherWorkspaceContextType {
    activeSection: TeacherSectionId;
    setActiveSection: React.Dispatch<React.SetStateAction<TeacherSectionId>>;
    navigateToSection: (section: TeacherSectionId, preferredClassId?: string) => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    mobileDrawerOpen: boolean;
    setMobileDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
    myClasses: ClassSummary[];
    setMyClasses: React.Dispatch<React.SetStateAction<ClassSummary[]>>;
    loadingClasses: boolean;
    selectedClassId: string;
    setSelectedClassId: React.Dispatch<React.SetStateAction<string>>;
    activeClan: Clan | null;
    setActiveClan: React.Dispatch<React.SetStateAction<Clan | null>>;
    loadingActiveClan: boolean;
    loadMyClasses: (preferredId?: string) => Promise<void>;
    loadActiveClan: (clanId: string, forceRefresh?: boolean) => Promise<void>;
}

const globalTeacherWorkspaceStore = globalThis as { __quizTeacherWorkspaceContext?: React.Context<TeacherWorkspaceContextType | undefined> };
const TeacherWorkspaceContext = import.meta.env.DEV
    ? (globalTeacherWorkspaceStore.__quizTeacherWorkspaceContext ??= createContext<TeacherWorkspaceContextType | undefined>(undefined))
    : createContext<TeacherWorkspaceContextType | undefined>(undefined);

export const useTeacherWorkspace = () => {
    const context = useContext(TeacherWorkspaceContext);
    if (!context) {
        throw new Error('useTeacherWorkspace must be used within a TeacherWorkspaceProvider');
    }
    return context;
};

export const TeacherWorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();

    const isTeacher = currentUser?.role === 'teacher';
    const userId = currentUser?.userId || '';
    const userClanId = currentUser?.clanId || '';

    const [activeSection, setActiveSection] = useState<TeacherSectionId>('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    const [myClasses, setMyClasses] = useState<ClassSummary[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [activeClan, setActiveClan] = useState<Clan | null>(null);
    const [loadingActiveClan, setLoadingActiveClan] = useState(false);

    const loadMyClasses = useCallback(async (preferredId?: string) => {
        if (!isTeacher || !userId) {
            setMyClasses([]);
            setSelectedClassId('');
            return;
        }
        setLoadingClasses(true);
        try {
            const list = await api.getMyClasses(userId);
            const classes = Array.isArray(list) ? list : [];
            setMyClasses(classes);
            setSelectedClassId(prev => {
                const targetId = preferredId || prev || userClanId || classes[0]?.clanId || '';
                if (targetId && classes.some(c => c.clanId === targetId)) {
                    return targetId;
                }
                return classes[0]?.clanId || '';
            });
        } catch (err) {
            console.error('Failed to load teacher classes:', err);
        } finally {
            setLoadingClasses(false);
        }
    }, [isTeacher, userId, userClanId]);

    const loadActiveClan = useCallback(async (clanId: string, forceRefresh = false) => {
        if (!isTeacher || !userId || !clanId) {
            setActiveClan(null);
            return;
        }
        setLoadingActiveClan(true);
        try {
            const data = await api.getClan(clanId, userId, forceRefresh);
            setActiveClan(data);
        } catch (err) {
            showNotification('error', err instanceof Error ? err.message : 'Failed to load class details');
        } finally {
            setLoadingActiveClan(false);
        }
    }, [isTeacher, userId, showNotification]);

    useEffect(() => {
        if (isTeacher && userId) {
            loadMyClasses();
        } else {
            setMyClasses([]);
            setSelectedClassId('');
            setActiveClan(null);
        }
    }, [isTeacher, userId, loadMyClasses]);

    useEffect(() => {
        if (isTeacher && selectedClassId) {
            loadActiveClan(selectedClassId);
        }
    }, [isTeacher, selectedClassId, loadActiveClan]);

    const navigateToSection = useCallback((section: TeacherSectionId, preferredClassId?: string) => {
        if (preferredClassId) {
            setSelectedClassId(preferredClassId);
        }
        setActiveSection(section);
        setMobileDrawerOpen(false);
        const onDashboard = location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/teacher';
        if (!onDashboard) {
            navigate('/');
        }
    }, [location.pathname, navigate]);

    return (
        <TeacherWorkspaceContext.Provider
            value={{
                activeSection,
                setActiveSection,
                navigateToSection,
                sidebarCollapsed,
                setSidebarCollapsed,
                mobileDrawerOpen,
                setMobileDrawerOpen,
                myClasses,
                setMyClasses,
                loadingClasses,
                selectedClassId,
                setSelectedClassId,
                activeClan,
                setActiveClan,
                loadingActiveClan,
                loadMyClasses,
                loadActiveClan
            }}
        >
            {children}
        </TeacherWorkspaceContext.Provider>
    );
};
