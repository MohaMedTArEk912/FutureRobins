import React, { useState } from 'react';
import {
    Globe,
    ChevronDown,
    RotateCcw,
    Loader2,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import {
    getLanguageByCode,
    POPULAR_LANGUAGES
} from '../../lib/translationService';
import { LanguageSelectModal } from './LanguageSelectModal';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface QuestionTranslatorBarProps {
    currentLanguage: string;
    isTranslating: boolean;
    isTranslated: boolean;
    autoTranslate: boolean;
    onSelectLanguage: (langCode: string) => void;
    onToggleOriginal: () => void;
    onToggleAutoTranslate: () => void;
    className?: string;
}

export const QuestionTranslatorBar: React.FC<QuestionTranslatorBarProps> = ({
    currentLanguage,
    isTranslating,
    isTranslated,
    autoTranslate,
    onSelectLanguage,
    onToggleOriginal,
    onToggleAutoTranslate,
    className = ''
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const selectedLangInfo = getLanguageByCode(currentLanguage);

    return (
        <div
            className={`flex flex-row items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl transition-all ${
                isBento
                    ? 'bg-[#faf8f2] border-2 border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-[#0e0d0b] border border-[#2e2924]'
            } ${className}`}
        >
            {/* Left: Language Selector Button + Quick Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg sm:rounded-xl font-black text-xs transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                        isBento
                            ? isTranslated && currentLanguage !== 'original'
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                : 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                            : isTranslated && currentLanguage !== 'original'
                                ? 'bg-[#bef264] text-[#0a0908]'
                                : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                    }`}
                    title="Change translation language"
                >
                    {isTranslating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Globe className="w-3.5 h-3.5" />
                    )}

                    <span className="truncate max-w-[100px] sm:max-w-[140px]">
                        {currentLanguage && currentLanguage !== 'original'
                            ? `${selectedLangInfo.flag} ${selectedLangInfo.nativeName}`
                            : tx('Translate', 'ترجم')}
                    </span>

                    <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {/* Quick Popular Language Chips (Desktop/Tablet) */}
                <div className="hidden md:flex items-center gap-1 shrink-0">
                    {POPULAR_LANGUAGES.slice(0, 4).map((lang) => {
                        const active = isTranslated && currentLanguage === lang.code;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => onSelectLanguage(lang.code)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    isBento
                                        ? active
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                            : 'bg-white hover:bg-[#fef9c3] text-black border border-black'
                                        : active
                                            ? 'bg-[#bef264] text-[#0a0908] font-black'
                                            : 'bg-[#141210] hover:bg-[#1c1917] text-[#a8a29e] hover:text-[#f5f3ec] border border-[#2e2924]'
                                }`}
                                title={`Translate to ${lang.name}`}
                            >
                                <span className="mr-1">{lang.flag}</span>
                                <span>{lang.nativeName}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right: Original Toggle & Auto-Translate (Always single sleek row!) */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                {currentLanguage && currentLanguage !== 'original' && (
                    <button
                        type="button"
                        onClick={onToggleOriginal}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                            isBento
                                ? 'bg-[#fed7aa] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                : 'bg-[#231e0f] text-[#fde047] border border-[#fde047]/40 hover:bg-[#2d2612]'
                        }`}
                        title={isTranslated ? 'Click to view original text' : 'Click to view translation'}
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isTranslated ? tx('Orig', 'الأصل') : tx('Trans', 'ترجمة')}</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={onToggleAutoTranslate}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                        isBento
                            ? 'text-black font-black hover:bg-black/5'
                            : 'text-[#a8a29e] hover:text-[#f5f3ec] font-bold'
                    }`}
                    title="Automatically translate next questions to this language"
                >
                    {autoTranslate ? (
                        <ToggleRight className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                    ) : (
                        <ToggleLeft className={`w-4 h-4 shrink-0 ${isBento ? 'text-black/45' : 'text-[#57534e]'}`} />
                    )}
                    <span className="sm:hidden text-[10px] font-black uppercase">{tx('Auto', 'تلقائي')}</span>
                    <span className="hidden sm:inline font-bold">{tx('Auto-translate', 'ترجمة تلقائية')}</span>
                </button>
            </div>

            <LanguageSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                currentLanguage={currentLanguage}
                onSelectLanguage={onSelectLanguage}
            />
        </div>
    );
};
