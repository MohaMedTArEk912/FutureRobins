import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    GraduationCap,
    Plus,
    Users,
    Search,
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

const emptyClassForm = {
    name: '',
    tag: '',
    description: '',
    trackId: '',
    isPublic: false,
    teacherId: ''
};

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

    const [createForm, setCreateForm] = useState(emptyClassForm);
    const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
    const [createLogo, setCreateLogo] = useState<ClanLogo>();

    const [selectedClass, setSelectedClass] = useState<AdminClassItem | null>(null);
    const [editForm, setEditForm] = useState(emptyClassForm);
    const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
    const [editLogo, setEditLogo] = useState<ClanLogo>();

    const [studentSearch, setStudentSearch] = useState('');
    const [showEmblemStudio, setShowEmblemStudio] = useState(false);
    const customizeEmblemRef = useRef<HTMLButtonElement>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const isCreating = mode === 'create';
    const form = isCreating ? createForm : editForm;
    const setForm = isCreating ? setCreateForm : setEditForm;
    const studentIds = isCreating ? createStudentIds : editStudentIds;
    const setStudentIds = isCreating ? setCreateStudentIds : setEditStudentIds;
    const draftLogo = isCreating ? createLogo : editLogo;
    const emblem = draftLogo ?? (isCreating ? undefined : selectedClass?.logo);
    const className = form.name.trim() || 'New Class';
    const classTag = form.tag || 'CLASS';

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

    const showClassMode = (nextMode: typeof mode) => {
        setShowEmblemStudio(false);
        setStudentSearch('');
        setMode(nextMode);
    };

    const closeEmblemStudio = () => {
        setShowEmblemStudio(false);
        requestAnimationFrame(() => customizeEmblemRef.current?.focus());
    };

    const openManageClass = (cls: AdminClassItem) => {
        setSelectedClass(cls);
        setEditForm({
            teacherId: cls.leaderId || '',
            trackId: cls.trackId || '',
            name: cls.name || '',
            tag: cls.tag,
            description: cls.description || '',
            isPublic: Boolean(cls.isPublic)
        });
        setEditStudentIds(Array.isArray(cls.studentIds) ? cls.studentIds : []);
        setEditLogo(undefined);
        showClassMode('manage');
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

    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
        );
    }, [students, studentSearch]);
    const selectedStudentIds = useMemo(() => new Set(studentIds), [studentIds]);

    const handleSaveClass = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (saving || showEmblemStudio || (!isCreating && !selectedClass)) return;

        const name = form.name.trim();
        const tag = form.tag.trim().toUpperCase();
        if (!name || (isCreating && !form.teacherId)) {
            onNotification('warning', name ? 'Please select a teacher.' : 'Please enter a class name.');
            return;
        }

        if (isCreating && tag.length < 2) {
            onNotification('warning', 'The class tag needs at least two characters.');
            return;
        }

        setSaving(true);
        const settings = {
            name,
            description: isCreating ? form.description.trim() : form.description,
            isPublic: form.isPublic,
            teacherId: form.teacherId || undefined,
            studentIds,
            logo: draftLogo
        };
        try {
            if (isCreating) {
                await api.createClan({
                    ...settings,
                    tag,
                    trackId: form.trackId || undefined
                }, currentUser.userId);
                setCreateForm(emptyClassForm);
                setCreateStudentIds([]);
                setCreateLogo(undefined);
            } else if (selectedClass) {
                await api.adminAssignClass(selectedClass.clanId, {
                    ...settings,
                    trackId: form.trackId || null
                }, currentUser.userId);
            }

            onNotification('success', isCreating ? `Class "${name}" created.` : `Class "${name}" updated.`);
            showClassMode('list');
            await loadData();
            await onRefresh();
        } catch (err) {
            onNotification('error', err instanceof Error ? err.message : 'Failed to save class');
        } finally {
            setSaving(false);
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
        <div className="space-y-2" role="group" aria-labelledby="class-curriculum-label">
            <div className="flex items-center justify-between gap-2">
                <span id="class-curriculum-label" className="text-xs font-black uppercase">Curriculum track</span>
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
            <div className={`max-h-64 overflow-y-auto rounded-xl p-2.5 space-y-2 custom-scrollbar ${styles.subtleBox}`}>
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
                                    checked ? styles.navItemActive : styles.navItemIdle
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onSelectTrack(checked ? '' : t.trackId)}
                                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                                />
                                <span className="font-bold flex-1 min-w-0 wrap-anywhere">{t.title}</span>
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
        <div className="space-y-2" role="radiogroup" aria-labelledby="class-enrollment-label">
            <span id="class-enrollment-label" className="block text-xs font-black uppercase">Enrollment mode</span>
            <div className="flex flex-wrap gap-2">
                {([
                    { value: false, label: 'Invite / Admin Assigned' },
                    { value: true, label: 'Open Join Link' }
                ] as const).map(opt => {
                    const checked = isPublic === opt.value;
                    return (
                        <label
                            key={opt.label}
                            className={`flex flex-[1_1_10rem] items-center gap-2.5 rounded-xl p-3 text-xs cursor-pointer transition ${
                                checked ? styles.navItemActive : styles.subtleBox
                            }`}
                        >
                            <input
                                type="radio"
                                name="class-enrollment"
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
            {mode === 'list' ? (
                <div className={`flex flex-col justify-between gap-4 rounded-[2rem] p-5 sm:flex-row sm:items-center sm:p-6 ${styles.heroBanner}`}>
                    <div className="min-w-0 space-y-1">
                        <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                            Classes, Teachers &amp; Student Assignments
                        </h2>
                        <p className={`text-xs font-bold ${styles.mutedText}`}>
                            {classes.length} classes · {teachers.length} teachers · {students.length} students
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={loadData}
                            className={`cursor-pointer rounded-xl p-2.5 ${styles.secondaryBtn}`}
                            aria-label="Refresh classes"
                        >
                            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => showClassMode('create')}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs ${styles.primaryBtn}`}
                        >
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            Create class
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => showClassMode('list')}
                    disabled={saving}
                    className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50 ${styles.secondaryBtn}`}
                >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    Back to classes
                </button>
            )}

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
                                onClick={() => showClassMode('create')}
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
                                                <span>Edit Class</span>
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

            {(isCreating || (mode === 'manage' && selectedClass)) && (
                <form
                    onSubmit={handleSaveClass}
                    className={`@container min-w-0 space-y-5 rounded-2xl p-3 sm:rounded-[2rem] sm:p-6 ${styles.surfaceCard}`}
                >
                    <div className={`flex min-w-0 items-center gap-3 border-b px-1 pb-4 ${styles.divider}`}>
                        <ClassEmblem logo={emblem} tag={classTag} name={className} size="md" />
                        <div className="min-w-0">
                            <h3 className="text-xl font-black tracking-tight">
                                {isCreating ? 'Create class' : 'Edit class'}
                            </h3>
                            {!isCreating && (
                                <p className={`wrap-anywhere text-sm font-semibold ${styles.mutedText}`}>
                                    [{selectedClass?.tag}] {selectedClass?.name}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid items-start gap-5 @min-[46rem]:grid-cols-2">
                        <section aria-labelledby="class-details-heading" className={`min-w-0 space-y-4 rounded-2xl border p-3 @sm:p-4 ${styles.divider}`}>
                            <h4 id="class-details-heading" className="text-base font-black">Class details</h4>
                            <div className="flex flex-wrap gap-3">
                                <div className="min-w-0 flex-[1_1_12rem]">
                                    <label htmlFor="admin-class-name" className="mb-1 block text-xs font-black uppercase">Class name</label>
                                    <input
                                        id="admin-class-name"
                                        required
                                        value={form.name}
                                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Web Front-End Cohort A"
                                        className={`w-full rounded-xl p-3 text-sm font-bold ${styles.input}`}
                                    />
                                </div>
                                {isCreating && (
                                    <div className="min-w-0 flex-[1_0_7rem]">
                                        <label htmlFor="admin-class-tag" className="mb-1 block text-xs font-black uppercase">Tag (2–5 chars)</label>
                                        <input
                                            id="admin-class-tag"
                                            required
                                            minLength={2}
                                            maxLength={5}
                                            value={form.tag}
                                            onChange={e => setForm(prev => ({ ...prev, tag: e.target.value.toUpperCase() }))}
                                            placeholder="WEB10"
                                            className={`w-full rounded-xl p-3 font-mono text-sm font-bold uppercase ${styles.input}`}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label htmlFor="admin-class-teacher" className="mb-1 block text-xs font-black uppercase">Assigned teacher</label>
                                <select
                                    id="admin-class-teacher"
                                    required={isCreating}
                                    value={form.teacherId}
                                    onChange={e => setForm(prev => ({ ...prev, teacherId: e.target.value }))}
                                    className={`w-full min-w-0 rounded-xl p-3 text-sm font-bold ${styles.select}`}
                                >
                                    <option value="" disabled>Select a teacher</option>
                                    {!isCreating && form.teacherId && !teachers.some(t => t.userId === form.teacherId) && (
                                        <option value={form.teacherId}>{selectedClass?.leaderName || 'Current teacher'}</option>
                                    )}
                                    {teachers.map(t => (
                                        <option key={t.userId} value={t.userId}>
                                            {t.name} ({t.email}) [{t.role === 'admin' ? 'Admin' : 'Teacher'}]
                                        </option>
                                    ))}
                                </select>
                                {isCreating && !teachers.some(t => t.role === 'teacher') && (
                                    <p className={`mt-2 text-xs ${styles.mutedText}`}>
                                        You can promote an account to Teacher in the Users tab.
                                    </p>
                                )}
                            </div>

                            {renderTrackCheckboxGroup(form.trackId, trackId => setForm(prev => ({ ...prev, trackId })))}
                            {renderEnrollmentCheckboxGroup(form.isPublic, isPublic => setForm(prev => ({ ...prev, isPublic })))}

                            <div>
                                <label htmlFor="admin-class-description" className="mb-1 block text-xs font-black uppercase">Description</label>
                                <textarea
                                    id="admin-class-description"
                                    rows={2}
                                    value={form.description}
                                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Cohort schedule, goals, or syllabus summary"
                                    className={`block w-full resize-y rounded-xl p-3 text-sm ${styles.input}`}
                                />
                            </div>
                        </section>

                        <section aria-labelledby="class-students-heading" className={`min-w-0 space-y-3 rounded-2xl border p-3 @sm:p-4 ${styles.divider}`}>
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                <h4 id="class-students-heading" className="text-base font-black">Students</h4>
                                <span aria-live="polite" className={`rounded-lg px-2 py-1 text-xs font-bold ${styles.pillNeutral}`}>
                                    {studentIds.length} selected
                                </span>
                            </div>

                            <div className="relative">
                                <Search aria-hidden="true" className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${styles.mutedText}`} />
                                <input
                                    aria-label="Search students by name or email"
                                    type="search"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                                    placeholder="Search names or emails"
                                    className={`w-full rounded-xl py-2.5 pl-9 pr-3 text-sm ${styles.input}`}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={!filteredStudents.some(s => !selectedStudentIds.has(s.userId))}
                                    onClick={() => setStudentIds(ids => [...new Set([...ids, ...filteredStudents.map(s => s.userId)])])}
                                    className={`min-h-8 rounded-lg px-2.5 py-1 text-xs cursor-pointer disabled:opacity-50 ${styles.secondaryBtn}`}
                                >
                                    {studentSearch.trim() ? 'Select matches' : 'Select all'}
                                </button>
                                <button
                                    type="button"
                                    disabled={studentIds.length === 0}
                                    onClick={() => setStudentIds([])}
                                    className={`min-h-8 rounded-lg px-2.5 py-1 text-xs cursor-pointer disabled:opacity-50 ${styles.secondaryBtn}`}
                                >
                                    Clear selection
                                </button>
                            </div>

                            <div className={`max-h-[25rem] overflow-y-auto rounded-xl border px-2 py-1 custom-scrollbar ${styles.divider}`}>
                                {filteredStudents.length === 0 && (
                                    <p className={`p-4 text-sm ${styles.mutedText}`}>
                                        {studentSearch.trim() ? 'No students match your search.' : 'No students are available.'}
                                    </p>
                                )}
                                {filteredStudents.map(student => {
                                    const checked = selectedStudentIds.has(student.userId);
                                    return (
                                        <label
                                            key={student.userId}
                                            className={`my-1 flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors ${checked ? styles.pillSuccess : styles.navItemIdle}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const nextChecked = e.target.checked;
                                                    setStudentIds(ids => nextChecked
                                                        ? [...ids, student.userId]
                                                        : ids.filter(id => id !== student.userId));
                                                }}
                                                className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                                            />
                                            <span className="min-w-0 text-left">
                                                <span className="block wrap-anywhere text-sm font-bold">{student.name}</span>
                                                <span className={`block wrap-anywhere text-xs ${checked ? 'opacity-80' : styles.mutedText}`}>{student.email}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    {showEmblemStudio ? (
                        <ClanLogoMakerModal
                            inline
                            isOpen
                            saveWithClass
                            onClose={closeEmblemStudio}
                            clanName={className}
                            clanTag={classTag}
                            initialLogo={emblem}
                            onSave={isCreating ? setCreateLogo : setEditLogo}
                        />
                    ) : (
                        <section
                            aria-labelledby="class-emblem-heading"
                            className={`flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl p-3 @sm:p-4 ${styles.subtleBox}`}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <ClassEmblem logo={emblem} tag={classTag} name={className} size="sm" />
                                <h4 id="class-emblem-heading" className="font-black">Class emblem</h4>
                            </div>
                            <button
                                type="button"
                                ref={customizeEmblemRef}
                                onClick={() => setShowEmblemStudio(true)}
                                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs cursor-pointer ${styles.secondaryBtn}`}
                            >
                                <Palette aria-hidden="true" className="h-4 w-4 shrink-0" />
                                Customize emblem
                            </button>
                        </section>
                    )}

                    <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-1 pt-4 ${styles.divider}`}>
                        <p className={`text-sm ${styles.mutedText}`}>
                            {showEmblemStudio
                                ? 'Apply or cancel the emblem draft before saving the class.'
                                : `${studentIds.length} ${studentIds.length === 1 ? 'student' : 'students'} selected for enrollment`}
                        </p>
                        <button
                            type="submit"
                            disabled={saving || showEmblemStudio}
                            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm cursor-pointer disabled:opacity-50 @sm:w-auto ${styles.primaryBtn}`}
                        >
                            {isCreating ? <Plus aria-hidden="true" className="h-4 w-4" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                            {saving ? 'Saving class…' : isCreating ? 'Create class' : 'Save class changes'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default ClassManagement;
