import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { pwaUpdater } from '../lib/pwaUpdater';

interface InstallPWAProps {
    inline?: boolean;
}

const InstallPWA: React.FC<InstallPWAProps> = ({ inline = false }) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();

    const [isDismissed, setIsDismissed] = useState(() => {
        return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    });

    const [pwaState, setPwaState] = useState(() => pwaUpdater.getState());
    const [showIOSModal, setShowIOSModal] = useState(false);

    useEffect(() => {
        pwaUpdater.init();
        return pwaUpdater.subscribe(setPwaState);
    }, []);

    const isIOS = pwaState.isIOS;
    const supportsPWA = pwaState.canInstall && !pwaState.isInstalled;

    const handleInstallClick = async (evt: React.MouseEvent) => {
        evt.preventDefault();
        const outcome = await pwaUpdater.promptInstall();
        if (outcome === 'ios') {
            setShowIOSModal(true);
        }
    };

    const handleDismiss = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setIsDismissed(true);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    if (!supportsPWA || isDismissed) {
        return null;
    }

    return (
        <>
            {/* Floating Install Prompt Banner */}
            <aside
                aria-label={tx('Install Quiz Platform App', 'تثبيت تطبيق Quiz Platform')}
                className={
                    inline
                        ? 'pointer-events-auto w-full sm:w-auto animate-in slide-in-from-bottom-5 duration-300'
                        : 'fixed bottom-20 xl:bottom-6 left-3 right-3 sm:left-auto sm:end-6 z-[80] animate-in slide-in-from-bottom-5 duration-300 pb-safe'
                }
            >
                <div className={`p-3.5 sm:p-4 rounded-2xl max-w-full sm:max-w-sm flex items-center gap-3 ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[5px_5px_0_#000]'
                        : 'bg-white/95 dark:bg-[#141210]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl shadow-indigo-500/15'
                }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isBento
                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                            : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                    }`}>
                        <Download className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-1.5 text-xs font-black ${
                            isBento ? 'text-black' : 'text-slate-900 dark:text-white'
                        }`}>
                            <span>{tx('Install App', 'نزّل التطبيق')}</span>
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                        </div>
                        <p className={`text-[11px] font-semibold line-clamp-1 ${
                            isBento ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                            {isIOS
                                ? tx('Add to Home Screen for best experience', 'ضيفه للشاشة الرئيسية لأفضل تجربة')
                                : tx('Fast, offline ready & fullscreen', 'سريع، يشتغل أوفلاين، وشاشة كاملة')}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={handleInstallClick}
                            className={`btn-unstyled px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                    : 'bg-indigo-600 hover:opacity-90 text-white shadow-md shadow-indigo-500/25'
                            }`}
                        >
                            {tx('Install', 'تثبيت')}
                        </button>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className={`btn-unstyled p-1.5 rounded-xl transition-colors cursor-pointer ${
                                isBento
                                    ? 'bg-slate-100 hover:bg-[#fecdd3] text-black border-2 border-black'
                                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}
                            aria-label={tx('Dismiss install banner', 'إغلاق إشعار التثبيت')}
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* iOS Instructions Modal */}
            {showIOSModal && (
                <div
                    className="app-dialog-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                    onClick={() => setShowIOSModal(false)}
                >
                    <div
                        className={`app-dialog-panel app-dialog-panel--padded rounded-3xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200 ${
                            isBento
                                ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0_#000]'
                                : 'bg-white dark:bg-[#141210] border border-slate-200 dark:border-white/10 shadow-2xl'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl ${
                                    isBento
                                        ? 'bg-[#fde047] text-black border-2 border-black'
                                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                }`}>
                                    <Download className="w-5 h-5" />
                                </div>
                                <h3 className={`font-black text-base ${isBento ? 'text-black' : 'text-slate-900 dark:text-white'}`}>
                                    {tx('Install on iOS', 'التثبيت على iOS')}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowIOSModal(false)}
                                className={`btn-unstyled p-1.5 rounded-xl cursor-pointer ${
                                    isBento
                                        ? 'bg-slate-100 hover:bg-[#fecdd3] text-black border-2 border-black'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className={`space-y-3 text-xs ${isBento ? 'text-slate-800' : 'text-slate-600 dark:text-slate-300'}`}>
                            <div className={`flex items-start gap-3 p-3 rounded-2xl ${
                                isBento ? 'bg-[#f8fafc] border-2 border-black/20' : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                            }`}>
                                <span className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-indigo-600 text-white'
                                }`}>1</span>
                                <p className="pt-0.5">
                                    {tx('Tap the Share button', 'اضغط على زرار المشاركة')}{' '}
                                    <Share className="w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" />{' '}
                                    {tx("in Safari's bottom toolbar.", 'في شريط Safari تحت.')}
                                </p>
                            </div>

                            <div className={`flex items-start gap-3 p-3 rounded-2xl ${
                                isBento ? 'bg-[#f8fafc] border-2 border-black/20' : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                            }`}>
                                <span className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-indigo-600 text-white'
                                }`}>2</span>
                                <p className="pt-0.5">
                                    {tx('Scroll down and tap Add to Home Screen', 'انزل لتحت واضغط إضافة للشاشة الرئيسية')}{' '}
                                    <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" />.
                                </p>
                            </div>

                            <div className={`flex items-start gap-3 p-3 rounded-2xl ${
                                isBento ? 'bg-[#f8fafc] border-2 border-black/20' : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                            }`}>
                                <span className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                    isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-indigo-600 text-white'
                                }`}>3</span>
                                <p className="pt-0.5">
                                    {tx('Tap Add in the top right corner to install Quiz Platform!', 'اضغط إضافة (Add) فوق لتثبيت Quiz Platform!')}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowIOSModal(false)}
                            className={`btn-unstyled w-full mt-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                    : 'bg-indigo-600 text-white'
                            }`}
                        >
                            {tx('Got It', 'فهمت')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallPWA;
