import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import Modal from '../common/Modal';
import type { Quiz, Question } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface ReplaceQuizModalProps {
    isOpen: boolean;
    onClose: () => void;
    quiz: Quiz | null;
    replacementFile: File | null;
    parsedData: {
        questions: Partial<Question>[];
        title?: string;
        description?: string;
        timeLimit?: number;
        passingScore?: number;
    } | null;
    onConfirm: (applyMetadata: boolean) => Promise<void>;
    onFileSelected: (file: File) => void;
    isLoading?: boolean;
}

const ReplaceQuizModal: React.FC<ReplaceQuizModalProps> = ({
    isOpen,
    onClose,
    quiz,
    replacementFile,
    parsedData,
    onConfirm,
    onFileSelected,
    isLoading = false
}) => {
    const { isBento } = useTheme();
    const [applyMetadata, setApplyMetadata] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!quiz) return null;

    const currentCount = quiz.questions?.length || 0;
    const newCount = parsedData?.questions?.length || 0;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelected(file);
        }
        e.target.value = '';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={isLoading ? () => {} : onClose}
            title="Replace Quiz Questions"
            description={`Update questions for "${quiz.title}"`}
            maxWidth="max-w-md"
            icon={<RefreshCw className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bae6fd]'} animate-spin-slow`} />}
            footer={
                <>
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={onClose}
                        className={`flex-1 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white hover:bg-gray-100 text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isLoading || !parsedData || newCount === 0}
                        onClick={() => onConfirm(applyMetadata)}
                        className={`flex-1 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                            isBento
                                ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                        }`}
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Replacing...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Confirm Replace</span>
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                {/* File Upload Selector / Drop Area */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                        isBento
                            ? 'bg-white border-black hover:bg-[#fef9c3] shadow-[2px_2px_0px_#000]'
                            : 'bg-[#1a1714] border-[#2e2924] hover:border-[#bef264]'
                    }`}
                >
                    <Upload className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                    <div className="text-center">
                        <span className={`text-xs font-bold ${isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'}`}>
                            {replacementFile ? replacementFile.name : 'Choose Replacement JSON File'}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                            {replacementFile ? 'Click to select a different file' : 'Click to browse (.json format)'}
                        </p>
                    </div>
                </div>

                {/* Diff Summary Box */}
                {parsedData && (
                    <div className={`p-4 rounded-2xl border ${
                        isBento
                            ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#1a1714] border-[#2e2924]'
                    }`}>
                        <div className={`flex items-center justify-between text-xs font-bold mb-3 pb-2 border-b ${isBento ? 'border-black/20' : 'border-[#2e2924]'}`}>
                            <span className={isBento ? 'text-slate-600' : 'text-[#a8a29e]'}>Target Quiz</span>
                            <span className={`font-black truncate max-w-[200px] ${isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'}`}>
                                {quiz.title}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className={`p-2.5 rounded-xl border ${
                                isBento ? 'bg-white border-2 border-black' : 'bg-[#0e0d0b] border-[#2e2924]'
                            }`}>
                                <div className={`text-[10px] uppercase font-bold ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>Current</div>
                                <div className={`text-base font-black ${isBento ? 'text-black font-mono' : 'text-[#f5f3ec]'}`}>
                                    {currentCount} Qs
                                </div>
                            </div>

                            <div className={`p-2.5 rounded-xl border ${
                                isBento ? 'bg-[#bae6fd] border-2 border-black font-mono' : 'bg-[#bae6fd]/12 border-[#bae6fd]/40 text-[#bae6fd]'
                            }`}>
                                <div className={`text-[10px] uppercase font-bold ${isBento ? 'text-black/80' : 'text-[#bae6fd]'}`}>Replacement</div>
                                <div className={`text-base font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                    {newCount} Qs
                                </div>
                            </div>
                        </div>

                        {/* Title Update Checkbox if replacement JSON has a title */}
                        {parsedData.title && parsedData.title !== quiz.title && (
                            <label className={`mt-3 flex items-start gap-2.5 p-2 rounded-xl cursor-pointer text-xs ${isBento ? 'hover:bg-black/5' : 'hover:bg-[#24201c]'}`}>
                                <input
                                    type="checkbox"
                                    checked={applyMetadata}
                                    onChange={(e) => setApplyMetadata(e.target.checked)}
                                    className="mt-0.5 rounded accent-[#bef264]"
                                />
                                <span className={`text-[11px] leading-tight ${isBento ? 'text-black font-mono' : 'text-[#d6d0c7]'}`}>
                                    Also update title to: <strong className={isBento ? 'text-black' : 'text-[#f5f3ec]'}>"{parsedData.title}"</strong>
                                </span>
                            </label>
                        )}
                    </div>
                )}

                {/* Warning note */}
                <div className={`p-3 rounded-xl flex items-start gap-2 text-[11px] leading-relaxed ${
                    isBento
                        ? 'bg-[#fef9c3] border-2 border-black text-black font-mono'
                        : 'bg-[#1e1b13] border border-[#fde047]/35 text-[#fde047]'
                }`}>
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                    <span>
                        All existing questions will be replaced by the questions from this file. The quiz ID, history, and student attempts remain intact.
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default ReplaceQuizModal;
