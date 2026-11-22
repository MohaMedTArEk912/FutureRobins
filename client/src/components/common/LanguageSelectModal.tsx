import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Globe, Check, Sparkles, Languages } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
    ALL_SUPPORTED_LANGUAGES,
    POPULAR_LANGUAGES
} from '../../lib/translationService';

interface LanguageSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLanguage: string;
    onSelectLanguage: (langCode: string) => void;
}

const LanguageSelectModalContent: React.FC<Omit<LanguageSelectModalProps, 'isOpen'>> = ({
    onClose,
    currentLanguage,
    onSelectLanguage
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    const filteredLanguages = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return ALL_SUPPORTED_LANGUAGES;

        return ALL_SUPPORTED_LANGUAGES.filter(
            (lang) =>
                lang.name.toLowerCase().includes(query) ||
                lang.nativeName.toLowerCase().includes(query) ||
                lang.code.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    return (
        <div className="app-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/30 dark:bg-black/45 backdrop-blur-md animate-in fade-in duration-200">
            {/* Backdrop Dismiss */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Card */}
            <div className={`app-dialog-panel app-dialog-panel--structured relative w-full max-w-xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${
                isBento
                    ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                    : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
            }`}>
                {/* Header */}
                <div className={`app-dialog-header p-5 sm:p-6 flex items-center justify-between ${
                    isBento
                        ? 'border-b-[2.5px] border-black bg-[#faf8f1]'
                        : 'border-b border-[#2e2924] bg-[#1a1714]'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#bef264]/15 text-[#bef264] border border-[#bef264]/35'
                        }`}>
                            <Languages className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={`text-base sm:text-lg font-black flex items-center gap-2 ${
                                isBento ? 'text-black' : 'text-[#f5f3ec]'
                            }`}>
                                {tx('Choose Question Language', 'اختار لغة السؤال')}
                            </h3>
                            <p className={`text-xs ${isBento ? 'text-slate-700 font-semibold' : 'text-[#a8a29e]'}`}>
                                {tx('Translate question, options, and explanations into any language', 'ترجم السؤال والاختيارات والشرح لأي لغة')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                        }`}
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar & Reset to Original */}
                <div className={`app-dialog-toolbar p-4 sm:p-5 border-b space-y-3 ${
                    isBento ? 'border-b-2 border-black bg-[#f5f3ec]' : 'border-[#2e2924] bg-[#161411]'
                }`}>
                    <div className="relative">
                        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by language (e.g. Arabic, French, Español, 日本語)..."
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none transition-all ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder-gray-400'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder-[#78716c]'
                            }`}
                        />
                    </div>

                    {/* Reset to Original Button */}
                    <button
                        onClick={() => {
                            onSelectLanguage('original');
                            onClose();
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            currentLanguage === 'original' || !currentLanguage
                                ? isBento
                                    ? 'bg-[#bef264] border-2 border-black text-black shadow-[2px_2px_0px_#000] font-black'
                                    : 'bg-[#bef264]/15 border-[#bef264] text-[#bef264] font-bold'
                                : isBento
                                    ? 'bg-white border-2 border-black text-black hover:bg-[#fef9c3]'
                                    : 'bg-[#1a1714] border-[#2e2924] hover:border-[#443d35] text-[#d6d0c7]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg">✨</span>
                            <div>
                                <div className="text-xs sm:text-sm font-black">Original Language (English)</div>
                                <div className={`text-[10px] ${isBento ? 'text-black/70 font-semibold' : 'text-[#a8a29e]'}`}>View untranslated original text</div>
                            </div>
                        </div>
                        {(currentLanguage === 'original' || !currentLanguage) && (
                            <Check className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                        )}
                    </button>
                </div>

                {/* Content: Language Lists */}
                <div className="app-dialog-body app-dialog-body-spaced flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
                    {/* Popular Languages (when not searching) */}
                    {!searchQuery && (
                        <div>
                            <div className={`text-[11px] font-black uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                                <Sparkles className="w-3 h-3" />
                                <span>Popular Languages</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {POPULAR_LANGUAGES.map((lang) => {
                                    const isSelected = currentLanguage === lang.code;
                                    return (
                                        <button
                                            key={lang.code}
                                            onClick={() => {
                                                onSelectLanguage(lang.code);
                                                onClose();
                                            }}
                                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                                                isSelected
                                                    ? isBento
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-[#bef264] text-[#0a0908] border-[#bef264]'
                                                    : isBento
                                                        ? 'bg-white text-black border-2 border-black hover:bg-[#fef9c3]'
                                                        : 'bg-[#1a1714] border-[#2e2924] hover:border-[#bef264]/60 text-[#f5f3ec]'
                                            }`}
                                        >
                                            <span className="text-xl shrink-0">{lang.flag}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-black truncate">{lang.name}</div>
                                                <div
                                                    className={`text-[10px] truncate ${
                                                        isSelected ? (isBento ? 'text-black/75' : 'text-[#0a0908]/75') : (isBento ? 'text-slate-600' : 'text-[#a8a29e]')
                                                    }`}
                                                >
                                                    {lang.nativeName}
                                                </div>
                                            </div>
                                            {lang.rtl && (
                                                <span
                                                    className={`text-[8px] font-black px-1 py-0.5 rounded uppercase shrink-0 ${
                                                        isSelected
                                                            ? 'bg-black/15 text-current'
                                                            : isBento
                                                                ? 'bg-[#fde047] text-black border border-black'
                                                                : 'bg-[#fde047]/15 text-[#fde047]'
                                                    }`}
                                                >
                                                    RTL
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* All Languages */}
                    <div>
                        <div className={`text-[11px] font-black uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`}>
                            <Globe className="w-3 h-3" />
                            <span>{searchQuery ? `Matching Languages (${filteredLanguages.length})` : 'All Supported Languages (50+)'}</span>
                        </div>

                        {filteredLanguages.length === 0 ? (
                            <div className={`py-8 text-center text-xs ${isBento ? 'text-slate-600 font-bold' : 'text-[#a8a29e]'}`}>
                                No languages found matching "{searchQuery}".
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {filteredLanguages.map((lang) => {
                                    const isSelected = currentLanguage === lang.code;
                                    return (
                                        <button
                                            key={lang.code}
                                            onClick={() => {
                                                onSelectLanguage(lang.code);
                                                onClose();
                                            }}
                                            className={`p-2.5 px-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                                isSelected
                                                    ? isBento
                                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-[#bef264] text-[#0a0908] border-[#bef264]'
                                                    : isBento
                                                        ? 'bg-white text-black border border-black hover:bg-[#fef9c3]'
                                                        : 'bg-[#1a1714] border-[#2e2924] hover:border-[#bef264]/60 text-[#f5f3ec]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="text-xl shrink-0">{lang.flag}</span>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold truncate">
                                                        {lang.name}
                                                    </div>
                                                    <div
                                                        className={`text-[10px] truncate ${
                                                            isSelected ? (isBento ? 'text-black/75' : 'text-[#0a0908]/75') : (isBento ? 'text-slate-600' : 'text-[#a8a29e]')
                                                        }`}
                                                    >
                                                        {lang.nativeName}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {lang.rtl && (
                                                    <span
                                                        className={`text-[8px] font-black px-1 py-0.5 rounded uppercase ${
                                                            isSelected
                                                                ? 'bg-black/15 text-current'
                                                                : isBento
                                                                    ? 'bg-[#fde047] text-black border border-black'
                                                                    : 'bg-[#fde047]/15 text-[#fde047]'
                                                        }`}
                                                    >
                                                        RTL
                                                    </span>
                                                )}
                                                {isSelected && <Check className="w-4 h-4" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className={`app-dialog-footer p-3.5 px-5 border-t flex items-center justify-between text-[11px] ${
                    isBento
                        ? 'bg-white border-t-[2.5px] border-black text-slate-700 font-bold'
                        : 'bg-[#11100e] border-[#2e2924] text-[#a8a29e]'
                }`}>
                    <span>⚡ Instant real-time multi-lingual translation</span>
                    <button
                        onClick={onClose}
                        className={`font-black uppercase tracking-wider px-3 py-1 rounded-lg cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border border-black'
                                : 'text-[#bef264] hover:underline'
                        }`}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export const LanguageSelectModal: React.FC<LanguageSelectModalProps> = ({ isOpen, ...props }) => {
    if (!isOpen) return null;
    return <LanguageSelectModalContent {...props} />;
};
