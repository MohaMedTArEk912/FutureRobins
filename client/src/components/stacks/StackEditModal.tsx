import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import Modal from '../common/Modal';
import { AVAILABLE_ICONS } from '../../utils/constants';
import { useTheme } from '../../context/ThemeContext';
import * as LucideIcons from 'lucide-react';
import type { Subject } from '../../types';

interface StackEditModalProps {
    isOpen: boolean;
    subject: Subject | null;
    onClose: () => void;
    onSave: (updatedSubject: Subject) => void;
}

const StackEditModal: React.FC<StackEditModalProps> = ({ isOpen, subject, onClose, onSave }) => {
    const { isBento } = useTheme();
    const [editForm, setEditForm] = useState<Subject | null>(null);

    useEffect(() => {
        if (subject) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEditForm({ ...subject });
        }
    }, [subject]);

    if (!editForm) return null;

    const handleSave = () => {
        if (!editForm.title.trim()) return; // internal validation
        onSave(editForm);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Stack"
            description="Update stack details including title, description and icon."
            maxWidth="max-w-md"
            icon={<Edit2 className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />}
            footer={
                <>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-gray-100'
                                : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#a3e635]'
                                : 'bg-[#bef264] text-[#0a0908] hover:bg-[#d2fa8a] shadow-[0_3px_0_#050504]'
                        }`}
                    >
                        Save Changes
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className={`block text-xs font-black uppercase mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Title</label>
                    <input
                        className={`w-full rounded-xl px-4 py-3 focus:outline-none transition-all font-bold ${
                            isBento
                                ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                        }`}
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="e.g. Mathematics"
                    />
                </div>
                <div>
                    <label className={`block text-xs font-black uppercase mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Description</label>
                    <textarea
                        className={`w-full rounded-xl px-4 py-3 focus:outline-none h-24 resize-none transition-all ${
                            isBento
                                ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] focus:border-[#bef264]'
                        }`}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Describe the contents of this stack..."
                    />
                </div>
                <div>
                    <label className={`block text-xs font-black uppercase mb-2 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Icon</label>
                    <div className={`grid grid-cols-6 gap-2 p-3 rounded-xl border max-h-48 overflow-y-auto custom-scrollbar ${
                        isBento ? 'bg-[#f5f3ec] border-2 border-black' : 'bg-[#0e0d0b] border-[#2e2924]'
                    }`}>
                        {AVAILABLE_ICONS.map(iconName => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const IconComp = (LucideIcons as any)[iconName];
                            const isSelected = editForm.icon === iconName;
                            return (
                                <button
                                    key={iconName}
                                    type="button"
                                    onClick={() => setEditForm({ ...editForm, icon: iconName })}
                                    className={`aspect-square flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                                        isSelected
                                            ? isBento
                                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-[#bef264] text-[#0a0908]'
                                            : isBento
                                                ? 'bg-white text-black border border-black/30 hover:border-black'
                                                : 'text-[#a8a29e] hover:bg-[#1c1917] hover:text-[#f5f3ec]'
                                    }`}
                                >
                                    {IconComp ? <IconComp className="w-5 h-5" /> : <div className="w-5 h-5 bg-gray-500/20 rounded" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default StackEditModal;
