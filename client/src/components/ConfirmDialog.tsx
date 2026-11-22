import React from 'react';
import { AlertTriangle, Info, AlertOctagon, Loader2 } from 'lucide-react';
import Modal from './common/Modal';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export interface ConfirmDialogProps {
    title: string;
    message: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info';
    isOpen?: boolean;
    isLoading?: boolean;
    showWarningBanner?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    description,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    type = 'warning',
    isOpen = true,
    isLoading = false,
    showWarningBanner
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const resolvedConfirmText = confirmText ?? tx('Confirm', 'تأكيد');
    const resolvedCancelText = cancelText ?? tx('Cancel', 'إلغاء');

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertOctagon className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#fb7185]'}`} />;
            case 'warning':
                return <AlertTriangle className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />;
            case 'info':
            default:
                return <Info className={`w-5 h-5 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />;
        }
    };

    const getIconContainerClass = () => {
        if (isBento) {
            switch (type) {
                case 'danger':
                    return 'bg-[#ff8787] text-black border-2 border-black shadow-[2px_2px_0px_#000]';
                case 'warning':
                    return 'bg-[#fef08a] text-black border-2 border-black shadow-[2px_2px_0px_#000]';
                case 'info':
                default:
                    return 'bg-[#bae6fd] text-black border-2 border-black shadow-[2px_2px_0px_#000]';
            }
        }

        switch (type) {
            case 'danger':
                return 'bg-[#251317] text-[#fb7185] border border-[#fb7185]/35';
            case 'warning':
                return 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35';
            case 'info':
            default:
                return 'bg-[#151e24] text-[#bae6fd] border border-[#bae6fd]/35';
        }
    };

    const getPrimaryButtonClass = () => {
        if (isBento) {
            switch (type) {
                case 'danger':
                    return 'bg-[#ff6b6b] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#ff5252] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none';
                case 'warning':
                    return 'bg-[#fef08a] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-yellow-300 hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none';
                case 'info':
                default:
                    return 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none';
            }
        }

        switch (type) {
            case 'danger':
                return 'bg-[#fb7185] hover:bg-[#fda4af] text-[#0a0908] hover:-translate-y-0.5 active:translate-y-0';
            case 'warning':
                return 'bg-[#fde047] hover:bg-[#fef08a] text-[#0a0908] hover:-translate-y-0.5 active:translate-y-0';
            case 'info':
            default:
                return 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] hover:-translate-y-0.5 active:translate-y-0';
        }
    };

    const getCancelButtonClass = () => {
        if (isBento) {
            return 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none';
        }
        return 'bg-[#1a1714] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec] active:scale-95';
    };

    const shouldShowBanner = showWarningBanner ?? (type === 'danger');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            description={description}
            icon={getIcon()}
            iconContainerClassName={getIconContainerClass()}
            maxWidth="max-w-md"
            footer={
                <div className="flex items-center gap-3 w-full">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getCancelButtonClass()}`}
                    >
                        {cancelText === 'Cancel' ? resolvedCancelText : cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClass()}`}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmText === 'Confirm' ? resolvedConfirmText : confirmText}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <p className={`leading-relaxed text-sm ${
                    isBento
                        ? 'text-black font-semibold'
                        : 'text-[#d6d0c7] font-medium'
                }`}>
                    {message}
                </p>

                {shouldShowBanner && (
                    <div className={`p-3.5 rounded-xl flex items-center gap-2 text-xs font-bold ${
                        isBento
                            ? 'bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                            : 'bg-[#251317] border border-[#fb7185]/35 text-[#fda4af]'
                    }`}>
                        <span className="text-base leading-none">⚠️</span>
                        <span>{tx('This action is permanent and cannot be undone.', 'الإجراء ده نهائي وما ينفعش الرجوع فيه.')}</span>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ConfirmDialog;
