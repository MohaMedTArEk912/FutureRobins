import React, { useState, useEffect, useMemo } from 'react';
import {
    Edit2, Trash2, Users, Eye, EyeOff, Search, BarChart3, Mail, Trophy, Calendar,
    Map as MapIcon, Lock, Unlock, CheckCircle, Gift, ChevronDown, ChevronRight, Route,
    CheckSquare, Square, Layers, ListChecks, Sparkles, RotateCcw, ExternalLink, Clock
} from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmDialog from '../ConfirmDialog';
import Avatar from '../Avatar.tsx';
import type { UserData, AttemptData, SkillTrack, SkillModule, Quiz, ShopItem, Subject } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useUserProfileModal } from '../../context/UserProfileModalContext';

type EditableUser = UserData & { password?: string };

interface UserManagementProps {
    users: UserData[];
    attempts: AttemptData[];
    currentUser: UserData;
    onRefresh: () => void | Promise<void>;
    onNotification: (type: 'success' | 'error', message: string) => void;
}

const ManageUserTracksModal: React.FC<{
    user: UserData;
    currentUser: UserData;
    onClose: () => void;
    onNotification: (type: 'success' | 'error', message: string) => void;
    onRefresh: () => void | Promise<void>;
}> = ({ user, currentUser, onClose, onNotification, onRefresh }) => {
    const { isBento } = useTheme();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [unlockedTracks, setUnlockedTracks] = useState<string[]>([]);
    const [primaryTrackId, setPrimaryTrackId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const subs = await api.getAllSubjects(currentUser.userId);
                setSubjects(Array.isArray(subs) ? subs : []);
                setUnlockedTracks((user.unlockedTracks || []).map(t => t.toString()));
                setPrimaryTrackId(user.primaryTrackId?.toString() || '');
            } catch (err) {
                console.error(err);
                onNotification('error', 'Failed to load tracks');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [currentUser.userId, user, onNotification]);

    const toggleTrack = (subjectId: string) => {
        setUnlockedTracks(prev => {
            const exists = prev.includes(subjectId);
            if (exists) {
                const next = prev.filter(id => id !== subjectId);
                if (primaryTrackId === subjectId) {
                    setPrimaryTrackId(next[0] || '');
                }
                return next;
            } else {
                const next = [...prev, subjectId];
                if (!primaryTrackId) {
                    setPrimaryTrackId(subjectId);
                }
                return next;
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.updateUserUnlockedTracks(user.userId, unlockedTracks, primaryTrackId, currentUser.userId);
            if (res.success) {
                onNotification('success', `Track access updated for ${user.name || user.userId}`);
                await Promise.resolve(onRefresh());
                onClose();
            }
        } catch (err) {
            console.error(err);
            onNotification('error', 'Failed to update track access');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Manage Track Permissions"
            description={`Configure accessible learning roads for ${user.name || user.userId}`}
            maxWidth="max-w-xl"
            icon={<Route className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            footer={
                <>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] font-mono'
                                : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex-[2] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] active:scale-95'
                        }`}
                    >
                        {saving ? 'Saving...' : 'Save Permissions'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <p className={`text-xs font-medium ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                    Checked roads are unlocked and accessible for this student. Unchecked roads will appear blurred and locked.
                </p>

                {loading ? (
                    <div className="py-8 text-center text-xs text-[#a8a29e]">Loading tracks...</div>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {subjects.map(subject => {
                            const isChecked = unlockedTracks.includes(subject._id);
                            const isPrimary = primaryTrackId === subject._id;

                            return (
                                <div
                                    key={subject._id}
                                    onClick={() => toggleTrack(subject._id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                        isChecked
                                            ? isBento
                                                ? 'bg-[#bef264]/35 border-2 border-black text-black'
                                                : 'bg-[#1c2317] border-[#bef264]/45 text-[#f5f3ec]'
                                            : isBento
                                                ? 'bg-[#f5f3ec] border-2 border-black/30 text-black/65'
                                                : 'bg-[#1a1714] border-[#2e2924] text-[#a8a29e] opacity-70'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2.5 rounded-xl ${
                                            isChecked
                                                ? isBento ? 'bg-black text-[#bef264]' : 'bg-[#bef264] text-[#0a0908]'
                                                : isBento ? 'bg-white border border-black/30 text-black/60' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#78716c]'
                                        }`}>
                                            <Route className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-black uppercase tracking-tight truncate flex items-center gap-2">
                                                <span>{subject.title}</span>
                                                {isPrimary && (
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase ${
                                                        isBento
                                                            ? 'bg-[#fde047] text-black border border-black'
                                                            : 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35'
                                                    }`}>
                                                        Primary Track
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-[11px] font-mono truncate ${isBento ? 'text-neutral-600' : 'text-[#78716c]'}`}>{subject._id}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {isChecked && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPrimaryTrackId(subject._id);
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    isPrimary
                                                        ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#fde047] text-[#0a0908]'
                                                        : isBento ? 'bg-white text-black border border-black hover:bg-[#fde047]' : 'bg-[#141210] border border-[#2e2924] text-[#a8a29e] hover:text-[#fde047]'
                                                }`}
                                                title="Set as primary track"
                                            >
                                                {isPrimary ? '★ Primary' : 'Set Primary'}
                                            </button>
                                        )}
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                                            isChecked
                                                ? isBento ? 'bg-black border-black text-[#bef264]' : 'bg-[#bef264] border-[#bef264] text-[#0a0908]'
                                                : isBento ? 'border-black/40 bg-white' : 'border-[#3a332c]'
                                        }`}>
                                            {isChecked && <CheckCircle className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {subjects.length === 0 && (
                            <div className="py-8 text-center text-[#a8a29e] font-bold text-xs">
                                No tracks found
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

const RoadmapEditorModal: React.FC<{
    user: UserData;
    currentUser: UserData;
    onClose: () => void;
    onNotification: (type: 'success' | 'error', message: string) => void;
    onRefresh?: () => void | Promise<void>;
}> = ({ user, currentUser, onClose, onNotification, onRefresh }) => {
    const { isBento } = useTheme();
    const [tracks, setTracks] = useState<SkillTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<string>('');
    const [progress, setProgress] = useState<{ completedModules: string[], unlockedModules: string[] }>({ completedModules: [], unlockedModules: [] });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | 'all'>('all');
    const [quickLevelTarget, setQuickLevelTarget] = useState<number>(0);
    const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
    const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(new Set());

    useEffect(() => {
        api.getSkillTracks().then(setTracks).catch(console.error);
    }, []);

    const handleSelectTrack = (nextTrackId: string) => {
        setSelectedTrack(nextTrackId);
        setSelectedModuleIds(new Set());
        if (!nextTrackId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        api.getUserRoadmapProgress(user.userId, nextTrackId, currentUser.userId)
            .then(p => setProgress({ completedModules: p.completedModules || [], unlockedModules: p.unlockedModules || [] }))
            .catch(() => onNotification('error', 'Failed to load progress'))
            .finally(() => setLoading(false));
    };

    const track = useMemo(() => tracks.find(t => t.trackId === selectedTrack), [tracks, selectedTrack]);

    // Group modules by level (defaulting undefined to 0)
    const modulesByLevel = useMemo(() => {
        if (!track?.modules) return new Map<number, SkillModule[]>();
        const map = new Map<number, SkillModule[]>();
        track.modules.forEach(m => {
            const lvl = typeof m.level === 'number' ? m.level : 0;
            if (!map.has(lvl)) {
                map.set(lvl, []);
            }
            map.get(lvl)!.push(m);
        });
        return map;
    }, [track]);

    const sortedLevels = useMemo(() => {
        return Array.from(modulesByLevel.keys()).sort((a, b) => a - b);
    }, [modulesByLevel]);

    const activeQuickLevel = sortedLevels.length > 0 && !sortedLevels.includes(quickLevelTarget)
        ? sortedLevels[0]
        : quickLevelTarget;

    // Total counts
    const totalStats = useMemo(() => {
        if (!track?.modules) return { total: 0, unlocked: 0, completed: 0, locked: 0 };
        const total = track.modules.length;
        const completed = track.modules.filter(m => progress.completedModules.includes(m.moduleId)).length;
        const unlockedOnly = track.modules.filter(m => progress.unlockedModules.includes(m.moduleId) && !progress.completedModules.includes(m.moduleId)).length;
        const openTotal = completed + unlockedOnly;
        const locked = total - openTotal;
        return { total, unlocked: openTotal, completed, locked };
    }, [track, progress]);

    // 1. Open/Unlock all modules on a level
    const handleOpenLevel = (level: number) => {
        const mods = modulesByLevel.get(level) || [];
        const ids = mods.map(m => m.moduleId);
        if (ids.length === 0) return;

        setProgress(prev => {
            const nextUnlocked = new Set(prev.unlockedModules);
            ids.forEach(id => nextUnlocked.add(id));
            return {
                ...prev,
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `🔓 Opened all ${ids.length} modules on Level ${level} to ${user.name || 'user'}`);
    };

    // 2. Complete all modules on a level
    const handleCompleteLevel = (level: number) => {
        const mods = modulesByLevel.get(level) || [];
        const ids = mods.map(m => m.moduleId);
        if (ids.length === 0) return;

        setProgress(prev => {
            const nextCompleted = new Set(prev.completedModules);
            const nextUnlocked = new Set(prev.unlockedModules);
            ids.forEach(id => {
                nextCompleted.add(id);
                nextUnlocked.add(id);
            });
            return {
                completedModules: Array.from(nextCompleted),
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `✓ Completed all ${ids.length} modules on Level ${level}`);
    };

    // 3. Lock all modules on a level
    const handleLockLevel = (level: number) => {
        const mods = modulesByLevel.get(level) || [];
        const idSet = new Set(mods.map(m => m.moduleId));
        if (idSet.size === 0) return;

        setProgress(prev => ({
            completedModules: prev.completedModules.filter(id => !idSet.has(id)),
            unlockedModules: prev.unlockedModules.filter(id => !idSet.has(id))
        }));
        setSelectedModuleIds(prev => {
            const next = new Set(prev);
            idSet.forEach(id => next.delete(id));
            return next;
        });
        onNotification('success', `🔒 Locked all modules on Level ${level}`);
    };

    // 4. Toggle selection of all modules on a level
    const handleToggleSelectLevel = (level: number) => {
        const mods = modulesByLevel.get(level) || [];
        const ids = mods.map(m => m.moduleId);
        const allSelected = ids.length > 0 && ids.every(id => selectedModuleIds.has(id));

        setSelectedModuleIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                ids.forEach(id => next.delete(id));
            } else {
                ids.forEach(id => next.add(id));
            }
            return next;
        });
    };

    // 5. Open entire track (all levels)
    const handleOpenAllLevels = () => {
        if (!track?.modules) return;
        const allIds = track.modules.map(m => m.moduleId);
        setProgress(prev => {
            const nextUnlocked = new Set(prev.unlockedModules);
            allIds.forEach(id => nextUnlocked.add(id));
            return {
                ...prev,
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `🔓 Opened all ${allIds.length} modules across all levels to ${user.name || 'user'}`);
    };

    // 6. Complete entire track
    const handleCompleteAllLevels = () => {
        if (!track?.modules) return;
        const allIds = track.modules.map(m => m.moduleId);
        setProgress(prev => {
            const nextCompleted = new Set(prev.completedModules);
            const nextUnlocked = new Set(prev.unlockedModules);
            allIds.forEach(id => {
                nextCompleted.add(id);
                nextUnlocked.add(id);
            });
            return {
                completedModules: Array.from(nextCompleted),
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `✓ Completed all ${allIds.length} modules across all levels`);
    };

    // 7. Lock entire track
    const handleLockAllLevels = () => {
        setProgress({ completedModules: [], unlockedModules: [] });
        setSelectedModuleIds(new Set());
        onNotification('success', `🔒 Locked all modules in track`);
    };

    // 8. Bulk action on selected modules: Open
    const handleOpenSelected = () => {
        if (selectedModuleIds.size === 0) return;
        setProgress(prev => {
            const nextUnlocked = new Set(prev.unlockedModules);
            selectedModuleIds.forEach(id => nextUnlocked.add(id));
            return {
                ...prev,
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `🔓 Opened ${selectedModuleIds.size} selected modules to ${user.name || 'user'}`);
        setSelectedModuleIds(new Set());
    };

    // 9. Bulk action on selected modules: Complete
    const handleCompleteSelected = () => {
        if (selectedModuleIds.size === 0) return;
        setProgress(prev => {
            const nextCompleted = new Set(prev.completedModules);
            const nextUnlocked = new Set(prev.unlockedModules);
            selectedModuleIds.forEach(id => {
                nextCompleted.add(id);
                nextUnlocked.add(id);
            });
            return {
                completedModules: Array.from(nextCompleted),
                unlockedModules: Array.from(nextUnlocked)
            };
        });
        onNotification('success', `✓ Completed ${selectedModuleIds.size} selected modules`);
        setSelectedModuleIds(new Set());
    };

    // 10. Bulk action on selected modules: Lock
    const handleLockSelected = () => {
        if (selectedModuleIds.size === 0) return;
        setProgress(prev => ({
            completedModules: prev.completedModules.filter(id => !selectedModuleIds.has(id)),
            unlockedModules: prev.unlockedModules.filter(id => !selectedModuleIds.has(id))
        }));
        onNotification('success', `🔒 Locked ${selectedModuleIds.size} selected modules`);
        setSelectedModuleIds(new Set());
    };

    // Toggle single module selection checkbox
    const handleToggleSelectModule = (moduleId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedModuleIds(prev => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    };

    // Toggle Level Collapse
    const toggleCollapseLevel = (level: number) => {
        setCollapsedLevels(prev => {
            const next = new Set(prev);
            if (next.has(level)) {
                next.delete(level);
            } else {
                next.add(level);
            }
            return next;
        });
    };

    // Set individual module state directly
    const setModuleState = (moduleId: string, targetState: 'locked' | 'unlocked' | 'completed') => {
        let newCompleted = [...progress.completedModules];
        let newUnlocked = [...progress.unlockedModules];

        if (targetState === 'locked') {
            newCompleted = newCompleted.filter(id => id !== moduleId);
            newUnlocked = newUnlocked.filter(id => id !== moduleId);
        } else if (targetState === 'unlocked') {
            newCompleted = newCompleted.filter(id => id !== moduleId);
            if (!newUnlocked.includes(moduleId)) {
                newUnlocked.push(moduleId);
            }
        } else if (targetState === 'completed') {
            if (!newCompleted.includes(moduleId)) {
                newCompleted.push(moduleId);
            }
            if (!newUnlocked.includes(moduleId)) {
                newUnlocked.push(moduleId);
            }
        }

        setProgress({ completedModules: newCompleted, unlockedModules: newUnlocked });
    };

    // Cycle module state
    const toggleModule = (moduleId: string) => {
        const isCompleted = progress.completedModules.includes(moduleId);
        const isUnlocked = progress.unlockedModules.includes(moduleId);

        if (isCompleted) {
            setModuleState(moduleId, 'locked');
        } else if (isUnlocked) {
            setModuleState(moduleId, 'completed');
        } else {
            setModuleState(moduleId, 'unlocked');
        }
    };

    const handleSave = async () => {
        if (!selectedTrack) return;
        try {
            const allTracks = await api.getSkillTracks();
            const currentTrack = allTracks.find((t: SkillTrack) => t.trackId === selectedTrack);

            if (currentTrack) {
                const originalProgress = await api.getUserRoadmapProgress(user.userId, selectedTrack, currentUser.userId);
                const originalCompleted = new Set(originalProgress?.completedModules || []);
                const newCompleted = new Set(progress.completedModules);

                const newlyCompletedModules = Array.from(newCompleted).filter(moduleId => !originalCompleted.has(moduleId));

                if (newlyCompletedModules.length > 0) {
                    const quizzesToMark = currentTrack.modules
                        .filter((m: SkillModule) => newlyCompletedModules.includes(m.moduleId))
                        .flatMap((m: SkillModule) => m.quizIds || []);

                    if (quizzesToMark.length > 0) {
                        const allQuizzes = await api.getQuizzes();
                        const quizzesToMarkFull = allQuizzes.filter((q: Quiz) => quizzesToMark.includes(q.id || q._id || ''));

                        for (const quiz of quizzesToMarkFull) {
                            const quizId = quiz.id || quiz._id;

                            const attempt = {
                                attemptId: crypto.randomUUID(),
                                userId: user.userId,
                                userName: user.name || user.userId || 'User',
                                userEmail: user.email || '',
                                quizId: quizId,
                                quizTitle: quiz.title || 'Quiz',
                                score: quiz.questions.length,
                                totalQuestions: quiz.questions.length,
                                percentage: 100,
                                timeTaken: 0,
                                answers: {},
                                completedAt: new Date().toISOString(),
                                passed: true,
                                powerUpsUsed: []
                            };

                            await api.saveAttempt(attempt);
                        }

                        const existingUser = await api.getUserData(user.userId);
                        const newStats = {
                            totalAttempts: (existingUser.user?.totalAttempts || 0) + quizzesToMarkFull.length,
                            totalScore: (existingUser.user?.totalScore || 0) + quizzesToMarkFull.length * 10,
                            xp: (existingUser.user?.xp || 0) + (quizzesToMarkFull.length * 50),
                            totalTime: (existingUser.user?.totalTime || 0),
                            inventory: existingUser.user?.inventory,
                            powerUps: existingUser.user?.powerUps,
                            streak: existingUser.user?.streak,
                            friends: existingUser.user?.friends,
                            rank: existingUser.user?.rank
                        };

                        await api.updateUser(user.userId, newStats);
                    }

                    newlyCompletedModules.forEach(completedModuleId => {
                        const moduleIndex = currentTrack.modules.findIndex((m: SkillModule) => m.moduleId === completedModuleId);
                        if (moduleIndex >= 0 && moduleIndex + 1 < currentTrack.modules.length) {
                            const nextModuleId = currentTrack.modules[moduleIndex + 1].moduleId;
                            if (!progress.unlockedModules.includes(nextModuleId)) {
                                progress.unlockedModules.push(nextModuleId);
                            }
                        }
                    });
                }
            }

            await api.updateUserRoadmapProgress(user.userId, selectedTrack, progress, currentUser.userId);

            onNotification('success', `Roadmap progress updated! ${progress.unlockedModules.length} modules open to ${user.name || 'user'}.`);

            if (onRefresh) {
                await Promise.resolve(onRefresh());
            }
            onClose();
        } catch (e) {
            console.error('Error saving progress:', e);
            onNotification('error', 'Failed to save: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Manage Roadmap & Level Access"
            description={`Configure roadmap modules and levels open to ${user?.name || user?.userId || 'User'}`}
            maxWidth="max-w-4xl"
            footer={
                <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
                    <div className={`text-xs font-bold ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                        {totalStats.total > 0 && (
                            <span>
                                Status: <strong className={isBento ? 'text-black' : 'text-[#bef264]'}>{totalStats.unlocked} Open</strong>, <strong className={isBento ? 'text-black' : 'text-[#fde047]'}>{totalStats.completed} Completed</strong>, <strong className={isBento ? 'text-neutral-600' : 'text-[#78716c]'}>{totalStats.locked} Locked</strong>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black hover:bg-[#f5f3ec] shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className={`px-7 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-95 ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            }
        >
            <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {/* 1. Track Selector */}
                <div>
                    <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                        Select Roadmap Track
                    </label>
                    <div className="relative">
                        <select
                            className={`w-full p-3.5 rounded-xl appearance-none focus:outline-none cursor-pointer font-bold text-sm ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                            }`}
                            value={selectedTrack}
                            onChange={e => handleSelectTrack(e.target.value)}
                        >
                            <option value="">Select a Roadmap...</option>
                            {tracks.map(t => <option key={t.trackId} value={t.trackId}>{t.title} ({t.modules?.length || 0} modules)</option>)}
                        </select>
                        <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            ▼
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="py-12 text-center text-xs font-bold text-[#a8a29e] animate-pulse">
                        Loading student roadmap progress...
                    </div>
                )}

                {track && !loading && (
                    <>
                        {/* 2. Overview Stats & Track-Wide Actions */}
                        <div className={`p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            {/* Stat Chips */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                                    isBento ? 'bg-[#fed7aa] text-black border border-black' : 'bg-[#151e24] border border-[#bae6fd]/30 text-[#bae6fd]'
                                }`}>
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>{totalStats.total} Total Modules</span>
                                </span>
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#1c2317] border border-[#bef264]/35 text-[#bef264]'
                                }`}>
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>{totalStats.unlocked} Open to User</span>
                                </span>
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                                    isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231f14] border border-[#fde047]/35 text-[#fde047]'
                                }`}>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>{totalStats.completed} Completed</span>
                                </span>
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                                    isBento ? 'bg-[#f5f3ec] text-black border border-black' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e]'
                                }`}>
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>{totalStats.locked} Locked</span>
                                </span>
                            </div>

                            {/* Global Quick Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleOpenAllLevels}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                    }`}
                                    title="Unlock all modules in this roadmap for the user"
                                >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Open All Levels</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCompleteAllLevels}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-yellow-300'
                                            : 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908]'
                                    }`}
                                    title="Mark all modules complete"
                                >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Complete All</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLockAllLevels}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                            : 'bg-[#141210] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c]'
                                    }`}
                                    title="Lock all modules"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reset All</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Dedicated Level Control Banner (Core Request) */}
                        <div className={`p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isBento
                                ? 'bg-[#fef9c3] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#1c2317] border border-[#bef264]/35 text-[#f5f3ec]'
                        }`}>
                            <div className="flex items-center gap-2">
                                <Sparkles className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                <span className="font-black text-xs uppercase tracking-wider">
                                    Quick Level Selector:
                                </span>
                                <select
                                    value={activeQuickLevel}
                                    onChange={e => setQuickLevelTarget(Number(e.target.value))}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer outline-none ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec]'
                                    }`}
                                >
                                    {sortedLevels.map(lvl => (
                                        <option key={lvl} value={lvl}>
                                            Level {lvl} ({(modulesByLevel.get(lvl) || []).length} modules)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handleOpenLevel(activeQuickLevel)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                    }`}
                                    title={`Unlock all modules on Level ${activeQuickLevel} for user`}
                                >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Open Level {activeQuickLevel}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCompleteLevel(activeQuickLevel)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908]'
                                    }`}
                                    title={`Complete all modules on Level ${activeQuickLevel}`}
                                >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Complete Level</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleLockLevel(activeQuickLevel)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#141210] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c]'
                                    }`}
                                    title={`Lock all modules on Level ${activeQuickLevel}`}
                                >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Lock Level</span>
                                </button>
                            </div>
                        </div>

                        {/* 4. Filter Toolbar & Search */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            {/* Level Filter Tabs */}
                            <div className="flex flex-wrap items-center gap-1.5 py-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedLevelFilter('all')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                        selectedLevelFilter === 'all'
                                            ? (isBento ? 'bg-black text-[#bef264]' : 'bg-[#bef264] text-[#0a0908]')
                                            : (isBento ? 'bg-[#f5f3ec] hover:bg-neutral-200 text-black border border-black' : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]')
                                    }`}
                                >
                                    All Levels ({totalStats.total})
                                </button>
                                {sortedLevels.map(lvl => {
                                    const mods = modulesByLevel.get(lvl) || [];
                                    const isSelected = selectedLevelFilter === lvl;
                                    return (
                                        <button
                                            key={lvl}
                                            type="button"
                                            onClick={() => setSelectedLevelFilter(lvl)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                                isSelected
                                                    ? (isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                                    : (isBento ? 'bg-white text-black border border-black hover:bg-[#f5f3ec]' : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]')
                                            }`}
                                        >
                                            Level {lvl} ({mods.length})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search Box */}
                            <div className="relative min-w-[200px]">
                                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Filter modules..."
                                    className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold outline-none ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* 5. Sticky Bulk Selection Action Bar (when checkboxes are checked) */}
                        {selectedModuleIds.size > 0 && (
                            <div className={`p-3 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150 ${
                                isBento
                                    ? 'bg-[#fed7aa] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#1c2317] text-[#f5f3ec] border border-[#bef264]/45'
                            }`}>
                                <div className="flex items-center gap-2 text-xs font-black">
                                    <ListChecks className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                    <span>{selectedModuleIds.size} Module{selectedModuleIds.size > 1 ? 's' : ''} Selected</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleOpenSelected}
                                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                            isBento ? 'bg-[#bef264] text-black border border-black shadow-[1px_1px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]'
                                        }`}
                                    >
                                        <Unlock className="w-3.5 h-3.5" />
                                        <span>Open Selected</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCompleteSelected}
                                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                            isBento ? 'bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]' : 'bg-[#fde047] text-[#0a0908]'
                                        }`}
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>Complete Selected</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLockSelected}
                                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                            isBento ? 'bg-white text-black border border-black shadow-[1px_1px_0px_#000]' : 'bg-[#141210] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c]'
                                        }`}
                                    >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Lock</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedModuleIds(new Set())}
                                        className="text-xs font-bold underline opacity-80 hover:opacity-100 ml-1 cursor-pointer"
                                    >
                                        Deselect
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 6. Grouped Level Sections */}
                        <div className="space-y-4">
                            {sortedLevels
                                .filter(lvl => selectedLevelFilter === 'all' || selectedLevelFilter === lvl)
                                .map(lvl => {
                                    const levelMods = modulesByLevel.get(lvl) || [];
                                    const filteredMods = levelMods.filter(m => {
                                        if (!searchQuery.trim()) return true;
                                        const q = searchQuery.toLowerCase();
                                        return m.title?.toLowerCase().includes(q) || m.moduleId?.toLowerCase().includes(q);
                                    });

                                    if (filteredMods.length === 0 && searchQuery.trim()) return null;

                                    const levelIds = levelMods.map(m => m.moduleId);
                                    const levelOpenCount = levelMods.filter(m => progress.unlockedModules.includes(m.moduleId) || progress.completedModules.includes(m.moduleId)).length;
                                    const levelCompletedCount = levelMods.filter(m => progress.completedModules.includes(m.moduleId)).length;
                                    const isAllOpen = levelOpenCount === levelMods.length && levelMods.length > 0;
                                    const isAllSelected = levelIds.length > 0 && levelIds.every(id => selectedModuleIds.has(id));
                                    const isCollapsed = collapsedLevels.has(lvl);

                                    return (
                                        <div
                                            key={lvl}
                                            className={`rounded-2xl overflow-hidden transition-all ${
                                                isBento
                                                    ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                                    : 'bg-[#141210] border border-[#2e2924]'
                                            }`}
                                        >
                                            {/* Level Header Bar with Direct Level Controls */}
                                            <div className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b select-none ${
                                                isBento
                                                    ? (isAllOpen ? 'bg-[#ecfccb] border-b-2 border-black' : 'bg-[#f5f3ec] border-b-2 border-black')
                                                    : (isAllOpen ? 'bg-[#1c2317] border-b border-[#2e2924]' : 'bg-[#1a1714] border-b border-[#2e2924]')
                                            }`}>
                                                {/* Left: Checkbox & Level Title */}
                                                <div className="flex items-center gap-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleSelectLevel(lvl)}
                                                        className={`p-1 rounded-lg cursor-pointer transition-colors ${
                                                            isBento ? 'hover:bg-black/10' : 'hover:bg-[#24201c]'
                                                        }`}
                                                        title={isAllSelected ? "Deselect all modules on this level" : "Select all modules on this level"}
                                                    >
                                                        {isAllSelected ? (
                                                            <CheckSquare className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                                        ) : (
                                                            <Square className={`w-5 h-5 ${isBento ? 'text-neutral-600' : 'text-[#78716c]'}`} />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapseLevel(lvl)}
                                                        className="flex items-center gap-2 text-left cursor-pointer group"
                                                    >
                                                        <div className={`flex items-center gap-1.5 font-black text-sm uppercase tracking-tight ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                            <Layers className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                                            <span>Level {lvl}</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                            isBento ? 'bg-black text-white' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                                                        }`}>
                                                            {levelMods.length} Modules
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                            isAllOpen
                                                                ? (isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264] text-[#0a0908]')
                                                                : (levelOpenCount > 0
                                                                    ? (isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35')
                                                                    : isBento ? 'bg-white text-neutral-600 border border-black/30' : 'bg-[#0e0d0b] text-[#78716c]')
                                                        }`}>
                                                            {levelOpenCount}/{levelMods.length} Open{levelCompletedCount > 0 ? ` (${levelCompletedCount} done)` : ''}
                                                        </span>
                                                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-[#a8a29e]" /> : <ChevronDown className="w-4 h-4 text-[#a8a29e]" />}
                                                    </button>
                                                </div>

                                                {/* Right: Direct Level Batch Action Buttons */}
                                                <div className="flex items-center gap-1.5 flex-wrap pl-7 sm:pl-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenLevel(lvl)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                                            isBento
                                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                        }`}
                                                        title={`Open / Unlock all modules on Level ${lvl} for ${user.name || 'user'}`}
                                                    >
                                                        <Unlock className="w-3.5 h-3.5" />
                                                        <span>Open Level {lvl}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCompleteLevel(lvl)}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                                            isBento
                                                                ? 'bg-[#fde047] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-yellow-300'
                                                                : 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908]'
                                                        }`}
                                                        title={`Mark all modules on Level ${lvl} complete`}
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        <span>Complete</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLockLevel(lvl)}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${
                                                            isBento
                                                                ? 'bg-white text-black border border-black hover:bg-[#f5f3ec]'
                                                                : 'bg-[#141210] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c]'
                                                        }`}
                                                        title={`Lock all modules on Level ${lvl}`}
                                                    >
                                                        <Lock className="w-3 h-3" />
                                                        <span>Lock</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Level Modules Feed */}
                                            {!isCollapsed && (
                                                <div className="p-3 space-y-2">
                                                    {filteredMods.map(m => {
                                                        const isComp = progress.completedModules.includes(m.moduleId);
                                                        const isUnl = progress.unlockedModules.includes(m.moduleId) || isComp;
                                                        const isSelected = selectedModuleIds.has(m.moduleId);

                                                        let statusLabel = 'Locked';
                                                        let statusColor = isBento ? 'text-neutral-600' : 'text-[#78716c]';
                                                        let icon = <Lock size={15} />;
                                                        let borderBgClass = isBento
                                                            ? 'bg-white border-2 border-black/30 hover:border-black'
                                                            : 'bg-[#1a1714] border-[#2e2924]';

                                                        if (isComp) {
                                                            statusLabel = 'Completed';
                                                            statusColor = isBento ? 'text-black' : 'text-[#fde047]';
                                                            icon = <CheckCircle size={15} />;
                                                            borderBgClass = isBento
                                                                ? 'bg-[#fef9c3] border-2 border-black'
                                                                : 'bg-[#231f14] border-[#fde047]/35';
                                                        } else if (isUnl) {
                                                            statusLabel = 'Unlocked (Open)';
                                                            statusColor = isBento ? 'text-black font-bold' : 'text-[#bef264] font-bold';
                                                            icon = <Unlock size={15} />;
                                                            borderBgClass = isBento
                                                                ? 'bg-[#ecfccb] border-2 border-black'
                                                                : 'bg-[#1c2317] border-[#bef264]/35';
                                                        }

                                                        return (
                                                            <div
                                                                key={m.moduleId}
                                                                onClick={() => toggleModule(m.moduleId)}
                                                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${borderBgClass} ${
                                                                    isSelected ? (isBento ? 'ring-2 ring-black' : 'ring-2 ring-[#bef264]') : ''
                                                                }`}
                                                            >
                                                                {/* Module Left Info */}
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div
                                                                        onClick={(e) => handleToggleSelectModule(m.moduleId, e)}
                                                                        className="cursor-pointer shrink-0"
                                                                        title="Select module"
                                                                    >
                                                                        {isSelected ? (
                                                                            <CheckSquare className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                                                        ) : (
                                                                            <Square className={`w-4 h-4 ${isBento ? 'text-neutral-600' : 'text-[#78716c]'}`} />
                                                                        )}
                                                                    </div>

                                                                    <div className={`p-2 rounded-xl shrink-0 ${statusColor} ${isBento ? 'bg-white border border-black' : 'bg-[#0e0d0b] border border-[#2e2924]'}`}>
                                                                        {icon}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`text-xs sm:text-sm font-black truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                                                {m.title}
                                                                            </span>
                                                                            <span className="text-[10px] font-mono opacity-60">
                                                                                {m.moduleId}
                                                                            </span>
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                                                                isComp
                                                                                    ? (isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35')
                                                                                    : isUnl
                                                                                        ? (isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35')
                                                                                        : (isBento ? 'bg-[#f5f3ec] text-neutral-700 border border-black/25' : 'bg-[#0e0d0b] text-[#78716c]')
                                                                            }`}>
                                                                                {statusLabel}
                                                                            </span>
                                                                        </div>
                                                                        <div className={`flex items-center gap-2 mt-0.5 text-[11px] font-semibold ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                                                            <span>{m.quizIds?.length || 0} Quiz{m.quizIds?.length === 1 ? '' : 'zes'}</span>
                                                                            {m.subModules && m.subModules.length > 0 && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span>{m.subModules.length} Sub-modules</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Module Right Controls */}
                                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                                                                    {/* 3 Quick State Switcher Buttons */}
                                                                    <div className={`flex items-center p-1 rounded-xl gap-1 ${isBento ? 'bg-black/10' : 'bg-[#0e0d0b] border border-[#2e2924]'}`}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setModuleState(m.moduleId, 'locked')}
                                                                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                                                !isUnl && !isComp
                                                                                    ? (isBento ? 'bg-black text-white font-black' : 'bg-[#2e2924] text-[#f5f3ec]')
                                                                                    : (isBento ? 'text-neutral-700 hover:text-black' : 'text-[#78716c] hover:text-[#f5f3ec]')
                                                                            }`}
                                                                            title="Lock module for user"
                                                                        >
                                                                            Lock
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setModuleState(m.moduleId, 'unlocked')}
                                                                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                                                isUnl && !isComp
                                                                                    ? (isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264] text-[#0a0908]')
                                                                                    : (isBento ? 'text-neutral-700 hover:text-black' : 'text-[#78716c] hover:text-[#bef264]')
                                                                            }`}
                                                                            title="Unlock / Open module for user"
                                                                        >
                                                                            Open
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setModuleState(m.moduleId, 'completed')}
                                                                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                                                isComp
                                                                                    ? (isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-[#fde047] text-[#0a0908]')
                                                                                    : (isBento ? 'text-neutral-700 hover:text-black' : 'text-[#78716c] hover:text-[#fde047]')
                                                                            }`}
                                                                            title="Mark module complete"
                                                                        >
                                                                            Done
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

const CreateUserModal: React.FC<{
    currentUser: UserData;
    defaultRole?: 'user' | 'teacher' | 'admin';
    onClose: () => void;
    onNotification: (type: 'success' | 'error', message: string) => void;
    onRefresh: () => void | Promise<void>;
}> = ({ currentUser, defaultRole = 'user', onClose, onNotification, onRefresh }) => {
    const { isBento } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'user' | 'teacher' | 'admin'>(defaultRole);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name || !email || !password) {
            onNotification('error', 'Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            onNotification('error', 'Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            const normalizedEmail = (email || '').toLowerCase().trim();
            await api.adminCreateUser({
                name: (name || '').trim(),
                email: normalizedEmail,
                password,
                role,
                userId: normalizedEmail.replace(/[^a-z0-9]/g, '_')
            }, currentUser.userId);

            onNotification('success', 'Identity created successfully');
            await Promise.resolve(onRefresh());
            onClose();
        } catch (error) {
            console.error('Create user error:', error);
            onNotification('error', error instanceof Error ? error.message : 'Failed to create user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Create Identity"
            description="Initialize a new agent profile"
            maxWidth="max-w-lg"
            icon={<Users className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            footer={
                <>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] font-mono'
                                : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className={`flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer disabled:opacity-50 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                        }`}
                    >
                        {isLoading ? 'Processing...' : 'Create Identity'}
                    </button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Agent Name</label>
                    <input
                        placeholder="e.g. Neo Anderson"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                        }`}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Email Identity</label>
                    <input
                        type="email"
                        placeholder="e.g. neo@matrix.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                        }`}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Access Key</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Secure code (min. 6 chars)"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all pr-14 ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 transition-colors cursor-pointer ${isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#bef264]'}`}
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Assignment Role</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['user', 'teacher', 'admin'] as const).map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`py-3 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer ${role === r
                                    ? isBento
                                        ? 'bg-[#fde047] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#1c2317] border-2 border-[#bef264] text-[#bef264]'
                                    : isBento
                                        ? 'bg-[#f5f3ec] border-2 border-black/30 text-black/70 hover:border-black'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                                    }`}
                            >
                                {r === 'admin' ? '🛡️ Admin' : r === 'teacher' ? '👩‍🏫 Teacher' : '🎓 Student'}
                            </button>
                        ))}
                    </div>
                </div>
            </form>
        </Modal>
    );
};

