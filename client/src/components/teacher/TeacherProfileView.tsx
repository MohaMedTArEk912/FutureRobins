import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    GraduationCap,
    Users,
    CheckCircle2,
    Compass,
    MonitorPlay,
    Settings,
    Palette,
    FileCode,
    BarChart3,
    Gamepad2,
    Pencil,
    Mail,
    BadgeCheck,
    BookOpen,
    Sparkles,
    Save,
    X
} from 'lucide-react';
import type { UserData, MotionPresentation } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useTeacherWorkspace } from '../../context/TeacherWorkspaceContext';
import { useData } from '../../context/DataContext';
import Avatar from '../Avatar';
import AvatarEditor from '../AvatarEditor';
import UserSettings from '../UserSettings';
import WorkspaceThemeSwitcher from '../WorkspaceThemeSwitcher';
import ThemeSkeletonPreviewCards from '../ThemeSkeletonPreviewCards';
import { ClassEmblem } from '../social/ClassEmblem';
import { getTeacherThemeStyles } from './teacherTheme';

interface TeacherProfileViewProps {
    user: UserData;
    onBack?: () => void;
    onUserUpdate: (updatedUser: UserData) => void;
}

type TeacherProfileTab = 'portfolio' | 'decks' | 'appearance' | 'settings';

interface EducatorMeta {
    headline: string;
    bio: string;
    specialties: string;
}

const DEFAULT_EDUCATOR_META: EducatorMeta = {
    headline: 'Curriculum & Interactive Board Instructor',
    bio: 'Leading hands-on coding cohorts, live interactive lessons, and track-aligned assessments.',
    specialties: 'Web Development, Python, Interactive Labs'
};

