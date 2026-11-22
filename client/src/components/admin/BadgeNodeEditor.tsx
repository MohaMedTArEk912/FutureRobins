import React, { useState } from 'react';
import type { BadgeNode, BadgeCriteria } from '../../types';
import { Plus, Trash2, Save, Sparkles, ChevronDown } from 'lucide-react';
import Modal from '../common/Modal';
import { BADGE_CRITERIA_TYPES } from '../../constants/badgeDefaults';

import { useTheme } from '../../context/ThemeContext';

interface BadgeNodeEditorProps {
    badge?: BadgeNode;
    onSave: (badge: Partial<BadgeNode>) => void;
    onClose: () => void;
}

const BadgeNodeEditor: React.FC<BadgeNodeEditorProps> = ({ badge, onSave, onClose }) => {
    const { isBento } = useTheme();
    const [formData, setFormData] = useState<Partial<BadgeNode>>({
        badgeId: badge?.badgeId || '',
        name: badge?.name || '',
        title: badge?.title || '',
        category: badge?.category || 'milestones',
        description: badge?.description || '',
        icon: badge?.icon || '🏆',
        rarity: badge?.rarity || 'common',
        color: badge?.color || '#3B82F6',
        unlockCriteria: badge?.unlockCriteria || [],
        rewards: badge?.rewards || { xp: 50, coins: 25, powerUps: [] },
        trees: badge?.trees || []
    });

    const [newCriterion, setNewCriterion] = useState<{
        type: BadgeCriteria['type'];
        threshold: number;
        operator: NonNullable<BadgeCriteria['operator']>;
    }>({
        type: 'total_attempts',
        threshold: 0,
        operator: '>='
    });

    const criteriaTypes = BADGE_CRITERIA_TYPES;

    const handleAddCriterion = () => {
        setFormData({
            ...formData,
            unlockCriteria: [...(formData.unlockCriteria || []), newCriterion]
        });
        setNewCriterion({ type: 'total_attempts', threshold: 0, operator: '>=' });
    };

    const handleRemoveCriterion = (index: number) => {
        setFormData({
            ...formData,
            unlockCriteria: formData.unlockCriteria?.filter((_, i) => i !== index)
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const inputCls = isBento
        ? 'w-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] rounded-xl px-4 py-3 text-black font-bold outline-none transition-all placeholder:text-gray-400'
        : 'w-full bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] rounded-xl px-4 py-3 text-[#f5f3ec] font-bold outline-none transition-all placeholder:text-[#78716c]';

    const labelCls = `text-[10px] font-black uppercase tracking-widest ml-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={badge?.badgeId ? 'Edit Badge' : 'Create Badge'}
            description="Configure achievement parameters"
            maxWidth="max-w-3xl"
            icon={<Sparkles className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
                                : 'bg-[#1c1917] text-[#d6d0c7] border border-[#2e2924] hover:bg-[#24201c]'
                        }`}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="badge-form"
                        className={`flex-[2] py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isBento
                                ? 'bg-[#bef264] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]'
                                : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                        }`}
                    >
                        <Save className="w-4 h-4" />
                        Save Badge
                    </button>
                </>
            }
        >
            <form id="badge-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className={labelCls}>Badge ID</label>
                        <input
                            type="text"
                            value={formData.badgeId}
                            onChange={(e) => setFormData({ ...formData, badgeId: e.target.value })}
                            className={inputCls}
                            required
                            disabled={!!badge}
                            placeholder="e.g. first-step"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelCls}>Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={inputCls}
                            required
                            placeholder="e.g. First Step"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className={labelCls}>Equip Title / Honorific</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className={inputCls}
                            placeholder="e.g. Novice Quizzer"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelCls}>Category</label>
                        <div className="relative">
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className={`${inputCls} appearance-none cursor-pointer`}
                            >
                                <option value="milestones">Milestones</option>
                                <option value="perfection">Perfection</option>
                                <option value="streaks">Streaks</option>
                                <option value="speed">Speed</option>
                                <option value="xp">XP & Levels</option>
                                <option value="skills">Roadmaps & Skills</option>
                                <option value="social">Clans & Social</option>
                                <option value="arena">Arena & Duels</option>
                                <option value="other">Other</option>
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className={labelCls}>Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className={`${inputCls} min-h-[100px] resize-none`}
                        required
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className={labelCls}>Icon</label>
                        <input
                            type="text"
                            value={formData.icon}
                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                            className={`${inputCls} text-center text-2xl`}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelCls}>Rarity</label>
                        <div className="relative">
                            <select
                                value={formData.rarity}
                                onChange={(e) => setFormData({ ...formData, rarity: e.target.value as BadgeNode['rarity'] })}
                                className={`${inputCls} appearance-none cursor-pointer`}
                            >
                                <option value="common">Common</option>
                                <option value="rare">Rare</option>
                                <option value="epic">Epic</option>
                                <option value="legendary">Legendary</option>
                                <option value="mythic">Mythic</option>
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={labelCls}>Color</label>
                        <div className="relative h-[50px]">
                            <input
                                type="color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className={`w-full h-full rounded-xl cursor-pointer p-0 overflow-hidden ${isBento ? 'border-2 border-black' : 'border border-[#2e2924]'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Rewards */}
                <div className={`rounded-2xl p-5 border space-y-4 ${
                    isBento ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border-[#2e2924]'
                }`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                        <span className="w-2 h-2 rounded-full bg-[#bef264]" />
                        Rewards
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className={`text-[10px] font-black uppercase tracking-widest absolute top-2 right-3 ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>XP</label>
                            <input
                                type="number"
                                value={formData.rewards?.xp}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    rewards: { ...formData.rewards!, xp: parseInt(e.target.value) || 0 }
                                })}
                                className={inputCls}
                                min="0"
                            />
                        </div>

                        <div className="relative">
                            <label className={`text-[10px] font-black uppercase tracking-widest absolute top-2 right-3 ${isBento ? 'text-slate-600' : 'text-[#a8a29e]'}`}>Coins</label>
                            <input
                                type="number"
                                value={formData.rewards?.coins}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    rewards: { ...formData.rewards!, coins: parseInt(e.target.value) || 0 }
                                })}
                                className={inputCls}
                                min="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Unlock Criteria */}
                <div className={`rounded-2xl p-5 border space-y-4 ${
                    isBento ? 'bg-[#f5f3ec] border-2 border-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] border-[#2e2924]'
                }`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                        <span className="w-2 h-2 rounded-full bg-[#fde047]" />
                        Unlock Criteria
                    </h3>

                    {/* Existing Criteria */}
                    <div className="space-y-2">
                        {formData.unlockCriteria?.map((criterion, index) => (
                            <div key={index} className={`flex items-center gap-3 rounded-xl p-3 border ${
                                isBento ? 'bg-white border-2 border-black' : 'bg-[#0e0d0b] border-[#2e2924]'
                            }`}>
                                <span className={`font-bold text-sm flex-1 flex items-center gap-2 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                        isBento ? 'bg-[#bae6fd] text-black border border-black' : 'bg-[#bae6fd]/15 text-[#bae6fd] border border-[#bae6fd]/35'
                                    }`}>
                                        {criteriaTypes.find(t => t.value === criterion.type)?.label || criterion.type}
                                    </span>
                                    {criterion.operator && criterion.threshold !== undefined && (
                                        <span className={`font-mono text-xs ${isBento ? 'text-slate-700' : 'text-[#a8a29e]'}`}>
                                            {criterion.operator} {criterion.threshold}
                                        </span>
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCriterion(index)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                        isBento ? 'text-black hover:bg-[#fecdd3]' : 'text-[#a8a29e] hover:bg-[#fb7185]/15 hover:text-[#fb7185]'
                                    }`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Criterion */}
                    <div className={`rounded-2xl p-4 border border-dashed ${
                        isBento ? 'bg-white border-black' : 'bg-[#141210] border-[#3a342e]'
                    }`}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                            <div className="relative col-span-1">
                                <select
                                    value={newCriterion.type}
                                    onChange={(e) => setNewCriterion({ ...newCriterion, type: e.target.value as BadgeCriteria['type'] })}
                                    className={`w-full rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold appearance-none cursor-pointer outline-none ${
                                        isBento ? 'bg-white text-black border-2 border-black' : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                                    }`}
                                >
                                    {criteriaTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                            </div>

                            <div className="relative">
                                <select
                                    value={newCriterion.operator}
                                    onChange={(e) => setNewCriterion({ ...newCriterion, operator: e.target.value as NonNullable<BadgeCriteria['operator']> })}
                                    className={`w-full rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold appearance-none cursor-pointer outline-none ${
                                        isBento ? 'bg-white text-black border-2 border-black' : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                                    }`}
                                >
                                    <option value=">=">&ge;</option>
                                    <option value=">">&gt;</option>
                                    <option value="=">=</option>
                                    <option value="<">&lt;</option>
                                    <option value="<=">&le;</option>
                                </select>
                                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                            </div>

                            <input
                                type="number"
                                value={newCriterion.threshold}
                                onChange={(e) => setNewCriterion({ ...newCriterion, threshold: parseInt(e.target.value) || 0 })}
                                className={`rounded-xl px-3 py-2.5 text-xs font-bold outline-none ${
                                    isBento ? 'bg-white text-black border-2 border-black' : 'bg-[#0e0d0b] text-[#f5f3ec] border border-[#2e2924]'
                                }`}
                                placeholder="Threshold"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleAddCriterion}
                            className={`w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest cursor-pointer ${
                                isBento
                                    ? 'bg-[#fde047] hover:bg-[#bef264] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                    : 'bg-[#bef264]/15 hover:bg-[#bef264] text-[#bef264] hover:text-[#0a0908] border border-[#bef264]/40'
                            }`}
                        >
                            <Plus className="w-3 h-3" />
                            Add Criterion
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default BadgeNodeEditor;
