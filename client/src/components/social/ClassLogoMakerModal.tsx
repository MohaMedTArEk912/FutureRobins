import { useState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Sparkles,
    Shuffle,
    Upload,
    Link as LinkIcon,
    Check,
    Palette,
    Layers,
    Image as ImageIcon
} from 'lucide-react';
import type { ClanLogo } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { ClanEmblem, CLAN_EMBLEM_ICONS, CLAN_EMBLEM_PRESETS } from './ClassEmblem';

interface ClanLogoMakerModalProps {
    isOpen: boolean;
    onClose: () => void;
    clanName: string;
    clanTag: string;
    initialLogo?: ClanLogo | null;
    onSave: (logo: ClanLogo) => Promise<void> | void;
    inline?: boolean;
    saveWithClass?: boolean;
}

const SHAPES: Array<{ id: NonNullable<ClanLogo['shape']>; label: string; iconShape: string }> = [
    { id: 'rounded', label: 'Rounded', iconShape: 'rounded-xl' },
    { id: 'shield', label: 'Shield', iconShape: 'rounded-b-2xl rounded-t-sm' },
    { id: 'circle', label: 'Circle', iconShape: 'rounded-full' },
    { id: 'hexagon', label: 'Hexagon', iconShape: 'rounded-lg' },
    { id: 'diamond', label: 'Diamond', iconShape: 'rounded-md rotate-45' }
];

const BG_COLORS = [
    { id: '#fde047', label: 'Yellow', value: '#fde047' },
    { id: '#bef264', label: 'Lime', value: '#bef264' },
    { id: '#bae6fd', label: 'Sky', value: '#bae6fd' },
    { id: '#ddd6fe', label: 'Purple', value: '#ddd6fe' },
    { id: '#fed7aa', label: 'Orange', value: '#fed7aa' },
    { id: '#fecdd3', label: 'Rose', value: '#fecdd3' },
    { id: '#a7f3d0', label: 'Emerald', value: '#a7f3d0' },
    { id: '#18181b', label: 'Obsidian', value: '#18181b' },
    { id: '#ffffff', label: 'White', value: '#ffffff' },
    { id: 'linear-gradient(135deg, #f97316, #ec4899)', label: 'Sunset', value: 'linear-gradient(135deg, #f97316, #ec4899)' },
    { id: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', label: 'Cyber', value: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' },
    { id: 'linear-gradient(135deg, #facc15, #f59e0b)', label: 'Gold', value: 'linear-gradient(135deg, #facc15, #f59e0b)' }
];

const ICON_COLORS = [
    { id: '#000000', label: 'Black', value: '#000000' },
    { id: '#ffffff', label: 'White', value: '#ffffff' },
    { id: '#bef264', label: 'Lime', value: '#bef264' },
    { id: '#fde047', label: 'Yellow', value: '#fde047' },
    { id: '#38bdf8', label: 'Sky', value: '#38bdf8' },
    { id: '#ef4444', label: 'Red', value: '#ef4444' }
];

const TABS = [
    { id: 'presets', label: 'Presets', icon: Sparkles },
    { id: 'customizer', label: 'Builder', icon: Layers },
    { id: 'upload', label: 'Image', icon: Upload }
] as const;

const availableIcons = Object.entries(CLAN_EMBLEM_ICONS);
const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
// Leave room for base64 encoding and other class fields within the API's 2 MB request limit.
const maxImageBytes = 1_400_000;

function getImageUrl(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;

    try {
        const url = new URL(trimmed);
        return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : '';
    } catch {
        return '';
    }
}

