import React, { useState, useRef } from 'react';
import {
    X,
    UploadCloud,
    FileArchive,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    FolderKanban
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useTheme } from '../../../context/ThemeContext';

interface ImportRoadBundleModalProps {
    isOpen: boolean;
    onClose: () => void;
    adminId: string;
    onSuccess: () => void;
    onNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
}

interface ImportStats {
    subjectsCreated: number;
    subjectsUpdated: number;
    tracksCreated: number;
    tracksUpdated: number;
    quizzesCreated: number;
    quizzesUpdated: number;
    errors: string[];
}

const ImportRoadBundleModal: React.FC<ImportRoadBundleModalProps> = ({
    isOpen,
    onClose,
    adminId,
    onSuccess,
    onNotification
}) => {
    const { isBento } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [stats, setStats] = useState<ImportStats | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isZipOrJson = file.name.endsWith('.zip') || file.name.endsWith('.json');
            if (!isZipOrJson) {
                onNotification('error', 'Please select a valid .zip or .json bundle file');
                return;
            }
            setSelectedFile(file);
            setStats(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const isZipOrJson = file.name.endsWith('.zip') || file.name.endsWith('.json');
            if (!isZipOrJson) {
                onNotification('error', 'Please drop a valid .zip or .json bundle file');
                return;
            }
            setSelectedFile(file);
            setStats(null);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleImport = async () => {
        if (!selectedFile) {
            onNotification('warning', 'Please select a ZIP or JSON bundle file first');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.importRoadmapBundle(selectedFile, replaceExisting, adminId);
            if (res.success) {
                setStats(res.stats);
                onNotification('success', res.message || 'Import completed successfully!');
                onSuccess();
            } else {
                onNotification('error', res.message || 'Import failed');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to import bundle';
            onNotification('error', msg);
        } finally {
            setIsLoading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const resetModal = () => {
        setSelectedFile(null);
        setStats(null);
        setIsLoading(false);
        onClose();
    };

    return (
        <div className="app-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
                className={`app-dialog-panel app-dialog-panel--structured flex flex-col w-full max-w-xl rounded-2xl overflow-hidden transition-all ${
                    isBento
                        ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                        : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                }`}
            >
                {/* Header */}
                <div
                    className={`app-dialog-header px-6 py-5 flex items-center justify-between border-b ${
                        isBento
                            ? 'bg-[#fef9c3] border-b-[2.5px] border-black'
                            : 'bg-[#1a1714] border-[#2e2924]'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#bef264]/15 text-[#bef264] border border-[#bef264]/35'
                            }`}
                        >
                            <FileArchive className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                Import Roadmap & Quizzes ZIP
                            </h3>
                            <p className={`text-xs ${isBento ? 'text-slate-700 font-semibold' : 'text-[#a8a29e]'}`}>
                                Restore or clone learning roads, roadmap graphs, and quiz questions.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={resetModal}
                        disabled={isLoading}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                        }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="app-dialog-body app-dialog-body-spaced p-6 space-y-5">
                    {/* Success / Result View */}
                    {stats ? (
                        <div className="space-y-4">
                            <div
                                className={`p-4 rounded-2xl flex items-start gap-3.5 ${
                                    isBento
                                        ? 'bg-[#dcfce7] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#171d14] border border-[#bef264]/35 text-[#f5f3ec]'
                                }`}
                            >
                                <CheckCircle2 className={`w-6 h-6 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                <div className="space-y-1">
                                    <h4 className={`text-sm font-black ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                        Import Completed Successfully!
                                    </h4>
                                    <p className={`text-xs ${isBento ? 'text-slate-700 font-semibold' : 'text-[#d6d0c7]'}`}>
                                        All roadmap structures, metadata, and quizzes were processed and applied.
                                    </p>
                                </div>
                            </div>

                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    className={`p-3.5 rounded-2xl ${
                                        isBento
                                            ? 'bg-[#bae6fd] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                            : 'bg-[#1a1714] border border-[#bae6fd]/35 text-[#f5f3ec]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <FolderKanban className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bae6fd]'}`} />
                                        <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#bae6fd]'}`}>
                                            Roads & Tracks
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-xs font-semibold">
                                        <span>Created: <strong>{stats.subjectsCreated}</strong></span>
                                        <span>Updated: <strong>{stats.subjectsUpdated}</strong></span>
                                    </div>
                                </div>

                                <div
                                    className={`p-3.5 rounded-2xl ${
                                        isBento
                                            ? 'bg-[#bef264] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                            : 'bg-[#1a1714] border border-[#bef264]/35 text-[#f5f3ec]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileArchive className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                        <span className={`text-xs font-black uppercase tracking-wider ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                            Quizzes
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-xs font-semibold">
                                        <span>Created: <strong>{stats.quizzesCreated}</strong></span>
                                        <span>Updated: <strong>{stats.quizzesUpdated}</strong></span>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings/Errors if any */}
                            {stats.errors && stats.errors.length > 0 && (
                                <div className={`p-3 rounded-xl text-xs ${
                                    isBento
                                        ? 'bg-[#fef08a] border-2 border-black text-black'
                                        : 'bg-[#1e1b13] border border-[#fde047]/35 text-[#fde047]'
                                }`}>
                                    <div className="flex items-center gap-1.5 font-black mb-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>Notice ({stats.errors.length}):</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                                        {stats.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* File Drag and Drop Zone */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip,.json"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? isBento
                                            ? 'border-black bg-[#bef264]/40 scale-[1.01]'
                                            : 'border-[#bef264] bg-[#bef264]/10 scale-[1.01]'
                                        : isBento
                                            ? 'border-black hover:bg-[#fef9c3] bg-[#f5f3ec]'
                                            : 'border-[#2e2924] bg-[#0e0d0b] hover:border-[#bef264]'
                                }`}
                            >
                                <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#1a1714] border border-[#2e2924] text-[#bef264]'
                                }`}>
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                {selectedFile ? (
                                    <div className="space-y-1">
                                        <div className={`text-sm font-black flex items-center justify-center gap-2 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            <FileArchive className={`w-4 h-4 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                                            <span>{selectedFile.name}</span>
                                        </div>
                                        <p className={`text-xs ${isBento ? 'text-slate-700 font-semibold' : 'text-[#a8a29e]'}`}>
                                            {formatFileSize(selectedFile.size)} • Click or drop to replace
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className={`text-sm font-bold ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            Click to browse or drag and drop your ZIP or JSON bundle
                                        </p>
                                        <p className={`text-xs ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>
                                            Supports .zip archives containing roads/quizzes and consolidated .json packages
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Replace Option Checkbox */}
                            <div
                                className={`p-4 rounded-2xl border transition-all ${
                                    isBento
                                        ? 'bg-[#fef9c3] border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#1a1714] border-[#2e2924]'
                                }`}
                            >
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={replaceExisting}
                                        onChange={(e) => setReplaceExisting(e.target.checked)}
                                        className="mt-1 w-4 h-4 rounded accent-[#bef264] cursor-pointer"
                                    />
                                    <div className="space-y-0.5">
                                        <span className={`text-sm font-black flex items-center gap-1.5 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            Replace / Overwrite Existing Items
                                            <span className={`text-[10px] px-1.5 py-0.5 font-black rounded ${
                                                isBento
                                                    ? 'bg-white text-black border border-black'
                                                    : 'bg-[#fde047]/15 text-[#fde047] border border-[#fde047]/35'
                                            }`}>
                                                Recommended
                                            </span>
                                        </span>
                                        <p className={`text-xs leading-relaxed ${isBento ? 'text-slate-700 font-medium' : 'text-[#a8a29e]'}`}>
                                            If a roadmap or quiz with matching title or ID already exists, its questions, modules, and content will be updated with the imported version. Uncheck to only insert new items.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div
                    className={`app-dialog-footer px-6 py-4 border-t flex items-center justify-end gap-3 ${
                        isBento ? 'border-t-[2.5px] border-black bg-white' : 'border-[#2e2924] bg-[#11100e]'
                    }`}
                >
                    {stats ? (
                        <button
                            onClick={resetModal}
                            className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635]'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                            }`}
                        >
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={resetModal}
                                disabled={isLoading}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000] hover:bg-gray-100'
                                        : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={!selectedFile || isLoading}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                                    isBento
                                        ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635] hover:-translate-y-0.5'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Importing & Replacing...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>Import Package</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportRoadBundleModal;
