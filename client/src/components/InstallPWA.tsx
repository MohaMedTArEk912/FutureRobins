import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { pwaUpdater } from '../lib/pwaUpdater';

interface InstallPWAProps {
    inline?: boolean;
}

const DISMISS_STORAGE_KEY = 'pwa_prompt_dismissed_until';
const DISMISS_SESSION_KEY = 'pwa_prompt_dismissed';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readInitialDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        if (window.sessionStorage.getItem(DISMISS_SESSION_KEY) === 'true') {
            return true;
        }
    } catch {
        // Ignore private-browsing storage restrictions
    }
    try {
        const untilRaw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
        if (untilRaw) {
            const until = Number(untilRaw);
            if (Number.isFinite(until) && Date.now() < until) {
                return true;
            }
        }
    } catch {
        // Ignore private-browsing storage restrictions
    }
    return false;
}

function persistDismissed(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(DISMISS_SESSION_KEY, 'true');
    } catch {
        // Ignore storage errors
    }
    try {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_COOLDOWN_MS));
    } catch {
        // Ignore storage errors
    }
}

const InstallPWA: React.FC<InstallPWAProps> = ({ inline = false }) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const location = useLocation();

    const [isDismissed, setIsDismissed] = useState<boolean>(readInitialDismissed);
    const [pwaState, setPwaState] = useState(() => pwaUpdater.getState());
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [isPrompting, setIsPrompting] = useState(false);

    useEffect(() => {
        pwaUpdater.init();
        return pwaUpdater.subscribe(setPwaState);
    }, []);

    // Close iOS instructions modal with Escape key
    useEffect(() => {
        if (!showIOSModal) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowIOSModal(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showIOSModal]);

    const dismissBanner = useCallback(() => {
        setShowIOSModal(false);
        setIsDismissed(true);
        persistDismissed();
    }, []);

    const isIOS = pwaState.isIOS;
    const supportsPWA = pwaState.canInstall && !pwaState.isInstalled;

    // Avoid floating banner overlapping active quizzes, live games, or standalone lobbies
    const isBusyRoute =
        location.pathname.startsWith('/quiz') ||
        location.pathname.startsWith('/game') ||
        location.pathname.startsWith('/results') ||
        location.pathname.startsWith('/live-arena') ||
        location.pathname.startsWith('/classroom');

    const handleInstallClick = async (evt: React.MouseEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (isPrompting) return;

        if (isIOS) {
            setShowIOSModal(true);
            return;
        }

        setIsPrompting(true);
        try {
            const outcome = await pwaUpdater.promptInstall();
            if (outcome === 'ios') {
                setShowIOSModal(true);
            } else {
                // On Android/Desktop, whether accepted, dismissed, or unavailable,
                // close the floating prompt cleanly so it never gets stuck.
                dismissBanner();
            }
        } catch {
            dismissBanner();
        } finally {
            setIsPrompting(false);
        }
    };

    const handleDismissClick = (evt: React.MouseEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        dismissBanner();
    };

    const handleCloseIOSModal = (evt?: React.MouseEvent) => {
        if (evt) {
            evt.preventDefault();
            evt.stopPropagation();
        }
        setShowIOSModal(false);
    };

    const handleFinishIOSModal = (evt: React.MouseEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        dismissBanner();
    };

    if ((!supportsPWA || isDismissed || isBusyRoute) && !showIOSModal) {
        return null;
    }

    const iosModalNode =
        showIOSModal && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={tx('Install on iOS', 'التثبيت على iOS')}
                      className="app-dialog-overlay pointer-events-auto fixed inset-0 z-[10050] flex items-center justify-center p-4"
                      onClick={() => handleCloseIOSModal()}
                  >
                      <div
                          className="modal-backdrop absolute inset-0 bg-black/70"
                          aria-hidden="true"
                          onClick={() => handleCloseIOSModal()}
                      />
                      <div
                          className={`app-dialog-panel app-dialog-panel--padded relative z-10 rounded-3xl p-5 sm:p-6 max-w-sm w-full ${
                              isBento
                                  ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0_#000]'
                                  : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_12px_0_#050504]'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                      >
                          <div className="flex items-center justify-between gap-2 mb-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                      className={`p-2 rounded-xl shrink-0 ${
                                          isBento
                                              ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                              : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                                      }`}
                                  >
                                      <Download className="w-5 h-5" />
                                  </div>
                                  <h3
                                      className={`font-black text-base truncate ${
                                          isBento ? 'text-black' : 'text-[#f5f3ec]'
                                      }`}
                                  >
                                      {tx('Install on iOS', 'التثبيت على iOS')}
                                  </h3>
                              </div>
                              <button
                                  type="button"
                                  onClick={handleCloseIOSModal}
                                  aria-label={tx('Close', 'إغلاق')}
                                  className={`btn-unstyled min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl cursor-pointer shrink-0 transition-colors ${
                                      isBento
                                          ? 'bg-white hover:bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                          : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                                  }`}
                              >
                                  <X className="w-4 h-4 stroke-[2.5]" />
                              </button>
                          </div>

                          <div
                              className={`space-y-2.5 text-xs ${
                                  isBento ? 'text-black' : 'text-[#d6d0c7]'
                              }`}
                          >
                              <div
                                  className={`flex items-start gap-3 p-3 rounded-2xl ${
                                      isBento
                                          ? 'bg-[#faf8f2] border-2 border-black'
                                          : 'bg-[#0e0d0b] border border-[#2e2924]'
                                  }`}
                              >
                                  <span
                                      className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                          isBento
                                              ? 'bg-[#bef264] text-black border-2 border-black'
                                              : 'bg-[#bef264] text-[#0a0908]'
                                      }`}
                                  >
                                      1
                                  </span>
                                  <p className="pt-0.5 font-semibold leading-relaxed">
                                      {tx('Tap the Share button', 'اضغط على زرار المشاركة')}{' '}
                                      <Share
                                          className={`w-3.5 h-3.5 inline align-text-bottom ${
                                              isBento ? 'text-black' : 'text-[#fde047]'
                                          }`}
                                      />{' '}
                                      {tx("in Safari's bottom toolbar.", 'في شريط Safari تحت.')}
                                  </p>
                              </div>

                              <div
                                  className={`flex items-start gap-3 p-3 rounded-2xl ${
                                      isBento
                                          ? 'bg-[#faf8f2] border-2 border-black'
                                          : 'bg-[#0e0d0b] border border-[#2e2924]'
                                  }`}
                              >
                                  <span
                                      className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                          isBento
                                              ? 'bg-[#bae6fd] text-black border-2 border-black'
                                              : 'bg-[#bae6fd] text-[#0a0908]'
                                      }`}
                                  >
                                      2
                                  </span>
                                  <p className="pt-0.5 font-semibold leading-relaxed">
                                      {tx('Scroll down and tap Add to Home Screen', 'انزل لتحت واضغط إضافة للشاشة الرئيسية')}{' '}
                                      <PlusSquare
                                          className={`w-3.5 h-3.5 inline align-text-bottom ${
                                              isBento ? 'text-black' : 'text-[#bae6fd]'
                                          }`}
                                      />
                                      .
                                  </p>
                              </div>

                              <div
                                  className={`flex items-start gap-3 p-3 rounded-2xl ${
                                      isBento
                                          ? 'bg-[#faf8f2] border-2 border-black'
                                          : 'bg-[#0e0d0b] border border-[#2e2924]'
                                  }`}
                              >
                                  <span
                                      className={`w-6 h-6 rounded-full font-black flex items-center justify-center shrink-0 text-xs ${
                                          isBento
                                              ? 'bg-[#fde047] text-black border-2 border-black'
                                              : 'bg-[#fde047] text-[#0a0908]'
                                      }`}
                                  >
                                      3
                                  </span>
                                  <p className="pt-0.5 font-semibold leading-relaxed">
                                      {tx(
                                          'Tap Add in the top right corner to install Future Robins!',
                                          'اضغط إضافة (Add) فوق لتثبيت فيوتشر روبينز!'
                                      )}
                                  </p>
                              </div>
                          </div>

                          <button
                              type="button"
                              onClick={handleFinishIOSModal}
                              className={`btn-unstyled w-full mt-5 min-h-[42px] py-2.5 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer transition-all active:translate-y-0.5 ${
                                  isBento
                                      ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0_#000]'
                                      : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                              }`}
                          >
                              {tx('Got It', 'فهمت')}
                          </button>
                      </div>
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            {/* Floating Install Prompt Banner */}
            {supportsPWA && !isDismissed && !isBusyRoute && (
                <aside
                    aria-label={tx('Install Future Robins App', 'تثبيت تطبيق فيوتشر روبينز')}
                    className={
                        inline
                            ? 'pointer-events-auto w-full sm:w-auto'
                            : 'fixed bottom-20 xl:bottom-6 left-3 right-3 sm:left-auto sm:end-6 z-[80] pb-safe'
                    }
                >
                    <div
                        className={`p-3 sm:p-3.5 rounded-2xl max-w-full sm:max-w-sm flex items-center gap-2.5 sm:gap-3 ${
                            isBento
                                ? 'bg-white text-black border-[3px] border-black shadow-[5px_5px_0_#000]'
                                : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                        }`}
                    >
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                    : 'bg-[#192211] text-[#bef264] border border-[#bef264]/40'
                            }`}
                        >
                            <Download className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div
                                className={`flex items-center gap-1.5 text-xs font-black ${
                                    isBento ? 'text-black' : 'text-[#f5f3ec]'
                                }`}
                            >
                                <span className="truncate">{tx('Install App', 'نزّل التطبيق')}</span>
                                <Sparkles
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                        isBento ? 'text-black' : 'text-[#fde047]'
                                    }`}
                                />
                            </div>
                            <p
                                className={`text-[11px] font-semibold line-clamp-1 ${
                                    isBento ? 'text-black/75' : 'text-[#a8a29e]'
                                }`}
                            >
                                {isIOS
                                    ? tx('Add to Home Screen for best experience', 'ضيفه للشاشة الرئيسية لأفضل تجربة')
                                    : tx('Fast, offline ready & fullscreen', 'سريع، يشتغل أوفلاين، وشاشة كاملة')}
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={handleInstallClick}
                                disabled={isPrompting}
                                className={`btn-unstyled min-h-[36px] px-3 sm:px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                                    isBento
                                        ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                }`}
                            >
                                {tx('Install', 'تثبيت')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDismissClick}
                                className={`btn-unstyled min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white hover:bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0_#000]'
                                        : 'bg-[#1c1917] hover:bg-[#24201c] text-[#a8a29e] hover:text-[#f5f3ec] border border-[#2e2924]'
                                }`}
                                aria-label={tx('Dismiss install banner', 'إغلاق إشعار التثبيت')}
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* iOS Instructions Modal (Portaled to document.body outside pointer-events-none wrappers) */}
            {iosModalNode}
        </>
    );
};

export default InstallPWA;
