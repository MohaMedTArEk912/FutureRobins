import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Subject } from '../../../types';
import ConfirmDialog from '../../ConfirmDialog';
import { useTheme } from '../../../context/ThemeContext';

interface RoadModalsProps {
    isCreateModalOpen: boolean;
    isEditModalOpen: boolean;
    isDeleteModalOpen: boolean;
    isSubmitting: boolean;
    roadToEdit?: Subject | null;
    roadToDelete?: Subject | null;
    onCreateClose: () => void;
    onEditClose: () => void;
    onDeleteClose: () => void;
    onCreateRoad: (title: string, description: string) => Promise<void>;
    onUpdateRoad: (title: string, description: string) => Promise<void>;
    onDeleteRoad: () => Promise<void>;
}

const RoadModals: React.FC<RoadModalsProps> = ({
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    isSubmitting,
    roadToEdit,
    roadToDelete,
    onCreateClose,
    onEditClose,
    onDeleteClose,
    onCreateRoad,
    onUpdateRoad,
    onDeleteRoad
}) => {
    const { isBento } = useTheme();
    // Form States for Create/Edit
    const [title, setTitle] = useState(roadToEdit?.title || '');
    const [description, setDescription] = useState(roadToEdit?.description || '');

    // Reset form when modal opens
    React.useEffect(() => {
        if (isCreateModalOpen) {
            setTitle('');
            setDescription('');
        }
    }, [isCreateModalOpen]);

    React.useEffect(() => {
        if (isEditModalOpen && roadToEdit) {
            setTitle(roadToEdit.title);
            setDescription(roadToEdit.description || '');
        }
    }, [isEditModalOpen, roadToEdit]);

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onCreateRoad(title, description);
    };

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onUpdateRoad(title, description);
    };

    return (
        <>
            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="app-dialog-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`app-dialog-panel app-dialog-panel--padded rounded-2xl w-full max-w-lg p-8 scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                            : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                    }`}>
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className={`text-2xl font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Create New Road</h3>
                            <button
                                onClick={onCreateClose}
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                        : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                                }`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="space-y-6 relative z-10">
                            <div>
                                <label className={`block text-xs uppercase tracking-wider font-black mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className={`w-full p-4 rounded-xl outline-none transition-all font-bold ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                    placeholder="e.g., Mathematics 101"
                                />
                            </div>
                            <div>
                                <label className={`block text-xs uppercase tracking-wider font-black mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className={`w-full p-4 rounded-xl outline-none transition-all font-medium h-32 resize-none ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                    placeholder="What is this road about?"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onCreateClose}
                                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-gray-100'
                                            : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                    }`}
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Road'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="app-dialog-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`app-dialog-panel app-dialog-panel--padded rounded-2xl w-full max-w-lg p-8 scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden ${
                        isBento
                            ? 'bg-white text-black border-[3px] border-black shadow-[6px_6px_0px_#000]'
                            : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504]'
                    }`}>
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className={`text-2xl font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Edit Road</h3>
                            <button
                                onClick={onEditClose}
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                    isBento
                                        ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#fde047]'
                                        : 'bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                                }`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateSubmit} className="space-y-6 relative z-10">
                            <div>
                                <label className={`block text-xs uppercase tracking-wider font-black mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className={`w-full p-4 rounded-xl outline-none transition-all font-bold ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs uppercase tracking-wider font-black mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className={`w-full p-4 rounded-xl outline-none transition-all font-medium h-32 resize-none ${
                                        isBento
                                            ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                                    }`}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onEditClose}
                                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-gray-100'
                                            : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono'
                                            : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                                    }`}
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={isDeleteModalOpen && !!roadToDelete}
                onCancel={onDeleteClose}
                onConfirm={onDeleteRoad}
                title="Delete Road?"
                message={roadToDelete ? `Are you sure you want to delete "${roadToDelete.title}"? This action cannot be undone and will delete all associated resources.` : ''}
                confirmText="Delete Road"
                cancelText="Cancel"
                type="danger"
                isLoading={isSubmitting}
                showWarningBanner={true}
            />
        </>
    );
};

export default RoadModals;
