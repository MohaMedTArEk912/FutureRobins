export type MascotGender = 'male' | 'female';

const STORAGE_KEY = 'future_robins_mascot_gender';

export function getStoredMascotGender(): MascotGender {
    try {
        const val = localStorage.getItem(STORAGE_KEY);
        return val === 'female' ? 'female' : 'male';
    } catch {
        return 'male';
    }
}

export function setStoredMascotGender(gender?: string | null): void {
    if (gender !== 'male' && gender !== 'female') return;
    try {
        localStorage.setItem(STORAGE_KEY, gender);
    } catch {
        // Ignore storage errors (e.g. private browsing restrictions)
    }
}
