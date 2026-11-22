import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { PublicUserProfileView } from './PublicUserProfileView';
import { useTheme } from '../../context/ThemeContext';

interface PublicUserProfileModalProps {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export const PublicUserProfileModal: React.FC<PublicUserProfileModalProps> = ({
    userId,
    isOpen,
    onClose
}) => {
    const { isBento } = useTheme();

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !userId) return null;

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="app-dialog-overlay fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-6 bg-black/50 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
            <div
                className={`app-dialog-panel app-dialog-panel--structured relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                        : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504,0_24px_60px_rgba(0,0,0,0.78)]'
                }`}
            >
                {/* Modal Header Bar with Close Button */}
                <div className={`app-dialog-header p-4 border-b flex items-center justify-between shrink-0 ${
                    isBento
                        ? 'bg-[#fde047] border-b-[2.5px] border-black text-black'
                        : 'bg-[#1a1714] border-[#2e2924] text-[#f5f3ec]'
                }`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            isBento ? 'bg-black text-[#bef264]' : 'bg-[#bef264] text-[#0a0908]'
                        }`}>
                            Player Profile
                        </span>
                        <span className={`text-xs font-bold ${isBento ? 'text-black/75' : 'text-[#a8a29e]'}`}>
                            View achievements, activity & challenge
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white hover:bg-[#fecdd3] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                : 'bg-[#141210] border border-[#2e2924] hover:border-[#bef264]/50 text-[#a8a29e] hover:text-[#f5f3ec]'
                        }`}
                        title="Close profile modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="app-dialog-body app-dialog-body-spaced flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    <PublicUserProfileView
                        userId={userId}
                        onClose={onClose}
                        isModal={true}
                    />
                </div>
            </div>
        </div>
    );
};
