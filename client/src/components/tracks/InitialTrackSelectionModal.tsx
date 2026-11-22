import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, BookOpen, Monitor, Cpu, Database, Globe, Atom, FlaskConical, Calculator, Languages, FileText, Brain, Code, Terminal, Layers } from 'lucide-react';
import type { Subject, UserData, Quiz } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';

const ICON_MAP: Record<string, React.ReactNode> = {
    'BookOpen': <BookOpen className="w-7 h-7" />,
    'Monitor': <Monitor className="w-7 h-7" />,
    'Cpu': <Cpu className="w-7 h-7" />,
    'Database': <Database className="w-7 h-7" />,
    'Globe': <Globe className="w-7 h-7" />,
    'Atom': <Atom className="w-7 h-7" />,
    'FlaskConical': <FlaskConical className="w-7 h-7" />,
    'Calculator': <Calculator className="w-7 h-7" />,
    'Languages': <Languages className="w-7 h-7" />,
    'FileText': <FileText className="w-7 h-7" />,
    'Brain': <Brain className="w-7 h-7" />,
    'Code': <Code className="w-7 h-7" />,
    'Terminal': <Terminal className="w-7 h-7" />,
};

const SubjectIcon: React.FC<{ icon: string }> = ({ icon }) => {
    if (ICON_MAP[icon]) {
        return <>{ICON_MAP[icon]}</>;
    }
    return <span className="text-3xl">{icon || '🗺️'}</span>;
};