export const TeacherProfileView: React.FC<TeacherProfileViewProps> = ({
    user,
    onUserUpdate
}) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const styles = useMemo(() => getTeacherThemeStyles(theme), [theme]);
    const { myClasses, loadingClasses, navigateToSection } = useTeacherWorkspace();
    const { skillTracks } = useData();

    const metaStorageKey = `teacher_profile_meta_${user.userId}`;
    const [educatorMeta, setEducatorMeta] = useState<EducatorMeta>(() => {
        try {
            const raw = localStorage.getItem(metaStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<EducatorMeta>;
                return {
                    headline: parsed.headline || DEFAULT_EDUCATOR_META.headline,
                    bio: parsed.bio || DEFAULT_EDUCATOR_META.bio,
                    specialties: parsed.specialties || DEFAULT_EDUCATOR_META.specialties
                };
            }
        } catch {
            // Ignore malformed local storage
        }
        return DEFAULT_EDUCATOR_META;
    });
    const [editingBio, setEditingBio] = useState(false);
    const [bioDraft, setBioDraft] = useState<EducatorMeta>(educatorMeta);

    const [activeTab, setActiveTab] = useState<TeacherProfileTab>('portfolio');
    const [showAvatarEditor, setShowAvatarEditor] = useState(false);
    const [presentations, setPresentations] = useState<MotionPresentation[]>([]);
    const [loadingDecks, setLoadingDecks] = useState(true);

    useEffect(() => {
        let mounted = true;
        api.getPresentations({}, user.userId)
            .then((list) => {
                if (mounted) {
                    setPresentations(Array.isArray(list) ? list : []);
                }
            })
            .catch(() => {
                if (mounted) setPresentations([]);
            })
            .finally(() => {
                if (mounted) setLoadingDecks(false);
            });
        return () => {
            mounted = false;
        };
    }, [user.userId]);

    const handleSaveEducatorMeta = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned: EducatorMeta = {
            headline: bioDraft.headline.trim() || DEFAULT_EDUCATOR_META.headline,
            bio: bioDraft.bio.trim() || DEFAULT_EDUCATOR_META.bio,
            specialties: bioDraft.specialties.trim() || DEFAULT_EDUCATOR_META.specialties
        };
        setEducatorMeta(cleaned);
        try {
            localStorage.setItem(metaStorageKey, JSON.stringify(cleaned));
        } catch {
            // Ignore storage quota errors
        }
        setEditingBio(false);
    };

    const specialtyList = useMemo(
        () => educatorMeta.specialties.split(',').map(s => s.trim()).filter(Boolean),
        [educatorMeta.specialties]
    );

    const trackMap = useMemo(
        () => new Map((skillTracks || []).map(t => [t.trackId, t])),
        [skillTracks]
    );

    const stats = useMemo(() => {
        const classesCount = myClasses.length;
        const studentsTaught = myClasses.reduce((sum, c) => sum + Math.max(0, (c.memberCount || 1) - 1), 0);
        const sessionsDelivered = myClasses.reduce((sum, c) => sum + (c.finishedSessionsCount || 0), 0);
        const decksCount = presentations.length;
        return { classesCount, studentsTaught, sessionsDelivered, decksCount };
    }, [myClasses, presentations.length]);

    return (
        <div className="flex-1 flex flex-col justify-between transition-colors">
            <main className="flex-1 relative z-10 w-full space-y-6">
                {/* Educator Dossier Hero Banner */}
                <section className={`rounded-[2rem] p-6 sm:p-8 ${styles.heroBanner}`}>
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 min-w-0">
                            <div className="relative shrink-0 self-start sm:self-center">
                                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden flex items-center justify-center ${
                                    styles.isBento
                                        ? 'bg-white border-[3px] border-black shadow-[4px_4px_0px_#000]'
                                        : 'bg-white dark:bg-[#0b0f1b] border-2 border-indigo-500/40 shadow-xl'
                                }`}>
                                    {user.avatar ? (
                                        <Avatar config={user.avatar} size="lg" className="w-full h-full" />
                                    ) : (
                                        <span className="text-2xl font-black">
                                            {(user.name || 'T').slice(0, 2).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAvatarEditor(v => !v)}
                                    title="Customize Educator Avatar"
                                    className={`absolute -bottom-2 -right-2 p-2 rounded-xl cursor-pointer ${styles.primaryBtn}`}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${styles.pillSuccess}`}>
                                        <BadgeCheck className="w-3.5 h-3.5" />
                                        <span>Verified Educator</span>
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${styles.pillPrimary}`}>
                                        Teacher Profile
                                    </span>
                                    {user.createdAt && (
                                        <span className={`text-xs font-bold ${styles.mutedText}`}>
                                            Teaching since {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">
                                        {user.name}
                                    </h1>
                                    <p className={`text-xs sm:text-sm font-bold mt-0.5 ${styles.mutedText}`}>
                                        {educatorMeta.headline}
                                    </p>
                                </div>

                                <div className={`flex items-center gap-1.5 text-xs font-semibold truncate ${styles.mutedText}`}>
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Teaching Metrics (No Student XP/Badges) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                            <div className={`px-4 py-3 rounded-2xl text-center ${styles.kpiTile('neutral')}`}>
                                <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Classes</div>
                                <div className="text-xl font-black mt-0.5">{stats.classesCount}</div>
                            </div>
                            <div className={`px-4 py-3 rounded-2xl text-center ${styles.kpiTile('indigo')}`}>
                                <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Students</div>
                                <div className="text-xl font-black mt-0.5">{stats.studentsTaught}</div>
                            </div>
                            <div className={`px-4 py-3 rounded-2xl text-center ${styles.kpiTile('emerald')}`}>
                                <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Sessions</div>
                                <div className="text-xl font-black mt-0.5">{stats.sessionsDelivered}</div>
                            </div>
                            <div className={`px-4 py-3 rounded-2xl text-center ${styles.kpiTile('amber')}`}>
                                <div className={`text-[10px] font-black uppercase ${styles.mutedText}`}>Decks</div>
                                <div className="text-xl font-black mt-0.5">{stats.decksCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* Educator Specialties & Bio Bar */}
                    <div className={`mt-5 pt-4 border-t ${styles.divider} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
                        {editingBio ? (
                            <form onSubmit={handleSaveEducatorMeta} className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    value={bioDraft.headline}
                                    onChange={(e) => setBioDraft(prev => ({ ...prev, headline: e.target.value }))}
                                    placeholder="Instructor Headline"
                                    className={`px-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                />
                                <input
                                    type="text"
                                    value={bioDraft.specialties}
                                    onChange={(e) => setBioDraft(prev => ({ ...prev, specialties: e.target.value }))}
                                    placeholder="Specialties (comma-separated)"
                                    className={`px-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={bioDraft.bio}
                                        onChange={(e) => setBioDraft(prev => ({ ...prev, bio: e.target.value }))}
                                        placeholder="Short teaching bio"
                                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold ${styles.input}`}
                                    />
                                    <button
                                        type="submit"
                                        className={`px-3 py-2 rounded-xl text-xs uppercase flex items-center gap-1 cursor-pointer shrink-0 ${styles.primaryBtn}`}
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBioDraft(educatorMeta);
                                            setEditingBio(false);
                                        }}
                                        className={`p-2 rounded-xl cursor-pointer shrink-0 ${styles.secondaryBtn}`}
                                        aria-label="Cancel bio edit"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="space-y-1.5 min-w-0">
                                    <p className={`text-xs sm:text-sm font-medium ${styles.mutedText}`}>
                                        {educatorMeta.bio}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {specialtyList.map((tag) => (
                                            <span key={tag} className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles.pillNeutral}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setBioDraft(educatorMeta);
                                        setEditingBio(true);
                                    }}
                                    className={`px-3.5 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shrink-0 self-start lg:self-center ${styles.secondaryBtn}`}
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Edit Teaching Bio</span>
                                </button>
                            </>
                        )}
                    </div>
                </section>

                {/* Inline Avatar Studio */}
                {showAvatarEditor && (
                    <section className={`rounded-[2rem] p-5 sm:p-6 ${styles.surfaceCard}`}>
                        <AvatarEditor
                            user={user}
                            onClose={() => setShowAvatarEditor(false)}
                            onUpdate={(updated) => {
                                onUserUpdate(updated);
                                setShowAvatarEditor(false);
                            }}
                        />
                    </section>
                )}

                {/* Educator Tab Bar + Direct Profile Workspace Theme Toggle */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className={`inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl max-w-full ${styles.surfaceCard}`}>
                        {([
                            { id: 'portfolio' as const, label: 'Teaching Portfolio', icon: GraduationCap },
                            { id: 'decks' as const, label: `Slide Decks (${stats.decksCount})`, icon: FileCode },
                            { id: 'appearance' as const, label: 'Avatar & Theme', icon: Palette },
                            { id: 'settings' as const, label: 'Account & Security', icon: Settings }
                        ]).map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${
                                        active ? styles.navItemActive : styles.navItemIdle
                                    }`}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className={`p-3 rounded-2xl w-full lg:w-[290px] shrink-0 ${styles.surfaceCard}`}>
                        <WorkspaceThemeSwitcher />
                    </div>
                </div>

                {/* TAB 1: TEACHING PORTFOLIO */}
                {activeTab === 'portfolio' && (
                    <div className="space-y-6">
                        {/* Educator Studio Launchpad */}
                        <section className={`rounded-[2rem] p-6 space-y-4 ${styles.surfaceCard}`}>
                            <h2 className="text-sm font-black uppercase tracking-wider">Educator Studio Shortcuts</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {([
                                    {
                                        label: 'Sessions & Board',
                                        desc: 'Deliver class modules & homework',
                                        action: () => navigateToSection(myClasses[0] ? 'sessions' : 'overview'),
                                        icon: Compass,
                                        accent: 'indigo' as const
                                    },
                                    {
                                        label: 'Presentations & JSON',
                                        desc: 'Upload decks or sample JSON',
                                        action: () => navigateToSection('presentations'),
                                        icon: FileCode,
                                        accent: 'amber' as const
                                    },
                                    {
                                        label: 'Interactive Board',
                                        desc: 'Launch full motion whiteboard',
                                        action: () => navigateToSection('board_studio'),
                                        icon: MonitorPlay,
                                        accent: 'emerald' as const
                                    },
                                    {
                                        label: 'Live Classroom',
                                        desc: 'Host live student quiz duels',
                                        action: () => navigate('/classroom'),
                                        icon: Gamepad2,
                                        accent: 'violet' as const
                                    }
                                ]).map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={item.action}
                                            className={`p-4 rounded-2xl text-left transition-all hover:-translate-y-0.5 cursor-pointer space-y-1.5 ${
                                                styles.isBento ? styles.kpiTile(item.accent) : styles.subtleBox
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <div className="font-black text-sm">{item.label}</div>
                                            <div className={`text-[11px] font-medium ${styles.mutedText}`}>{item.desc}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Assigned Classes & Curriculum Coverage */}
                        <section className={`rounded-[2rem] p-6 space-y-4 ${styles.surfaceCard}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h2 className="text-sm font-black uppercase tracking-wider">
                                    Assigned Classes &amp; Curriculum Coverage ({myClasses.length})
                                </h2>
                                <span className={`text-xs font-semibold ${styles.mutedText}`}>
                                    Provisioned by School Administrator
                                </span>
                            </div>

                            {loadingClasses ? (
                                <div className="py-10 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                                </div>
                            ) : myClasses.length === 0 ? (
                                <div className={`p-8 rounded-2xl text-center space-y-2 ${styles.subtleBox}`}>
                                    <GraduationCap className={`w-10 h-10 mx-auto ${styles.mutedText}`} />
                                    <p className={`text-sm font-bold ${styles.mutedText}`}>
                                        No classes assigned to your profile yet. Once an Administrator assigns you a class, coverage metrics and quick links appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {myClasses.map(cls => {
                                        const studentsCount = Math.max(0, (cls.memberCount || 1) - 1);
                                        const track = cls.trackId ? trackMap.get(cls.trackId) : undefined;
                                        const totalModules = track?.modules?.length || 0;
                                        const finished = cls.finishedSessionsCount || 0;
                                        const progressPct = totalModules > 0 ? Math.min(100, Math.round((finished / totalModules) * 100)) : 0;

                                        return (
                                            <div key={cls.clanId} className={`p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-4 ${styles.subtleBox}`}>
                                                <div className="flex items-start gap-3.5 min-w-0">
                                                    <ClassEmblem logo={cls.logo} tag={cls.tag} name={cls.name} size="md" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${styles.pillPrimary}`}>
                                                                [{cls.tag}]
                                                            </span>
                                                            {track ? (
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black truncate max-w-[190px] ${styles.pillSuccess}`}>
                                                                    {track.icon || '🗺️'} {track.title}
                                                                </span>
                                                            ) : (
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles.pillWarning}`}>
                                                                    No Track Assigned
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="font-black text-base truncate mt-1">{cls.name}</h3>
                                                        <div className={`flex items-center gap-3 text-xs font-bold mt-1 ${styles.mutedText}`}>
                                                            <span className="inline-flex items-center gap-1">
                                                                <Users className="w-3.5 h-3.5" /> {studentsCount} students
                                                            </span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> {finished}{totalModules > 0 ? `/${totalModules}` : ''} sessions
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {totalModules > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                                            <span className={styles.mutedText}>Track Progress</span>
                                                            <span>{progressPct}%</span>
                                                        </div>
                                                        <div className={`h-2 rounded-full overflow-hidden ${styles.isBento ? 'bg-white border border-black' : 'bg-slate-200 dark:bg-white/10'}`}>
                                                            <div
                                                                className={`h-full transition-all ${styles.isBento ? 'bg-[#bef264]' : 'bg-indigo-600'}`}
                                                                style={{ width: `${progressPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigateToSection('sessions', cls.clanId)}
                                                        className={`flex-1 py-2 px-3 rounded-xl text-xs uppercase cursor-pointer ${styles.primaryBtn}`}
                                                    >
                                                        Open Class Sessions →
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigateToSection('analytics', cls.clanId)}
                                                        className={`p-2 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                                                        title="Class Analytics"
                                                    >
                                                        <BarChart3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigateToSection('students', cls.clanId)}
                                                        className={`p-2 rounded-xl cursor-pointer ${styles.secondaryBtn}`}
                                                        title="Students & Invites"
                                                    >
                                                        <Users className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* TAB 2: SLIDE DECKS & PRESENTATIONS */}
                {activeTab === 'decks' && (
                    <section className={`rounded-[2rem] p-6 space-y-5 ${styles.surfaceCard}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <h2 className="text-base font-black uppercase tracking-tight">Teaching Slide Decks ({presentations.length})</h2>
                                <p className={`text-xs font-medium mt-0.5 ${styles.mutedText}`}>
                                    Interactive motion presentations available in your Teaching Board library.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigateToSection('presentations')}
                                className={`px-4 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer ${styles.primaryBtn}`}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Upload / Manage JSON Decks</span>
                            </button>
                        </div>

                        {loadingDecks ? (
                            <div className="py-10 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                            </div>
                        ) : presentations.length === 0 ? (
                            <div className={`p-8 rounded-2xl text-center space-y-3 ${styles.subtleBox}`}>
                                <BookOpen className={`w-10 h-10 mx-auto ${styles.mutedText}`} />
                                <p className={`text-sm font-bold ${styles.mutedText}`}>
                                    No custom decks uploaded yet. Upload a presentation JSON deck from the Presentations hub to build your teaching library.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {presentations.map((deck) => (
                                    <div key={deck.presentationId} className={`p-4 rounded-2xl flex flex-col justify-between gap-3 ${styles.subtleBox}`}>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${styles.pillPrimary}`}>
                                                    {deck.slides?.length || 0} Slides
                                                </span>
                                                {deck.moduleId && (
                                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold truncate max-w-[140px] ${styles.pillNeutral}`}>
                                                        {deck.moduleId}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-black text-sm truncate">{deck.title}</h3>
                                            {deck.description && (
                                                <p className={`text-xs line-clamp-2 ${styles.mutedText}`}>
                                                    {deck.description}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => navigateToSection('board_studio')}
                                            className={`w-full py-2 px-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer ${styles.secondaryBtn}`}
                                        >
                                            <MonitorPlay className="w-3.5 h-3.5" />
                                            <span>Open Teaching Board</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* TAB 3: AVATAR & THEME */}
                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <section className={`rounded-[2rem] p-6 space-y-5 ${styles.surfaceCard}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-tight">Choose Your Workspace Theme</h2>
                                    <p className={`text-xs sm:text-sm font-medium mt-1 ${styles.mutedText}`}>
                                        Teacher Studio, Sessions, Presentations, and the Interactive Board adapt immediately across Light, Dark, and Bento themes.
                                    </p>
                                </div>
                                <div className="w-full sm:w-[270px] shrink-0">
                                    <WorkspaceThemeSwitcher />
                                </div>
                            </div>
                            <ThemeSkeletonPreviewCards onThemeSelect={(chosen) => setTheme(chosen)} />
                        </section>

                        <section className={`rounded-[2rem] p-5 sm:p-6 ${styles.surfaceCard}`}>
                            <div className="mb-4">
                                <h2 className="text-base font-black uppercase tracking-tight">Customize Educator Avatar</h2>
                                <p className={`text-xs font-medium mt-0.5 ${styles.mutedText}`}>
                                    Appears in your sidebar identity card, class chats, and live classroom sessions.
                                </p>
                            </div>
                            <AvatarEditor
                                user={user}
                                onClose={() => setActiveTab('portfolio')}
                                onUpdate={(updated) => onUserUpdate(updated)}
                            />
                        </section>
                    </div>
                )}

                {/* TAB 4: ACCOUNT & SECURITY */}
                {activeTab === 'settings' && (
                    <section className={`rounded-[2rem] p-5 sm:p-6 ${styles.surfaceCard}`}>
                        <UserSettings
                            user={user}
                            onUpdate={onUserUpdate}
                            embedded={true}
                        />
                    </section>
                )}
            </main>
        </div>
    );
};

export default TeacherProfileView;
