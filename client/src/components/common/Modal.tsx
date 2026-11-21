import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    maxWidth?: string;
    footer?: React.ReactNode;
    icon?: React.ReactNode;
    bodyClassName?: string;
    iconContainerClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = 'max-w-2xl',
    footer,
    icon,
    bodyClassName,
    iconContainerClassName
}) => {
    const { isBento } = useTheme();

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="app-dialog-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe pl-safe pr-safe !bg-transparent !border-0 !shadow-none">
            {/* Backdrop */}
            <div
                className="modal-backdrop absolute inset-0 bg-black/40 dark:bg-[#050504]/82 backdrop-blur-md dark:backdrop-blur-none transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Content */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`app-dialog-panel app-dialog-panel--structured relative flex w-full ${maxWidth} flex-col animate-in fade-in zoom-in-95 duration-200 ${
                    isBento
                        ? 'bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_#000] text-black'
                        : 'bg-white/95 dark:bg-[#141210] backdrop-blur-xl dark:backdrop-blur-none rounded-2xl shadow-2xl dark:shadow-[0_8px_0_#050504] border border-gray-200 dark:border-[1.5px] dark:border-[#2b2722] text-gray-900 dark:text-[#f5f3ec]'
                }`}>
                {/* Header */}
                <div className={`app-dialog-header flex items-center justify-between gap-3 ${
                    isBento
                        ? 'border-b-[2.5px] border-black bg-white rounded-t-2xl'
                        : 'border-b border-gray-200 dark:border-[#2b2722] bg-gray-50/50 dark:bg-[#1a1714] rounded-t-2xl backdrop-blur-sm dark:backdrop-blur-none'
                }`}>
                    <div>
                        <h2 className={`text-xl sm:text-2xl font-black flex items-center gap-3 ${
                            isBento ? 'text-black' : 'text-gray-900 dark:text-[#f5f3ec]'
                        }`}>
                            {icon && (
                                <div className={`p-2 rounded-lg flex items-center justify-center shrink-0 ${
                                    iconContainerClassName ?? (
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-orange-500/10 text-orange-500 dark:bg-[#fde047]/14 dark:text-[#fde047] dark:border dark:border-[#fde047]/30'
                                    )
                                }`}>
                                    {icon}
                                </div>
                            )}
                            {title}
                        </h2>
                        {description && (
                            <p className={`text-xs sm:text-sm mt-1 pl-1 ${
                                isBento ? 'text-slate-700 font-semibold' : 'text-gray-500 dark:text-[#b5aea4]'
                            }`}>
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all touch-target ${
                            isBento
                                ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] text-black'
                                : 'hover:bg-gray-200 dark:hover:bg-[#f5f3ec]/10 text-gray-500 dark:text-[#a8a29e] dark:hover:text-[#f5f3ec] border-0'
                        }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className={`app-dialog-body custom-scrollbar ${bodyClassName ?? 'app-dialog-body-spaced'}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className={`app-dialog-footer flex justify-end gap-2.5 ${
                        isBento
                            ? 'border-t-[2.5px] border-black bg-white rounded-b-2xl'
                            : 'border-t border-gray-200 dark:border-[#f5f3ec]/10 bg-gray-50/50 dark:bg-[#11100e]/85 rounded-b-2xl backdrop-blur-sm'
                    }`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
