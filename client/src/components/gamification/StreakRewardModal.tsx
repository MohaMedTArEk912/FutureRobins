import React, { useState } from 'react';
import { Flame, Check } from 'lucide-react';
import Modal from '../common/Modal';
import { BoltSvg, BulbSvg, CoinSvg, FlameSvg, GiftSvg, HourglassSvg } from '../common/BrandIcons';
import { MysteryLootBox, type LootReward } from './MysteryLootBox';
import { sounds } from '../../lib/soundEffects';
import { api } from '../../lib/api';
import type { UserData } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface StreakRewardModalProps {
    isOpen: boolean;
    user: UserData;
    onClose: () => void;
    onClaimStreak: (rewards: { coins?: number; xp?: number; powerUp?: string }) => void;
}

const STREAK_DAYS = [
    { day: 1, label: '+25 Coins', icon: <CoinSvg className="w-7 h-7" />, coins: 25, xp: 0 },
    { day: 2, label: '+50 Coins & 50 XP', icon: <BoltSvg className="w-7 h-7" />, coins: 50, xp: 50 },
    { day: 3, label: '1x Hint Power-Up', icon: <BulbSvg className="w-7 h-7" />, coins: 30, powerUp: 'hint' },
    { day: 4, label: '+100 Coins & 100 XP', icon: <CoinSvg className="w-7 h-7" />, coins: 100, xp: 100 },
    { day: 5, label: '1x Time Freeze', icon: <HourglassSvg className="w-7 h-7" />, coins: 50, powerUp: 'time_freeze' },
    { day: 6, label: '+150 Coins & 250 XP', icon: <FlameSvg className="w-7 h-7" />, coins: 150, xp: 250 },
    { day: 7, label: 'Mystery Loot Box', icon: <GiftSvg className="w-7 h-7" />, isLootBox: true }
];

