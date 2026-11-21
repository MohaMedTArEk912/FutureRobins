import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Check, X, Layout, Video, GraduationCap, Target, Play
} from 'lucide-react';
import type { SkillModule, Quiz, AttemptData } from '../types';
import { getQuizPoolStatus } from '../utils/poolUtils';
import { useTheme } from '../context/ThemeContext';

interface UserRoadmapViewProps {
    modules: SkillModule[];
    quizzes?: Quiz[];
    attempts?: AttemptData[];
    userProgress?: {
        completedModules: string[];
        unlockedModules: string[];
        completedSubModules?: string[]; // Format: "moduleId:subModuleId"
    };
    onSubModuleComplete?: (moduleId: string, subModuleId: string) => Promise<void>;
    onStartQuiz?: (quiz: Quiz) => void;
}

const UserRoadmapView: React.FC<UserRoadmapViewProps> = ({
    modules,
    quizzes = [],
    attempts = [],
    userProgress,
    onSubModuleComplete,
    onStartQuiz
}) => {
    const { isBento } = useTheme();
    const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [completingSubModule, setCompletingSubModule] = useState<string | null>(null);
    const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isDetailsOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsDetailsOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isDetailsOpen]);

    // Sort modules by level/index to ensure correct order
    const sortedModules = [...modules].sort((a, b) => (a.level || 0) - (b.level || 0));

    // Module completion requires 70% minimum on ALL quizzes
    const MODULE_PASSING_THRESHOLD = 70;

    const computeStatus = (module: SkillModule) => {
        // Default to locked
        let status = 'locked';
        let isLocked = true;
        let isCompleted = false;

        // Progress Calculation
        const moduleQuizzes = quizzes.filter(q => module.quizIds?.includes(q.id || q._id || ''));
        const subModules = module.subModules || [];
        const totalItems = moduleQuizzes.length + subModules.length;

        let completedItems = 0;

        // Count completed sub-modules
        let allSubsComplete = true;
        if (subModules.length > 0) {
            subModules.forEach(sub => {
                const subKey = `${module.moduleId}:${sub.id}`;
                if (userProgress?.completedSubModules?.includes(subKey) || optimisticCompleted.has(subKey)) {
                    completedItems++;
                } else {
                    allSubsComplete = false;
                }
            });
        }

        // Count completed quizzes and check if all passed
        let allQuizzesPassed = true;
        if (moduleQuizzes.length > 0) {
            moduleQuizzes.forEach(q => {
                const qId = q.id || q._id;
                const hasPassed = attempts.some(a => a.quizId === qId && a.percentage >= MODULE_PASSING_THRESHOLD);
                if (hasPassed) {
                    completedItems++;
                } else {
                    allQuizzesPassed = false;
                }
            });
        } else {
            // If no quizzes, consider quizzes as "passed" for completion check
            allQuizzesPassed = true;
        }

        const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        // Check if module is actually complete (all quizzes passed + all sub-modules done)
        // If module has no items (no quizzes and no sub-modules), consider it complete if marked in backend
        const isActuallyComplete = totalItems > 0 ? (allSubsComplete && allQuizzesPassed) : false;

        // Determine main status
        if (userProgress) {
            // Check if marked as completed in backend OR if actually complete
            if (userProgress.completedModules?.includes(module.moduleId) || isActuallyComplete) {
                status = 'completed';
                isLocked = false;
                isCompleted = true;
            } else if (userProgress.unlockedModules?.includes(module.moduleId)) {
                status = 'available';
                isLocked = false;
            } else {
                // Check if previous module is completed to unlock this one
                const moduleIndex = sortedModules.findIndex(m => m.moduleId === module.moduleId);
                if (moduleIndex > 0) {
                    const prevModule = sortedModules[moduleIndex - 1];
                    // Check if previous module is completed (avoid recursion by checking directly)
                    const prevModuleQuizzes = quizzes.filter(q => prevModule.quizIds?.includes(q.id || q._id || ''));
                    const prevSubModules = prevModule.subModules || [];
                    let prevAllSubsComplete = true;
                    if (prevSubModules.length > 0) {
                        prevAllSubsComplete = prevSubModules.every(sub => {
                            const subKey = `${prevModule.moduleId}:${sub.id}`;
                            return userProgress?.completedSubModules?.includes(subKey);
                        });
                    }
                    let prevAllQuizzesPassed = true;
                    if (prevModuleQuizzes.length > 0) {
                        prevAllQuizzesPassed = prevModuleQuizzes.every(q => {
                            const qId = q.id || q._id;
                            return attempts.some(a => a.quizId === qId && a.percentage >= MODULE_PASSING_THRESHOLD);
                        });
                    }
                    const prevIsComplete = prevAllSubsComplete && prevAllQuizzesPassed && (prevModuleQuizzes.length > 0 || prevSubModules.length > 0);

                    if (userProgress.completedModules?.includes(prevModule.moduleId) || prevIsComplete) {
                        // Auto-unlock if previous is completed
                        status = 'available';
                        isLocked = false;
                    }
                } else if (moduleIndex === 0) {
                    // First module is always available if nothing is started
                    if (!userProgress.completedModules?.length && !userProgress.unlockedModules?.length) {
                        status = 'available';
                        isLocked = false;
                    }
                }
            }
        } else {
            // Fallback if no user progress
            if (sortedModules[0]?.moduleId === module.moduleId) {
                status = 'available';
                isLocked = false;
            }
        }

        return { status, isLocked, isCompleted, progressPercent, totalItems, completedItems, isActuallyComplete };
    };

    const handleModuleClick = (module: SkillModule) => {
        const { isLocked } = computeStatus(module);
        if (isLocked) return;
        setSelectedModule(module);
        setIsDetailsOpen(true);
    };

    const handleToggleSubModule = async (subModuleId: string) => {
        if (!onSubModuleComplete || !selectedModule) return;

        // Check if already completed
        const subModuleKey = `${selectedModule.moduleId}:${subModuleId}`;
        const isCompleted = userProgress?.completedSubModules?.includes(subModuleKey);

        if (isCompleted) return; // One-way completion for now

        // Optimistic Update
        setOptimisticCompleted(prev => new Set(prev).add(subModuleKey));

        setCompletingSubModule(subModuleId);
        try {
            await onSubModuleComplete(selectedModule.moduleId, subModuleId);
        } catch (error) {
            console.error("Failed to complete sub-module", error);
            // Revert optimistic update on failure
            setOptimisticCompleted(prev => {
                const next = new Set(prev);
                next.delete(subModuleKey);
                return next;
            });
        } finally {
            setCompletingSubModule(null);
        }
    };

    // Chunk modules into rows of 2
    const chunkedModules = [];
    for (let i = 0; i < sortedModules.length; i += 2) {
        chunkedModules.push(sortedModules.slice(i, i + 2));
    }

    // Helper for modal details
    const getModuleDetails = (module: SkillModule) => {
        const { progressPercent, completedItems, totalItems } = computeStatus(module);
        const moduleQuizzes = quizzes.filter(q => module.quizIds?.includes(q.id || q._id || ''));
        return { progressPercent, completedItems, totalItems, moduleQuizzes };
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4">
            <div className="flex flex-col gap-10 md:gap-20 relative pb-20">
                {/* Vertical Spine Line for Mobile */}
                <div className={`absolute left-6 top-8 bottom-20 md:hidden rounded-full ${
                    isBento ? 'w-1.5 bg-black' : 'w-1 bg-[#2e2924]'
                }`} />

                {chunkedModules.map((rowModules, rowIndex) => {
                    // Determine if this is a reversed row (for snake pattern: Right->Left)
                    const isReversed = rowIndex % 2 === 1; // Rows 1, 3, 5... are reversed

                    // Prepare modules for display
                    // If reversed, we swap them visually in the grid (but keep logical order for flex mobile)
                    const displayModules = isReversed ? [...rowModules].reverse() : rowModules;

                    return (
                        <div
                            key={rowIndex}
                            className={`relative flex ${isReversed ? 'flex-col-reverse' : 'flex-col'} md:grid md:grid-cols-2 gap-8 md:gap-28`}
                        >
                            {/* Desktop Connectors */}
                            {/* Horizontal Line Pattern */}
                            {displayModules.length === 2 && (
                                <div className={`hidden md:block absolute top-1/2 left-0 right-0 -z-10 mx-auto w-[calc(100%-4rem)] rounded-full ${
                                    isBento ? 'h-1.5 bg-black' : 'h-[2px] bg-[#2e2924]'
                                }`} />
                            )}

                            {/* Vertical turn connectors */}
                            {rowIndex < chunkedModules.length - 1 && (
                                <div className={`hidden md:block absolute top-1/2 h-[calc(100%+5rem)] w-[calc(50%+2px)] rounded-[2.5rem] -z-10 
                                    ${isBento ? 'border-[3.5px] border-black' : 'border-2 border-[#2e2924]'}
                                    ${isReversed
                                        ? 'left-0 border-r-0 rounded-r-none border-b-0 rounded-bl-none' // Coming from Left, turning Down-Right
                                        : 'right-0 border-l-0 rounded-l-none border-b-0 rounded-br-none' // Coming from Right, turning Down-Left
                                    }`}
                                />
                            )}

                            {displayModules.map((module) => {
                                const { isLocked, isCompleted, progressPercent } = computeStatus(module);
                                const moduleNumber = module.level || (sortedModules.indexOf(module) + 1);

                                // Authentic Neo-Brutalist Bento & Noir Studio Dark Card Styling (100% Opaque Solid Surfaces)
                                const containerClasses = isBento
                                    ? isLocked
                                        ? 'bg-[#faf8f2] border-[2.5px] border-black text-black'
                                        : isCompleted
                                            ? 'bg-[#bef264] border-[3px] border-black text-black'
                                            : 'bg-white border-[3px] border-black text-black'
                                    : isLocked
                                        ? 'bg-[#11100e] border-[1.5px] border-[#23201c] text-[#78716c]'
                                        : isCompleted
                                            ? 'bg-[#141210] border-[1.5px] border-[#2e2924] border-t-[3px] border-t-[#bef264] text-[#f5f3ec]'
                                            : 'bg-[#141210] border-[1.5px] border-[#2e2924] border-t-[3px] border-t-[#fde047] text-[#f5f3ec] hover:border-[#fde047]/70';

                                const shadowClasses = isBento
                                    ? isLocked
                                        ? 'shadow-[4px_4px_0px_#000]'
                                        : 'shadow-[6px_6px_0px_#000] hover:shadow-[8px_8px_0px_#000]'
                                    : isLocked
                                        ? 'shadow-[0_3px_0_#050504]'
                                        : 'shadow-[0_6px_0_#050504]';

                                return (
                                    <div
                                        key={module.moduleId}
                                        data-snake-wall="card"
                                        onClick={() => handleModuleClick(module)}
                                        className={`
                                            relative rounded-3xl p-7 transition-all duration-200 group z-10 flex flex-col justify-between
                                            ${containerClasses}
                                            ${shadowClasses}
                                            ${!isLocked && (isBento ? 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5' : 'cursor-pointer hover:-translate-y-1')}
                                        `}
                                    >
                                        {/* Mobile Connector Dot */}
                                        <div className={`md:hidden absolute left-[-2rem] top-8 w-4 h-4 rounded-full ${
                                            isBento
                                                ? `border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${isCompleted ? 'bg-[#bef264]' : isLocked ? 'bg-[#e2e8f0]' : 'bg-[#fde047]'}`
                                                : `border-2 border-[#0a0908] ${isCompleted ? 'bg-[#bef264]' : isLocked ? 'bg-[#2e2924]' : 'bg-[#fde047]'}`
                                        }`} />

                                        <div>
                                            {/* Status & Progress Circle */}
                                            <div className="flex items-center justify-between mb-5">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                    isBento
                                                        ? isLocked
                                                            ? 'bg-[#e2e8f0] text-black/70 border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                                            : isCompleted
                                                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : isLocked
                                                            ? 'bg-[#1c1917] text-[#78716c] border border-[#2e2924]'
                                                            : isCompleted
                                                                ? 'bg-[#192211] text-[#bef264] border border-[#bef264]/45'
                                                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/45'
                                                }`}>
                                                    {isLocked ? 'Locked' : isCompleted ? 'Completed' : 'Available'}
                                                </span>

                                                {/* Circular Progress Badge */}
                                                <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${
                                                    isBento
                                                        ? isLocked
                                                            ? 'bg-[#e2e8f0] border-2 border-black'
                                                            : isCompleted
                                                                ? 'bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#bae6fd] border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-[#0e0d0b] border border-[#2e2924]'
                                                }`}>
                                                    <svg className="w-14 h-14 transform -rotate-90">
                                                        <circle
                                                            cx="28"
                                                            cy="28"
                                                            r="23"
                                                            stroke="currentColor"
                                                            strokeWidth={isBento ? '4.5' : '3.5'}
                                                            fill="transparent"
                                                            className={
                                                                isBento
                                                                    ? isLocked ? 'text-black/15' : 'text-black/20'
                                                                    : 'text-[#2e2924]'
                                                            }
                                                        />
                                                        {!isLocked && (
                                                            <circle
                                                                cx="28"
                                                                cy="28"
                                                                r="23"
                                                                stroke="currentColor"
                                                                strokeWidth={isBento ? '4.5' : '3.5'}
                                                                fill="transparent"
                                                                strokeDasharray={2 * Math.PI * 23}
                                                                strokeDashoffset={2 * Math.PI * 23 - (progressPercent / 100) * (2 * Math.PI * 23)}
                                                                strokeLinecap="round"
                                                                className={`transition-all duration-1000 ease-out ${
                                                                    isBento
                                                                        ? 'text-black'
                                                                        : isCompleted ? 'text-[#bef264]' : 'text-[#fde047]'
                                                                }`}
                                                            />
                                                        )}
                                                    </svg>
                                                    <span className={`absolute text-base font-black font-mono ${
                                                        isBento
                                                            ? isLocked ? 'text-black/50' : 'text-black'
                                                            : isCompleted ? 'text-[#bef264]' : isLocked ? 'text-[#78716c]' : 'text-[#fde047]'
                                                    }`}>
                                                        {String(moduleNumber).padStart(2, '0')}
                                                    </span>
                                                </div>
                                            </div>

                                            <h3 className={`text-xl md:text-2xl font-black mb-2.5 tracking-tight ${
                                                isBento
                                                    ? isLocked ? 'text-black/65' : 'text-black'
                                                    : isLocked ? 'text-[#78716c]' : 'text-[#f5f3ec]'
                                            }`}>
                                                {module.title}
                                            </h3>

                                            <p className={`text-sm font-semibold leading-relaxed line-clamp-2 md:line-clamp-3 ${
                                                isBento
                                                    ? isLocked ? 'text-black/55' : 'text-black/75'
                                                    : isLocked ? 'text-[#78716c]/80' : 'text-[#a8a29e]'
                                            }`}>
                                                {module.description || (isLocked ? 'Complete previous modules to unlock.' : 'Master this topic to progress.')}
                                            </p>
                                        </div>

                                        <div className="mt-5">
                                            {/* Mini Progress Bar in Card */}
                                            {!isLocked && !isCompleted && (
                                                <div className={`mb-4 w-full rounded-full overflow-hidden ${
                                                    isBento ? 'h-2.5 bg-[#faf8f2] border-2 border-black' : 'h-2 bg-[#0e0d0b] border border-[#2e2924]'
                                                }`}>
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            isBento ? 'bg-[#bef264]' : 'bg-[#fde047]'
                                                        }`}
                                                        style={{ width: `${Math.max(4, progressPercent)}%` }}
                                                    />
                                                </div>
                                            )}

                                            {!isLocked && (
                                                <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                                    isBento
                                                        ? isCompleted
                                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] group-hover:bg-[#fde047]'
                                                            : 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] group-hover:bg-[#a3e635]'
                                                        : isCompleted
                                                            ? 'bg-[#192211] text-[#bef264] border border-[#bef264]/45 group-hover:bg-[#233218]'
                                                            : 'bg-[#bef264] text-[#0a0908] shadow-[0_3px_0_#050504] group-hover:bg-[#d2fa8a]'
                                                }`}>
                                                    <span>View Details</span>
                                                    <Layout className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Module Details Modal (portaled to document.body so ancestor transforms never offset fixed centering) */}
            {isDetailsOpen && selectedModule && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsDetailsOpen(false);
                    }}
                    className={`app-dialog-overlay fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200 !border-0 !shadow-none`}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                        className={`app-dialog-panel app-dialog-panel--structured relative w-full max-w-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${
                        isBento
                            ? 'bg-white border-[3px] border-black shadow-[8px_8px_0px_#000] text-black'
                            : 'bg-[#141210] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504] text-[#f5f3ec]'
                    }`}>
                        {(() => {
                            const { progressPercent, completedItems, totalItems, moduleQuizzes } = getModuleDetails(selectedModule);
                            const { isCompleted } = computeStatus(selectedModule);

                            return (
                                <>
                                    {/* Header */}
                                    <div className={`app-dialog-header p-6 sm:p-8 relative overflow-hidden flex-shrink-0 ${
                                        isBento
                                            ? 'border-b-[2.5px] border-black bg-[#faf8f2] text-black'
                                            : 'border-b border-[#2e2924] bg-[#0e0d0b] text-[#f5f3ec]'
                                    }`}>
                                        <div className="flex items-start justify-between relative z-10 mb-4 gap-3">
                                            <div>
                                                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                                                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                        isBento
                                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                            : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/45'
                                                    }`}>
                                                        Module {(selectedModule.level ?? 0) + 1}
                                                    </div>
                                                    {isCompleted && (
                                                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                                            isBento
                                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                : 'bg-[#192211] text-[#bef264] border border-[#bef264]/45'
                                                        }`}>
                                                            Completed
                                                        </div>
                                                    )}
                                                </div>
                                                <h2 className={`text-xl sm:text-2xl font-black mb-1.5 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{selectedModule.title}</h2>
                                                <p className={`text-sm font-semibold ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>{selectedModule.description}</p>
                                            </div>
                                            <button
                                                onClick={() => setIsDetailsOpen(false)}
                                                aria-label="Close module details"
                                                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                                                    isBento
                                                        ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] text-black'
                                                        : 'bg-[#1c1917] border border-[#2e2924] hover:border-[#bef264] text-[#a8a29e] hover:text-[#f5f3ec]'
                                                }`}
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Progress Loader */}
                                        <div className="space-y-2">
                                            <div className={`flex items-center justify-between text-xs font-black uppercase tracking-widest ${
                                                isBento ? 'text-black' : 'text-[#a8a29e]'
                                            }`}>
                                                <span>Progress</span>
                                                <span className={isBento ? 'text-black' : 'text-[#bef264]'}>{completedItems}/{totalItems} Steps</span>
                                            </div>
                                            <div className={`w-full rounded-full overflow-hidden ${
                                                isBento ? 'h-3 bg-white border-2 border-black' : 'h-2.5 bg-[#1c1917] border border-[#2e2924]'
                                            }`}>
                                                <div
                                                    className={`h-full transition-all duration-700 ease-out ${
                                                        isBento ? 'bg-[#bef264] border-r-2 border-black' : 'bg-[#bef264]'
                                                    }`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Scroll Area */}
                                    <div className="app-dialog-body app-dialog-body-spaced flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">

                                        {/* Learning Steps (Sub-modules) */}
                                        <div className="space-y-4">
                                            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                                                isBento ? 'text-black' : 'text-[#a8a29e]'
                                            }`}>
                                                <Layout className="w-4 h-4" /> Learning Steps
                                            </h3>

                                            {selectedModule.subModules?.map((sub) => {
                                                const subKey = `${selectedModule.moduleId}:${sub.id}`;
                                                const isSubCompleted = userProgress?.completedSubModules?.includes(subKey) || optimisticCompleted.has(subKey);
                                                const isProcessing = completingSubModule === sub.id;

                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className={`
                                                            group flex items-start gap-4 p-4 rounded-2xl transition-all
                                                            ${isBento
                                                                ? isSubCompleted
                                                                    ? 'bg-[#bef264]/45 border-2 border-black shadow-[2px_2px_0px_#000]'
                                                                    : 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#fef9c3]'
                                                                : isSubCompleted
                                                                    ? 'bg-[#192211]/60 border border-[#bef264]/35'
                                                                    : 'bg-[#0e0d0b] border border-[#2e2924] hover:border-[#bef264]/50'}
                                                        `}
                                                    >
                                                        <button
                                                            onClick={() => handleToggleSubModule(sub.id)}
                                                            disabled={isSubCompleted || isProcessing}
                                                            className={`
                                                                mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer
                                                                ${isBento
                                                                    ? isSubCompleted
                                                                        ? 'bg-[#bef264] border-black text-black'
                                                                        : 'border-black bg-white hover:bg-[#bef264]'
                                                                    : isSubCompleted
                                                                        ? 'bg-[#bef264] border-[#bef264] text-[#0a0908]'
                                                                        : 'border-[#57534e] bg-[#141210] hover:border-[#bef264]'}
                                                            `}
                                                        >
                                                            {isSubCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                        </button>

                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1 gap-2">
                                                                <h4 className={`font-bold ${
                                                                    isSubCompleted
                                                                        ? isBento ? 'text-black/50 line-through' : 'text-[#78716c] line-through'
                                                                        : isBento ? 'text-black font-black' : 'text-[#f5f3ec]'
                                                                }`}>
                                                                    {sub.title}
                                                                </h4>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {sub.xp && (
                                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                                                            isBento
                                                                                ? 'bg-[#fde047] text-black border border-black'
                                                                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40'
                                                                        }`}>
                                                                            {sub.xp} XP
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className={`flex items-center gap-4 text-xs font-semibold ${isBento ? 'text-black/65' : 'text-[#a8a29e]'}`}>
                                                                {sub.videoUrl && (
                                                                    <a href={sub.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                        <Video className="w-3 h-3" /> Watch Video
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {(!selectedModule.subModules || selectedModule.subModules.length === 0) && (
                                                <p className={`text-sm italic py-2 ${isBento ? 'text-black/60' : 'text-[#78716c]'}`}>No learning steps needed for this module.</p>
                                            )}
                                        </div>

                                        {/* Quizzes Section */}
                                        {moduleQuizzes.length > 0 && (
                                            <div className={`space-y-4 pt-5 border-t ${
                                                isBento ? 'border-t-2 border-black' : 'border-[#2e2924]'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                                                        isBento ? 'text-black' : 'text-[#a8a29e]'
                                                    }`}>
                                                        <GraduationCap className="w-4 h-4" /> Module Quizzes
                                                    </h3>
                                                </div>

                                                {/* 70% Requirement Alert */}
                                                <div className={`flex items-start gap-3 p-3.5 rounded-2xl ${
                                                    isBento
                                                        ? 'bg-[#fed7aa] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                                        : 'bg-[#231e0f] border border-[#fde047]/35 text-[#fde047]'
                                                }`}>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                        isBento ? 'bg-white border-2 border-black text-black' : 'bg-[#0e0d0b] border border-[#fde047]/40 text-[#fde047]'
                                                    }`}>
                                                        <Target className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-black ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                                                            70% Required to Pass
                                                        </p>
                                                        <p className={`text-xs mt-0.5 font-semibold ${isBento ? 'text-black/80' : 'text-[#b5aea4]'}`}>
                                                            You must score at least 70% on all quizzes to complete this module and unlock the next one.
                                                        </p>
                                                    </div>
                                                </div>

                                                {moduleQuizzes.map(quiz => {
                                                    const qId = quiz.id || quiz._id || '';
                                                    const poolStatus = getQuizPoolStatus(quiz, attempts);
                                                    const bestAttempt = attempts.filter(a => a.quizId === qId).sort((a, b) => b.percentage - a.percentage)[0];
                                                    const isPassed = Boolean(poolStatus.isFullyCompleted || (bestAttempt && bestAttempt.percentage >= MODULE_PASSING_THRESHOLD));
                                                    const isPoolInProgress = poolStatus.isPool && poolStatus.hasStarted && !poolStatus.isFullyCompleted;

                                                    return (
                                                        <div
                                                            key={qId}
                                                            className={`
                                                                flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl transition-all
                                                                ${isBento
                                                                    ? isPassed
                                                                        ? 'bg-[#bef264]/45 border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                                                        : 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                                                    : isPassed
                                                                        ? 'bg-[#192211]/60 border border-[#bef264]/35'
                                                                        : 'bg-[#0e0d0b] border border-[#2e2924]'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                                                <div className={`
                                                                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                                                                    ${isBento
                                                                        ? 'bg-[#bae6fd] border-2 border-black text-black shadow-[1.5px_1.5px_0px_#000]'
                                                                        : isPassed
                                                                            ? 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                                                            : 'bg-[#111c22] text-[#bae6fd] border border-[#bae6fd]/40'}
                                                                `}>
                                                                    {isPassed ? <Target className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className={`font-black mb-0.5 truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{quiz.title}</h4>
                                                                    <div className={`flex flex-wrap items-center gap-3 text-xs font-semibold ${isBento ? 'text-black/70' : 'text-[#a8a29e]'}`}>
                                                                        {poolStatus.isPool ? (
                                                                            <>
                                                                                <span className={`font-black ${
                                                                                    isBento
                                                                                        ? 'text-black'
                                                                                        : poolStatus.isFullyCompleted ? 'text-[#bef264]' : 'text-[#bae6fd]'
                                                                                }`}>
                                                                                    {poolStatus.isFullyCompleted ? `Bank Mastered (${poolStatus.totalQuestions} Qs)` : `${poolStatus.seenCount}/${poolStatus.totalQuestions} Qs (${poolStatus.percentage}%)`}
                                                                                </span>
                                                                                {poolStatus.isFullyCompleted ? (
                                                                                    <span className={isBento ? 'text-black font-black' : 'text-[#bef264] font-bold'}>
                                                                                        ✓ 100% Solved
                                                                                    </span>
                                                                                ) : poolStatus.remainingCount > 0 ? (
                                                                                    <span className={isBento ? 'text-black/80 font-black' : 'text-[#fde047] font-bold'}>
                                                                                        {poolStatus.remainingCount} Remaining
                                                                                    </span>
                                                                                ) : null}
                                                                            </>
                                                                        ) : (
                                                                            <span>{quiz.questions?.length} Questions</span>
                                                                        )}
                                                                        {bestAttempt && (
                                                                            <>
                                                                                <span className={
                                                                                    isBento
                                                                                        ? 'text-black font-black'
                                                                                        : isPassed ? 'text-[#bef264]' : 'text-[#fde047]'
                                                                                }>
                                                                                    Best: {bestAttempt.percentage}%
                                                                                </span>
                                                                                {!isPassed && bestAttempt.percentage > 0 && (
                                                                                    <span className={isBento ? 'text-red-700 font-black' : 'text-[#fb7185] font-bold'}>
                                                                                        Need {MODULE_PASSING_THRESHOLD - bestAttempt.percentage}% more to pass
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => onStartQuiz && onStartQuiz(quiz)}
                                                                className={`
                                                                    px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer
                                                                    ${isBento
                                                                        ? isPassed
                                                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a3e635]'
                                                                            : 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#facc15] active:translate-y-0.5'
                                                                        : isPassed
                                                                            ? 'bg-[#192211] text-[#bef264] border border-[#bef264]/45 hover:bg-[#243218]'
                                                                            : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a] shadow-[0_3px_0_#050504]'}
                                                                `}
                                                            >
                                                                {isPassed ? (
                                                                    'Retake'
                                                                ) : isPoolInProgress ? (
                                                                    <><Play className="w-3 h-3 fill-current" /> Complete Remaining ({poolStatus.remainingCount} Left)</>
                                                                ) : (
                                                                    <><Play className="w-3 h-3 fill-current" /> Start</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className={`p-5 sm:p-6 flex justify-end flex-shrink-0 ${
                                        isBento
                                            ? 'border-t-[2.5px] border-black bg-[#faf8f2]'
                                            : 'border-t border-[#2e2924] bg-[#0e0d0b]'
                                    }`}>
                                        <button
                                            onClick={() => setIsDetailsOpen(false)}
                                            className={`px-6 py-2.5 font-black uppercase tracking-widest text-xs rounded-xl transition-all cursor-pointer ${
                                                isBento
                                                    ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#fde047]'
                                                    : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                                            }`}
                                        >
                                            Close View
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default UserRoadmapView;