interface InitialTrackSelectionModalProps {
    subjects: Subject[];
    quizzes: Quiz[];
    currentUser: UserData;
    onSuccess: (updatedUser: Partial<UserData>) => void;
    onNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

const InitialTrackSelectionModal: React.FC<InitialTrackSelectionModalProps> = ({
    subjects,
    quizzes,
    currentUser,
    onSuccess,
    onNotification
}) => {
    const { isBento } = useTheme();
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!selectedSubjectId) {
            onNotification('info', 'Please select a learning track to continue');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.selectInitialTrack(selectedSubjectId);
            if (res.success) {
                onNotification('success', res.message || 'Track selected successfully! Welcome aboard!');
                onSuccess({
                    ...currentUser,
                    primaryTrackId: selectedSubjectId,
                    unlockedTracks: [selectedSubjectId]
                });
            }
        } catch (error) {
            console.error('Error confirming track:', error);
            const msg = error instanceof Error ? error.message : 'Failed to select track';
            onNotification('error', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 animate-in fade-in duration-300 overflow-y-auto">
            <div className={`app-dialog-panel app-dialog-panel--structured app-dialog-panel--padded relative w-full max-w-4xl rounded-2xl p-6 sm:p-10 flex flex-col my-auto max-h-[90vh] ${
                isBento
                    ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                    : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504,0_24px_60px_rgba(0,0,0,0.78)]'
            }`}>
                {/* Header */}
                <div className="text-center mb-8 shrink-0">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-4 ${
                        isBento
                            ? 'bg-[#fde047] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#1c2317] border border-[#bef264]/35 text-[#bef264]'
                    }`}>
                        <Sparkles className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                        <span>Welcome, {currentUser.name || 'Student'}!</span>
                    </div>
                    <h2 className={`text-3xl sm:text-4xl font-black uppercase tracking-tight mb-3 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                        Choose Your <span className={isBento ? 'bg-[#bef264] px-2 border-2 border-black text-black' : 'text-[#bef264]'}>Learning Road</span>
                    </h2>
                    <p className={`text-sm sm:text-base font-medium max-w-xl mx-auto ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                        Select which primary track you belong to. Your chosen road will unlock immediately. You can request access to additional roads anytime!
                    </p>
                </div>

                {/* Road Cards Selection Grid */}
                <div className="app-dialog-body flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjects.map((subject) => {
                            const isSelected = selectedSubjectId === subject._id;
                            const subjectQuizzes = quizzes.filter(q => q.subjectId === subject._id);

                            return (
                                <div
                                    key={subject._id}
                                    onClick={() => setSelectedSubjectId(subject._id)}
                                    className={`relative p-5 rounded-3xl transition-all duration-200 cursor-pointer flex flex-col group overflow-hidden ${
                                        isSelected
                                            ? isBento
                                                ? 'bg-[#bef264] border-[2.5px] border-black shadow-[4px_4px_0px_#000] text-black'
                                                : 'bg-[#1c2317] border-2 border-[#bef264] text-[#f5f3ec]'
                                            : isBento
                                                ? 'bg-[#f5f3ec] border-2 border-black hover:bg-white shadow-[2px_2px_0px_#000] text-black'
                                                : 'bg-[#1a1714] border border-[#2e2924] hover:border-[#bef264]/50 hover:bg-[#211d19] text-[#f5f3ec]'
                                    }`}
                                >
                                    {/* Selection badge */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                                            isSelected
                                                ? isBento
                                                    ? 'bg-black text-[#bef264] border-2 border-black'
                                                    : 'bg-[#bef264] text-[#0a0908]'
                                                : isBento
                                                    ? 'bg-white border-2 border-black text-black'
                                                    : 'bg-[#141210] border border-[#2e2924] text-[#bef264]'
                                        }`}>
                                            <SubjectIcon icon={subject.icon} />
                                        </div>

                                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                                            isSelected
                                                ? isBento
                                                    ? 'bg-black text-[#bef264]'
                                                    : 'bg-[#bef264] text-[#0a0908]'
                                                : isBento
                                                    ? 'border-2 border-black bg-white'
                                                    : 'border-2 border-[#3a332c]'
                                        }`}>
                                            {isSelected && <Check className="w-4 h-4" strokeWidth={3} />}
                                        </div>
                                    </div>

                                    <h3 className={`text-lg font-black uppercase tracking-tight mb-2 transition-colors line-clamp-1 ${
                                        isBento
                                            ? 'text-black'
                                            : isSelected ? 'text-[#bef264]' : 'text-[#f5f3ec] group-hover:text-[#bef264]'
                                    }`}>
                                        {subject.title}
                                    </h3>

                                    <p className={`text-xs font-medium line-clamp-2 mb-4 leading-relaxed flex-1 ${
                                        isBento ? 'text-neutral-700' : 'text-[#a8a29e]'
                                    }`}>
                                        {subject.description || 'Master key concepts, quizzes, and modules in this learning road.'}
                                    </p>

                                    <div className={`pt-3 border-t flex items-center justify-between text-[11px] font-bold ${
                                        isBento ? 'border-black/20 text-black' : 'border-[#2e2924] text-[#a8a29e]'
                                    }`}>
                                        <span className="flex items-center gap-1.5">
                                            <Layers className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                            {subjectQuizzes.length} Quizzes
                                        </span>
                                        {isSelected && (
                                            <span className={`font-black uppercase tracking-wider text-[10px] ${
                                                isBento ? 'text-black' : 'text-[#bef264]'
                                            }`}>
                                                Selected
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {subjects.length === 0 && (
                            <div className={`col-span-full py-12 text-center ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p className="font-bold">No tracks available yet. Please ask an administrator to create learning roads.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className={`mt-6 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 ${
                    isBento ? 'border-black/20' : 'border-[#2e2924]'
                }`}>
                    <div className={`text-xs font-bold text-center sm:text-left ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                        {selectedSubjectId ? (
                            <span className={`font-black ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                Ready to unlock: {subjects.find(s => s._id === selectedSubjectId)?.title}
                            </span>
                        ) : (
                            <span>Please select your track to begin</span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedSubjectId || isSubmitting}
                        className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] active:scale-95'
                        }`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Enroll & Unlock Track</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InitialTrackSelectionModal;
