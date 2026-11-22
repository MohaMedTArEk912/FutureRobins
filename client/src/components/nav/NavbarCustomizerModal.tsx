import React, { useState } from 'react';
import {
    Sliders,
    X,
    ArrowUp,
    ArrowDown,
    Pin,
    PinOff,
    EyeOff,
    Sparkles,
    RotateCcw,
    Check,
    Layers,
    Smartphone,
    Laptop
} from 'lucide-react';
import { useNavArrangement, NAV_PRESETS, type PresetKey } from '../../context/NavArrangementContext';
import { useTheme } from '../../context/ThemeContext';

export const NavbarCustomizerModal: React.FC = () => {
    const {
        isCustomizerOpen,
        closeCustomizer,
        primaryItems,
        secondaryItems,
        hiddenItems,
        config,
        movePrimaryItem,
        moveSecondaryItem,
        pinToPrimary,
        unpinToSecondary,
        toggleHideItem,
        setSyncWithBottomNav,
        applyPreset,
        resetToDefault
    } = useNavArrangement();

    const { isBento } = useTheme();
    const [activeTab, setActiveTab] = useState<'arrange' | 'presets'>('arrange');

    if (!isCustomizerOpen) return null;

    return (
        <div className="app-dialog-overlay fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="navigation-customizer-title"
                className={`app-dialog-panel app-dialog-panel--structured relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                }`}
            >
                {/* Header */}
                <div className={`app-dialog-header flex items-center justify-between gap-3 border-b ${
                    isBento
                        ? 'bg-[#fde047] border-b-[2.5px] border-black text-black'
                        : 'bg-[#1a1714] border-[#2e2924]'
                }`}>
                    <div className="flex items-center gap-2.5">
                        <div className={`rounded-xl p-2 ${
                            isBento
                                ? 'bg-black text-[#bef264]'
                                : 'bg-[#bef264]/15 text-[#bef264] border border-[#bef264]/35'
                        }`}>
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 id="navigation-customizer-title" className="text-lg font-black tracking-tight">
                                Customize Navigation
                            </h2>
                            <p className={`text-xs font-medium ${isBento ? 'opacity-80' : 'text-[#a8a29e]'}`}>
                                Arrange, reorder, and pin tabs to match your personal workflow
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeCustomizer}
                        className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl transition-all ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100'
                                : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                        }`}
                        aria-label="Close customizer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Subheader Switcher: Arrange Tabs vs Presets */}
                <div className={`app-dialog-toolbar p-3 border-b flex items-center justify-between gap-3 shrink-0 ${
                    isBento ? 'bg-neutral-50 border-b-2 border-black' : 'bg-[#161411] border-[#2e2924]'
                }`}>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('arrange')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'arrange'
                                    ? (isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                    : (isBento ? 'text-gray-700 hover:text-black' : 'text-[#a8a29e] hover:text-[#f5f3ec]')
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Arrange Tabs</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('presets')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'presets'
                                    ? (isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#bef264] text-[#0a0908]')
                                    : (isBento ? 'text-gray-700 hover:text-black' : 'text-[#a8a29e] hover:text-[#f5f3ec]')
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Presets</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={resetToDefault}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer ${
                            isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#fb7185]'
                        }`}
                        title="Restore default navigation order"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Default</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="app-dialog-body app-dialog-body-spaced flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Live Preview of Desktop Navbar */}
                    <div className="space-y-2">
                        <div className={`flex items-center justify-between text-xs font-bold uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            <span className="flex items-center gap-1.5">
                                <Laptop className={`w-3.5 h-3.5 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                Live Navbar Preview
                            </span>
                            <span className="text-[11px] font-semibold opacity-70">
                                {primaryItems.length} Pinned Tabs
                            </span>
                        </div>

                        {/* Rendered Live Preview Pill */}
                        <div className={`p-2.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto custom-scrollbar select-none ${
                            isBento
                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924]'
                        }`}>
                            {primaryItems.map((item, idx) => {
                                const Icon = item.icon;
                                const isFirst = idx === 0;

                                return (
                                    <div
                                        key={item.path}
                                        className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold shrink-0 transition-transform ${
                                            isFirst
                                                ? (isBento ? 'bg-[#bef264] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] font-black' : 'bg-[#bef264] text-[#0a0908] font-black')
                                                : (isBento ? 'bg-neutral-100 text-black border border-black' : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7]')
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{item.shortLabel || item.label}</span>
                                    </div>
                                );
                            })}

                            {/* "More" preview indicator */}
                            <div className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-xs font-bold shrink-0 opacity-85 ${
                                isBento ? 'bg-neutral-200 text-black border border-black' : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e]'
                            }`}>
                                <Sparkles className={`w-3 h-3 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                <span>More ({secondaryItems.length})</span>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'presets' ? (
                        /* Presets Selection View */
                        <div className="space-y-3">
                            <p className={`text-xs font-medium ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                                Select a curated preset layout designed for different play and learning styles:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(Object.entries(NAV_PRESETS) as [PresetKey, typeof NAV_PRESETS[PresetKey]][]).map(([key, preset]) => (
                                    <div
                                        key={key}
                                        onClick={() => applyPreset(key)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer select-none group flex flex-col justify-between ${
                                            isBento
                                                ? 'bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5'
                                                : 'bg-[#1a1714] hover:bg-[#24201c] border-[#2e2924] hover:border-[#bef264]/60'
                                        }`}
                                    >
                                        <div>
                                            <h4 className={`font-black text-sm uppercase tracking-tight mb-1 transition-colors ${isBento ? 'text-black' : 'text-[#f5f3ec] group-hover:text-[#bef264]'}`}>
                                                {preset.title}
                                            </h4>
                                            <p className={`text-xs font-medium leading-relaxed ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                                                {preset.description}
                                            </p>
                                        </div>

                                        <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isBento ? 'border-black/15' : 'border-[#2e2924]'}`}>
                                            <span className="font-bold opacity-75">
                                                {preset.primary.length} Pinned Tabs
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-xl font-black uppercase text-[10px] ${
                                                isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264] text-[#0a0908]'
                                            }`}>
                                                Apply Preset
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Arrange Tabs Interactive List View */
                        <div className="space-y-6">
                            {/* Section 1: Pinned Primary Tabs */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Pin className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                        <h3 className={`font-black text-xs uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            Pinned to Main Navbar ({primaryItems.length} / 7)
                                        </h3>
                                    </div>
                                    <span className={`text-[11px] ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                        Use arrows to reorder
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {primaryItems.map((item, index) => {
                                        const Icon = item.icon;
                                        const isFirst = index === 0;
                                        const isLast = index === primaryItems.length - 1;

                                        return (
                                            <div
                                                key={item.path}
                                                className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                                                    isBento
                                                        ? 'bg-white border-2 border-black shadow-[2px_2px_0px_#000]'
                                                        : 'bg-[#1a1714] border border-[#2e2924]'
                                                }`}
                                            >
                                                {/* Left: Position & Title */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                                        isBento ? 'bg-[#bef264] text-black border border-black' : 'bg-[#bef264] text-[#0a0908]'
                                                    }`}>
                                                        {index + 1}
                                                    </span>

                                                    <div className={`p-2 rounded-xl shrink-0 ${
                                                        isBento ? 'bg-neutral-100 text-black border border-black' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#bef264]'
                                                    }`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h4 className={`font-black text-sm truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                            {item.label}
                                                        </h4>
                                                        <p className={`text-[11px] truncate ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={isFirst}
                                                        onClick={() => movePrimaryItem(index, 'left')}
                                                        className={`p-2 rounded-xl transition-all cursor-pointer disabled:opacity-30 ${
                                                            isBento ? 'hover:bg-neutral-100 text-black' : 'hover:bg-[#24201c] text-[#d6d0c7]'
                                                        }`}
                                                        title="Move Left"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={isLast}
                                                        onClick={() => movePrimaryItem(index, 'right')}
                                                        className={`p-2 rounded-xl transition-all cursor-pointer disabled:opacity-30 ${
                                                            isBento ? 'hover:bg-neutral-100 text-black' : 'hover:bg-[#24201c] text-[#d6d0c7]'
                                                        }`}
                                                        title="Move Right"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => unpinToSecondary(item.path)}
                                                        disabled={primaryItems.length <= 1}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-30 ${
                                                            isBento
                                                                ? 'bg-neutral-100 hover:bg-neutral-200 text-black border border-black'
                                                                : 'bg-[#0e0d0b] border border-[#2e2924] hover:border-[#443d35] text-[#d6d0c7]'
                                                        }`}
                                                        title="Move to 'More' Dropdown"
                                                    >
                                                        <PinOff className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Unpin</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 2: Secondary Tabs (More Menu) */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />
                                        <h3 className={`font-black text-xs uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            More Menu Tabs ({secondaryItems.length})
                                        </h3>
                                    </div>
                                    <span className={`text-[11px] ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                        Shown inside 'More' dropdown
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {secondaryItems.map((item, index) => {
                                        const Icon = item.icon;
                                        const isFirst = index === 0;
                                        const isLast = index === secondaryItems.length - 1;

                                        return (
                                            <div
                                                key={item.path}
                                                className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                                                    isBento
                                                        ? 'bg-neutral-50 border-2 border-black/40'
                                                        : 'bg-[#161411] border border-[#2e2924]'
                                                }`}
                                            >
                                                {/* Left: Icon & Label */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`p-2 rounded-xl shrink-0 ${
                                                        isBento ? 'bg-white text-black border border-black' : 'bg-[#0e0d0b] border border-[#2e2924] text-[#a8a29e]'
                                                    }`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h4 className={`font-black text-sm truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                                            {item.label}
                                                        </h4>
                                                        <p className={`text-[11px] truncate ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={isFirst}
                                                        onClick={() => moveSecondaryItem(index, 'up')}
                                                        className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer ${isBento ? 'hover:bg-black/10 text-black' : 'hover:bg-[#24201c] text-[#d6d0c7]'}`}
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isLast}
                                                        onClick={() => moveSecondaryItem(index, 'down')}
                                                        className={`p-1.5 rounded-lg disabled:opacity-30 cursor-pointer ${isBento ? 'hover:bg-black/10 text-black' : 'hover:bg-[#24201c] text-[#d6d0c7]'}`}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleHideItem(item.path)}
                                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isBento ? 'text-black hover:bg-[#fecdd3]' : 'text-[#a8a29e] hover:bg-[#fb7185]/15 hover:text-[#fb7185]'}`}
                                                        title="Hide tab from navigation"
                                                    >
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => pinToPrimary(item.path)}
                                                        disabled={primaryItems.length >= 7}
                                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                                                            isBento
                                                                ? 'bg-[#bef264] text-black border border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-[#a3e635]'
                                                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908]'
                                                        }`}
                                                        title="Pin to Main Navbar"
                                                    >
                                                        <Pin className="w-3.5 h-3.5" />
                                                        <span>Pin</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 3: Hidden Tabs (if any) */}
                            {hiddenItems.length > 0 && (
                                <div className={`space-y-2.5 pt-2 border-t ${isBento ? 'border-black/15' : 'border-[#2e2924]'}`}>
                                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                        <EyeOff className="w-4 h-4" />
                                        <span>Hidden Tabs ({hiddenItems.length})</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {hiddenItems.map(item => {
                                            const Icon = item.icon;
                                            return (
                                                <div
                                                    key={item.path}
                                                    className={`p-2.5 rounded-xl border border-dashed flex items-center justify-between gap-2 opacity-75 hover:opacity-100 transition-opacity ${
                                                        isBento ? 'border-black/40 bg-white' : 'border-[#2e2924] bg-[#1a1714]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Icon className="w-4 h-4" />
                                                        <span className="text-xs font-bold truncate">{item.label}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleHideItem(item.path)}
                                                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                                                            isBento
                                                                ? 'bg-[#bef264] text-black border border-black'
                                                                : 'bg-[#bef264]/15 text-[#bef264] hover:bg-[#bef264]/25'
                                                        }`}
                                                    >
                                                        Restore
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Mobile Bottom Nav Sync Toggle */}
                            <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${
                                isBento ? 'bg-[#fef9c3] border-2 border-black' : 'bg-[#1a1714] border border-[#2e2924]'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <Smartphone className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                    <div>
                                        <p className={`font-black text-xs uppercase tracking-tight ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            Sync with Mobile Bottom Bar
                                        </p>
                                        <p className={`text-[11px] font-medium ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                                            Mirror your top 4 primary tabs on the mobile bottom bar
                                        </p>
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={config.syncWithBottomNav}
                                    onChange={e => setSyncWithBottomNav(e.target.checked)}
                                    className="w-4 h-4 accent-[#bef264] rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`app-dialog-footer p-4 border-t flex items-center justify-between gap-3 shrink-0 ${
                    isBento ? 'bg-white border-t-[2.5px] border-black' : 'bg-[#11100e] border-[#2e2924]'
                }`}>
                    <span className={`text-xs font-bold ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                        Changes are saved instantly to your profile.
                    </span>

                    <button
                        type="button"
                        onClick={closeCustomizer}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                        }`}
                    >
                        <Check className="w-4 h-4" />
                        <span>Done</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NavbarCustomizerModal;
