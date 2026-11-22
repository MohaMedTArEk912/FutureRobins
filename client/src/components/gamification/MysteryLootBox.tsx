import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../../lib/soundEffects';
import { useTheme } from '../../context/ThemeContext';

export interface LootReward {
    type: 'coins' | 'xp' | 'powerup' | 'badge';
    label: string;
    amount?: number;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface MysteryLootBoxProps {
    onClaimReward: (reward: LootReward) => void;
    onClose: () => void;
}

const POSSIBLE_REWARDS: LootReward[] = [
    { type: 'coins', label: '150 Gold Coins', amount: 150, icon: '🪙', rarity: 'rare' },
    { type: 'xp', label: '300 Bonus XP', amount: 300, icon: '⚡', rarity: 'rare' },
    { type: 'powerup', label: '2x Time Freeze Power-Ups', amount: 2, icon: '⏳', rarity: 'epic' },
    { type: 'coins', label: '500 Mega Gold Coins', amount: 500, icon: '💰', rarity: 'legendary' },
    { type: 'powerup', label: '3x Hint & 50/50 Power-Ups', amount: 3, icon: '💡', rarity: 'legendary' }
];

export const MysteryLootBox: React.FC<MysteryLootBoxProps> = ({
    onClaimReward,
    onClose
}) => {
    const { isBento } = useTheme();
    const [boxState, setBoxState] = useState<'closed' | 'opening' | 'opened'>('closed');
    const [reward, setReward] = useState<LootReward | null>(null);

    const handleOpen = () => {
        if (boxState !== 'closed') return;
        setBoxState('opening');

        sounds.playPowerUp();

        setTimeout(() => {
            const picked = POSSIBLE_REWARDS[Math.floor(Math.random() * POSSIBLE_REWARDS.length)];
            setReward(picked);
            setBoxState('opened');
            sounds.playLootboxOpen();

            confetti({
                particleCount: 120,
                spread: 90,
                origin: { y: 0.6 },
                zIndex: 10060
            });
        }, 1200);
    };

    const handleClaim = () => {
        if (reward) {
            onClaimReward(reward);
        }
        onClose();
    };

    const content = (
        <div className={`app-dialog-overlay fixed inset-0 z-[10050] flex items-center justify-center p-4 animate-in fade-in duration-300 ${
            isBento ? 'bg-black/60 backdrop-blur-sm' : 'bg-[#050504]/85'
        }`}>
            <div className={`app-dialog-panel app-dialog-panel--padded relative w-full max-w-md p-8 text-center overflow-hidden transition-all ${
                isBento
                    ? 'bg-white text-black rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_#000]'
                    : 'bg-[#141210] rounded-2xl border-[1.5px] border-[#2e2924] shadow-[0_8px_0_#050504] text-[#f5f3ec]'
            }`}>
                {boxState === 'closed' && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close Mystery Loot Box"
                        className={`absolute top-3 right-3 z-20 p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isBento ? 'text-black hover:bg-black/10' : 'text-[#a8a29e] hover:text-[#f5f3ec] hover:bg-white/10'
                        }`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                {boxState === 'closed' && (
                    <div className="space-y-6 relative z-10">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isBento
                                ? 'bg-[#fde047] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                        }`}>
                            <Sparkles className="w-3 h-3" />
                            Mythic Streak Reward
                        </div>

                        <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            Mystery Loot Box
                        </h2>
                        <p className={`text-xs ${isBento ? 'text-gray-700 font-bold' : 'text-[#a8a29e] font-medium'}`}>
                            Tap the chest below to crack open your streak rewards!
                        </p>

                        {/* Interactive Chest */}
                        <button
                            type="button"
                            onClick={handleOpen}
                            className="group relative block mx-auto py-6 cursor-pointer focus:outline-none"
                        >
                            {isBento ? (
                                <div className="w-32 h-32 mx-auto rounded-2xl bg-[#bef264] border-[3px] border-black shadow-[6px_6px_0px_#000] flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-transform animate-bounce">
                                    <Gift className="w-16 h-16 text-black" />
                                </div>
                            ) : (
                                <div className="w-32 h-32 mx-auto rounded-2xl bg-[#fde047] p-1 shadow-[0_6px_0_#050504] group-hover:scale-105 group-active:scale-95 transition-transform animate-bounce">
                                    <div className="w-full h-full bg-[#1a1714] rounded-xl flex items-center justify-center border border-[#2e2924]">
                                        <Gift className="w-16 h-16 text-[#fde047]" />
                                    </div>
                                </div>
                            )}
                            <span className={`inline-block mt-4 text-xs font-black uppercase tracking-widest ${
                                isBento ? 'text-black' : 'text-[#fde047] group-hover:text-[#fef08a]'
                            }`}>
                                🎁 Tap to Unlock!
                            </span>
                        </button>
                    </div>
                )}

                {boxState === 'opening' && (
                    <div className="py-12 space-y-6 relative z-10">
                        {isBento ? (
                            <div className="w-32 h-32 mx-auto rounded-2xl bg-[#fde047] border-[3px] border-black shadow-[6px_6px_0px_#000] p-1 animate-spin flex items-center justify-center">
                                <Sparkles className="w-16 h-16 text-black" />
                            </div>
                        ) : (
                            <div className="w-32 h-32 mx-auto rounded-2xl bg-[#fde047] p-1 animate-spin">
                                <div className="w-full h-full bg-[#1a1714] rounded-xl flex items-center justify-center">
                                    <Sparkles className="w-16 h-16 text-[#fde047] animate-pulse" />
                                </div>
                            </div>
                        )}
                        <h3 className={`text-lg font-black uppercase tracking-wider animate-pulse ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            Cracking Mystery Vault...
                        </h3>
                    </div>
                )}

                {boxState === 'opened' && reward && (
                    <div className="space-y-6 relative z-10 animate-in zoom-in duration-300">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isBento
                                ? 'bg-[#bef264] border-2 border-black text-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                        }`}>
                            <Sparkles className="w-3 h-3" />
                            {reward.rarity.toUpperCase()} REWARD UNLOCKED
                        </div>

                        {/* Reward Card */}
                        <div className={`p-6 space-y-3 rounded-2xl ${
                            isBento
                                ? 'bg-[#f5f3ec] border-2 border-black shadow-[4px_4px_0px_#000]'
                                : 'bg-[#1a1714] border border-[#2e2924]'
                        }`}>
                            <div className="text-5xl">{reward.icon}</div>
                            <h3 className={`text-2xl font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                {reward.label}
                            </h3>
                            <p className={`text-xs ${isBento ? 'text-gray-700 font-bold' : 'text-[#a8a29e]'}`}>
                                Added to your student inventory &amp; wallet balance!
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleClaim}
                            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[4px_4px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                            }`}
                        >
                            Claim Reward &amp; Continue
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

export default MysteryLootBox;