function ClassEmblemStudio({
    onClose,
    clanName,
    clanTag,
    initialLogo,
    onSave,
    inline = false,
    saveWithClass = false
}: Omit<ClanLogoMakerModalProps, 'isOpen'>) {
    const { isBento } = useTheme();
    const studioId = useId();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('presets');
    const [logo, setLogo] = useState<ClanLogo>(() => ({
        shape: initialLogo?.shape || 'rounded',
        icon: initialLogo?.icon || 'Shield',
        bgColor: initialLogo?.bgColor || '#fde047',
        iconColor: initialLogo?.iconColor || '#000000',
        showTag: initialLogo?.showTag ?? true,
        customUrl: initialLogo?.customUrl || ''
    }));
    const [isSaving, setIsSaving] = useState(false);
    const [isReadingFile, setIsReadingFile] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (saveWithClass) headingRef.current?.focus({ preventScroll: true });
    }, [saveWithClass]);

    useEffect(() => {
        if (inline) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [inline, onClose]);

    const imageUrl = getImageUrl(logo.customUrl || '');
    const isUploadedImage = logo.customUrl?.startsWith('data:image/');
    const isBusy = isSaving || isReadingFile;
    const border = isBento ? 'border-black' : 'border-slate-200 dark:border-white/10';
    const mutedText = isBento ? 'text-slate-700' : 'text-slate-600 dark:text-slate-300';
    const panel = isBento ? 'bg-[#f8fafc]' : 'bg-slate-50 dark:bg-white/[0.04]';
    const primary = isBento
        ? 'border-2 border-black bg-[#bef264] text-black shadow-[2px_2px_0px_#000] hover:bg-lime-300'
        : 'border border-violet-600 bg-violet-600 text-white hover:bg-violet-700';
    const secondary = isBento
        ? 'border-2 border-black bg-white text-black hover:bg-slate-100'
        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10';
    const selected = isBento
        ? 'border-black bg-[#bef264] text-black ring-1 ring-black'
        : 'border-violet-500 bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100';
    const optionButton = 'min-h-11 min-w-0 rounded-lg border cursor-pointer transition-colors';
    const actionButton = 'inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black cursor-pointer disabled:opacity-50';

    const updateLogo = (change: Partial<ClanLogo>) => {
        setLogo(prev => ({ ...prev, customUrl: '', ...change }));
        setError('');
    };

    const handleRandomize = () => {
        const bgColor = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)].value;
        updateLogo({
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)].id,
            icon: availableIcons[Math.floor(Math.random() * availableIcons.length)][0],
            bgColor,
            iconColor: bgColor === '#18181b' ? '#ffffff' : '#000000',
            showTag: true
        });
    };

    const handleFileUpload = (file?: File) => {
        if (!file || isBusy) return;
        if (!imageTypes.includes(file.type)) {
            setError('Choose a PNG, JPG, WebP, or SVG image.');
            return;
        }
        if (file.size > maxImageBytes) {
            setError('Choose an image no larger than 1.4 MB.');
            return;
        }

        setError('');
        setIsReadingFile(true);
        const reader = new FileReader();
        reader.onload = () => updateLogo({ customUrl: String(reader.result) });
        reader.onerror = () => setError('The image could not be read. Try choosing it again.');
        reader.onloadend = () => setIsReadingFile(false);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (logo.customUrl?.trim() && !imageUrl) {
            setActiveTab('upload');
            setError('Enter an image URL that starts with https:// or http://.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            await onSave({ ...logo, customUrl: imageUrl });
            onClose();
        } catch {
            setError('The emblem could not be saved. Try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const card = (
        <section
            aria-labelledby={`${studioId}-heading`}
            role={inline ? undefined : 'dialog'}
            aria-modal={inline ? undefined : true}
            className={`@container/studio relative min-w-0 w-full rounded-2xl ${inline ? '' : 'my-auto max-w-4xl'} ${
                isBento
                    ? 'border-[3px] border-black bg-white text-black shadow-[4px_4px_0px_#000]'
                    : 'border border-slate-200 bg-white text-slate-900 shadow-lg dark:border-white/10 dark:bg-[#121623] dark:text-white'
            }`}
            onClick={e => { if (!inline) e.stopPropagation(); }}
        >
            <header className={`flex min-w-0 items-center gap-3 rounded-t-[inherit] border-b p-3 @sm/studio:p-4 ${border} ${isBento ? 'bg-[#fde047]' : panel}`}>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${secondary}`}>
                    <Palette aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 id={`${studioId}-heading`} ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 font-black tracking-tight @sm/studio:text-lg">
                    Class Emblem Studio
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl ${secondary}`}
                    aria-label="Close studio"
                >
                    <X aria-hidden="true" className="h-5 w-5" />
                </button>
            </header>

            <div className="grid min-w-0 gap-4 p-3 @sm/studio:p-4 @min-[42rem]/studio:grid-cols-[minmax(11rem,1fr)_minmax(0,3fr)] @min-[42rem]/studio:gap-5">
                <div
                    className={`flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border p-3 @min-[42rem]/studio:flex-col @min-[42rem]/studio:flex-nowrap @min-[42rem]/studio:justify-center @min-[42rem]/studio:p-4 @min-[42rem]/studio:text-center ${border} ${panel}`}
                >
                    <div className="shrink-0 p-3 @min-[42rem]/studio:p-4">
                        <ClanEmblem
                            logo={{ ...logo, customUrl: imageUrl }}
                            tag={clanTag}
                            name={clanName}
                            size="lg"
                            className="@min-[42rem]/studio:h-24 @min-[42rem]/studio:w-24"
                        />
                    </div>
                    <div className="min-w-0 flex-[1_1_7rem] space-y-1 @min-[42rem]/studio:w-full @min-[42rem]/studio:flex-none">
                        <p className={`text-xs font-bold ${mutedText}`}>Live preview</p>
                        <p className="wrap-anywhere text-sm font-black">[{clanTag}] {clanName}</p>
                        <p className={`text-xs capitalize ${mutedText}`}>
                            {imageUrl ? 'Custom image' : `${logo.shape} · ${logo.icon}`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRandomize}
                        disabled={isBusy}
                        className={`${actionButton} ${secondary}`}
                    >
                        <Shuffle aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Randomize
                    </button>
                </div>

                <fieldset disabled={isBusy} className="min-w-0 space-y-4">
                    <legend className="sr-only">Emblem options</legend>
                    <div role="group" aria-label="Emblem source" className={`grid grid-cols-3 gap-1 rounded-xl border p-1 ${border} ${panel}`}>
                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={activeTab === id}
                                onClick={() => { setActiveTab(id); setError(''); }}
                                className={`inline-flex min-h-10 min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-lg px-1 py-1.5 text-xs font-black cursor-pointer ${
                                    activeTab !== id
                                        ? mutedText
                                        : isBento
                                            ? 'bg-black text-white'
                                            : 'bg-violet-600 text-white'
                                }`}
                            >
                                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'presets' && (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))] gap-2">
                            {CLAN_EMBLEM_PRESETS.map(preset => {
                                const isCurrent =
                                    !imageUrl &&
                                    logo.icon === preset.logo.icon &&
                                    logo.shape === preset.logo.shape &&
                                    logo.bgColor === preset.logo.bgColor &&
                                    logo.iconColor === preset.logo.iconColor &&
                                    logo.showTag === preset.logo.showTag;

                                return (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        aria-pressed={isCurrent}
                                        onClick={() => updateLogo(preset.logo as ClanLogo)}
                                        className={`${optionButton} flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-center ${isCurrent ? selected : secondary}`}
                                    >
                                        <ClanEmblem logo={preset.logo as ClanLogo} size="xs" />
                                        <span className="wrap-anywhere text-xs font-black">{preset.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'customizer' && (
                        <div className="space-y-4">
                            <div className="space-y-2" role="group" aria-labelledby={`${studioId}-shapes`}>
                                <h4 id={`${studioId}-shapes`} className="text-xs font-black uppercase">Shape</h4>
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,3.6rem),1fr))] gap-2">
                                    {SHAPES.map(shape => {
                                        const isCurrent = logo.shape === shape.id && !imageUrl;
                                        return (
                                            <button
                                                key={shape.id}
                                                type="button"
                                                aria-pressed={isCurrent}
                                                onClick={() => updateLogo({ shape: shape.id })}
                                                className={`${optionButton} flex flex-col items-center gap-1.5 px-1 py-2.5 text-xs font-bold ${isCurrent ? selected : secondary}`}
                                            >
                                                <span aria-hidden="true" className={`h-4 w-4 border-2 border-current ${shape.iconShape}`} />
                                                <span className="wrap-anywhere">{shape.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2" role="group" aria-labelledby={`${studioId}-symbols`}>
                                <h4 id={`${studioId}-symbols`} className="text-xs font-black uppercase">Symbol</h4>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                                    {availableIcons.map(([icon, Icon]) => {
                                        const isCurrent = logo.icon === icon && !imageUrl;
                                        return (
                                            <button
                                                key={icon}
                                                type="button"
                                                title={icon}
                                                aria-label={icon}
                                                aria-pressed={isCurrent}
                                                onClick={() => updateLogo({ icon })}
                                                className={`${optionButton} grid place-items-center ${isCurrent ? selected : secondary}`}
                                            >
                                                <Icon aria-hidden="true" className="h-4 w-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                {([
                                    { key: 'bgColor', label: 'Background color', colors: BG_COLORS },
                                    { key: 'iconColor', label: 'Symbol color', colors: ICON_COLORS }
                                ] as const).map(({ key, label, colors }) => (
                                    <div key={key} className="min-w-0 flex-[1_1_13rem] space-y-2" role="group" aria-label={label}>
                                        <h4 className="text-xs font-black uppercase">{label}</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {colors.map(color => {
                                                const isCurrent = logo[key] === color.value && !imageUrl;
                                                return (
                                                    <button
                                                        key={color.id}
                                                        type="button"
                                                        title={color.label}
                                                        aria-label={color.label}
                                                        aria-pressed={isCurrent}
                                                        onClick={() => updateLogo({ [key]: color.value })}
                                                        style={{ background: color.value }}
                                                        className={`grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-black/30 dark:border-white/30 ${isCurrent ? 'ring-2 ring-current ring-offset-1' : ''}`}
                                                    >
                                                        {isCurrent && (
                                                            <Check aria-hidden="true" className="h-5 w-5 rounded-full bg-black p-0.5 text-white" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-3">
                            <label
                                className={`flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center focus-within:ring-2 focus-within:ring-violet-500 ${border} ${panel}`}
                                onDragOver={event => event.preventDefault()}
                                onDrop={event => {
                                    event.preventDefault();
                                    handleFileUpload(event.dataTransfer.files[0]);
                                }}
                            >
                                <ImageIcon aria-hidden="true" className="h-6 w-6" />
                                <span className="text-sm font-black">{isReadingFile ? 'Reading image...' : 'Choose or drop an image'}</span>
                                <span className={`text-xs ${mutedText}`}>PNG, JPG, WebP, or SVG up to 1.4 MB</span>
                                <input
                                    type="file"
                                    accept={imageTypes.join(',')}
                                    className="sr-only"
                                    onChange={event => {
                                        handleFileUpload(event.currentTarget.files?.[0]);
                                        event.currentTarget.value = '';
                                    }}
                                />
                            </label>

                            <div>
                                <label htmlFor={`${studioId}-url`} className="mb-1 block text-xs font-black uppercase">Image URL</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative min-w-0 flex-[1_1_11rem]">
                                        <LinkIcon aria-hidden="true" className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedText}`} />
                                        <input
                                            id={`${studioId}-url`}
                                            type="text"
                                            inputMode="url"
                                            value={isUploadedImage ? '' : logo.customUrl || ''}
                                            onChange={event => updateLogo({ customUrl: event.target.value })}
                                            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
                                            placeholder="https://example.com/emblem.png"
                                            className={`min-h-10 w-full rounded-xl py-2 pl-9 pr-3 text-sm ${secondary}`}
                                        />
                                    </div>
                                    {logo.customUrl && (
                                        <button type="button" onClick={() => updateLogo({})} className={`${actionButton} ${secondary}`}>
                                            Clear image
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'presets' && (
                        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm font-bold ${border} ${panel}`}>
                            <input
                                type="checkbox"
                                checked={logo.showTag}
                                onChange={event => setLogo(prev => ({ ...prev, showTag: event.target.checked }))}
                                className="h-4 w-4 shrink-0 accent-indigo-600"
                            />
                            Show class tag
                        </label>
                    )}
                </fieldset>
            </div>

            <footer className={`flex flex-wrap items-center justify-end gap-3 rounded-b-[inherit] border-t p-3 @sm/studio:p-4 ${border} ${panel}`}>
                {(error || saveWithClass) && (
                    <p
                        role={error ? 'alert' : undefined}
                        className={`min-w-0 flex-[1_1_14rem] text-xs font-semibold ${error ? 'text-rose-700 dark:text-rose-300' : mutedText}`}
                    >
                        {error || 'Applied emblems are saved with the class.'}
                    </p>
                )}
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={onClose} disabled={isSaving} className={`${actionButton} ${secondary}`}>
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={isBusy} className={`${actionButton} ${primary}`}>
                        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {isSaving ? 'Applying emblem...' : saveWithClass ? 'Apply emblem' : 'Save class emblem'}
                    </button>
                </div>
            </footer>
        </section>
    );

    if (inline) return card;
    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6" onClick={onClose}>
            {card}
        </div>,
        document.body
    );
}

export function ClanLogoMakerModal({ isOpen, ...props }: ClanLogoMakerModalProps) {
    if (!isOpen || (!props.inline && typeof document === 'undefined')) return null;
    return <ClassEmblemStudio {...props} />;
}

export default ClanLogoMakerModal;
