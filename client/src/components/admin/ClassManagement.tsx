import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    GraduationCap,
    Plus,
    Users,
    Search,
    CheckSquare,
    Square,
    Trash2,
    Save,
    Copy,
    Palette,
    RefreshCw,
    ArrowLeft
} from 'lucide-react';
import type { UserData, SkillTrack, ClanLogo } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { ClassEmblem } from '../social/ClassEmblem';
import { ClanLogoMakerModal } from '../social/ClassLogoMakerModal';
import { getTeacherThemeStyles } from '../teacher/teacherTheme';

interface AdminClassItem {
    clanId: string;
    name: string;
    tag: string;
    description: string;
    leaderId: string;
    leaderName: string;
    leaderEmail?: string;
    isPublic: boolean;
    logo?: ClanLogo;
    inviteCode?: string;
    trackId?: string | null;
    trackTitle?: string | null;
    trackIcon?: string | null;
    totalSessions: number;
    finishedSessionsCount: number;
    memberCount: number;
    studentIds: string[];
    students?: { userId: string; name: string; email?: string; role: string }[];
    createdAt?: string;
}

interface ClassManagementProps {
    users: UserData[];
    currentUser: UserData;
    onRefresh: () => void | Promise<void>;
    onNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const ClassManagement: React.FC<ClassManagementProps> = ({
    users,
    currentUser,
    onRefresh,
    onNotification
}) => {
    const { theme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);

    const [classes, setClasses] = useState<AdminClassItem[]>([]);
    const [tracks, setTracks] = useState<SkillTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<'list' | 'create' | 'manage'>('list');
    const [classSearch, setClassSearch] = useState('');

    // Teachers & Students pools
    const teachers = useMemo(
        () => users.filter(u => u.role === 'teacher' || u.role === 'admin' || u.isAdmin === true),
        [users]
    );
    const students = useMemo(
        () => users.filter(u => !u.role || u.role === 'user'),
        [users]
    );

    // Create Class State
    const [createForm, setCreateForm] = useState({
        name: '',
        tag: '',
        description: '',
        trackId: '',
        isPublic: false,
        teacherId: ''
    });
    const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
    const [createStudentSearch, setCreateStudentSearch] = useState('');
    const [createLogo, setCreateLogo] = useState<ClanLogo | null>(null);
    const [showCreateLogoStudio, setShowCreateLogoStudio] = useState(false);
    const [creating, setCreating] = useState(false);

    // Manage / Assign Existing Class State
    const [selectedClass, setSelectedClass] = useState<AdminClassItem | null>(null);
    const [assignTeacherId, setAssignTeacherId] = useState('');
    const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
    const [assignTrackId, setAssignTrackId] = useState('');
    const [assignName, setAssignName] = useState('');
    const [assignDescription, setAssignDescription] = useState('');
    const [assignIsPublic, setAssignIsPublic] = useState(false);
    const [assignStudentSearch, setAssignStudentSearch] = useState('');
    const [savingAssign, setSavingAssign] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [classList, trackList] = await Promise.all([
                api.adminGetAllClasses(currentUser.userId),
                api.getSkillTracks().catch(() => [])
            ]);
            setClasses(Array.isArray(classList) ? classList : []);
            setTracks(Array.isArray(trackList) ? trackList : []);
        } catch (err) {
            onNotification('error', err instanceof Error ? err.message : 'Failed to load classes');
        } finally {
            setLoading(false);
        }
    }, [currentUser.userId, onNotification]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openManageClass = (cls: AdminClassItem) => {
        setSelectedClass(cls);
        setAssignTeacherId(cls.leaderId || '');
        setAssignStudentIds(Array.isArray(cls.studentIds) ? cls.studentIds : []);
        setAssignTrackId(cls.trackId || '');
        setAssignName(cls.name || '');
        setAssignDescription(cls.description || '');
        setAssignIsPublic(Boolean(cls.isPublic));
        setAssignStudentSearch('');
        setMode('manage');
    };

    const filteredClasses = useMemo(() => {
        const q = classSearch.trim().toLowerCase();
        if (!q) return classes;
        return classes.filter(c =>
            c.name.toLowerCase().includes(q)
            || c.tag.toLowerCase().includes(q)
            || (c.leaderName || '').toLowerCase().includes(q)
        );
    }, [classes, classSearch]);

    const filteredCreateStudents = useMemo(() => {
        const q = createStudentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
        );
    }, [students, createStudentSearch]);

    const filteredAssignStudents = useMemo(() => {
        const q = assignStudentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
        );
    }, [students, assignStudentSearch]);

    const toggleIdInList = (id: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.teacherId) {
            onNotification('warning', 'Please select a teacher to assign to this class');
            return;
        }
        setCreating(true);
        try {
            await api.createClan({
                name: createForm.name.trim(),
                tag: createForm.tag.trim().toUpperCase(),
                description: createForm.description.trim(),
                isPublic: createForm.isPublic,
                trackId: createForm.trackId || undefined,
                logo: createLogo || undefined,
                teacherId: createForm.teacherId,
                studentIds: createStudentIds
            }, currentUser.userId);
            onNotification('success', `Class "${createForm.name}" created with teacher & ${createStudentIds.length} students!`);
            setCreateForm({ name: '', tag: '', description: '', trackId: '', isPublic: false, teacherId: '' });
            setCreateStudentIds([]);
            setCreateLogo(null);
            setShowCreateLogoStudio(false);
            setMode('list');
            await loadData();
            await onRefresh();
        } catch (err) {
            onNotification('error', err instanceof Error ? err.message : 'Failed to create class');
        } finally {
            setCreating(false);
        }
    };

    const handleSaveAssignments = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return;
        setSavingAssign(true);
        try {
            await api.adminAssignClass(selectedClass.clanId, {
                teacherId: assignTeacherId || undefined,
                studentIds: assignStudentIds,
                trackId: assignTrackId || null,
                name: assignName.trim(),
                description: assignDescription,
                isPublic: assignIsPublic
            }, currentUser.userId);
            onNotification('success', `Updated teacher & ${assignStudentIds.length} enrolled students for "${assignName}"`);
            await loadData();
            await onRefresh();
            setMode('list');
        } catch (err) {
            onNotification('error', err instanceof Error ? err.message : 'Failed to save class assignments');
        } finally {
            setSavingAssign(false);
        }
    };

    const handleDeleteClass = async (clanId: string) => {
        try {
            await api.adminDeleteClass(clanId, currentUser.userId);
            setConfirmDeleteId(null);
            onNotification('success', 'Class deleted successfully.');
            await loadData();
            await onRefresh();
        } catch (err) {
            onNotification('error', err instanceof Error ? err.message : 'Failed to delete class');
        }
    };

    const copyInviteUrl = async (code?: string) => {
        if (!code || typeof window === 'undefined') return;
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/classes/join/${code}`);
            onNotification('success', 'Class invite link copied!');
        } catch {
            onNotification('error', 'Could not copy link');
        }
    };

    const renderTrackCheckboxGroup = (
        selectedTrackId: string,
        onSelectTrack: (trackId: string) => void
    ) => (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-black uppercase">Curriculum Track</label>
                {selectedTrackId && (
                    <button
                        type="button"
                        onClick={() => onSelectTrack('')}
                        className={`text-[10px] font-black uppercase cursor-pointer underline ${styles.mutedText}`}
                    >
                        Clear
                    </button>
                )}
            </div>
            <div className={`max-h-44 overflow-y-auto rounded-2xl p-2 space-y-1.5 ${styles.subtleBox}`}>
                {tracks.length === 0 ? (
                    <div className={`p-3 text-center text-xs font-bold ${styles.mutedText}`}>
                        No curriculum tracks available.
                    </div>
                ) : (
                    tracks.map(t => {
                        const checked = selectedTrackId === t.trackId;
                        return (
                            <label
                                key={t.trackId}
                                className={`p-2.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition text-xs ${
                                    checked ? styles.navItemActive : styles.secondaryBtn
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onSelectTrack(checked ? '' : t.trackId)}
                                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                                />
                                <span className="font-bold flex-1 min-w-0 truncate">{t.title}</span>
                                <span className={`text-[10px] font-black shrink-0 ${checked ? '' : styles.mutedText}`}>
                                    {t.modules?.length || 0} sessions
                                </span>
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );

    const renderEnrollmentCheckboxGroup = (
        isPublic: boolean,
        onChangePublic: (nextPublic: boolean) => void
    ) => (
        <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase">Enrollment Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                    { value: false, label: 'Invite / Admin Assigned' },
                    { value: true, label: 'Open Join Link' }
                ] as const).map(opt => {
                    const checked = isPublic === opt.value;
                    return (
                        <label
                            key={opt.label}
                            className={`p-3 rounded-xl flex items-center gap-2.5 cursor-pointer transition text-xs ${
                                checked ? styles.navItemActive : styles.subtleBox
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onChangePublic(opt.value)}
                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                            />
                            <span className="font-bold">{opt.label}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div className={`p-5 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${styles.heroBanner}`}>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${styles.pillPrimary}`}>
                            Admin Class Provisioning
                        </span>
                        <span className={`text-xs font-bold ${styles.mutedText}`}>
                            {classes.length} Classes • {teachers.length} Teachers • {students.length} Students
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                        Classes, Teachers &amp; Student Assignments
                    </h2>
                    <p className={`text-xs sm:text-sm font-medium ${styles.mutedText}`}>
                        Only administrators can create classes and assign teachers or enroll students into cohorts.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {mode !== 'list' ? (
                        <button
                            type="button"
                            onClick={() => setMode('list')}
                            className={`px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer ${styles.secondaryBtn}`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to Classes</span>
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={loadData}
                                className={`p-2.5 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                                title="Refresh classes"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('create')}
                                className={`px-5 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2 cursor-pointer ${styles.primaryBtn}`}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Class &amp; Assign</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* MODE 1: LIST CLASSES */}
            {mode === 'list' && (
                <div className="space-y-4">
                    <div className="relative max-w-md">
                        <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                        <input
                            value={classSearch}
                            onChange={e => setClassSearch(e.target.value)}
                            placeholder="Search classes by name, tag, or teacher..."
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                        />
                    </div>

                    {loading ? (
                        <div className={`py-14 text-center rounded-[2rem] ${styles.surfaceCard}`}>
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
                        </div>
                    ) : filteredClasses.length === 0 ? (
                        <div className={`p-12 rounded-[2rem] text-center space-y-4 ${styles.surfaceCard}`}>
                            <GraduationCap className="w-12 h-12 mx-auto opacity-70" />
                            <h3 className="text-lg font-black uppercase">No Classes Found</h3>
                            <p className={`text-xs max-w-md mx-auto font-medium ${styles.mutedText}`}>
                                Create your first class, assign a teacher, and pick enrolled students.
                            </p>
                            <button
                                type="button"
                                onClick={() => setMode('create')}
                                className={`px-5 py-3 rounded-2xl text-xs uppercase inline-flex items-center gap-2 cursor-pointer ${styles.primaryBtn}`}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create First Class</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {filteredClasses.map(cls => {
                                const isConfirmingDelete = confirmDeleteId === cls.clanId;
                                return (
                                    <div key={cls.clanId} className={`p-5 sm:p-6 rounded-[2rem] space-y-4 ${styles.surfaceCard}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <ClassEmblem logo={cls.logo} tag={cls.tag} name={cls.name} size="md" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${styles.pillPrimary}`}>
                                                            [{cls.tag}]
                                                        </span>
                                                        {cls.trackTitle ? (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black truncate max-w-[180px] ${styles.pillSuccess}`}>
                                                                {cls.trackIcon || '🗺️'} {cls.trackTitle}
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles.pillWarning}`}>
                                                                No Track
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-lg font-black truncate mt-1">{cls.name}</h3>
                                                    <div className={`text-xs font-bold mt-0.5 ${styles.mutedText}`}>
                                                        Teacher: <span className="font-black">{cls.leaderName}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {cls.inviteCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => copyInviteUrl(cls.inviteCode)}
                                                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer ${styles.secondaryBtn}`}
                                                    title="Copy invite link"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    <span>{cls.inviteCode}</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                                            <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                                                <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Students</div>
                                                <div className="text-sm sm:text-base font-black">{cls.studentIds?.length || 0}</div>
                                            </div>
                                            <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                                                <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Sessions</div>
                                                <div className="text-sm sm:text-base font-black">
                                                    {cls.finishedSessionsCount}/{cls.totalSessions || 0}
                                                </div>
                                            </div>
                                            <div className={`p-2 sm:p-2.5 rounded-xl ${styles.subtleBox}`}>
                                                <div className={`text-[9px] sm:text-[10px] font-black uppercase ${styles.mutedText}`}>Access</div>
                                                <div className="text-sm sm:text-base font-black">{cls.isPublic ? 'Open' : 'Invite'}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => openManageClass(cls)}
                                                className={`flex-1 py-2.5 px-4 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer ${styles.primaryBtn}`}
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                <span>Assign Teacher &amp; Students</span>
                                            </button>

                                            {isConfirmingDelete ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClass(cls.clanId)}
                                                        className={`px-3 py-2.5 rounded-xl text-xs cursor-pointer ${styles.dangerBtn}`}
                                                    >
                                                        Confirm Delete
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className={`px-2.5 py-2.5 rounded-xl text-xs cursor-pointer ${styles.secondaryBtn}`}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteId(cls.clanId)}
                                                    className={`p-2.5 rounded-xl cursor-pointer ${styles.dangerBtn}`}
                                                    title="Delete class"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* MODE 2: CREATE CLASS + ASSIGN TEACHER & STUDENTS */}
            {mode === 'create' && (
                <form onSubmit={handleCreateClass} className={`rounded-[2rem] p-6 sm:p-8 space-y-6 ${styles.surfaceCard}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Class Details & Assigned Teacher */}
                        <div className="space-y-4">
                            <h3 className="text-base font-black uppercase tracking-tight">1. Class Details &amp; Teacher</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black uppercase mb-1">Class Name</label>
                                    <input
                                        required
                                        value={createForm.name}
                                        onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Web Front-End Cohort A"
                                        className={`w-full p-3 rounded-xl font-bold text-sm ${styles.input}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase mb-1">Tag (2-5 chars)</label>
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={5}
                                        value={createForm.tag}
                                        onChange={e => setCreateForm(prev => ({ ...prev, tag: e.target.value.toUpperCase() }))}
                                        placeholder="WEB10"
                                        className={`w-full p-3 rounded-xl font-bold font-mono uppercase text-sm ${styles.input}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase mb-1">Assign Teacher (Required)</label>
                                <select
                                    required
                                    value={createForm.teacherId}
                                    onChange={e => setCreateForm(prev => ({ ...prev, teacherId: e.target.value }))}
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${styles.select}`}
                                >
                                    <option value="">-- Select Assigned Teacher --</option>
                                    {teachers.map(t => (
                                        <option key={t.userId} value={t.userId}>
                                            {t.name} ({t.email}) [{t.role === 'admin' ? 'Admin' : 'Teacher'}]
                                        </option>
                                    ))}
                                </select>
                                {teachers.filter(t => t.role === 'teacher').length === 0 && (
                                    <p className={`text-[11px] font-semibold mt-1 ${styles.mutedText}`}>
                                        Tip: Promote an account to Teacher in the Users tab to assign them here.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3">
                                {renderTrackCheckboxGroup(
                                    createForm.trackId,
                                    (trackId) => setCreateForm(prev => ({ ...prev, trackId }))
                                )}
                                {renderEnrollmentCheckboxGroup(
                                    createForm.isPublic,
                                    (isPublic) => setCreateForm(prev => ({ ...prev, isPublic }))
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={createForm.description}
                                    onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Cohort schedule, goals, or syllabus summary..."
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${styles.input}`}
                                />
                            </div>

                            <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${styles.subtleBox}`}>
                                <div className="flex items-center gap-3">
                                    <ClassEmblem
                                        logo={createLogo || { shape: 'rounded', icon: 'Shield', bgColor: '#fde047', iconColor: '#000000', showTag: true }}
                                        tag={createForm.tag || 'CLASS'}
                                        name={createForm.name || 'New Class'}
                                        size="sm"
                                    />
                                    <span className="text-xs font-black uppercase">Class Emblem</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateLogoStudio(v => !v)}
                                    className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer ${styles.secondaryBtn}`}
                                >
                                    <Palette className="w-3.5 h-3.5" />
                                    <span>{showCreateLogoStudio ? 'Hide Studio' : 'Customize'}</span>
                                </button>
                            </div>

                            {showCreateLogoStudio && (
                                <ClanLogoMakerModal
                                    inline={true}
                                    isOpen={true}
                                    onClose={() => setShowCreateLogoStudio(false)}
                                    clanName={createForm.name || 'New Class'}
                                    clanTag={createForm.tag || 'CLASS'}
                                    initialLogo={createLogo}
                                    onSave={logo => {
                                        setCreateLogo(logo);
                                        setShowCreateLogoStudio(false);
                                    }}
                                />
                            )}
                        </div>

                        {/* Right Column: Student Multi-Select Assignment */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base font-black uppercase tracking-tight">
                                    2. Assign Students ({createStudentIds.length} selected)
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCreateStudentIds(filteredCreateStudents.map(s => s.userId))}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreateStudentIds([])}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                                <input
                                    value={createStudentSearch}
                                    onChange={e => setCreateStudentSearch(e.target.value)}
                                    placeholder="Search students to enroll..."
                                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                />
                            </div>

                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                {filteredCreateStudents.map(stu => {
                                    const checked = createStudentIds.includes(stu.userId);
                                    return (
                                        <button
                                            key={stu.userId}
                                            type="button"
                                            onClick={() => toggleIdInList(stu.userId, createStudentIds, setCreateStudentIds)}
                                            className={`w-full p-3 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition ${
                                                checked
                                                    ? styles.navItemActive
                                                    : styles.subtleBox
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="font-black text-xs sm:text-sm truncate">{stu.name}</div>
                                                <div className="text-[11px] opacity-75 truncate">{stu.email}</div>
                                            </div>
                                            {checked ? <CheckSquare className="w-4 h-4 shrink-0" /> : <Square className="w-4 h-4 shrink-0 opacity-60" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={creating}
                        className={`w-full py-4 rounded-2xl text-sm uppercase tracking-wider cursor-pointer disabled:opacity-50 ${styles.primaryBtn}`}
                    >
                        {creating ? 'Creating Class & Assigning Members...' : `Create Class & Assign Teacher + ${createStudentIds.length} Students`}
                    </button>
                </form>
            )}

            {/* MODE 3: EDIT EXISTING CLASS TEACHER & STUDENT ASSIGNMENTS */}
            {mode === 'manage' && selectedClass && (
                <form onSubmit={handleSaveAssignments} className={`rounded-[2rem] p-6 sm:p-8 space-y-6 ${styles.surfaceCard}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <ClassEmblem logo={selectedClass.logo} tag={selectedClass.tag} name={selectedClass.name} size="md" />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-65">
                                    Editing Class Assignments
                                </div>
                                <h3 className="text-xl font-black">[{selectedClass.tag}] {selectedClass.name}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase mb-1">Assigned Teacher</label>
                                <select
                                    value={assignTeacherId}
                                    onChange={e => setAssignTeacherId(e.target.value)}
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${styles.select}`}
                                >
                                    {teachers.map(t => (
                                        <option key={t.userId} value={t.userId}>
                                            {t.name} ({t.email}) [{t.role === 'admin' ? 'Admin' : 'Teacher'}]
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {renderTrackCheckboxGroup(assignTrackId, setAssignTrackId)}

                            <div>
                                <label className="block text-xs font-black uppercase mb-1">Class Name</label>
                                <input
                                    value={assignName}
                                    onChange={e => setAssignName(e.target.value)}
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${styles.input}`}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={assignDescription}
                                    onChange={e => setAssignDescription(e.target.value)}
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${styles.input}`}
                                />
                            </div>

                            {renderEnrollmentCheckboxGroup(assignIsPublic, setAssignIsPublic)}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-black uppercase">
                                    Enrolled Students ({assignStudentIds.length} assigned)
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setAssignStudentIds(filteredAssignStudents.map(s => s.userId))}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        Select Filtered
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAssignStudentIds([])}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${styles.secondaryBtn}`}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${styles.mutedText}`} />
                                <input
                                    value={assignStudentSearch}
                                    onChange={e => setAssignStudentSearch(e.target.value)}
                                    placeholder="Search students to add or remove..."
                                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold ${styles.input}`}
                                />
                            </div>

                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                {filteredAssignStudents.map(stu => {
                                    const checked = assignStudentIds.includes(stu.userId);
                                    return (
                                        <button
                                            key={stu.userId}
                                            type="button"
                                            onClick={() => toggleIdInList(stu.userId, assignStudentIds, setAssignStudentIds)}
                                            className={`w-full p-3 rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition ${
                                                checked ? styles.navItemActive : styles.subtleBox
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="font-black text-xs sm:text-sm truncate">{stu.name}</div>
                                                <div className="text-[11px] opacity-75 truncate">{stu.email}</div>
                                            </div>
                                            {checked ? <CheckSquare className="w-4 h-4 shrink-0" /> : <Square className="w-4 h-4 shrink-0 opacity-60" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={savingAssign}
                        className={`w-full py-4 rounded-2xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${styles.primaryBtn}`}
                    >
                        <Save className="w-4 h-4" />
                        <span>{savingAssign ? 'Saving Assignments...' : 'Save Teacher & Student Assignments'}</span>
                    </button>
                </form>
            )}
        </div>
    );
};

export default ClassManagement;
