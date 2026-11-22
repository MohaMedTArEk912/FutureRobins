import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Upload, FileJson, AlertCircle, Check, Code } from 'lucide-react';
import Modal from '../common/Modal';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { SkillTrack, SkillModule } from '../../types';

interface RoadmapJsonImporterProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: { track?: Partial<SkillTrack>; modules: SkillModule[] }) => Promise<void> | void;
}

const SAMPLE_ROUTER_ASSET = '/samples/roadmap-sample.json';

export const RoadmapJsonImporter: React.FC<RoadmapJsonImporterProps> = ({ isOpen, onClose, onImport }) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [mode, setMode] = useState<'upload' | 'editor'>('upload');
    const [jsonInput, setJsonInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setJsonInput('');
            setError(null);
            setSuccessMsg(null);
            setImporting(false);
            setMode('upload');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && mode === 'editor') {
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
            });
        }
    }, [isOpen, mode]);

    // --- Actions ---

    const handleDownloadSample = () => {
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', SAMPLE_ROUTER_ASSET);
        downloadAnchorNode.setAttribute('download', 'roadmap_sample.json');
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleLoadSampleToEditor = async () => {
        try {
            const res = await fetch(SAMPLE_ROUTER_ASSET);
            if (!res.ok) throw new Error('Failed to fetch sample JSON');
            const data = await res.json();
            setJsonInput(JSON.stringify(data, null, 2));
            setMode('editor');
        } catch {
            setError(tx('Could not load sample roadmap template.', 'مقدرناش نحمّل نموذج الخريطة.'));
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                JSON.parse(content);
                setJsonInput(content);
                setMode('editor');
                setSuccessMsg(tx(`Loaded ${file.name} successfully!`, `تم تحميل ${file.name} بنجاح!`));
                setTimeout(() => setSuccessMsg(null), 3000);
            } catch {
                setError(tx('Failed to parse JSON file. Please check the syntax.', 'فشل قراءة ملف الـ JSON، راجع الصياغة.'));
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const processImport = async () => {
        try {
            if (!jsonInput.trim()) {
                setError(
                    tx(
                        'Please provide JSON content either by uploading a file or writing code.',
                        'ارفع ملف JSON أو اكتب الكود في المحرر الأول.'
                    )
                );
                return;
            }

            const parsed = JSON.parse(jsonInput);

            if (!parsed.modules || !Array.isArray(parsed.modules)) {
                throw new Error('JSON structure invalid: Root must contain a "modules" array.');
            }

            if (parsed.modules.length > 0) {
                const sample = parsed.modules[0];
                if (!sample.moduleId || !sample.title) {
                    throw new Error('Invalid Module: Each module must have "moduleId" and "title".');
                }
            }

            setError(null);
            setImporting(true);

            await Promise.resolve(
                onImport({
                    track: {
                        title: parsed.title,
                        description: parsed.description,
                        icon: parsed.icon
                    },
                    modules: parsed.modules
                })
            );

            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Invalid JSON format';
            setError(message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={tx('Import Roadmap Configuration', 'استيراد إعدادات المسار')}
            description={tx(
                'Create or update your learning path structure instantly',
                'اعمل أو حدّث هيكل مسار التعلم فوراً'
            )}
            icon={<FileJson className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            maxWidth="max-w-6xl"
            bodyClassName={`flex flex-col md:flex-row overflow-hidden p-0 ${
                isBento
                    ? 'bg-[#f5f3ec] text-black'
                    : 'bg-[#0e0d0b] text-[#f5f3ec]'
            }`}
            footer={
                <div className="flex flex-wrap justify-between items-center gap-3 w-full">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadSample}
                            className={`btn-unstyled flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white hover:bg-[#fef9c3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#1c1917] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                            }`}
                        >
                            <Download className="w-4 h-4 shrink-0" />
                            <span>{tx('Sample JSON', 'نموذج JSON')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleLoadSampleToEditor()}
                            className={`btn-unstyled flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bae6fd] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#bae6fd]/12 text-[#bae6fd] hover:bg-[#bae6fd]/20 border border-[#bae6fd]/35'
                            }`}
                        >
                            <Code className="w-4 h-4 shrink-0" />
                            <span>{tx('Load to Editor', 'فتح في المحرر')}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 ms-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`btn-unstyled px-5 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white hover:bg-[#fecdd3] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            {tx('Cancel', 'إلغاء')}
                        </button>
                        <button
                            type="button"
                            onClick={() => void processImport()}
                            disabled={importing || (!jsonInput && mode === 'editor')}
                            className={`btn-unstyled px-7 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504] hover:-translate-y-0.5 active:translate-y-0'
                            }`}
                        >
                            {importing ? tx('Importing...', 'بنستورد...') : tx('Import Changes', 'استيراد التعديلات')}
                        </button>
                    </div>
                </div>
            }
        >
            {/* Sidebar / Tabs */}
            <div
                className={`w-full md:w-64 shrink-0 flex flex-col p-4 gap-2 ${
                    isBento
                        ? 'bg-white border-b-[2.5px] md:border-b-0 md:border-e-[2.5px] border-black text-black'
                        : 'bg-[#141210] border-b md:border-b-0 md:border-e border-[#2e2924]'
                }`}
            >
                <div
                    className={`text-xs font-black uppercase tracking-wider mb-1 px-2 ${
                        isBento ? 'text-black' : 'text-[#a8a29e]'
                    }`}
                >
                    {tx('Import Source', 'مصدر الاستيراد')}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('upload')}
                        className={`btn-unstyled flex items-center gap-3 p-3.5 rounded-xl text-start transition-all duration-200 cursor-pointer ${
                            mode === 'upload'
                                ? isBento
                                    ? 'bg-[#bef264] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                    : 'bg-[#bef264]/15 border border-[#bef264] text-[#bef264]'
                                : isBento
                                  ? 'bg-white hover:bg-[#fef9c3] border-2 border-black/20 text-black'
                                  : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                        }`}
                    >
                        <Upload className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                            <div className="font-bold text-sm">{tx('Upload File', 'رفع ملف')}</div>
                            <div className="text-xs opacity-75 font-medium truncate">
                                {tx('From your computer', 'من جهازك')}
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode('editor')}
                        className={`btn-unstyled flex items-center gap-3 p-3.5 rounded-xl text-start transition-all duration-200 cursor-pointer ${
                            mode === 'editor'
                                ? isBento
                                    ? 'bg-[#bef264] border-2 border-black shadow-[3px_3px_0px_#000] text-black'
                                    : 'bg-[#bef264]/15 border border-[#bef264] text-[#bef264]'
                                : isBento
                                  ? 'bg-white hover:bg-[#fef9c3] border-2 border-black/20 text-black'
                                  : 'bg-[#1a1714] border border-[#2e2924] text-[#a8a29e] hover:text-[#f5f3ec]'
                        }`}
                    >
                        <Code className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                            <div className="font-bold text-sm">{tx('Text Editor', 'محرر الأكواد')}</div>
                            <div className="text-xs opacity-75 font-medium truncate">
                                {tx('Write or paste code', 'اكتب أو الصق الكود')}
                            </div>
                        </div>
                    </button>
                </div>

                <div
                    className={`mt-auto hidden md:block p-4 rounded-xl ${
                        isBento
                            ? 'bg-[#bae6fd] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                            : 'bg-[#1a1714] border border-[#bae6fd]/35'
                    }`}
                >
                    <h4
                        className={`flex items-center gap-2 font-black text-xs mb-1.5 ${
                            isBento ? 'text-black' : 'text-[#bae6fd]'
                        }`}
                    >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {tx('Note', 'ملاحظة')}
                    </h4>
                    <p
                        className={`text-[11px] leading-relaxed font-medium ${
                            isBento ? 'text-black/80' : 'text-[#d6d0c7]'
                        }`}
                    >
                        {tx(
                            'Ensure your JSON follows the schema. Download the sample for a reference structure.',
                            'اتأكد إن ملف الـ JSON ماشي على نفس الهيكل، ونزل النموذج عشان تراجع الشكل المطلوب.'
                        )}
                    </p>
                </div>
            </div>

            {/* Content Area */}
            <div
                className={`flex-1 relative min-h-[320px] md:h-full overflow-hidden ${
                    isBento ? 'bg-[#f5f3ec]' : 'bg-[#0e0d0b]'
                }`}
            >
                {/* Error/Success Messages */}
                {(error || successMsg) && (
                    <div
                        className={`absolute top-4 start-4 end-4 z-20 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2 ${
                            error
                                ? isBento
                                    ? 'bg-[#fecdd3] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#251317] border border-[#fb7185]/45 text-[#fb7185]'
                                : isBento
                                  ? 'bg-[#bef264] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                  : 'bg-[#171d14] border border-[#bef264]/45 text-[#bef264]'
                        }`}
                    >
                        {error ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Check className="w-5 h-5 shrink-0" />}
                        <div className="flex-1 text-sm font-bold">{error || successMsg}</div>
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                setSuccessMsg(null);
                            }}
                            className="btn-unstyled p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                            aria-label={tx('Dismiss message', 'إغلاق الرسالة')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {mode === 'upload' && (
                    <div className="h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-in fade-in duration-300">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`group w-full max-w-lg aspect-video rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 p-6 ${
                                isBento
                                    ? 'bg-white border-[3px] border-dashed border-black hover:bg-[#fef9c3] shadow-[5px_5px_0px_#000]'
                                    : 'bg-[#141210] border-2 border-dashed border-[#2e2924] hover:border-[#bef264]'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <div
                                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-5 transition-colors duration-300 ${
                                    isBento
                                        ? 'bg-[#fde047] border-2 border-black text-black shadow-[3px_3px_0px_#000]'
                                        : 'bg-[#1c1917] border border-[#2e2924] group-hover:border-[#bef264] text-[#bef264]'
                                }`}
                            >
                                <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                            </div>
                            <h3
                                className={`text-lg sm:text-xl font-black transition-colors ${
                                    isBento
                                        ? 'text-black'
                                        : 'text-[#f5f3ec] group-hover:text-[#bef264]'
                                }`}
                            >
                                {tx('Click to upload JSON', 'اضغط لرفع ملف JSON')}
                            </h3>
                            <p
                                className={`mt-2 text-xs sm:text-sm font-semibold ${
                                    isBento ? 'text-slate-700' : 'text-[#a8a29e]'
                                }`}
                            >
                                {tx('or drag and drop file here', 'أو اسحب الملف وحطه هنا')}
                            </p>
                        </div>
                        <p
                            className={`mt-6 text-xs sm:text-sm font-bold ${
                                isBento ? 'text-slate-700' : 'text-[#78716c]'
                            }`}
                        >
                            {tx('Supported formats: .json', 'الصيغ المدعومة: .json')}
                        </p>
                    </div>
                )}

                {mode === 'editor' && (
                    <div className="h-full flex flex-col animate-in fade-in duration-300 p-3 sm:p-4 gap-2">
                        <textarea
                            ref={textareaRef}
                            value={jsonInput}
                            onChange={(e) => {
                                setJsonInput(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder={'{\n  "title": "My Roadmap",\n  "modules": [...]\n}'}
                            className={`flex-1 w-full min-h-[260px] p-4 sm:p-5 font-mono text-sm leading-6 rounded-2xl outline-none resize-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-[#141210] text-[#f5f3ec] border border-[#2e2924] placeholder:text-[#78716c] focus:border-[#bef264]'
                            }`}
                            spellCheck={false}
                            rows={16}
                        />
                        <div
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex justify-between ${
                                isBento
                                    ? 'bg-white border-2 border-black text-black'
                                    : 'bg-[#141210] border border-[#2e2924] text-[#a8a29e]'
                            }`}
                        >
                            <span>{tx('JSON Editor', 'محرر JSON')}</span>
                            <span>
                                {jsonInput.length} {tx('chars', 'حرف')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
