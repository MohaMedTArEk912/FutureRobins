import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaUpdateState {
    needRefresh: boolean;
    offlineReady: boolean;
    checking: boolean;
    lastChecked: Date | null;
    registration: ServiceWorkerRegistration | null;
    canInstall: boolean;
    isInstalled: boolean;
    isIOS: boolean;
}

type UpdateListener = (state: PwaUpdateState) => void;

class PwaUpdater {
    private listeners: Set<UpdateListener> = new Set();
    private updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
    private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
    private state: PwaUpdateState = {
        needRefresh: false,
        offlineReady: false,
        checking: false,
        lastChecked: null,
        registration: null,
        canInstall: false,
        isInstalled: false,
        isIOS: false,
    };
    private periodicCheckInterval: number | null = null;
    private initialized = false;

    public init() {
        if (this.initialized || typeof window === 'undefined') return;
        this.initialized = true;

        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        const ua = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;

        this.setState({
            isInstalled: isStandalone,
            isIOS: isIOSDevice,
            canInstall: isIOSDevice && !isStandalone,
        });

        window.addEventListener('beforeinstallprompt', (e: Event) => {
            e.preventDefault();
            this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
            this.setState({ canInstall: true });
        });

        window.addEventListener('appinstalled', () => {
            this.deferredInstallPrompt = null;
            this.setState({ canInstall: false, isInstalled: true });
        });

        if ('serviceWorker' in navigator) {
            const hadController = Boolean(navigator.serviceWorker.controller);
            let refreshing = false;

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!hadController || refreshing) return;

                const path = window.location.pathname;
                const isActiveSession =
                    path.startsWith('/quiz/') ||
                    path.startsWith('/game/vs') ||
                    path.startsWith('/challenge/');

                if (isActiveSession) {
                    this.setState({ needRefresh: true });
                    return;
                }

                const key = 'sw_auto_reload_timestamp';
                const lastReload = sessionStorage.getItem(key);
                const now = Date.now();
                if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                    refreshing = true;
                    sessionStorage.setItem(key, now.toString());
                    window.location.reload();
                }
            });

            this.updateSWFunction = registerSW({
                immediate: true,
                onNeedRefresh: () => {
                    console.log('[PWA] New update available');
                    this.setState({ needRefresh: true });
                },
                onOfflineReady: () => {
                    console.log('[PWA] Ready for offline usage');
                    this.setState({ offlineReady: true });
                },
                onRegistered: (registration) => {
                    if (registration) {
                        this.setState({ registration, lastChecked: new Date() });
                        this.setupUpdateTriggers(registration);
                    }
                },
                onRegisterError: (error) => {
                    console.error('[PWA] Service Worker registration failed:', error);
                }
            });

            this.setupChunkErrorRecovery();
        }
    }

    private setupUpdateTriggers(registration: ServiceWorkerRegistration) {
        // 1. Periodic background check every 20 minutes
        if (this.periodicCheckInterval) {
            window.clearInterval(this.periodicCheckInterval);
        }
        this.periodicCheckInterval = window.setInterval(() => {
            this.checkForUpdates();
        }, 20 * 60 * 1000);

        // 2. Check for updates on tab visibility change / app resume
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkForUpdates();
            }
        });

        // 3. Check for updates on window focus
        window.addEventListener('focus', () => {
            this.checkForUpdates();
        });

        // 4. Check for updates when coming back online
        window.addEventListener('online', () => {
            this.checkForUpdates();
        });

        // 5. Listen for custom service worker state changes
        if (registration) {
            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version installed in background and waiting
                            this.setState({ needRefresh: true });
                        }
                    });
                }
            });
        }
    }

    /**
     * Catches Vite ChunkLoadErrors when old chunk hashes no longer exist after a deploy
     */
    private setupChunkErrorRecovery() {
        const handleChunkError = (errorMsg: string) => {
            const isChunkLoadError = 
                errorMsg.includes('Failed to fetch dynamically imported module') ||
                errorMsg.includes('Loading chunk') ||
                errorMsg.includes('Importing a module script failed');

            if (isChunkLoadError) {
                console.warn('[PWA] Detected missing chunk module. Refreshing to load latest application assets...');
                const key = 'chunk_reload_timestamp';
                const lastReload = sessionStorage.getItem(key);
                const now = Date.now();

                // Prevent infinite reload loops (ensure at least 10s between auto-reloads)
                if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    sessionStorage.setItem(key, now.toString());
                    this.updateApp();
                }
            }
        };

        window.addEventListener('error', (event) => {
            if (event.message) {
                handleChunkError(event.message);
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason?.message || event.reason?.toString() || '';
            handleChunkError(reason);
        });
    }

    public async promptInstall(): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> {
        if (this.state.isInstalled) return 'unavailable';
        if (this.deferredInstallPrompt) {
            await this.deferredInstallPrompt.prompt();
            const { outcome } = await this.deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                this.deferredInstallPrompt = null;
                this.setState({ canInstall: false, isInstalled: true });
            }
            return outcome;
        }
        if (this.state.isIOS) {
            return 'ios';
        }
        return 'unavailable';
    }

    public async checkForUpdates(): Promise<boolean> {
        if (!navigator.onLine) {
            return false;
        }

        let reg = this.state.registration;
        if (!reg && 'serviceWorker' in navigator) {
            try {
                reg = (await navigator.serviceWorker.getRegistration()) || null;
                if (reg) this.setState({ registration: reg });
            } catch {
                // ignore
            }
        }

        if (!reg) {
            this.setState({ lastChecked: new Date() });
            return false;
        }

        try {
            this.setState({ checking: true });
            await reg.update();
            const hasWaiting = Boolean(reg.waiting);
            this.setState({
                checking: false,
                lastChecked: new Date(),
                needRefresh: this.state.needRefresh || hasWaiting,
            });
            return this.state.needRefresh || hasWaiting;
        } catch (err) {
            console.debug('[PWA] Background update check error:', err);
            this.setState({ checking: false, lastChecked: new Date() });
            return false;
        }
    }

    public async updateApp() {
        console.log('[PWA] Updating application and activating latest service worker...');
        if (this.updateSWFunction) {
            await this.updateSWFunction(true);
        } else {
            // Fallback hard reload
            window.location.reload();
        }
    }

    public subscribe(listener: UpdateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getState(): PwaUpdateState {
        return this.state;
    }

    public dismissRefresh() {
        this.setState({ needRefresh: false });
    }

    private setState(partialState: Partial<PwaUpdateState>) {
        this.state = { ...this.state, ...partialState };
        this.listeners.forEach(listener => listener(this.state));
    }
}

export const pwaUpdater = new PwaUpdater();
