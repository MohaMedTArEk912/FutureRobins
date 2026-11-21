import React, { createContext, useContext } from 'react';

interface PersistentShellContextValue {
    /** True when MainLayout is rendering persistent AmbientBackground, Navbar, Footer, and BottomNav */
    inPersistentShell: boolean;
}

const PersistentShellContext = createContext<PersistentShellContextValue>({
    inPersistentShell: false
});

export const PersistentShellProvider: React.FC<{
    inPersistentShell: boolean;
    children: React.ReactNode;
}> = ({ inPersistentShell, children }) => (
    <PersistentShellContext.Provider value={{ inPersistentShell }}>
        {children}
    </PersistentShellContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const usePersistentShell = () => useContext(PersistentShellContext);