export const StreakRewardModal: React.FC<StreakRewardModalProps> = ({
    isOpen,
    user,
    onClose,
    onClaimStreak
}) => {
    const { isBento } = useTheme();
    const [showLootBox, setShowLootBox] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    // Reliable check if claimed today: either from DB field or localStorage
    const isClaimedToday = Boolean((() => {
        const todayStr = new Date().toDateString();
        if (user.lastStreakClaimDate && new Date(user.lastStreakClaimDate).toDateString() === todayStr) {
            return true;
        }
        const lastClaimedLocal = localStorage.getItem(`streak_claimed_${user.userId}`);
        if (lastClaimedLocal && new Date(lastClaimedLocal).toDateString() === todayStr) {
            return true;
        }
        return false;
    })());

    if (!isOpen) return null;

    const streak = user.streak || 1;
    const currentStreakDay = ((streak - 1) % 7) + 1; // 1 to 7

    const handleClaimToday = async () => {
        if (isClaimedToday || isClaiming) return;

        const dayConfig = STREAK_DAYS[currentStreakDay - 1];
        if (dayConfig.isLootBox) {
            setShowLootBox(true);
            return;
        }

        setIsClaiming(true);
        sounds.playStreak(streak);

        try {
            const res = await api.claimDailyStreak();
            localStorage.setItem(`streak_claimed_${user.userId}`, new Date().toISOString());
            onClaimStreak({
                coins: res.rewards?.coins ?? dayConfig.coins,
                xp: res.rewards?.xp ?? dayConfig.xp,
                powerUp: res.rewards?.powerUp ?? dayConfig.powerUp
            });
        } catch (err) {
            console.warn('Backend streak claim fallback to client state:', err);
            localStorage.setItem(`streak_claimed_${user.userId}`, new Date().toISOString());
            onClaimStreak({
                coins: dayConfig.coins,
                xp: dayConfig.xp,
                powerUp: dayConfig.powerUp
            });
        } finally {
            setIsClaiming(false);
        }
    };

    const handleLootBoxClaim = async (loot: LootReward) => {
        setIsClaiming(true);
        sounds.playStreak(streak);

        try {
            const res = await api.claimDailyStreak();
            localStorage.setItem(`streak_claimed_${user.userId}`, new Date().toISOString());
            setShowLootBox(false);
            onClaimStreak({
                coins: res.rewards?.coins ?? (loot.type === 'coins' ? loot.amount : 50),
                xp: res.rewards?.xp ?? (loot.type === 'xp' ? loot.amount : 100),
                powerUp: res.rewards?.powerUp ?? (loot.type === 'powerup' ? 'hint' : undefined)
            });
        } catch {
            localStorage.setItem(`streak_claimed_${user.userId}`, new Date().toISOString());
            setShowLootBox(false);
            onClaimStreak({
                coins: loot.type === 'coins' ? loot.amount : 50,
                xp: loot.type === 'xp' ? loot.amount : 100,
                powerUp: loot.type === 'powerup' ? 'hint' : undefined
            });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Daily Login Streak Calendar"
                description="Keep your streak alive to unlock escalating rewards and Day 7 Mystery Boxes!"
                maxWidth="max-w-2xl"
                icon={<Flame className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />}
                iconContainerClassName={
                    isBento
                        ? 'bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                        : 'bg-[#fde047]/15 text-[#fde047] border border-[#fde047]/35'
                }
                footer={
                    <div className="flex items-center justify-between gap-3 w-full">
                        <span className={`text-xs font-bold ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            Current Streak: <span className={`font-black ${isBento ? 'text-black' : 'text-[#fde047]'}`}>{streak} Day{streak !== 1 ? 's' : ''}</span>
                        </span>

                        <button
                            type="button"
                            onClick={handleClaimToday}
                            disabled={isClaimedToday || isClaiming}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 ${
                                isBento
                                    ? isClaimedToday
                                        ? 'bg-gray-100 text-gray-500 border-2 border-black/30 cursor-default shadow-none'
                                        : 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                    : isClaimedToday
                                        ? 'bg-[#1c1917] text-[#78716c] border border-[#2e2924] cursor-default'
                                        : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                            }`}
                        >
                            {isClaimedToday ? '✓ Claimed Today' : isClaiming ? 'Claiming...' : 'Claim Day Reward'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-5">
                    {/* Streak Highlight Banner */}
                    <div className={`p-4 rounded-xl flex items-center justify-between ${
                        isBento
                            ? 'bg-[#fff7ed] border-2 border-black shadow-[3px_3px_0px_#000]'
                            : 'bg-[#1e1b13] border border-[#fde047]/35'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg ${
                                isBento
                                    ? 'bg-[#fed7aa] border-2 border-black text-black shadow-[1.5px_1.5px_0px_#000]'
                                    : 'bg-[#fde047]/15 border border-[#fde047]/35 text-[#fde047]'
                            }`}>
                                <FlameSvg className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
                                    isBento ? 'text-black' : 'text-[#f5f3ec]'
                                }`}>
                                    {streak} Day Streak!
                                </h3>
                                <p className={`text-xs font-medium ${
                                    isBento ? 'text-gray-700' : 'text-[#a8a29e]'
                                }`}>
                                    Log in every day to claim all 7 rewards without resetting.
                                </p>
                            </div>
                        </div>

                        <div className="text-right">
                            <span className={`px-2.5 py-1 rounded-md font-black text-[11px] uppercase tracking-wider ${
                                isBento
                                    ? 'bg-black text-[#bef264] border-2 border-black shadow-[1.5px_1.5px_0px_#000]'
                                    : 'bg-[#fde047] text-[#0a0908]'
                            }`}>
                                Day {currentStreakDay} / 7
                            </span>
                        </div>
                    </div>

                    {/* 7-Day Calendar Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {STREAK_DAYS.map((d) => {
                            const isPast = d.day < currentStreakDay;
                            const isToday = d.day === currentStreakDay;

                            return (
                                <div
                                    key={d.day}
                                    className={`p-3 rounded-xl flex flex-col items-center justify-between text-center transition-all min-h-[110px] ${
                                        isToday
                                            ? isBento
                                                ? 'bg-[#fed7aa] border-2 border-black shadow-[3px_3px_0px_#000] z-10 text-black'
                                                : 'bg-[#1e1b13] border-2 border-[#fde047] z-10'
                                            : isPast
                                                ? isBento
                                                    ? 'bg-[#dcfce7] border-2 border-black shadow-[2px_2px_0px_#000] text-black'
                                                    : 'bg-[#171d14] border border-[#bef264]/40'
                                                : isBento
                                                    ? 'bg-white border-2 border-black/40 text-black/70'
                                                    : 'bg-[#1a1714] border border-[#2e2924] opacity-75'
                                    }`}
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                                        isToday
                                            ? isBento ? 'text-black' : 'text-[#fde047]'
                                            : isPast
                                                ? isBento ? 'text-black' : 'text-[#bef264]'
                                                : isBento ? 'text-gray-500' : 'text-[#a8a29e]'
                                    }`}>
                                        Day {d.day}
                                    </span>

                                    <div className="text-3xl my-1.5">{d.icon}</div>

                                    <div className={`text-[10px] font-black leading-tight ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                        {d.label}
                                    </div>

                                    {isPast && (
                                        <div className={`mt-1 flex items-center gap-0.5 text-[9px] font-black uppercase ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                            <Check className="w-2.5 h-2.5" /> Claimed
                                        </div>
                                    )}

                                    {isToday && (
                                        <div className={`mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase ${isBento ? 'text-black' : 'text-[#fde047]'}`}>
                                            {isClaimedToday ? '✓ Done' : <><GiftSvg className="w-3 h-3" /> Today</>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            {/* Mystery Loot Box Modal */}
            {showLootBox && (
                <MysteryLootBox
                    onClaimReward={handleLootBoxClaim}
                    onClose={() => setShowLootBox(false)}
                />
            )}
        </>
    );
};

export default StreakRewardModal;