const UserManagement: React.FC<UserManagementProps> = ({ users, attempts, currentUser, onRefresh, onNotification }) => {
    const { isBento } = useTheme();
    const { openUserProfile } = useUserProfileModal();
    const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
    const [originalUser, setOriginalUser] = useState<EditableUser | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'teacher'>('student');
    const [includeAdmins, setIncludeAdmins] = useState(false);
    const [managedUsers, setManagedUsers] = useState<UserData[]>(() => (Array.isArray(users) ? users : []));

    useEffect(() => {
        setManagedUsers(Array.isArray(users) ? users : []);
    }, [users]);
    const [viewingAttempts, setViewingAttempts] = useState<UserData | null>(null);
    const [managingRoadmap, setManagingRoadmap] = useState<UserData | null>(null);
    const [managingTrackAccess, setManagingTrackAccess] = useState<UserData | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [giftingUser, setGiftingUser] = useState<UserData | null>(null);
    const [giftType, setGiftType] = useState<'coins' | 'xp' | 'shopitem'>('coins');
    const [giftAmount, setGiftAmount] = useState('');
    const [selectedShopItem, setSelectedShopItem] = useState('');
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);

    // Fetch shop items when component mounts
    React.useEffect(() => {
        const fetchShopItems = async () => {
            try {
                const items = await api.getShopItems?.() || [];
                setShopItems(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error('Failed to fetch shop items:', error);
                setShopItems([]);
            }
        };
        fetchShopItems();
    }, []);

    const safeUsers = useMemo(() => (Array.isArray(managedUsers) ? managedUsers.filter(Boolean) : []), [managedUsers]);
    const studentUsersCount = useMemo(
        () => safeUsers.filter(u => u.role !== 'teacher' && u.role !== 'admin' && !u.isAdmin).length,
        [safeUsers]
    );
    const teacherUsersCount = useMemo(
        () => safeUsers.filter(u => u.role === 'teacher').length,
        [safeUsers]
    );
    const adminUsersCount = useMemo(
        () => safeUsers.filter(u => u.role === 'admin' || u.isAdmin).length,
        [safeUsers]
    );

    const filteredUsers = safeUsers.filter(user => {
        const isTeacherRole = user.role === 'teacher';
        const isAdminRole = user.role === 'admin' || Boolean(user.isAdmin);

        if (activeRoleTab === 'teacher') {
            if (!isTeacherRole && !(includeAdmins && isAdminRole)) return false;
        } else {
            if (isTeacherRole) return false;
            if (isAdminRole && !includeAdmins) return false;
        }

        const term = (searchTerm || '').toLowerCase();
        if (!term) return true;
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const userId = (user.userId || '').toLowerCase();
        return name.includes(term) || email.includes(term) || userId.includes(term);
    });

    const patchLocalUser = (targetId: string, patch: Partial<UserData>) => {
        setManagedUsers(prev =>
            prev.map(u => {
                const uid = u.userId || (u as { _id?: string })._id?.toString() || u.email || '';
                if (uid === targetId || u.userId === targetId || u.email === targetId) {
                    return { ...u, ...patch };
                }
                return u;
            })
        );
    };

    const handleQuickRoleSwitch = async (targetUser: UserData, nextRole: 'user' | 'teacher') => {
        const targetId = targetUser.userId || (targetUser as { _id?: string })._id?.toString() || targetUser.email || '';
        if (!targetId) return;
        const previousRole = targetUser.role || 'user';
        patchLocalUser(targetId, { role: nextRole });
        try {
            const updatedUser = await api.updateUser(targetId, { role: nextRole });
            patchLocalUser(targetId, { role: updatedUser?.role || nextRole });
            onNotification(
                'success',
                `${targetUser.name || targetId} is now a ${nextRole === 'teacher' ? 'Teacher' : 'Student'}`
            );
            Promise.resolve(onRefresh()).catch(() => {});
        } catch (err) {
            patchLocalUser(targetId, { role: previousRole });
            onNotification('error', err instanceof Error ? err.message : 'Failed to switch role');
        }
    };

    const handleUpdateUser = async (user: EditableUser) => {
        if (!user) return;
        const normalizedEmail = (user.email || '').toLowerCase().trim();
        const trimmedName = (user.name || '').trim();
        const nextRole = user.role || 'user';
        const prevRole = originalUser?.role || 'user';

        try {
            if (
                trimmedName !== (originalUser?.name || '').trim() ||
                normalizedEmail !== (originalUser?.email || '').toLowerCase().trim() ||
                nextRole !== prevRole
            ) {
                const updated = await api.updateUser(user.userId, {
                    name: trimmedName,
                    email: normalizedEmail,
                    role: nextRole
                });
                patchLocalUser(user.userId, {
                    name: updated?.name || trimmedName,
                    email: updated?.email || normalizedEmail,
                    role: updated?.role || nextRole
                });
            }

            if (user.password && user.password.trim() !== '') {
                await api.adminChangeUserPassword(
                    user.userId,
                    user.password.trim(),
                    currentUser.userId
                );
            }

            setEditingUser(null);
            setOriginalUser(null);
            onNotification('success', 'User updated successfully');
            Promise.resolve(onRefresh()).catch(() => {});
        } catch (error) {
            console.error('Update error:', error);
            const msg = error instanceof Error ? error.message : 'Failed to update user';
            onNotification('error', msg);
        }
    };

    const handleGiftSend = async (user: UserData) => {
        if (!giftAmount && giftType !== 'shopitem') {
            onNotification('error', 'Please enter an amount');
            return;
        }

        if (giftType === 'shopitem' && !selectedShopItem) {
            onNotification('error', 'Please select an item');
            return;
        }

        try {
            const updates: Partial<UserData> = {};

            if (giftType === 'coins') {
                updates.coins = (user.coins || 0) + parseInt(giftAmount);
            } else if (giftType === 'xp') {
                updates.totalScore = (user.totalScore || 0) + parseInt(giftAmount);
            } else if (giftType === 'shopitem') {
                // Add to inventory
                const inventory = Array.isArray(user.inventory) ? [...user.inventory] : [];
                const itemExists = inventory.some((item) =>
                    (typeof item === 'string' ? item : item?.itemId) === selectedShopItem
                );
                if (!itemExists) {
                    inventory.push({ itemId: selectedShopItem, quantity: 1 });
                    updates.inventory = inventory;
                }
            }

            await api.updateUser(user.userId, updates);

            const itemName = giftType === 'coins' ? `${giftAmount} Coins` :
                giftType === 'xp' ? `${giftAmount} XP` :
                    selectedShopItem;

            onNotification('success', `Gifted ${itemName} to ${user.name}`);
            setGiftingUser(null);
            setGiftAmount('');
            setSelectedShopItem('');
            await Promise.resolve(onRefresh());
        } catch (error) {
            console.error('Gift error:', error);
            onNotification('error', 'Failed to send gift');
        }
    };

    const confirmDeleteUser = async () => {
        if (!deleteConfirmation || !deleteConfirmation.id) return;
        const userId = deleteConfirmation.id;
        try {
            await api.deleteUser(userId, currentUser.userId);
            setManagedUsers(prev => prev.filter(u => {
                const uid = u.userId || (u as { _id?: string })._id?.toString() || u.email || '';
                return uid !== userId && u.userId !== userId;
            }));
            onNotification('success', 'User deleted successfully');
            Promise.resolve(onRefresh()).catch(() => {});
        } catch (error) {
            console.error('Delete user error:', error);
            onNotification('error', error instanceof Error ? error.message : 'Failed to delete user');
        } finally {
            setDeleteConfirmation(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Role Split Tabs: Students vs Teachers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className={`inline-flex p-1.5 rounded-2xl gap-1.5 ${
                    isBento ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]' : 'bg-white/70 dark:bg-[#1c1917]/80 border border-gray-200/80 dark:border-white/10'
                }`}>
                    <button
                        type="button"
                        onClick={() => setActiveRoleTab('student')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            activeRoleTab === 'student'
                                ? isBento
                                    ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                    >
                        <span>🎓 Students</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            activeRoleTab === 'student'
                                ? isBento ? 'bg-black text-white' : 'bg-white/20 text-white'
                                : 'bg-black/10 dark:bg-white/10'
                        }`}>
                            {studentUsersCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveRoleTab('teacher')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            activeRoleTab === 'teacher'
                                ? isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-amber-500 text-black shadow-md shadow-amber-500/25'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                    >
                        <span>👩‍🏫 Teachers</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            activeRoleTab === 'teacher'
                                ? isBento ? 'bg-black text-white' : 'bg-black/20 text-black'
                                : 'bg-black/10 dark:bg-white/10'
                        }`}>
                            {teacherUsersCount}
                        </span>
                    </button>
                </div>

                {adminUsersCount > 0 && (
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 cursor-pointer select-none px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5">
                        <input
                            type="checkbox"
                            checked={includeAdmins}
                            onChange={e => setIncludeAdmins(e.target.checked)}
                            className="accent-indigo-600 cursor-pointer"
                        />
                        <span>Show Admins ({adminUsersCount})</span>
                    </label>
                )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
                <div className={`flex-1 p-3 px-5 rounded-2xl sm:rounded-3xl transition-all flex items-center gap-3 sm:gap-4 ${
                    isBento
                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-white/60 dark:bg-[#1c1917]/60 backdrop-blur-xl border border-gray-200/80 dark:border-white/5 shadow-sm focus-within:border-teal-500/50'
                }`}>
                    <Search className={`w-5 h-5 shrink-0 ${isBento ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} />
                    <input
                        type="text"
                        placeholder="Search identities by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`flex-1 bg-transparent border-none focus:ring-0 placeholder:text-gray-400 font-bold text-sm tracking-tight outline-none ${
                            isBento ? 'text-black font-mono uppercase' : 'text-gray-900 dark:text-white uppercase'
                        }`}
                    />
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className={`flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 rounded-2xl sm:rounded-3xl transition-all cursor-pointer ${
                        isBento
                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                            : 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-lg shadow-teal-600/25 hover:shadow-teal-600/40 hover:-translate-y-0.5 active:scale-95'
                    }`}
                >
                    <Users className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 ${isBento ? 'text-black' : 'text-white'}`} />
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isBento ? 'font-mono text-black' : 'text-white'}`}>
                        {activeRoleTab === 'teacher' ? 'Create Teacher' : 'Create Student'}
                    </span>
                </button>
                <div className={`hidden lg:flex items-center gap-3 px-6 py-3 rounded-2xl sm:rounded-3xl ${
                    isBento
                        ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-mono'
                        : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                }`}>
                    <Users className={`w-5 h-5 ${isBento ? 'text-black' : 'text-teal-600 dark:text-teal-400'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap ${isBento ? 'text-black font-mono' : 'text-teal-600 dark:text-teal-400'}`}>
                        Showing: {filteredUsers.length} {activeRoleTab === 'teacher' ? 'Teachers' : 'Students'}
                    </span>
                </div>
            </div>

            {filteredUsers.length === 0 && (
                <div className={`p-10 rounded-3xl text-center border-2 border-dashed ${
                    isBento ? 'bg-white border-black text-black' : 'border-gray-200 dark:border-white/10 text-gray-500'
                }`}>
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-black uppercase">
                        {activeRoleTab === 'teacher' ? 'No Teachers Found' : 'No Students Found'}
                    </p>
                    <p className="text-xs opacity-75 mt-1">
                        {activeRoleTab === 'teacher'
                            ? 'Click "Create Teacher" above or promote a student from the Students tab.'
                            : 'Click "Create Student" above or clear your search filter.'}
                    </p>
                </div>
            )}

            {/* User Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredUsers.map(user => {
                    const userId = user.userId || (user as { _id?: string })._id?.toString() || (user as { id?: string }).id || user.email || '';
                    const userAttempts = (attempts || []).filter(a => a.userId === userId || a.userId === user.userId || (user.email && a.userEmail === user.email));
                    const avgScore = userAttempts.length > 0
                        ? Math.round(userAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / userAttempts.length)
                        : 0;

                    return (
                        <div
                            key={userId || user.email}
                            className={`rounded-2xl sm:rounded-3xl p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                    : 'bg-white/60 dark:bg-[#1c1917]/60 backdrop-blur-xl border border-gray-200/80 dark:border-white/5 hover:border-teal-500/30 shadow-sm hover:shadow-xl group'
                            }`}
                        >
                            {!isBento && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none group-hover:bg-teal-500/10 transition-colors" />
                            )}

                            {/* Card Header: Avatar & Info */}
                            <div className="flex items-start gap-4 mb-5 sm:mb-6 relative z-10">
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 transition-transform ${
                                    isBento
                                        ? 'bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-teal-500 p-0.5 shadow-lg group-hover:scale-105'
                                }`}>
                                    <div
                                        onClick={() => openUserProfile(userId)}
                                        className={`w-full h-full rounded-[10px] sm:rounded-[14px] overflow-hidden flex items-center justify-center cursor-pointer hover:scale-105 transition-transform ${
                                            isBento ? 'bg-[#fde047]' : 'bg-white dark:bg-[#1c1917]'
                                        }`}
                                        title="View Public Profile"
                                    >
                                        {user.avatar ? (
                                            <Avatar config={user.avatar} size="md" className="w-full h-full" />
                                        ) : (
                                            <span className={`font-black text-xl ${isBento ? 'text-black font-mono' : 'text-teal-600 dark:text-teal-400'}`}>
                                                {(user.name || userId || 'U').charAt(0)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3
                                        onClick={() => openUserProfile(userId)}
                                        className={`font-black uppercase tracking-tight text-base sm:text-lg leading-tight truncate cursor-pointer ${
                                            isBento ? 'text-black font-mono hover:underline' : 'text-gray-900 dark:text-white group-hover:text-teal-600 hover:underline transition-colors'
                                        }`}
                                        title="View Public Profile"
                                    >
                                        {user.name || userId || 'Unnamed User'}
                                    </h3>
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            user.role === 'admin'
                                                ? isBento ? 'bg-[#fecdd3] text-black border border-black' : 'bg-rose-500/15 text-rose-500 border border-rose-500/20'
                                                : user.role === 'teacher'
                                                    ? isBento ? 'bg-[#fde047] text-black border border-black' : 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                                                    : isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                                        }`}>
                                            {user.role === 'admin' ? '🛡️ Admin' : user.role === 'teacher' ? '👩‍🏫 Teacher' : '🎓 Student'}
                                        </span>
                                        {user.role !== 'admin' && !user.isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handleQuickRoleSwitch(user, user.role === 'teacher' ? 'user' : 'teacher')}
                                                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 cursor-pointer transition"
                                                title={user.role === 'teacher' ? 'Switch role back to Student' : 'Promote user to Teacher'}
                                            >
                                                {user.role === 'teacher' ? '→ Student' : '→ Make Teacher'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400 mt-1">
                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                        <span className={`text-[10px] font-bold truncate ${isBento ? 'text-black/60 font-mono' : 'opacity-75'}`}>
                                            {user.email || 'No email'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => { setOriginalUser({ ...user, userId }); setEditingUser({ ...user, userId, password: '' }); }}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento ? 'bg-white hover:bg-[#bae6fd] text-black border border-black shadow-[1.5px_1.5px_0px_#000]' : 'text-indigo-400 hover:bg-indigo-500/10 hover:scale-110'
                                        }`}
                                        title="Edit User"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setManagingRoadmap({ ...user, userId })}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento ? 'bg-white hover:bg-[#bef264] text-black border border-black shadow-[1.5px_1.5px_0px_#000]' : 'text-emerald-400 hover:bg-emerald-500/10 hover:scale-110'
                                        }`}
                                        title="Manage Roadmap"
                                    >
                                        <MapIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setManagingTrackAccess({ ...user, userId })}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento ? 'bg-white hover:bg-[#fde047] text-black border border-black shadow-[1.5px_1.5px_0px_#000]' : 'text-teal-400 hover:bg-teal-500/10 hover:scale-110'
                                        }`}
                                        title="Manage Track Permissions"
                                    >
                                        <Route className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setGiftingUser({ ...user, userId });
                                            setGiftType('coins');
                                            setGiftAmount('');
                                            setSelectedShopItem('');
                                        }}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento ? 'bg-white hover:bg-[#fef08a] text-black border border-black shadow-[1.5px_1.5px_0px_#000]' : 'text-amber-400 hover:bg-amber-500/10 hover:scale-110'
                                        }`}
                                        title="Send Gift"
                                    >
                                        <Gift className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmation({ isOpen: true, id: userId })}
                                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                                            isBento ? 'bg-white hover:bg-[#fecdd3] text-red-600 border border-black shadow-[1.5px_1.5px_0px_#000]' : 'text-red-500 hover:bg-red-500/10 hover:scale-110'
                                        }`}
                                        title="Delete User"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Stats Section */}
                            <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 relative z-10">
                                <div className={`p-3 rounded-xl sm:rounded-2xl ${
                                    isBento ? 'bg-[#f8fafc] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-gray-50/50 dark:bg-black/20 border border-white/5'
                                }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isBento ? 'text-black/60 font-mono' : 'text-gray-400'}`}>Total XP</span>
                                    </div>
                                    <div className={`text-sm font-black ${isBento ? 'text-black font-mono' : 'text-gray-900 dark:text-white'}`}>{user.totalScore?.toLocaleString() || 0}</div>
                                </div>
                                <div className={`p-3 rounded-xl sm:rounded-2xl ${
                                    isBento ? 'bg-[#f8fafc] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]' : 'bg-gray-50/50 dark:bg-black/20 border border-white/5'
                                }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <BarChart3 className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-teal-500'}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isBento ? 'text-black/60 font-mono' : 'text-gray-400'}`}>Avg Score</span>
                                    </div>
                                    <div className={`text-sm font-black ${isBento ? 'text-black font-mono' : 'text-gray-900 dark:text-white'}`}>{avgScore}%</div>
                                </div>
                            </div>

                            {/* Quick Action: View Attempts */}
                            <button
                                onClick={() => setViewingAttempts(user)}
                                className={`w-full py-3 rounded-xl sm:rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 mt-auto cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                        : 'bg-white/40 dark:bg-white/5 hover:bg-teal-500/10 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 border border-gray-200/80 dark:border-white/10'
                                }`}
                            >
                                <BarChart3 className="w-4 h-4" />
                                View {userAttempts.length} Attempts
                            </button>
                        </div>
                    );
                })}

                {filteredUsers.length === 0 && (
                    <div className="col-span-full py-24 text-center bg-white/40 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                        <Users className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4 animate-pulse" />
                        <p className="text-gray-400 font-black uppercase tracking-widest text-sm text-center">No identities found</p>
                    </div>
                )}
            </div>

            {/* User Attempts Explorer Modal */}
            <Modal
                isOpen={!!viewingAttempts}
                onClose={() => setViewingAttempts(null)}
                title={viewingAttempts ? `${viewingAttempts.name}'s Pulse` : 'Attempts'}
                description="Performance History Log"
                maxWidth="max-w-2xl"
                icon={<BarChart3 className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            >
                <div className="space-y-3">
                    {viewingAttempts && attempts.filter(a => a.userId === viewingAttempts.userId).length > 0 ? (
                        attempts
                            .filter(a => a.userId === viewingAttempts.userId)
                            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                            .map(attempt => {
                                const passed = attempt.percentage >= 70;
                                const mins = attempt.timeTaken ? Math.floor(attempt.timeTaken / 60) : 0;
                                const secs = attempt.timeTaken ? attempt.timeTaken % 60 : 0;
                                return (
                                    <div
                                        key={attempt.attemptId}
                                        className={`p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:-translate-y-0.5 transition-all ${
                                            isBento
                                                ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                                                : 'bg-[#1a1714] border border-[#2e2924]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                isBento
                                                    ? `border-2 border-black shadow-[2px_2px_0px_#000] ${passed ? 'bg-[#bef264] text-black' : 'bg-[#fecdd3] text-black'}`
                                                    : passed ? 'bg-[#1c2317] text-[#bef264] border border-[#bef264]/35' : 'bg-[#251317] text-[#fb7185] border border-[#fb7185]/35'
                                            }`}>
                                                <Trophy className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`text-xs font-black uppercase tracking-tight mb-1 truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                    {attempt.quizTitle}
                                                </div>
                                                <div className={`flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(attempt.completedAt).toLocaleDateString()}
                                                    </span>
                                                    {typeof attempt.timeTaken === 'number' && attempt.timeTaken > 0 && (
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-black ${
                                                            isBento
                                                                ? 'bg-white border border-black/25 text-black'
                                                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                                                        }`}>
                                                            <Clock className="w-3 h-3" />
                                                            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                                            <div className={`px-2.5 py-1 rounded-lg text-center ${
                                                isBento
                                                    ? `border-2 border-black shadow-[2px_2px_0px_#000] bg-white ${passed ? 'text-black' : 'text-red-600'}`
                                                    : `bg-[#0e0d0b] border border-[#2e2924] ${passed ? 'text-[#bef264]' : 'text-[#fb7185]'}`
                                            }`}>
                                                <div className={`text-[9px] font-black uppercase tracking-widest leading-none mb-0.5 ${isBento ? 'text-neutral-600' : 'text-[#a8a29e]'}`}>SCORE</div>
                                                <div className="text-sm font-black leading-none">{attempt.percentage}%</div>
                                            </div>
                                            <a
                                                href={`/admin/proctoring/${encodeURIComponent(attempt.attemptId)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`px-3.5 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 no-underline ${
                                                    isBento
                                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-y-0.5 hover:shadow-none'
                                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                }`}
                                                title="Open full telemetry & answer inspector in a new tab"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span>Inspect Answers</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        <div className={`py-16 text-center rounded-2xl border-2 border-dashed ${
                            isBento
                                ? 'bg-[#f5f3ec] border-black/30 text-black/60'
                                : 'bg-[#1a1714] border-[#2e2924] text-[#a8a29e]'
                        }`}>
                            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="text-xs font-black uppercase tracking-widest">No activity recorded for this student</p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title="Edit Agent"
                description="Update credentials and access"
                maxWidth="max-w-lg"
                footer={
                    <>
                        <button
                            onClick={() => setEditingUser(null)}
                            className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] font-mono'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => editingUser && handleUpdateUser(editingUser)}
                            className={`flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                            }`}
                        >
                            Update Identity
                        </button>
                    </>
                }
            >
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Display Name</label>
                        <input
                            placeholder="e.g. John Wick"
                            value={editingUser?.name || ''}
                            onChange={e => editingUser && setEditingUser({ ...editingUser, name: e.target.value })}
                            className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Email Identity</label>
                        <input
                            placeholder="e.g. wick@continental.com"
                            value={editingUser?.email || ''}
                            onChange={e => editingUser && setEditingUser({ ...editingUser, email: e.target.value })}
                            className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Platform Mode / Role</label>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { id: 'user', label: '🎓 Student' },
                                { id: 'teacher', label: '👩‍🏫 Teacher' },
                                { id: 'admin', label: '🛡️ Admin' }
                            ] as const).map(r => {
                                const currentRole = editingUser?.role === 'student' ? 'user' : (editingUser?.role || 'user');
                                const selected = currentRole === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => editingUser && setEditingUser({ ...editingUser, role: r.id })}
                                        className={`py-2.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
                                            selected
                                                ? isBento
                                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#1c2317] border-2 border-[#bef264] text-[#bef264]'
                                                : isBento
                                                    ? 'bg-[#f5f3ec] border-2 border-black/30 text-black/70 hover:border-black'
                                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Access Key Override</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Secure blank for status quo"
                                value={editingUser?.password || ''}
                                onChange={e => editingUser && setEditingUser({ ...editingUser, password: e.target.value })}
                                className={`w-full rounded-xl px-5 py-4 font-bold outline-none transition-all pr-14 ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 transition-colors cursor-pointer ${isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#bef264]'}`}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Roadmap Manager Modal */}
            {managingRoadmap && (
                <RoadmapEditorModal
                    user={managingRoadmap}
                    currentUser={currentUser}
                    onClose={() => setManagingRoadmap(null)}
                    onNotification={onNotification}
                    onRefresh={onRefresh}
                />
            )}

            {/* Create Identity Modal */}
            {isCreateOpen && (
                <CreateUserModal
                    currentUser={currentUser}
                    defaultRole={activeRoleTab === 'teacher' ? 'teacher' : 'user'}
                    onClose={() => setIsCreateOpen(false)}
                    onNotification={onNotification}
                    onRefresh={onRefresh}
                />
            )}

            {/* Gift Modal */}
            <Modal
                isOpen={!!giftingUser}
                onClose={() => setGiftingUser(null)}
                title="Send Gift"
                description={giftingUser ? `To: ${giftingUser.name}` : ''}
                icon={<Gift className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />}
                maxWidth="max-w-xl"
                footer={
                    <>
                        <button
                            onClick={() => setGiftingUser(null)}
                            className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] font-mono'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => giftingUser && handleGiftSend(giftingUser)}
                            disabled={!giftAmount && giftType !== 'shopitem' || (giftType === 'shopitem' && !selectedShopItem)}
                            className={`flex-[2] py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                    : 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908]'
                            }`}
                        >
                            Send Gift
                        </button>
                    </>
                }
            >
                <div className="space-y-6">
                    <div>
                        <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            Gift Type
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['coins', 'xp', 'shopitem'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setGiftType(type);
                                        setGiftAmount('');
                                    }}
                                    className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer ${giftType === type
                                        ? isBento
                                            ? type === 'coins' ? 'bg-[#fde047] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                                : type === 'xp' ? 'bg-[#bef264] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                                    : 'bg-[#bae6fd] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : type === 'coins' ? 'bg-[#231f14] border-2 border-[#fde047] text-[#fde047]'
                                                : type === 'xp' ? 'bg-[#1c2317] border-2 border-[#bef264] text-[#bef264]'
                                                    : 'bg-[#151e24] border-2 border-[#bae6fd] text-[#bae6fd]'
                                        : isBento
                                            ? 'bg-[#f5f3ec] border-2 border-black/30 text-black/75 hover:border-black'
                                            : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                                        }`}
                                >
                                    {type === 'coins' ? '🪙 Coins' : type === 'xp' ? '⭐ XP' : '🛍️ Item'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {giftType === 'coins' && (
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                Coins Amount
                            </label>
                            <input
                                type="number"
                                value={giftAmount}
                                onChange={(e) => setGiftAmount(e.target.value)}
                                placeholder="Enter coins amount"
                                min="0"
                                className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:border-[#fde047]'
                                }`}
                            />
                        </div>
                    )}

                    {giftType === 'xp' && (
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                XP Amount
                            </label>
                            <input
                                type="number"
                                value={giftAmount}
                                onChange={(e) => setGiftAmount(e.target.value)}
                                placeholder="Enter XP amount"
                                min="0"
                                className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder-[#78716c] focus:border-[#bef264]'
                                }`}
                            />
                        </div>
                    )}

                    {giftType === 'shopitem' && (
                        <div>
                            <label className={`block text-xs font-black uppercase tracking-widest mb-3 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                Select Item
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedShopItem}
                                    onChange={(e) => setSelectedShopItem(e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl font-bold focus:outline-none appearance-none cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bae6fd]'
                                    }`}
                                >
                                    <option value="">Choose an item...</option>
                                    {shopItems.length > 0 ? (
                                        shopItems.map(item => (
                                            <option key={item.itemId} value={item.itemId}>
                                                {item.name} ({item.price} coins)
                                            </option>
                                        ))
                                    ) : (
                                        <option value="" disabled>Loading items...</option>
                                    )}
                                </select>
                                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                            </div>
                        </div>
                    )}

                    <div className={`rounded-xl p-4 ${
                        isBento
                            ? 'bg-[#bae6fd] border-2 border-black text-black'
                            : 'bg-[#151e24] border border-[#bae6fd]/30 text-[#bae6fd]'
                    }`}>
                        <p className="text-xs font-bold">
                            💡 The gift will be added to the user's inventory immediately.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmDialog
                isOpen={!!deleteConfirmation}
                onCancel={() => setDeleteConfirmation(null)}
                onConfirm={confirmDeleteUser}
                title="Abolish Agent?"
                message="This will permanently extinguish the agent and all their progress histories."
                confirmText="Abolish"
                cancelText="Back"
                type="danger"
                showWarningBanner={true}
            />

            {/* Manage User Track Permissions Modal */}
            {managingTrackAccess && (
                <ManageUserTracksModal
                    user={managingTrackAccess}
                    currentUser={currentUser}
                    onClose={() => setManagingTrackAccess(null)}
                    onNotification={onNotification}
                    onRefresh={onRefresh}
                />
            )}
        </div>
    );
};

export default UserManagement;
