import React, { useState, useEffect } from 'react';
import { Copy, Check, Share2, Link, ExternalLink } from 'lucide-react';
import Modal from '../common/Modal';
import { useTheme } from '../../context/ThemeContext';
import type { Quiz } from '../../types';

interface ShareQuizModalProps {
    quiz: Quiz | null;
    isOpen: boolean;
    onClose: () => void;
}

const ShareQuizModal: React.FC<ShareQuizModalProps> = ({ quiz, isOpen, onClose }) => {
    const { isBento } = useTheme();
    const [copied, setCopied] = useState(false);

    // Build the shareable link using the quiz's id
    const quizId = quiz?.id || quiz?._id || '';
    const shareUrl = quizId
        ? `${window.location.origin}/quiz/${encodeURIComponent(quizId)}`
        : '';

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!isOpen) setCopied(false);
    }, [isOpen]);

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    const handleNativeShare = async () => {
        if (!quiz || !shareUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: quiz.title,
                    text: `Take the "${quiz.title}" quiz! ${quiz.questions?.length || 0} questions.`,
                    url: shareUrl,
                });
            } catch {
                // User cancelled share — no-op
            }
        }
    };

    if (!isOpen || !quiz) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Share Quiz"
            description="Anyone with the link can take this quiz"
            maxWidth="max-w-md"
            icon={<Share2 className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />}
            iconContainerClassName={
                isBento
                    ? 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-[#bae6fd]/15 text-[#bae6fd] border border-[#bae6fd]/35'
            }
            footer={
                <div className="flex gap-3 w-full">
                    <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fef08a]'
                                : 'bg-[#1c1917] text-[#f5f3ec] border border-[#2e2924] hover:border-[#bef264]'
                        }`}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Preview
                    </a>
                    {typeof navigator.share === 'function' && (
                        <button
                            type="button"
                            onClick={handleNativeShare}
                            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#facc15]'
                                    : 'bg-[#fde047] text-[#0a0908] hover:bg-[#fef08a]'
                            }`}
                        >
                            <Share2 className="w-4 h-4" />
                            Share via...
                        </button>
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                <div className={`p-4 rounded-xl ${
                    isBento
                        ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-[#1a1714] border border-[#2e2924]'
                }`}>
                    <h3 className={`font-black text-sm truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>{quiz.title}</h3>
                    <p className={`text-xs mt-0.5 font-semibold ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                        {quiz.questions?.length || 0} Questions &bull; {quiz.difficulty || 'Medium'} &bull; {quiz.category || 'General'}
                    </p>
                </div>

                {/* Link input */}
                <div>
                    <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                        <Link className="w-3 h-3 inline mr-1.5" />
                        Shareable Link
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className={`flex-1 px-3 py-2.5 text-sm rounded-xl focus:outline-none font-mono overflow-hidden text-ellipsis ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                            }`}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                isBento
                                    ? copied
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#bef264]'
                                    : copied
                                        ? 'bg-[#bef264] text-[#0a0908]'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_2px_0_#050504]'
                            }`}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ShareQuizModal;
